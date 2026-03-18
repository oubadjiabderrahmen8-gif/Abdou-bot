const mineflayer = require('mineflayer');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- GLOBAL STATE ---
let bot = null;
let botStatus = "Offline";
let afkIntervals = [];
let reconnectTimeout = null;

let generalLogs = [];
let chatLogs = [];
let afkLogs = [];

function addLog(array, message) {
    const time = new Date().toLocaleTimeString();
    array.unshift(`[${time}] ${message}`);
    if (array.length > 40) array.pop();
}

const afkMessages = [
    "ABDOU-PRO is here and active!",
    "Anti-AFK mode: ON. Let's go!",
    "Keeping the Mathcrafters world alive.",
    "Bot status: 100% Operational.",
    "Checking chunks, looking good!",
    "I'm not a ghost, I'm ABDOU-PRO!"
];

// --- ANTI-AFK ENGINE (PERFECTION VERSION) ---
function startAntiAfk() {
    stopAntiAfk(); 
    addLog(afkLogs, "Anti-AFK System initialized.");

    // 1. Precise Camera Rotation (Every 10s)
    afkIntervals.push(setInterval(() => {
        if (!bot || !bot.entity) return;
        bot.look(Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.5);
        addLog(afkLogs, "Rotated view.");
    }, 10000));

    // 2. Controlled Random Walk (Every 20s for 2s duration)
    afkIntervals.push(setInterval(() => {
        if (!bot || !bot.entity) return;
        bot.setControlState('forward', true);
        addLog(afkLogs, "Walking...");
        setTimeout(() => {
            if (bot) {
                bot.setControlState('forward', false);
                addLog(afkLogs, "Stopped walking.");
            }
        }, 2000);
    }, 20000));

    // 3. Jump (Every 30s)
    afkIntervals.push(setInterval(() => {
        if (!bot || !bot.entity) return;
        bot.setControlState('jump', true);
        setTimeout(() => { if (bot) bot.setControlState('jump', false); }, 500);
        addLog(afkLogs, "Jumped.");
    }, 30000));

    // 4. Stealth Sneak (Every 40s)
    afkIntervals.push(setInterval(() => {
        if (!bot || !bot.entity) return;
        bot.setControlState('sneak', true);
        setTimeout(() => { if (bot) bot.setControlState('sneak', false); }, 500);
        addLog(afkLogs, "Sneaked.");
    }, 40000));

    // 5. Smart Chat (Every 8m)
    afkIntervals.push(setInterval(() => {
        if (!bot) return;
        const msg = afkMessages[Math.floor(Math.random() * afkMessages.length)];
        bot.chat(msg);
        addLog(afkLogs, `Chat heartbeat: "${msg}"`);
    }, 480000));
}

function stopAntiAfk() {
    afkIntervals.forEach(clearInterval);
    afkIntervals = [];
    if (bot) bot.clearControlStates();
}

// --- CORE BOT LOGIC WITH AUTO-RECONNECT ---
function initBot() {
    if (bot) {
        bot.quit();
        stopAntiAfk();
    }

    clearTimeout(reconnectTimeout);
    botStatus = "Connecting...";
    addLog(generalLogs, "ABDOU-PRO is attempting to join Mathcrafters...");

    bot = mineflayer.createBot({
        host: 'mathcrafters.aternos.me',
        port: 12030,
        username: 'ABDOU-PRO',
        version: false,
        hideErrors: true
    });

    bot.on('spawn', () => {
        botStatus = "Online";
        addLog(generalLogs, "ABDOU-PRO spawned in-game!");
        startAntiAfk();
    });

    bot.on('message', (jsonMsg) => {
        const str = jsonMsg.toString().trim();
        if (str) addLog(chatLogs, str);
    });

    bot.on('kicked', (reason) => {
        botStatus = "Kicked";
        addLog(generalLogs, `Reason for Kick: ${reason}`);
        handleReconnect();
    });

    bot.on('error', (err) => {
        botStatus = "Error";
        addLog(generalLogs, `Connection Error: ${err.message}`);
        handleReconnect();
    });

    bot.on('end', () => {
        botStatus = "Offline";
        addLog(generalLogs, "Bot disconnected. Triggering auto-reconnect...");
        handleReconnect();
    });
}

function handleReconnect() {
    stopAntiAfk();
    addLog(generalLogs, "Retrying in 15 seconds...");
    clearTimeout(reconnectTimeout);
    reconnectTimeout = setTimeout(initBot, 15000); 
}

// --- DASHBOARD API & UI ---
app.get('/api/data', (req, res) => {
    let stats = { health: 0, food: 0, xp: 0, gm: "N/A", pos: "N/A", held: "Nothing", players: [] };

    if (bot && bot.entity) {
        stats.health = Math.round(bot.health);
        stats.food = Math.round(bot.food);
        stats.xp = bot.experience.level;
        stats.gm = bot.game.gameMode;
        stats.pos = `X: ${Math.round(bot.entity.position.x)}, Y: ${Math.round(bot.entity.position.y)}, Z: ${Math.round(bot.entity.position.z)}`;
        
        const item = bot.inventory.slots[bot.getEquipmentDestSlot('hand')];
        if (item) stats.held = `${item.name} (x${item.count})`;
        stats.players = Object.keys(bot.players);
    }

    res.json({ name: 'ABDOU-PRO', status: botStatus, stats, generalLogs, chatLogs, afkLogs });
});

app.post('/api/action', (req, res) => {
    const { action, msg, type } = req.body;
    if (action === 'reconnect') initBot();
    if (action === 'chat' && bot) bot.chat(msg);
    if (action === 'clear') {
        if (type === 'chat') chatLogs = [];
        if (type === 'gen') generalLogs = [];
        if (type === 'afk') afkLogs = [];
    }
    res.sendStatus(200);
});

app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ABDOU-PRO Control Center</title>
        <style>
            :root { --bg: #0b0e14; --card: #151921; --accent: #00d2ff; --text: #f0f0f0; --dim: #888; }
            body { font-family: 'Segoe UI', system-ui, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 20px; }
            .container { max-width: 1200px; margin: auto; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #222; padding-bottom: 10px; margin-bottom: 20px; }
            .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 15px; }
            .card { background: var(--card); border-radius: 12px; padding: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
            .stat-val { font-size: 1.4em; font-weight: bold; color: var(--accent); }
            .log-box { height: 180px; overflow-y: auto; background: #000; color: #00ff99; padding: 10px; font-family: 'Courier New', monospace; font-size: 0.85em; border-radius: 8px; margin-top: 10px; border: 1px solid #333; }
            button { background: var(--accent); color: #000; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: bold; }
            input { background: #1a1a1a; border: 1px solid #333; color: #fff; padding: 10px; border-radius: 6px; width: 70%; }
            .player-tag { background: #222; padding: 4px 8px; border-radius: 4px; margin: 2px; display: inline-block; font-size: 0.8em; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>ABDOU-PRO Dashboard</h1>
                <div id="statusBadge" style="padding: 8px 15px; border-radius: 20px; font-weight: bold; background: #444;">OFFLINE</div>
            </div>

            <div class="grid">
                <div class="card">
                    <h3>📊 Live Vitals</h3>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                        <div>Health: <span id="hp" class="stat-val">0</span></div>
                        <div>Hunger: <span id="fd" class="stat-val">0</span></div>
                        <div>XP Lvl: <span id="xp" class="stat-val">0</span></div>
                        <div>Mode: <span id="gm" class="stat-val">N/A</span></div>
                    </div>
                    <p style="margin-top:15px;">📍 <span id="pos" style="color:var(--dim)">X: 0, Y: 0, Z: 0</span></p>
                    <p>✋ Hand: <span id="held" style="color:var(--accent)">Nothing</span></p>
                    <button onclick="act('reconnect')">🔄 Force Reconnect</button>
                </div>

                <div class="card">
                    <h3>👥 Online Players</h3>
                    <div id="players" style="margin-top:10px; height: 120px; overflow-y:auto;"></div>
                    <hr style="border:0.5px solid #333; margin:15px 0;">
                    <input type="text" id="chatIn" placeholder="Send a message...">
                    <button onclick="sendMsg()">Send</button>
                </div>

                <div class="card">
                    <h3>💬 Server Chat</h3>
                    <div id="chatLog" class="log-box"></div>
                    <button onclick="cl('chat')" style="margin-top:10px; background:#333; color:#fff">Clear</button>
                </div>

                <div class="card">
                    <h3>🏃 Anti-AFK Activity</h3>
                    <div id="afkLog" class="log-box" style="color:#00d2ff"></div>
                    <button onclick="cl('afk')" style="margin-top:10px; background:#333; color:#fff">Clear</button>
                </div>

                <div class="card">
                    <h3>⚙️ System Logs</h3>
                    <div id="genLog" class="log-box" style="color:#ffcc00"></div>
                </div>
            </div>
        </div>

        <script>
            async function refresh() {
                try {
                    const r = await fetch('/api/data');
                    const d = await r.json();
                    
                    const badge = document.getElementById('statusBadge');
                    badge.innerText = d.status.toUpperCase();
                    badge.style.background = d.status === "Online" ? "#2ecc71" : "#e74c3c";
                    
                    document.getElementById('hp').innerText = d.stats.health;
                    document.getElementById('fd').innerText = d.stats.food;
                    document.getElementById('xp').innerText = d.stats.xp;
                    document.getElementById('gm').innerText = d.stats.gm;
                    document.getElementById('pos').innerText = d.stats.pos;
                    document.getElementById('held').innerText = d.stats.held;

                    document.getElementById('players').innerHTML = d.stats.players.map(p => \`<span class="player-tag">\${p}</span>\`).join('');
                    document.getElementById('chatLog').innerHTML = d.chatLogs.join('<br>');
                    document.getElementById('afkLog').innerHTML = d.afkLogs.join('<br>');
                    document.getElementById('genLog').innerHTML = d.generalLogs.join('<br>');
                } catch(e) {}
            }
            setInterval(refresh, 2000);

            async function act(action) { await fetch('/api/action', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action}) }); }
            async function cl(type) { await fetch('/api/action', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'clear', type}) }); }
            async function sendMsg() {
                const i = document.getElementById('chatIn');
                await fetch('/api/action', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'chat', msg: i.value}) });
                i.value = '';
            }
        </script>
    </body>
    </html>
    `);
});

app.listen(PORT, () => {
    console.log(`ABDOU-PRO Dashboard live on port ${PORT}`);
    initBot();
});
