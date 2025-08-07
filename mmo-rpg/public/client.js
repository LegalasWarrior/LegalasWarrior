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

// Ranges (must match server)
const ATTACK_RANGE = 90;
const GATHER_RANGE = 90;

let ws;
let me = null;
let meId = null;
let mapSize = 2000;
let players = [];
let mobs = [];
let resources = [];

let inputs = { up: false, down: false, left: false, right: false };
let pressedSpaceTimer = 0;
let pressedETimer = 0;

// Smooth positions map: id -> { drawX, drawY, targetX, targetY }
const smoothPos = new Map();

function ensureSmoothPos(id, x, y) {
  let e = smoothPos.get(id);
  if (!e) {
    e = { drawX: x, drawY: y, targetX: x, targetY: y };
    smoothPos.set(id, e);
  } else {
    e.targetX = x;
    e.targetY = y;
    if (Number.isNaN(e.drawX) || Number.isNaN(e.drawY)) {
      e.drawX = x; e.drawY = y;
    }
  }
  return e;
}

function tickSmooth(dt) {
  // Lerp all known positions
  const smoothing = 12; // larger = snappier
  for (const e of smoothPos.values()) {
    e.drawX += (e.targetX - e.drawX) * Math.min(1, smoothing * dt);
    e.drawY += (e.targetY - e.drawY) * Math.min(1, smoothing * dt);
  }
}

function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}`);

  ws.addEventListener('open', () => {
    log('Подключено к серверу.');
  });

  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    switch (msg.type) {
      case 'welcome': {
        me = msg.you;
        meId = me.id;
        mapSize = msg.world.mapSize;
        mobs = msg.world.mobs;
        resources = msg.world.resources;
        ensureSmoothPos(me.id, me.x, me.y);
        updateHUD();
        break;
      }
      case 'state': {
        players = msg.players;
        mobs = msg.mobs;
        resources = msg.resources;
        // Update my authoritative position from server state
        if (meId) {
          const self = players.find((p) => p.id === meId);
          if (self) {
            me.x = self.x; me.y = self.y; me.hp = self.hp; me.maxHp = self.maxHp; me.name = self.name || me.name;
            ensureSmoothPos(me.id, me.x, me.y);
            updateHUD();
          }
        }
        // Ensure smooth positions for visible players
        for (const p of players) ensureSmoothPos(p.id, p.x, p.y);
        for (const m of mobs) ensureSmoothPos(`mob:${m.id}`, m.x, m.y);
        break;
      }
      case 'you': {
        me = msg.you;
        meId = me.id;
        ensureSmoothPos(me.id, me.x, me.y);
        updateHUD();
        break;
      }
      case 'combat':
      case 'gather':
      case 'upgrade':
      case 'levelUp':
      case 'death': {
        if (msg.message) log(msg.message);
        updateHUD();
        break;
      }
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
  if (e.repeat) return;
  if (e.code in keyMap) {
    inputs[keyMap[e.code]] = true;
    sendInputs();
  } else if (e.code === 'Space') {
    pressedSpaceTimer = 0.15;
    ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: 'attack' }));
  } else if (e.code === 'KeyE') {
    pressedETimer = 0.15;
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

// ---------------- Helpers ----------------
function nearestWithin(origin, list, range) {
  let best = null; let bestD = Infinity;
  for (const o of list) {
    const dx = o.x - origin.x; const dy = o.y - origin.y;
    const d = Math.hypot(dx, dy);
    if (d < range && d < bestD) { best = o; bestD = d; }
  }
  return best;
}

// ---------------- Rendering ----------------
let lastTime = performance.now();
function draw(now = performance.now()) {
  requestAnimationFrame(draw);
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  tickSmooth(dt);
  if (pressedSpaceTimer > 0) pressedSpaceTimer = Math.max(0, pressedSpaceTimer - dt);
  if (pressedETimer > 0) pressedETimer = Math.max(0, pressedETimer - dt);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!me) {
    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#7f8fa6';
    ctx.font = '16px sans-serif';
    ctx.fillText('Подключение к серверу...', 20, 30);
    return;
  }

  // Camera center on me (use smoothed draw position if present)
  const mePos = smoothPos.get(me.id) || { drawX: me.x, drawY: me.y };
  const camX = mePos.drawX - canvas.width / 2;
  const camY = mePos.drawY - canvas.height / 2;

  // Background
  ctx.fillStyle = '#0b0f14';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Grid
  ctx.strokeStyle = '#142033';
  ctx.lineWidth = 1;
  for (let x = -((camX % 50) + 50); x < canvas.width; x += 50) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let y = -((camY % 50) + 50); y < canvas.height; y += 50) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }

  // Highlight nearest targets
  const nearestMob = nearestWithin(me, mobs, ATTACK_RANGE);
  const nearestRes = nearestWithin(me, resources, GATHER_RANGE);

  // Range circles
  const mx = mePos.drawX - camX; const my = mePos.drawY - camY;
  ctx.strokeStyle = 'rgba(255,80,80,0.25)';
  ctx.beginPath(); ctx.arc(mx, my, ATTACK_RANGE, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(80,200,255,0.20)';
  ctx.beginPath(); ctx.arc(mx, my, GATHER_RANGE, 0, Math.PI * 2); ctx.stroke();

  // Resources
  for (const r of resources) {
    const pos = ensureSmoothPos(`res:${r.id}`, r.x, r.y);
    const x = pos.drawX - camX; const y = pos.drawY - camY;
    if (x < -40 || x > canvas.width + 40 || y < -40 || y > canvas.height + 40) continue;
    ctx.fillStyle = r.color || '#888';
    ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c8d6e5'; ctx.font = '12px sans-serif'; ctx.fillText(r.type, x + 12, y + 4);
    if (nearestRes && nearestRes.id === r.id) {
      ctx.strokeStyle = 'rgba(80,200,255,0.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1;
    }
  }

  // Mobs
  for (const m of mobs) {
    const pos = ensureSmoothPos(`mob:${m.id}`, m.x, m.y);
    const x = pos.drawX - camX; const y = pos.drawY - camY;
    if (x < -40 || x > canvas.width + 40 || y < -40 || y > canvas.height + 40) continue;
    ctx.fillStyle = m.color || '#aaa';
    ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill();
    // HP bar
    const hpPct = Math.max(0, m.hp / m.maxHp);
    ctx.fillStyle = '#2b313a'; ctx.fillRect(x - 16, y - 22, 32, 5);
    ctx.fillStyle = '#ff4757'; ctx.fillRect(x - 16, y - 22, 32 * hpPct, 5);
    ctx.fillStyle = '#aab7c4'; ctx.font = '12px sans-serif'; ctx.fillText(m.name, x - 16, y + 26);
    if (nearestMob && nearestMob.id === m.id) {
      ctx.strokeStyle = 'rgba(255,100,100,0.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1;
    }
  }

  // Other players
  for (const p of players) {
    if (!me || p.id === me.id) continue;
    const pos = ensureSmoothPos(p.id, p.x, p.y);
    const x = pos.drawX - camX; const y = pos.drawY - camY;
    if (x < -40 || x > canvas.width + 40 || y < -40 || y > canvas.height + 40) continue;
    const ang = Math.atan2(pos.targetY - pos.drawY, pos.targetX - pos.drawX);
    drawPlayer(x, y, '#74b9ff', ang, 0);
    ctx.fillStyle = '#74b9ff'; ctx.font = '12px sans-serif'; ctx.fillText(p.name, x - 18, y + 26);
  }

  // Me orientation from inputs or movement
  let dirX = (inputs.right ? 1 : 0) - (inputs.left ? 1 : 0);
  let dirY = (inputs.down ? 1 : 0) - (inputs.up ? 1 : 0);
  let angle = 0;
  if (dirX !== 0 || dirY !== 0) {
    angle = Math.atan2(dirY, dirX);
  } else {
    const meS = smoothPos.get(me.id);
    if (meS) angle = Math.atan2(meS.targetY - meS.drawY, meS.targetX - meS.drawX);
  }
  const moving = dirX !== 0 || dirY !== 0;
  const bob = moving ? Math.sin(now * 0.02) * 2.5 : 0;

  // Me
  drawPlayer(mx, my + bob, '#55efc4', angle, moving ? 1 : 0);
  ctx.fillStyle = '#55efc4'; ctx.font = '12px sans-serif'; ctx.fillText(me.name || 'You', mx - 18, my + 26 + bob);

  // Input helper overlay
  drawInputOverlay();
}

function drawPlayer(x, y, color, angleRad = 0, moving = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angleRad);
  // Body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-12, -10);
  ctx.lineTo(-12, 10);
  ctx.closePath();
  ctx.fill();
  // Feet (simple walk viz)
  if (moving) {
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    const t = performance.now() * 0.01;
    ctx.beginPath(); ctx.arc(-6, 8 + Math.sin(t) * 2, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-6, -8 + Math.cos(t) * 2, 3, 0, Math.PI * 2); ctx.fill();
  }
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(0, 12, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawInputOverlay() {
  const baseX = 18; const baseY = canvas.height - 84;
  const key = (label, x, y, w = 28) => {
    ctx.fillStyle = '#121722';
    ctx.strokeStyle = '#22314a';
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, w, 28);
    ctx.strokeRect(x, y, w, 28);
    ctx.fillStyle = '#aab7c4';
    ctx.font = '12px sans-serif';
    ctx.fillText(label, x + 7, y + 18);
  };
  const on = (cond) => cond ? '#59ffa8' : '#3a4a66';

  // WASD
  key('W', baseX + 30, baseY, 28);
  key('A', baseX, baseY + 30, 28);
  key('S', baseX + 30, baseY + 30, 28);
  key('D', baseX + 60, baseY + 30, 28);
  ctx.fillStyle = on(inputs.up); ctx.fillRect(baseX + 30, baseY, 28, 3);
  ctx.fillStyle = on(inputs.left); ctx.fillRect(baseX, baseY + 30, 28, 3);
  ctx.fillStyle = on(inputs.down); ctx.fillRect(baseX + 30, baseY + 30, 28, 3);
  ctx.fillStyle = on(inputs.right); ctx.fillRect(baseX + 60, baseY + 30, 28, 3);

  // Space / E / 1 / 2
  key('Space', baseX + 110, baseY + 30, 72);
  ctx.fillStyle = on(pressedSpaceTimer > 0); ctx.fillRect(baseX + 110, baseY + 30, 72, 3);
  key('E', baseX + 190, baseY + 30, 28);
  ctx.fillStyle = on(pressedETimer > 0); ctx.fillRect(baseX + 190, baseY + 30, 28, 3);
  key('1', baseX + 230, baseY + 30, 28);
  key('2', baseX + 262, baseY + 30, 28);
}

// Resize canvas to window for better visibility
function resizeCanvas() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.floor(window.innerWidth);
  const h = Math.floor(window.innerHeight);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

requestAnimationFrame(draw);