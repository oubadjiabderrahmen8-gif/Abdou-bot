const mineflayer = require('mineflayer');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 10000; // Render's preferred port

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- GLOBAL STATE ---
let bot = null;
let botStatus = "Offline";
let afkIntervals = [];

let generalLogs = [];
let chatLogs = [];
let afkLogs = [];

function addLog(array, message) {
    const time = new Date().toLocaleTimeString();
    array.unshift(`[${time}] ${message}`);
    if (array.length > 30) array.pop();
}

const afkMessages = [
    "Exploring the area!",
    "Anti-AFK mode active.",
    "Checking out the mathcrafters world.",
    "Still here and moving!",
    "Bot status: Healthy and active.",
    "Loading chunks... please wait."
];

// --- ANTI-AFK SYSTEM ---
function startAntiAfk() {
    stopAntiAfk(); 
    addLog(afkLogs, "Anti-AFK System Started.");

    // 1. Turn camera every 10 seconds
    afkIntervals.push(setInterval(() => {
        if (!bot || !bot.entity) return;
        const yaw = Math.random() * Math.PI * 2;
        bot.look(yaw, 0);
        addLog(afkLogs, "Camera rotated.");
    }, 10000));

    // 2. Random walk every 20 seconds (Walks for 2s)
    afkIntervals.push(setInterval(() => {
        if (!bot || !bot.entity) return;
        const yaw = Math.random() * Math.PI * 2;
        bot.look(yaw, 0);
        bot.setControlState('forward', true);
        addLog(afkLogs, "Walking forward...");
        setTimeout(() => {
            if (bot) bot.setControlState('forward', false);
        }, 2000);
    }, 20000));

    // 3. Jump every 30 seconds
    afkIntervals.push(setInterval(() => {
        if (!bot || !bot.entity) return;
        bot.setControlState('jump', true);
        setTimeout(() => { if (bot) bot.setControlState('jump', false); }, 500);
        addLog(afkLogs, "Jumped.");
    }, 30000));

    // 4. Sneak every 40 seconds
    afkIntervals.push(setInterval(() => {
        if (!bot || !bot.entity) return;
        bot.setControlState('sneak', true);
        setTimeout(() => { if (bot) bot.setControlState('sneak', false); }, 500);
        addLog(afkLogs, "Sneaked.");
    }, 40000));

    // 5. Random chat every 8 minutes
    afkIntervals.push(setInterval(() => {
        if (!bot) return;
        const msg = afkMessages[Math.floor(Math.random() * afkMessages.length)];
        bot.chat(msg);
        addLog(afkLogs, `Sent chat: ${msg}`);
    }, 480000));
}

function stopAntiAfk() {
    afkIntervals.forEach(clearInterval);
    afkIntervals = [];
    if (bot) bot.clearControlStates();
}

// --- BOT INITIALIZATION ---
function initBot() {
    if (bot) {
        bot.quit();
        stopAntiAfk();
    }

    botStatus = "Connecting...";
    addLog(generalLogs, "Connecting to mathcrafters.aternos.me:12030");

    bot = mineflayer.createBot({
        host: 'mathcrafters.aternos.me',
        port: 12030,
        username: 'mhmdazizi',
        version: false // Auto-detect version
    });

    bot.on('spawn', () => {
        botStatus = "Online";
        addLog(generalLogs, "Bot spawned successfully!");
        startAntiAfk();
    });

    bot.on('message', (jsonMsg) => {
        addLog(chatLogs, jsonMsg.toString());
    });

    bot.on('kicked', (reason) => {
        botStatus = "Kicked";
        addLog(generalLogs, `Kicked: ${reason}`);
        stopAntiAfk();
    });

    bot.on('error', (err) => {
        botStatus = "Error";
        addLog(generalLogs, `Error: ${err.message}`);
    });

    bot.on('end', () => {
        botStatus = "Offline";
        addLog(generalLogs, "Disconnected.");
        stopAntiAfk();
    });
}

// --- DASHBOARD API ---
app.get('/api/data', (req, res) => {
    let health = 0, hunger = 0, gamemode = "N/A", pos = "N/A", xp = 0, held = "None";
    let players = [];

    if (bot && bot.entity) {
        health = Math.round(bot.health);
        hunger = Math.round(bot.food);
        gamemode = bot.game.gameMode;
        xp = bot.experience.level;
        pos = `X:${Math.round(bot.entity.position.x)} Y:${Math.round(bot.entity.position.y)} Z:${Math.round(bot.entity.position.z)}`;
        const item = bot.inventory.slots[bot.getEquipmentDestSlot('hand')];
        if (item) held = `${item.name} x${item.count}`;
        players = Object.keys(bot.players);
    }

    res.json({
        name: 'mhmdazizi', status: botStatus, health, hunger, gamemode, pos, xp, held, players,
        generalLogs, chatLogs, afkLogs
    });
});

app.post('/api/action', (req, res) => {
    const { action, chatMessage, logType } = req.body;
    if (action === 'reconnect') initBot();
    if (action === 'sendChat' && bot) bot.chat(chatMessage);
    if (action === 'clearLogs') {
        if (logType === 'chat') chatLogs = [];
        if (logType === 'general') generalLogs = [];
        if (logType === 'afk') afkLogs = [];
    }
    res.sendStatus(200);
});

// --- DASHBOARD UI ---
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>mhmdazizi Dash</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            :root { --bg: #0f0f17; --card: #1c1c27; --text: #e0e0e0; --accent: #7289da; }
            body { font-family: sans-serif; background: var(--bg); color: var(--text); padding: 10px; margin: 0; }
            .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 10px; }
            .card { background: var(--card); padding: 15px; border-radius: 10px; border: 1px solid #333; }
            .log-box { height: 150px; overflow-y: auto; background: #000; padding: 10px; font-family: monospace; font-size: 0.85em; border-radius: 5px; color: #0f0; }
            button { background: var(--accent); color: white; border: none; padding: 8px 12px; border-radius: 5px; cursor: pointer; }
            input { padding: 8px; border-radius: 5px; border: 1px solid #444; background: #222; color: white; width: 70%; }
            .stat { font-size: 1.2em; font-weight: bold; color: var(--accent); }
        </style>
    </head>
    <body>
        <h1>Bot: mhmdazizi <small id="status" style="color:red">Offline</small></h1>
        <div class="grid">
            <div class="card">
                <h3>Stats</h3>
                <p>Health: <span id="health" class="stat">0</span> | Hunger: <span id="hunger" class="stat">0</span></p>
                <p>XP Level: <span id="xp" class="stat">0</span> | Mode: <span id="gamemode" class="stat">N/A</span></p>
                <p>Position: <span id="pos">N/A</span></p>
                <p>Hand: <span id="held">None</span></p>
                <button onclick="doAction('reconnect')">Reconnect Bot</button>
            </div>
            <div class="card">
                <h3>Chat</h3>
                <div id="chatLogs" class="log-box"></div>
                <div style="margin-top:10px">
                    <input type="text" id="chatInput"> <button onclick="sendChat()">Send</button>
                </div>
            </div>
            <div class="card">
                <h3>AFK Activity</h3>
                <div id="afkLogs" class="log-box"></div>
                <button onclick="clearLog('afk')" style="margin-top:5px">Clear</button>
            </div>
            <div class="card">
                <h3>System Logs</h3>
                <div id="generalLogs" class="log-box"></div>
            </div>
        </div>
        <script>
            async function update() {
                const r = await fetch('/api/data');
                const d = await r.json();
                document.getElementById('status').innerText = d.status;
                document.getElementById('status').style.color = d.status === "Online" ? "lime" : "red";
                document.getElementById('health').innerText = d.health;
                document.getElementById('hunger').innerText = d.hunger;
                document.getElementById('xp').innerText = d.xp;
                document.getElementById('gamemode').innerText = d.gamemode;
                document.getElementById('pos').innerText = d.pos;
                document.getElementById('held').innerText = d.held;
                document.getElementById('chatLogs').innerHTML = d.chatLogs.join('<br>');
                document.getElementById('afkLogs').innerHTML = d.afkLogs.join('<br>');
                document.getElementById('generalLogs').innerHTML = d.generalLogs.join('<br>');
            }
            setInterval(update, 2000);
            async function doAction(action) { await fetch('/api/action', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action}) }); }
            async function clearLog(logType) { await fetch('/api/action', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action:'clearLogs', logType}) }); }
            async function sendChat() {
                const i = document.getElementById('chatInput');
                await fetch('/api/action', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action:'sendChat', chatMessage: i.value}) });
                i.value = '';
            }
        </script>
    </body>
    </html>
    `);
});

app.listen(PORT, () => {
    console.log(`Web server on port ${PORT}`);
    initBot();
});
