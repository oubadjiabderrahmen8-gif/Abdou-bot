const mineflayer = require('mineflayer');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 10000;

// --- STATE MANAGEMENT ---
let bot = null;
let botStatus = "Offline";
let afkIntervals = [];
let reconnectTimeout = null;
let isConnecting = false; // GUARD: Prevents spamming login attempts

let generalLogs = [];
let chatLogs = [];
let afkLogs = [];

function addLog(array, message) {
    const time = new Date().toLocaleTimeString();
    array.unshift(`[${time}] ${message}`);
    if (array.length > 30) array.pop();
}

// --- ANTI-AFK LOGIC ---
function startAntiAfk() {
    stopAntiAfk(); 
    addLog(afkLogs, "System: Anti-AFK Started.");

    afkIntervals.push(setInterval(() => {
        if (!bot || !bot.entity) return;
        bot.look(Math.random() * Math.PI * 2, 0);
    }, 10000));

    afkIntervals.push(setInterval(() => {
        if (!bot || !bot.entity) return;
        bot.setControlState('forward', true);
        setTimeout(() => { if (bot) bot.setControlState('forward', false); }, 2000);
    }, 20000));

    afkIntervals.push(setInterval(() => {
        if (!bot || !bot.entity) return;
        bot.setControlState('jump', true);
        setTimeout(() => { if (bot) bot.setControlState('jump', false); }, 500);
    }, 30000));

    afkIntervals.push(setInterval(() => {
        if (!bot || !bot.entity) return;
        bot.setControlState('sneak', true);
        setTimeout(() => { if (bot) bot.setControlState('sneak', false); }, 500);
    }, 40000));

    afkIntervals.push(setInterval(() => {
        if (!bot) return;
        const msgs = ["ABDOU-PRO Active", "Chunk loading...", "Still here!"];
        bot.chat(msgs[Math.floor(Math.random() * msgs.length)]);
    }, 480000));
}

function stopAntiAfk() {
    afkIntervals.forEach(clearInterval);
    afkIntervals = [];
    if (bot) bot.clearControlStates();
}

// --- BOT INITIALIZATION (THE FIX) ---
function initBot() {
    if (isConnecting || (bot && bot.entity)) return; // Don't start if already trying or online

    isConnecting = true;
    botStatus = "Connecting...";
    addLog(generalLogs, "Connecting as ABDOU-PRO...");

    if (bot) {
        bot.quit();
        stopAntiAfk();
    }

    bot = mineflayer.createBot({
        host: 'mathcrafters.aternos.me',
        port: 12030,
        username: 'ABDOU-PRO',
        version: false,
        skipValidation: true // Faster login
    });

    bot.on('spawn', () => {
        isConnecting = false;
        botStatus = "Online";
        addLog(generalLogs, "Joined Server!");
        startAntiAfk();
    });

    bot.on('message', (m) => { if(m.toString().trim()) addLog(chatLogs, m.toString()); });

    bot.on('error', (err) => {
        addLog(generalLogs, `Error: ${err.message}`);
        isConnecting = false;
    });

    bot.on('end', () => {
        botStatus = "Offline";
        isConnecting = false;
        stopAntiAfk();
        addLog(generalLogs, "Disconnected. Reconnect in 30s...");
        
        // Wait 30 seconds before trying again to avoid Aternos "Spam" kick
        clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(initBot, 30000);
    });
}

// --- DASHBOARD ---
app.get('/api/data', (req, res) => {
    let stats = { hp: 0, food: 0, pos: "N/A" };
    if (bot && bot.entity) {
        stats.hp = Math.round(bot.health);
        stats.food = Math.round(bot.food);
        stats.pos = `X:${Math.round(bot.entity.position.x)} Y:${Math.round(bot.entity.position.y)}`;
    }
    res.json({ name: 'ABDOU-PRO', status: botStatus, stats, generalLogs, chatLogs, afkLogs });
});

app.post('/api/action', (req, res) => {
    if (req.body.action === 'reconnect') initBot();
    if (req.body.action === 'chat' && bot) bot.chat(req.body.msg);
    res.sendStatus(200);
});

app.get('/', (req, res) => {
    res.send(`
    <html>
        <head>
            <title>ABDOU-PRO</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: sans-serif; background: #0b0e14; color: white; padding: 20px; }
                .card { background: #151921; padding: 15px; border-radius: 10px; margin-bottom: 10px; border: 1px solid #333; }
                .log { height: 120px; overflow-y: auto; background: black; color: lime; padding: 10px; font-family: monospace; font-size: 0.8em; margin-top: 5px; }
                button { background: #00d2ff; border: none; padding: 10px; border-radius: 5px; font-weight: bold; cursor: pointer; }
                .online { color: lime; } .offline { color: red; }
            </style>
        </head>
        <body>
            <h2>ABDOU-PRO: <span id="st" class="offline">Offline</span></h2>
            <div class="card">
                <p>Health: <span id="hp">0</span> | Hunger: <span id="fd">0</span></p>
                <p>Pos: <span id="ps">N/A</span></p>
                <button onclick="fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'reconnect'})})">Force Reconnect</button>
            </div>
            <div class="card">
                <b>Server Chat</b>
                <div id="cl" class="log"></div>
                <input type="text" id="ci" style="width:70%; margin-top:5px;">
                <button onclick="s()">Send</button>
            </div>
            <div class="card"><b>AFK Logs</b><div id="al" class="log" style="color:cyan"></div></div>
            <div class="card"><b>System</b><div id="gl" class="log" style="color:yellow"></div></div>
            <script>
                async function s(){
                    const i = document.getElementById('ci');
                    await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'chat',msg:i.value})});
                    i.value='';
                }
                setInterval(async () => {
                    const r = await fetch('/api/data');
                    const d = await r.json();
                    document.getElementById('st').innerText = d.status;
                    document.getElementById('st').className = d.status === "Online" ? "online" : "offline";
                    document.getElementById('hp').innerText = d.stats.hp;
                    document.getElementById('fd').innerText = d.stats.food;
                    document.getElementById('ps').innerText = d.stats.pos;
                    document.getElementById('cl').innerHTML = d.chatLogs.join('<br>');
                    document.getElementById('al').innerHTML = d.afkLogs.join('<br>');
                    document.getElementById('gl').innerHTML = d.generalLogs.join('<br>');
                }, 2000);
            </script>
        </body>
    </html>
    `);
});

// START EXPRESS FIRST (Important for Render Health Check)
app.listen(PORT, () => {
    console.log(`Web Dashboard active on port ${PORT}`);
    // Start bot only after web server is confirmed up
    setTimeout(initBot, 5000); 
});
