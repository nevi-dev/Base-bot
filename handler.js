// handler.js

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import settings from './settings.js'; 
import { fileURLToPath } from 'url';

const { NOMBRE_BOT, PREFIJOS, OWNER_NUMERO } = settings;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carga de todos los plugins
const plugins = new Map();
function loadPlugins() {
    const pluginDir = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginDir)) fs.mkdirSync(pluginDir);

    fs.readdirSync(pluginDir).forEach(file => {
        if (file.endsWith('.js')) {
            import(path.join(pluginDir, file)).then(plugin => {
                if (plugin.handler && plugin.handler.comando && plugin.handler.comando[0]) {
                    const command = plugin.handler.comando[0];
                    plugins.set(command, plugin);
                }
            }).catch(error => {
                console.error(chalk.red(`[ERROR AL CARGAR PLUGIN ${file}]`), error);
            });
        }
    });
    console.log(chalk.green(`[HANDLER]`) + ` Se cargaron ${plugins.size} plugins.`);
}
loadPlugins();

export async function handleMessage(sock, msg) {
    const mensaje = msg.messages[0];
    if (!mensaje.message) return;

    const remoteJid = mensaje.key.remoteJid;
    const texto = (mensaje.message.extendedTextMessage?.text || mensaje.message.conversation || '').trim();
    const hora = new Date(mensaje.messageTimestamp * 1000).toLocaleTimeString();
    
    // Identificar al remitente
    const sender = mensaje.key.participant || mensaje.key.remoteJid;
    const senderNumber = sender.split('@')[0];
    const botNumber = sock.user.id.split(':')[0];

    // 1. Decoración de Consola
    console.log(`\n${chalk.bgCyan.black(` ${NOMBRE_BOT} (${botNumber}) `)}`);
    console.log(`[TIPO] ${chalk.yellow(Object.keys(mensaje.message)[0])}`);
    console.log(`[HORA] ${hora}`);
    console.log(`[DE]   ${chalk.magenta(remoteJid)}`);
    console.log(`[MSG]  ${texto.slice(0, 50)}${texto.length > 50 ? '...' : ''}`);

    const prefix = PREFIJOS.find(p => texto.startsWith(p));
    if (!prefix) return;

    const [comandoNombre, ...args] = texto.slice(prefix.length).split(/\s+/);
    const plugin = plugins.get(comandoNombre.toLowerCase());

    if (!plugin) return; 

    // 2. Lógica de Comprobación Básica
    const checks = plugin.handler;
    const esGrupo = remoteJid.endsWith('@g.us');
    
    const isOwner = senderNumber === OWNER_NUMERO;

    // --- Comprobaciones en Orden de Prioridad ---
    
    // 1. Owner
    if (checks.owner && !isOwner) {
         return sock.sendMessage(remoteJid, { text: "🚫 Comando solo para desarrolladores (Owner)." });
    }
    
    // 2. Grupo / Privado
    if (checks.grupo && !esGrupo) {
        return sock.sendMessage(remoteJid, { text: "👥 Este comando solo funciona en grupos." });
    }
    if (checks.privado && esGrupo) {
        return sock.sendMessage(remoteJid, { text: "👤 Este comando solo funciona en chat privado." });
    }
    
    // Las comprobaciones 'admin', 'registrado', 'money', 'vip', 'nivel' 
    // han sido quitadas ya que dependen de una DB externa.

    // --- Ejecución ---
    try {
        await plugin.run(sock, mensaje, args);
    } catch (error) {
        console.error(chalk.bgRed.white(`[ERROR EN PLUGIN ${comandoNombre}]`), error);
        sock.sendMessage(remoteJid, { text: `❌ Hubo un error al ejecutar el comando: ${error.message}` });
    }
}