const mineflayer = require('mineflayer')
const http = require('http')
const url = require('url')

const options = {
  host: 'mathcrafters.aternos.me',
  port: 12030,
  username: 'ABDOU_PRO',
  version: '1.20.1'
}

// --- BOT STATE & MEMORY ---
let bot = null
let botStatus = "OFFLINE"
let antiAfkMode = "wander" 
let startTime = null
let history = new Set()
let logs = []
let botStats = { 
  health: 20, food: 20, level: 0, 
  x: 0, y: 0, z: 0, 
  ping: 0, items: 0, time: "Day", weather: "Clear" 
}

// --- CORE SERVER ---
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true)
  const path = parsedUrl.pathname

  if (path === '/api/status') {
    let currentlyOnline = bot && bot.players ? Object.keys(bot.players) : []
    let onlineData = []
    
    currentlyOnline.forEach(name => {
      history.add(name)
      onlineData.push({ name: name, ping: bot.players[name].ping || 0 })
    })

    let offlineData = Array.from(history).filter(name => !currentlyOnline.includes(name))

    let uptime = "0h 0m 0s"
    if (startTime && botStatus === "ONLINE") {
      const diff = Math.floor((Date.now() - startTime) / 1000)
      const h = Math.floor(diff / 3600); const m = Math.floor((diff % 3600) / 60); const s = diff % 60
      uptime = `${h}h ${m}m ${s}s`
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({
      status: botStatus, uptime, stats: botStats, 
      afkMode: antiAfkMode, logs: logs.slice(-15), 
      online: onlineData, offline: offlineData
    }))
  }

  if (path === '/api/action') {
    const action = parsedUrl.query.type
    const val = parsedUrl.query.val
    
    if (action === 'start') createBot()
    if (action === 'stop' && bot) { bot.quit(); botStatus = "OFFLINE"; }
    if (action === 'chat' && bot && botStatus === "ONLINE" && val) bot.chat(val)
    if (action === 'afk') { antiAfkMode = val; addLog(`⚙️ Anti-AFK set to: ${val.toUpperCase()}`); }
    
    res.writeHead(200); return res.end("OK")
  }

  if (path === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>ABDOU BOT 2.0</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          <style>
            :root { --bg: #050505; --card: #111; --border: #333; --green: #0f0; --red: #f44; --text: #ddd; }
            body { background: var(--bg); color: var(--text); font-family: 'Consolas', monospace; margin: 0; padding: 10px; padding-bottom: 50px; }
            
            .header { text-align: center; border-bottom: 1px solid var(--border); padding-bottom: 10px; margin-bottom: 15px; }
            .header h1 { color: #fff; margin: 0 0 5px 0; font-size: 1.5em; letter-spacing: 2px; text-shadow: 0 0 10px var(--green); }
            .card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 15px; margin-bottom: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.5); }
            .card-title { color: var(--green); font-weight: bold; font-size: 0.9em; margin-bottom: 10px; text-transform: uppercase; border-bottom: 1px dashed var(--border); padding-bottom: 5px; }
            
            .btn-group { display: flex; gap: 10px; margin-bottom: 15px; }
            .btn { flex: 1; padding: 12px; border: none; border-radius: 5px; font-weight: bold; color: #fff; cursor: pointer; text-align: center; font-size: 0.9em; }
            .btn-connect { background: #006400; border: 1px solid var(--green); box-shadow: 0 0 10px rgba(0,255,0,0.2); }
            .btn-disconnect { background: #8b0000; border: 1px solid var(--red); box-shadow: 0 0 10px rgba(255,0,0,0.2); }
            
            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
            .data-box { background: #000; border: 1px solid #222; padding: 8px; text-align: center; border-radius: 4px; }
            .data-label { font-size: 0.7em; color: #888; display: block; margin-bottom: 3px; }
            .data-val { color: #fff; font-size: 1.1em; font-weight: bold; }
            
            .console { background: #000; border: 1px solid #222; height: 150px; overflow-y: auto; padding: 10px; font-size: 0.8em; color: #aaa; border-radius: 4px; display: flex; flex-direction: column-reverse; }
            .chat-bar { display: flex; gap: 5px; margin-top: 10px; }
            input, select { background: #000; border: 1px solid var(--border); color: var(--green); padding: 12px; border-radius: 4px; outline: none; width: 100%; font-family: inherit; }
            .btn-send { background: var(--green); color: #000; padding: 0 20px; font-weight: bold; border: none; border-radius: 4px; }
            
            .list-box { max-height: 150px; overflow-y: auto; background: #000; border: 1px solid #222; padding: 5px; border-radius: 4px; font-size: 0.85em; }
            ul { list-style: none; padding: 0; margin: 0; }
            li { padding: 4px 0; border-bottom: 1px solid #111; }
            
            .dot-green { color: var(--green); margin-right: 5px; }
            .dot-red { color: var(--red); margin-right: 5px; }
          </style>
        </head>
        <body>

          <div class="header">
            <h1>ABDOU BOT 2.0</h1>
            <div style="font-size:0.85em;">Status: <b id="ui-status" style="color:var(--red)">OFFLINE</b> | Uptime: <span id="ui-uptime">0h 0m 0s</span></div>
          </div>

          <div class="btn-group">
            <button class="btn btn-connect" onclick="sendAction('start')">CONNECT BOT</button>
            <button class="btn btn-disconnect" onclick="sendAction('stop')">DISCONNECT</button>
          </div>

          <div class="card">
            <div class="card-title">⚙️ Anti-AFK Settings</div>
            <select id="afk-select" onchange="sendAction('afk', this.value)">
              <option value="none">Disabled (Stand Still)</option>
              <option value="rotate">Look Around</option>
              <option value="jump">Jump in Place</option>
              <option value="wander" selected>Random Wander (Best)</option>
            </select>
          </div>

          <div class="grid-2" style="margin-bottom: 15px;">
            <div class="card" style="margin:0;">
              <div class="card-title">❤️ Vital Signs</div>
              <div class="grid-2">
                <div class="data-box"><span class="data-label">Health</span><span class="data-val" id="ui-hp" style="color:var(--red)">0/20</span></div>
                <div class="data-box"><span class="data-label">Hunger</span><span class="data-val" id="ui-food" style="color:orange">0/20</span></div>
                <div class="data-box"><span class="data-label">Level (XP)</span><span class="data-val" id="ui-lvl" style="color:var(--green)">0</span></div>
                <div class="data-box"><span class="data-label">Items</span><span class="data-val" id="ui-items">0</span></div>
              </div>
            </div>
            
            <div class="card" style="margin:0;">
              <div class="card-title">🌍 Environment</div>
              <div class="data-box" style="margin-bottom:5px;"><span class="data-label">Position</span><span class="data-val" id="ui-pos">X:0 Y:0 Z:0</span></div>
              <div class="grid-2">
                <div class="data-box"><span class="data-label">Time</span><span class="data-val" id="ui-time" style="font-size:0.9em;">---</span></div>
                <div class="data-box"><span class="data-label">Weather</span><span class="data-val" id="ui-weather" style="font-size:0.9em;">---</span></div>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-title">💻 Server Console</div>
            <div class="console" id="ui-console"></div>
            <div class="chat-bar">
              <input type="text" id="chat-input" placeholder="Type command or message...">
              <button class="btn-send" onclick="sendChat()">SEND</button>
            </div>
          </div>

          <div class="card">
            <div class="card-title">📡 Player Radar</div>
            <div class="grid-2">
              <div>
                <div style="font-size:0.8em; margin-bottom:5px; color:var(--green);">ONLINE (<span id="ui-on-count">0</span>)</div>
                <div class="list-box"><ul id="ui-online-list"></ul></div>
              </div>
              <div>
                <div style="font-size:0.8em; margin-bottom:5px; color:var(--red);">OFFLINE (<span id="ui-off-count">0</span>)</div>
                <div class="list-box"><ul id="ui-offline-list"></ul></div>
              </div>
            </div>
          </div>

          <script>
            function sendAction(type, val = '') { fetch('/api/action?type=' + type + '&val=' + encodeURIComponent(val)); }
            function sendChat() {
              const input = document.getElementById('chat-input');
              if(input.value) { sendAction('chat', input.value); input.value = ''; }
            }
            
            setInterval(() => {
              fetch('/api/status').then(res => res.json()).then(data => {
                const statEl = document.getElementById('ui-status');
                statEl.innerText = data.status;
                statEl.style.color = data.status === 'ONLINE' ? 'var(--green)' : (data.status === 'CONNECTING...' ? 'orange' : 'var(--red)');
                document.getElementById('ui-uptime').innerText = data.uptime;
                
                document.getElementById('ui-hp').innerText = Math.round(data.stats.health) + '/20';
                document.getElementById('ui-food').innerText = Math.round(data.stats.food) + '/20';
                document.getElementById('ui-lvl').innerText = data.stats.level;
                document.getElementById('ui-items').innerText = data.stats.items;
                document.getElementById('ui-pos').innerText = \`X:\${Math.round(data.stats.x)} Y:\${Math.round(data.stats.y)} Z:\${Math.round(data.stats.z)}\`;
                document.getElementById('ui-time').innerText = data.stats.time;
                document.getElementById('ui-weather').innerText = data.stats.weather;
                
                document.getElementById('afk-select').value = data.afkMode;
                document.getElementById('ui-console').innerHTML = data.logs.slice().reverse().map(l => \`<div>\${l}</div>\`).join('');

                document.getElementById('ui-on-count').innerText = data.online.length;
                document.getElementById('ui-online-list').innerHTML = data.online.map(p => \`<li><span class="dot-green">●</span>\${p.name} <span style="color:#555;font-size:0.8em;">(\${p.ping}ms)</span></li>\`).join('');
                
                document.getElementById('ui-off-count').innerText = data.offline.length;
                document.getElementById('ui-offline-list').innerHTML = data.offline.map(name => \`<li style="color:#666"><span class="dot-red">●</span>\${name}</li>\`).join('');
              });
            }, 2000); 
          </script>
        </body>
      </html>
    `)
    return res.end()
  }
})

server.listen(process.env.PORT || 8080)

// --- BOT LOGIC ---
function addLog(msg) {
  logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`)
  if (logs.length > 30) logs.shift()
}

function createBot() {
  if (botStatus === "ONLINE" || botStatus === "CONNECTING...") return
  botStatus = "CONNECTING..."
  addLog("Initializing connection...")
  bot = mineflayer.createBot(options)

  bot.on('spawn', () => {
    botStatus = "ONLINE"
    if (!startTime) startTime = Date.now()
    addLog("✅ Bot spawned successfully!")
    
    setInterval(() => {
      if (botStatus !== "ONLINE" || !bot.entity) return;
      
      switch(antiAfkMode) {
        case 'wander':
          bot.setControlState('forward', true)
          setTimeout(() => bot.setControlState('forward', false), 300)
          bot.look(Math.random() * 6.28, 0)
          break;
        case 'jump':
          bot.setControlState('jump', true)
          setTimeout(() => bot.setControlState('jump', false), 100)
          break;
        case 'rotate':
          bot.look(Math.random() * 6.28, 0)
          break;
        case 'none':
          break;
      }
    }, 15000)
  })

  bot.on('health', () => { botStats.health = bot.health; botStats.food = bot.food; })
  bot.on('experience', () => { botStats.level = bot.experience.level; })
  bot.on('move', () => {
    if (bot.entity) {
      botStats.x = bot.entity.position.x
      botStats.y = bot.entity.position.y
      botStats.z = bot.entity.position.z
    }
  })
  bot.on('time', () => {
    botStats.time = bot.time.isDay ? "Day" : "Night"
    botStats.weather = bot.isRaining ? "Raining" : "Clear"
  })

  setInterval(() => {
    if (bot && bot.inventory) { botStats.items = bot.inventory.items().length }
  }, 5000)

  bot.on('chat', (username, message) => addLog(`💬 <b>${username}:</b> ${message}`))
  bot.on('kicked', (reason) => { botStatus = "OFFLINE"; addLog("❌ Kicked: " + reason) })
  bot.on('end', () => { 
    if(botStatus !== "OFFLINE") { addLog("Disconnected. Reconnecting..."); setTimeout(createBot, 5000) }
  })
}

createBot()
