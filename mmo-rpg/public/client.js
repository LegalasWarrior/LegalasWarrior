const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const hpText = document.getElementById('hpText');
const hpBar = document.getElementById('hpBar');
const goldEl = document.getElementById('gold');
const invEl = document.getElementById('inventory');
const skillsEl = document.getElementById('skills');
const logEl = document.getElementById('log');
const weaponLevelEl = document.getElementById('weaponLevel');
const armorLevelEl = document.getElementById('armorLevel');
const weaponCostEl = document.getElementById('weaponCost');
const armorCostEl = document.getElementById('armorCost');
const btnWeapon = document.getElementById('upgradeWeapon');
const btnArmor = document.getElementById('upgradeArmor');

let ws;
let me = null;
let mapSize = 2000;
let players = [];
let mobs = [];
let resources = [];

let inputs = { up: false, down: false, left: false, right: false };

function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}`);

  ws.addEventListener('open', () => {
    log('Подключено к серверу.');
  });

  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    switch (msg.type) {
      case 'welcome':
        me = msg.you;
        mapSize = msg.world.mapSize;
        mobs = msg.world.mobs;
        resources = msg.world.resources;
        updateHUD();
        break;
      case 'state':
        players = msg.players;
        mobs = msg.mobs;
        resources = msg.resources;
        break;
      case 'you':
        me = msg.you;
        updateHUD();
        break;
      case 'combat':
      case 'gather':
      case 'upgrade':
      case 'levelUp':
      case 'death':
        if (msg.message) log(msg.message);
        updateHUD();
        break;
      default:
        break;
    }
  });

  ws.addEventListener('close', () => {
    log('Отключено. Переподключение через 3 сек...');
    setTimeout(connect, 3000);
  });
}
connect();

// ---------------- UI / HUD ----------------
function log(text) {
  const div = document.createElement('div');
  div.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
  logEl.prepend(div);
  while (logEl.children.length > 100) logEl.removeChild(logEl.lastChild);
}

function upgradeCost(slot, level) {
  const base = 120;
  return base * level * level;
}

function updateHUD() {
  if (!me) return;
  hpText.textContent = `HP ${me.hp}/${me.maxHp}`;
  const pct = (me.hp / me.maxHp) * 100;
  hpBar.style.width = `${pct}%`;
  goldEl.textContent = `${me.gold}`;
  weaponLevelEl.textContent = me.weaponLevel;
  armorLevelEl.textContent = me.armorLevel;
  weaponCostEl.textContent = `Цена: ${upgradeCost('weapon', me.weaponLevel)}`;
  armorCostEl.textContent = `Цена: ${upgradeCost('armor', me.armorLevel)}`;

  invEl.innerHTML = '';
  const items = Object.entries(me.inventory);
  for (const [k, v] of items) {
    const li = document.createElement('li');
    li.textContent = `${k}: ${v}`;
    invEl.appendChild(li);
  }

  skillsEl.innerHTML = '';
  for (const [k, s] of Object.entries(me.skills)) {
    const li = document.createElement('li');
    li.textContent = `${k}: ур. ${s.level}`;
    skillsEl.appendChild(li);
  }
}

btnWeapon.addEventListener('click', () => {
  ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: 'upgrade', slot: 'weapon' }));
});
btnArmor.addEventListener('click', () => {
  ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: 'upgrade', slot: 'armor' }));
});

// ---------------- Input ----------------
const keyMap = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
};

window.addEventListener('keydown', (e) => {
  if (e.code in keyMap) {
    inputs[keyMap[e.code]] = true;
    sendInputs();
  } else if (e.code === 'Space') {
    ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: 'attack' }));
  } else if (e.code === 'KeyE') {
    ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: 'gather' }));
  } else if (e.code === 'Digit1') {
    ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: 'upgrade', slot: 'weapon' }));
  } else if (e.code === 'Digit2') {
    ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: 'upgrade', slot: 'armor' }));
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code in keyMap) {
    inputs[keyMap[e.code]] = false;
    sendInputs();
  }
});

function sendInputs() {
  ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: 'input', inputs }));
}

// ---------------- Rendering ----------------
function draw() {
  requestAnimationFrame(draw);
  if (!me) {
    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#7f8fa6';
    ctx.font = '16px sans-serif';
    ctx.fillText('Подключение к серверу...', 20, 30);
    return;
  }

  // Camera center on me
  const camX = me.x - canvas.width / 2;
  const camY = me.y - canvas.height / 2;

  // Background
  ctx.fillStyle = '#0b0f14';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Grid
  ctx.strokeStyle = '#142033';
  ctx.lineWidth = 1;
  for (let x = -((camX % 50) + 50); x < canvas.width; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = -((camY % 50) + 50); y < canvas.height; y += 50) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Resources
  for (const r of resources) {
    const x = r.x - camX;
    const y = r.y - camY;
    if (x < -40 || x > canvas.width + 40 || y < -40 || y > canvas.height + 40) continue;
    ctx.fillStyle = r.color || '#888';
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c8d6e5';
    ctx.font = '12px sans-serif';
    ctx.fillText(r.type, x + 12, y + 4);
  }

  // Mobs
  for (const m of mobs) {
    const x = m.x - camX;
    const y = m.y - camY;
    if (x < -40 || x > canvas.width + 40 || y < -40 || y > canvas.height + 40) continue;
    ctx.fillStyle = m.color || '#aaa';
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fill();
    // HP bar
    const hpPct = m.hp / m.maxHp;
    ctx.fillStyle = '#2b313a';
    ctx.fillRect(x - 16, y - 22, 32, 5);
    ctx.fillStyle = '#ff4757';
    ctx.fillRect(x - 16, y - 22, 32 * hpPct, 5);
    ctx.fillStyle = '#aab7c4';
    ctx.font = '12px sans-serif';
    ctx.fillText(m.name, x - 16, y + 26);
  }

  // Other players
  for (const p of players) {
    if (!me || p.id === me.id) continue;
    const x = p.x - camX;
    const y = p.y - camY;
    if (x < -40 || x > canvas.width + 40 || y < -40 || y > canvas.height + 40) continue;
    drawPlayer(x, y, '#74b9ff');
    // Name
    ctx.fillStyle = '#74b9ff';
    ctx.font = '12px sans-serif';
    ctx.fillText(p.name, x - 18, y + 26);
  }

  // Me
  const mx = me.x - camX;
  const my = me.y - camY;
  drawPlayer(mx, my, '#55efc4');
  ctx.fillStyle = '#55efc4';
  ctx.font = '12px sans-serif';
  ctx.fillText(me.name || 'You', mx - 18, my + 26);
}

function drawPlayer(x, y, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - 14);
  ctx.lineTo(x + 12, y + 10);
  ctx.lineTo(x - 12, y + 10);
  ctx.closePath();
  ctx.fill();
}

requestAnimationFrame(draw);