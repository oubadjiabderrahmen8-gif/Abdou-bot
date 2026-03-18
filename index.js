const mineflayer = require('mineflayer');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

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
    if (array.length > 30) array.pop(); // Increased log history slightly
}

// Random messages for the 8-minute timer
const afkMessages = [
    "Just wandering around the area...",
    "Doing my anti-afk stretches.",
    "Keeping these chunks loaded! 🚀",
    "Checking out the scenery.",
    "Bot is still alive and kicking.",
    "Taking a quick look around.",
    "Mining, crafting, and mostly just standing here."
];

// --- ANTI-AFK SYSTEM ---
function startAntiAfk() {
    stopAntiAfk(); 
    addLog(afkLogs, "Anti-AFK Started.");

    // 1. Turn camera once every 10 seconds
    afkIntervals.push(setInterval(() => {
        if (!bot) return;
        const randomYaw = Math.random() * Math.PI * 2; 
        bot.look(randomYaw, 0); // 0 pitch keeps the head level
        addLog(afkLogs, "Looked around");
    }, 10000));

    // 2. Walk in a random direction for 2 seconds once every 20 seconds
    afkIntervals.push(setInterval(() => {
        if (!bot) return;
        const randomYaw = Math.random() * Math.PI * 2;
        bot.look(randomYaw, 0);
        bot.setControlState('forward', true);
        addLog(afkLogs, "Walking forward...");
        
        // Stop walking after 2 seconds
        setTimeout(() => {
            if (bot) bot.setControlState('forward', false);
            addLog(afkLogs, "Stopped walking");
        }, 2000);
    }, 20000));

    // 3. Jump once every 30 seconds
    afkIntervals.push(setInterval(() => {
        if (!bot) return;
        bot.setControlState('jump', true);
        setTimeout(() => { if (bot) bot.setControlState('jump', false); }, 500);
        addLog(afkLogs, "Performed Jump");
    }, 30000));

    // 4. Sneak once every 40 seconds
    afkIntervals.push(setInterval(() => {
        if (!bot) return;
        bot.setControlState('sneak', true);
        setTimeout(() => { if (bot) bot.setControlState('sneak', false); }, 500);
        addLog(afkLogs, "Performed Sneak");
    }, 40000));

    // 5. Send one random chat message every 8 minutes (480,000 ms)
    afkIntervals.push(setInterval(() => {
        if (!bot) return;
        const randomMsg = afkMessages[Math.floor(Math.random() * afkMessages.length)];
        bot.chat(randomMsg);
        addLog(afkLogs, `Sent chat: "${randomMsg}"`);
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
    addLog(generalLogs, "Attempting to connect to mathcrafters.aternos.me...");

    bot = mineflayer.createBot({
        host: 'mathcrafters.aternos.me',
        port: 12030,
        username: 'mhmdazizi',
        version: false
    });

    bot.on('spawn', () => {
        botStatus = "Online";
        addLog(generalLogs, "Bot spawned in the world!");
        startAntiAfk();
    });

    bot.on('message', (message) => {
        addLog(chatLogs, message.toAnsi() || message.toString());
    });

    bot.on('kicked', (reason) => {
        botStatus = "Kicked";
        addLog(generalLogs, `Kicked: ${reason}`);
        stopAntiAfk();
    });

    bot.on('error', (err) => {
        botStatus = "Error";
        addLog(generalLogs, `Error: ${err.message}`);
        stopAntiAfk();
    });

    bot.on('end', () => {
        botStatus = "Offline";
        addLog(generalLogs, "Bot disconnected from server.");
        stopAntiAfk();
    });
}

// --- EXPRESS WEB DASHBOARD ---

app.get('/api/data', (req, res) => {
    let health = 0, hunger = 0, gamemode = "N/A", position = "N/A", xp = 0, heldItem = "None";
    let onlinePlayers = [];
    
    if (bot && bot.entity) {
        health = Math.round(bot.health);
        hunger = Math.round(bot.food);
        gamemode = bot.game.gameMode;
        xp = bot.experience.level;
        
        const pos = bot.entity.position;
        position = `X: ${Math.round(pos.x)} Y: ${Math.round(pos.y)} Z: ${Math.round(pos.z)}`;
        
        const item = bot.inventory.slots[bot.getEquipmentDestSlot('hand')];
        if (item) heldItem = `${item.name} (x${item.count})`;

        if (bot.players) {
            onlinePlayers = Object.keys(bot.players);
        }
    }

    res.json({
        name: 'mhmdazizi',
        status: botStatus,
        health, hunger, gamemode, position, xp, heldItem, onlinePlayers,
        generalLogs, chatLogs, afkLogs
    });
});

app.post('/api/action', (req, res) => {
    const action = req.body.action;
    if (action === 'reconnect') {
        initBot();
    } else if (action === 'sendChat' && bot) {
        bot.chat(req.body.chatMessage);
        addLog(generalLogs, `Sent chat: ${req.body.chatMessage}`);
    } else if (action === 'stopAfk') {
        stopAntiAfk();
        addLog(generalLogs, "Manual override: Stopped Anti-AFK");
    } else if (action === 'startAfk') {
        startAntiAfk();
        addLog(generalLogs, "Manual override: Started Anti-AFK");
    } else if (action === 'clearLogs') {
        if (req.body.logType === 'chat') chatLogs = [];
        if (req.body.logType === 'general') generalLogs = [];
        if (req.body.logType === 'afk') afkLogs = [];
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
        <title>mhmdazizi Dashboard</title>
        <style>
            :root { --bg: #1e1e2e; --card: #313244; --text: #cdd6f4; --accent: #89b4fa; --danger: #f38ba8; --success: #a6e3a1; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 15px; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #45475a; padding-bottom: 10px; margin-bottom: 20px; }
            h1, h2 { margin: 0; color: var(--accent); }
            /* Mobile-friendly Grid */
            .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px; }
            .card { background: var(--card); padding: 15px; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.2); }
            .card-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #45475a; padding-bottom: 8px; margin-bottom: 10px; }
            .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
            .stat-box { background: #181825; padding: 10px; border-radius: 8px; text-align: center; }
            .stat-box span { display: block; font-size: 1.2em; font-weight: bold; margin-top: 5px; color: var(--accent); }
            .logs { height: 200px; overflow-y: auto; background: #11111b; padding: 10px; border-radius: 8px; font-family: monospace; font-size: 0.85em; }
            button { background: var(--accent); color: #11111b; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-weight: bold; transition: opacity 0.2s; }
            button:hover { opacity: 0.8; }
            .btn-danger { background: var(--danger); }
            .btn-small { padding: 4px 8px; font-size: 0.8em; }
            input[type="text"] { padding: 10px; width: 100%; box-sizing: border-box; border-radius: 6px; border: none; background: #181825; color: var(--text); margin-bottom: 10px; }
            .player-list { background: #181825; padding: 10px; border-radius: 8px; max-height: 100px; overflow-y: auto; font-size: 0.9em; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🤖 <span id="botName">Loading...</span></h1>
            <h2 id="status" style="color: var(--success);">Offline</h2>
        </div>
        
        <div class="grid">
            <div class="card">
                <div class="card-header"><h2>📊 Bot Stats</h2></div>
                <div class="stats-grid">
                    <div class="stat-box">Health<span id="health">0</span></div>
                    <div class="stat-box">Hunger<span id="hunger">0</span></div>
                    <div class="stat-box">XP Level<span id="xp">0</span></div>
                    <div class="stat-box">Gamemode<span id="gamemode">N/A</span></div>
                </div>
                <div style="margin-top: 15px;">
                    <p>📍 <strong>Position:</strong> <span id="position">N/A</span></p>
                    <p>🎒 <strong>Holding:</strong> <span id="heldItem">None</span></p>
                </div>
                <hr style="border:1px solid #45475a; margin: 15px 0;">
                <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                    <button onclick="sendAction('reconnect')">🔄 Reconnect</button>
                    <button onclick="sendAction('startAfk')">🏃 Start AFK</button>
                    <button onclick="sendAction('stopAfk')" class="btn-danger">🛑 Stop AFK</button>
                </div>
            </div>

            <div class="card">
                <div class="card-header"><h2>👥 Online Players</h2></div>
                <div class="player-list" id="onlinePlayers">Loading...</div>
                
                <div class="card-header" style="margin-top: 15px;"><h2>💬 Send Chat</h2></div>
                <div style="display: flex; gap: 5px;">
                    <input type="text" id="chatInput" placeholder="Type a message...">
                    <button onclick="sendChat()" style="height: 38px;">Send</button>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h2>💬 Live Chat</h2>
                    <button class="btn-small" onclick="clearLogs('chat')">Clear</button>
                </div>
                <div class="logs" id="chatLogs"></div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h2>🏃 AFK Activity</h2>
                    <button class="btn-small" onclick="clearLogs('afk')">Clear</button>
                </div>
                <div class="logs" id="afkLogs"></div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h2>⚙️ System Logs</h2>
                    <button class="btn-small" onclick="clearLogs('general')">Clear</button>
                </div>
                <div class="logs" id="generalLogs"></div>
            </div>
        </div>

        <script>
            setInterval(async () => {
                const res = await fetch('/api/data');
                const data = await res.json();
                
                document.getElementById('botName').innerText = data.name;
                document.getElementById('status').innerText = data.status;
                document.getElementById('health').innerText = data.health;
                document.getElementById('hunger').innerText = data.hunger;
                document.getElementById('xp').innerText = data.xp;
                document.getElementById('gamemode').innerText = data.gamemode;
                document.getElementById('position').innerText = data.position;
                document.getElementById('heldItem').innerText = data.heldItem;

                document.getElementById('onlinePlayers').innerHTML = data.onlinePlayers.length > 0 ? data.onlinePlayers.join(', ') : 'No one else is online';

                document.getElementById('generalLogs').innerHTML = data.generalLogs.join('<br>');
                document.getElementById('chatLogs').innerHTML = data.chatLogs.join('<br>');
                document.getElementById('afkLogs').innerHTML = data.afkLogs.join('<br>');
            }, 2000);

            async function sendAction(action) {
                await fetch('/api/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action })
                });
            }

            async function clearLogs(logType) {
                await fetch('/api/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'clearLogs', logType })
                });
                document.getElementById(logType + 'Logs').innerHTML = ''; // Clear immediately on frontend
            }

            async function sendChat() {
                const input = document.getElementById('chatInput');
                if (!input.value) return;
                await fetch('/api/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'sendChat', chatMessage: input.value })
                });
                input.value = '';
            }
        </script>
    </body>
    </html>
    `);
});

app.listen(PORT, () => {
    console.log(\`Dashboard listening on port \${PORT}\`);
    initBot();
});
