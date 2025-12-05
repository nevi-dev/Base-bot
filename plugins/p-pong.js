// plugins/p-ping.js
/**
 * Plugin de prueba de latencia (Ping)
 */

// 1. Definiciones de requisitos (Handlers)
export const handler = {
    // El comando será 'p'
    comando: ['p', 'ping'], 
    categoria: ['utilidad'],
    usos: [
        'p',
        'ping'
    ],
    // Comprobaciones
    admin: false,
    grupo: false,
    privado: false, // Funciona en ambos
    registrado: false,
    money: 0,
    vip: false,
    nivel: 0,
    owner: false
};

// 2. Función principal que se ejecuta si todas las comprobaciones pasan
export async function run(sock, mensaje, args) {
    // 1. Capturar el tiempo inicial (antes de procesar y enviar)
    const startTime = Date.now();

    // 2. Enviar el mensaje de respuesta
    const response = await sock.sendMessage(mensaje.key.remoteJid, { 
        text: 'Pong! ⏳' 
    });

    // 3. Capturar el tiempo final y calcular la diferencia
    const endTime = Date.now();
    const latency = endTime - startTime;

    // 4. Editar el mensaje original con la latencia
    await sock.sendMessage(mensaje.key.remoteJid, {
        text: `Pong! 🏓\nTiempo de respuesta: *${latency} ms*`
    }, {
        quoted: mensaje // Responder citando el mensaje 'p'
    });
    
    // Si quisieras editar el mensaje en lugar de enviar uno nuevo, usarías esto:
    /*
    await sock.sendMessage(mensaje.key.remoteJid, {
        text: `Pong! 🏓\nTiempo de respuesta: *${latency} ms*`,
        edit: response.key
    });
    */
}