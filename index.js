// index.js
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    Browsers, 
    isMessage, // <-- CORREGIDO: Usar el nombre de la función exportada (isMessage)
    fetchLatestBaileysVersion 
} = require('@whiskeysockets/baileys');
const { handleMessage } = require('./handler');
const { NOMBRE_BOT, VERSION, LIMPIEZA_TMP_MS } = require('./settings');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const sessionPath = './sessions';
const tmpPath = './tmp';

// 1. Función de Conexión Principal
async function connectToWhatsApp() {
    // 1.1. Inicio de Sesión y archivos
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    
    // 1.2. Configuración de Conexión
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true, // Pide QR en terminal
        browser: [NOMBRE_BOT, 'Ubuntu', VERSION], // Dispositivo Ubuntu y nombre del Bot
        getMessage: async (key) => { return { conversation: 'Hola!' } } // Placeholder
    });
    
    // 1.3. Visualización Inicial (Main)
    console.log(chalk.bgBlue.white(`\n ${NOMBRE_BOT} | V${VERSION} `));
    console.log("---------------------------------------");
    console.log(`🔑 Inicia sesión: ${chalk.yellow("Escanea el QR o usa el Código de Pareo.")}`);
    console.log("---------------------------------------");

    // 1.4. Manejo de Estado de Conexión
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(chalk.red('❌ Conexión cerrada. Intentando reconectar...'), shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log(chalk.green(`\n✅ Sesión iniciada con éxito como ${NOMBRE_BOT}!`));
            iniciarLimpieza();
        }
    });

    // 1.5. Guardar Credenciales
    sock.ev.on('creds.update', saveCreds);

    // 1.6. Manejar Mensajes
    sock.ev.on('messages.upsert', (msg) => handleMessage(sock, msg));
}

// 2. Función de Limpieza
function limpiarArchivos(folderPath) {
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
        return;
    }
    fs.readdir(folderPath, (err, files) => {
        if (err) return console.error(chalk.red(`[LIMPIEZA] Error al leer directorio ${folderPath}:`), err);
        
        for (const file of files) {
            if (file !== 'creds.json' && folderPath !== tmpPath) { // No borrar credenciales
                 fs.unlink(path.join(folderPath, file), (err) => {
                    if (err) console.error(chalk.red(`[LIMPIEZA] Error al borrar ${file}:`), err);
                });
            } else if (folderPath === tmpPath) { // Borrar todo en tmp
                 fs.unlink(path.join(folderPath, file), (err) => {
                    if (err) console.error(chalk.red(`[LIMPIEZA] Error al borrar ${file}:`), err);
                });
            }
        }
        console.log(chalk.blue(`[LIMPIEZA] Directorio ${path.basename(folderPath)} limpiado.`));
    });
}

// 3. Inicialización de Limpieza Periódica
function iniciarLimpieza() {
    // Crea o limpia el directorio tmp al iniciar
    limpiarArchivos(tmpPath); 
    
    // Limpieza periódica (tmp y sessions)
    setInterval(() => {
        limpiarArchivos(tmpPath);
        // limpiarArchivos(sessionPath); // Descomentar para limpiar archivos de sesión no esenciales
    }, LIMPIEZA_TMP_MS); 
}

connectToWhatsApp().catch(err => console.error(chalk.bgRed.white('❌ Error Fatal al conectar:'), err));