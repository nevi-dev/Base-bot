// handler.js
const fs = require('fs');
const path = require('path');
const { NOMBRE_BOT, PREFIJOS } = require('./settings');
const chalk = require('chalk');

// Carga de todos los plugins
const plugins = new Map();
function loadPlugins() {
    const pluginDir = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginDir)) fs.mkdirSync(pluginDir);

    fs.readdirSync(pluginDir).forEach(file => {
        if (file.endsWith('.js')) {
            const plugin = require(path.join(pluginDir, file));
            const command = plugin.handler.comando[0];
            plugins.set(command, plugin);
        }
    });
    console.log(chalk.green(`[HANDLER]`) + ` Se cargaron ${plugins.size} plugins.`);
}
loadPlugins();

module.exports = {
    handleMessage: async (sock, msg) => {
        const mensaje = msg.messages[0];
        if (!mensaje.message) return;

        const remoteJid = mensaje.key.remoteJid;
        const texto = (mensaje.message.extendedTextMessage?.text || mensaje.message.conversation || '').trim();
        const hora = new Date(mensaje.messageTimestamp * 1000).toLocaleTimeString();
        
        // 1. Decoración de Consola
        console.log(`\n${chalk.bgCyan.black(` ${NOMBRE_BOT} (${sock.user.id.split(':')[0]}) `)}`);
        console.log(`[TIPO] ${chalk.yellow(Object.keys(mensaje.message)[0])}`);
        console.log(`[HORA] ${hora}`);
        console.log(`[DE]   ${chalk.magenta(remoteJid)}`);
        console.log(`[MSG]  ${texto.slice(0, 50)}${texto.length > 50 ? '...' : ''}`);
        
        const prefix = PREFIJOS.find(p => texto.startsWith(p));
        if (!prefix) return;

        const [comandoNombre, ...args] = texto.slice(prefix.length).split(/\s+/);
        const plugin = plugins.get(comandoNombre.toLowerCase());

        if (!plugin) {
             // Aquí iría la lógica para comandos no encontrados
             return; 
        }

        // 2. Lógica de Comprobación Simplificada (Handler Checks)
        const checks = plugin.handler;

        // Comprobación de Dueño (Owner)
        if (checks.owner && remoteJid.startsWith(checks.OWNER_NUMERO)) {
             // NOTA: La lógica real debe ser más robusta para IDs de WhatsApp.
             return sock.sendMessage(remoteJid, { text: "🚫 Comando solo para desarrolladores." });
        }
        
        // Comprobación de Grupo/Privado simplificada
        const esGrupo = remoteJid.endsWith('@g.us');
        if (checks.grupo && !esGrupo) {
            return sock.sendMessage(remoteJid, { text: "👥 Este comando solo funciona en grupos." });
        }
        if (checks.privado && esGrupo) {
            return sock.sendMessage(remoteJid, { text: "👤 Este comando solo funciona en chat privado." });
        }
        
        // Aquí irían las demás comprobaciones (admin, money, vip, nivel, etc.)

        try {
            await plugin.run(sock, mensaje, args);
        } catch (error) {
            console.error(chalk.bgRed.white(`[ERROR EN PLUGIN ${comandoNombre}]`), error);
            sock.sendMessage(remoteJid, { text: `❌ Hubo un error al ejecutar el comando: ${error.message}` });
        }
    }
};