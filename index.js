// index.js - Usando ES Modules (Requiere "type": "module" en package.json)
import { 
    default as makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    isJidUser
} from '@whiskeysockets/baileys';
import { handleMessage } from './handler.js';
import { NOMBRE_BOT, VERSION, LIMPIEZA_TMP_MS } from './settings.js';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import qrcode from 'qrcode'; // Necesitarás 'qrcode' para el QR
import readline from 'readline'; // Para interactuar con la consola

const sessionPath = './sessions';
const tmpPath = './tmp';

// Configuración de Readline para la entrada del usuario en la consola
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// --- Funciones Auxiliares (Limpieza) ---

function limpiarArchivos(folderPath) {
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
        return;
    }
    fs.readdir(folderPath, (err, files) => {
        if (err) return console.error(chalk.red(`[LIMPIEZA] Error al leer directorio ${folderPath}:`), err);
        
        for (const file of files) {
            // No borrar creds.json o archivos importantes en sessionPath
            const isCreds = folderPath === sessionPath && file === 'creds.json';
            
            if (!isCreds) {
                 fs.unlink(path.join(folderPath, file), (err) => {
                    if (err) console.error(chalk.red(`[LIMPIEZA] Error al borrar ${file}:`), err);
                });
            }
        }
        console.log(chalk.blue(`[LIMPIEZA] Directorio ${path.basename(folderPath)} limpiado.`));
    });
}

function iniciarLimpieza() {
    limpiarArchivos(tmpPath); 
    // Limpieza periódica (tmp y sessions)
    setInterval(() => {
        limpiarArchivos(tmpPath);
        // Puedes añadir aquí limpiarArchivos(sessionPath); si quieres limpiar credenciales antiguas.
    }, LIMPIEZA_TMP_MS); 
}

// --- Lógica de Conexión Principal ---

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    let usePairingCode = false;
    let phoneNumber = undefined;

    // 1. Visualización Inicial y Selección de Método
    console.log(chalk.bgBlue.white(`\n ${NOMBRE_BOT} | V${VERSION} `));
    console.log("---------------------------------------");
    
    // Si ya existe una sesión, la usamos.
    if (fs.existsSync(path.join(sessionPath, 'creds.json'))) {
        console.log(chalk.yellow(`🔑 Sesión encontrada. Iniciando...`));
    } else {
        // Pedir método de conexión
        console.log(chalk.cyan(`CÓMO DESEAS INICIAR SESIÓN:`));
        console.log(`[1] Código QR (Predeterminado)`);
        console.log(`[2] Código de Pareo (Pairing Code)`);
        
        const answer = await new Promise(resolve => {
            rl.question(chalk.green('Elige una opción (1 o 2): '), resolve);
        });

        if (answer.trim() === '2') {
            usePairingCode = true;
            
            // Pedir el número si elige Código de Pareo
            console.log("---------------------------------------");
            const numberAnswer = await new Promise(resolve => {
                rl.question(chalk.green('📞 Ingresa tu número de WhatsApp (Ej: 57310xxxxxxx): '), resolve);
            });
            phoneNumber = numberAnswer.replace(/[^0-9]/g, '');
            if (!phoneNumber) {
                 console.log(chalk.red('❌ Número no válido. Terminando.'));
                 rl.close();
                 return;
            }
        }
    }
    
    // 2. Configuración de Conexión
    const { version } = await fetchLatestBaileysVersion();
    
    const connectionOptions = {
        logger: pino({ level: "silent" }),
        printQRInTerminal: !usePairingCode, // Solo imprime QR si no usamos Código de Pareo
        auth: { 
            creds: state.creds, 
            keys: makeCacheableSignalKeyStore(state.keys, pino({level: 'silent'})) 
        },
        browser: [NOMBRE_BOT, 'Ubuntu', VERSION], // Dispositivo Ubuntu y nombre del Bot
        version: version,
        getMessage: async (key) => { return { conversation: 'Hola!' } } 
    };

    const sock = makeWASocket(connectionOptions);
    
    // 3. Manejo de Código de Pareo
    if (usePairingCode && phoneNumber) {
        console.log(chalk.yellow('---------------------------------------'));
        console.log(chalk.yellow('⏳ Solicitando Código de Pareo...'));
        let code = await sock.requestPairingCode(phoneNumber);
        
        if (code) {
            code = code.match(/.{1,4}/g)?.join("-");
            console.log(chalk.bgGreen.white(`\n🎁 CÓDIGO DE PAREO: ${code}\n`));
            console.log(`*» PASOS DEL PROTOCOLO:*`);
            console.log(`\`1\` » Toca los tres puntos (Esquina Superior Derecha).`);
            console.log(`\`2\` » Selecciona *Dispositivos Vinculados*.`);
            console.log(`\`3\` » Elige *Vincular con el número de teléfono*.`);
            console.log(`\`4\` » Ingresa el código de 8 dígitos de arriba.`);
            console.log(chalk.yellow('---------------------------------------'));
        }
    }
    
    rl.close(); // Cerrar la interfaz de lectura una vez que la conexión inicia

    // 4. Manejo de Estado de Conexión
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr && !usePairingCode) {
            // Mostrar QR en la consola (ya lo hace Baileys con printQRInTerminal: true)
        }
        
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(chalk.red('❌ Conexión cerrada. Intentando reconectar...'), shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            } else {
                 console.log(chalk.bgRed.white('\n⛔ SESIÓN CERRADA MANUALMENTE. Elimina la carpeta /sessions para volver a iniciar.'));
            }
        } else if (connection === 'open') {
            console.log(chalk.green(`\n✅ Sesión iniciada con éxito como ${NOMBRE_BOT}!`));
            iniciarLimpieza();
        }
    });

    // 5. Guardar Credenciales y Manejar Mensajes
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('messages.upsert', (msg) => handleMessage(sock, msg));
}

connectToWhatsApp().catch(err => console.error(chalk.bgRed.white('❌ Error Fatal al conectar:'), err));