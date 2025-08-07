import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import { nanoid } from 'nanoid';

// -----------------------
// Server Setup
// -----------------------
const app = express();
app.use(express.static('public'));
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

// -----------------------
// Game Constants
// -----------------------
const MAP_SIZE = 2000;
const TICK_RATE_MS = 100; // 10 ticks per second
const BROADCAST_RATE_MS = 200; // 5 updates per second
const PLAYER_SPEED = 180; // units per second
const ATTACK_RANGE = 90;
const GATHER_RANGE = 90;
const ATTACK_COOLDOWN_MS = 600;
const GATHER_COOLDOWN_MS = 900;
const MAX_MOBS = 32;
const MAX_RESOURCES = 45;

const SKILL_DEFS = [
  { key: 'mining', name: 'Mining' },
  { key: 'woodcutting', name: 'Woodcutting' },
  { key: 'fishing', name: 'Fishing' },
  { key: 'herbalism', name: 'Herbalism' },
  { key: 'hunting', name: 'Hunting' },
];

const RESOURCE_DEFS = [
  { key: 'ore', name: 'Ore Vein', color: '#8c8c8c', skill: 'mining', tier: 1 },
  { key: 'wood', name: 'Tree', color: '#3f8f3f', skill: 'woodcutting', tier: 1 },
  { key: 'fish', name: 'Fishing Spot', color: '#2e86de', skill: 'fishing', tier: 1 },
  { key: 'herb', name: 'Herb Patch', color: '#8e44ad', skill: 'herbalism', tier: 1 },
  { key: 'hide', name: 'Hunting Ground', color: '#a0522d', skill: 'hunting', tier: 1 },
];

const MOB_DEFS = [
  { key: 'slime', name: 'Slime', color: '#9be564', maxHp: 30, baseDamage: 4, gold: [4, 8] },
  { key: 'goblin', name: 'Goblin', color: '#2ecc71', maxHp: 45, baseDamage: 6, gold: [8, 15] },
  { key: 'wolf', name: 'Wolf', color: '#95a5a6', maxHp: 60, baseDamage: 9, gold: [12, 20] },
  { key: 'skeleton', name: 'Skeleton', color: '#ecf0f1', maxHp: 80, baseDamage: 12, gold: [16, 28] },
  { key: 'elemental', name: 'Fire Elemental', color: '#e74c3c', maxHp: 110, baseDamage: 16, gold: [20, 40] },
];

// -----------------------
// World State
// -----------------------
const players = new Map(); // id -> player
const sockets = new Map(); // id -> ws
const mobs = new Map(); // id -> mob
const resources = new Map(); // id -> resource node

function randomInRange(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function makePlayer(id) {
  return {
    id,
    name: `Adventurer-${String(id).slice(-4)}`,
    x: randomInRange(200, MAP_SIZE - 200),
    y: randomInRange(200, MAP_SIZE - 200),
    vx: 0,
    vy: 0,
    hp: 100,
    maxHp: 100,
    gold: 0,
    weaponLevel: 1,
    armorLevel: 1,
    lastAttackAt: 0,
    lastGatherAt: 0,
    inputs: { up: false, down: false, left: false, right: false },
    inventory: { ore: 0, wood: 0, fish: 0, herb: 0, hide: 0 },
    skills: SKILL_DEFS.reduce((acc, s) => {
      acc[s.key] = { level: 1, xp: 0 };
      return acc;
    }, {}),
  };
}

function makeMob() {
  const def = MOB_DEFS[Math.floor(Math.random() * MOB_DEFS.length)];
  const id = nanoid(8);
  return {
    id,
    type: def.key,
    name: def.name,
    color: def.color,
    x: randomInRange(50, MAP_SIZE - 50),
    y: randomInRange(50, MAP_SIZE - 50),
    hp: def.maxHp,
    maxHp: def.maxHp,
    baseDamage: def.baseDamage,
    goldRange: def.gold,
    wanderDir: randomInRange(0, Math.PI * 2),
  };
}

function makeResourceNode() {
  const def = RESOURCE_DEFS[Math.floor(Math.random() * RESOURCE_DEFS.length)];
  const id = nanoid(8);
  return {
    id,
    type: def.key,
    name: def.name,
    color: def.color,
    skill: def.skill,
    tier: def.tier,
    x: randomInRange(50, MAP_SIZE - 50),
    y: randomInRange(50, MAP_SIZE - 50),
  };
}

function ensurePopulations() {
  while (mobs.size < MAX_MOBS) {
    const m = makeMob();
    mobs.set(m.id, m);
  }
  while (resources.size < MAX_RESOURCES) {
    const r = makeResourceNode();
    resources.set(r.id, r);
  }
}

function getMobDef(typeKey) {
  return MOB_DEFS.find((m) => m.key === typeKey);
}

function getResourceDef(typeKey) {
  return RESOURCE_DEFS.find((r) => r.key === typeKey);
}

function levelUpThreshold(level) {
  // Slightly escalating requirement
  return 60 + (level - 1) * 60 + Math.floor((level - 1) * (level - 1) * 10);
}

function addSkillXp(player, skillKey, xp) {
  const skill = player.skills[skillKey];
  if (!skill) return;
  skill.xp += xp;
  let threshold = levelUpThreshold(skill.level);
  while (skill.xp >= threshold) {
    skill.xp -= threshold;
    skill.level += 1;
    threshold = levelUpThreshold(skill.level);
    sendTo(player.id, { type: 'levelUp', skill: skillKey, level: skill.level });
  }
}

function playerDamage(player) {
  return 6 + player.weaponLevel * 3;
}

function applyArmorReduction(incomingDamage, armorLevel) {
  const reduction = clamp((armorLevel - 1) * 0.06, 0, 0.7); // max 70% reduction
  return Math.max(1, Math.round(incomingDamage * (1 - reduction)));
}

function upgradeCost(slot, level) {
  const base = slot === 'weapon' ? 120 : 120;
  return base * level * level;
}

function sendTo(playerId, message) {
  const ws = sockets.get(playerId);
  if (ws && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function broadcast(message) {
  const payload = JSON.stringify(message);
  for (const ws of wss.clients) {
    if (ws.readyState === ws.OPEN) ws.send(payload);
  }
}

// -----------------------
// Ticking and Simulation
// -----------------------
let lastTick = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt = (now - lastTick) / 1000;
  lastTick = now;

  // Movement
  for (const player of players.values()) {
    const ix = (player.inputs.right ? 1 : 0) - (player.inputs.left ? 1 : 0);
    const iy = (player.inputs.down ? 1 : 0) - (player.inputs.up ? 1 : 0);
    let vx = ix * PLAYER_SPEED;
    let vy = iy * PLAYER_SPEED;
    // Normalize diagonal
    if (ix !== 0 && iy !== 0) {
      const m = Math.SQRT1_2;
      vx *= m;
      vy *= m;
    }
    player.x = clamp(player.x + vx * dt, 0, MAP_SIZE);
    player.y = clamp(player.y + vy * dt, 0, MAP_SIZE);
  }

  // Simple mob wandering
  for (const mob of mobs.values()) {
    if (Math.random() < 0.02) {
      mob.wanderDir = randomInRange(0, Math.PI * 2);
    }
    const speed = 40;
    mob.x = clamp(mob.x + Math.cos(mob.wanderDir) * speed * dt, 0, MAP_SIZE);
    mob.y = clamp(mob.y + Math.sin(mob.wanderDir) * speed * dt, 0, MAP_SIZE);
  }

  // Passive regen for players
  for (const player of players.values()) {
    if (player.hp < player.maxHp) {
      player.hp = Math.min(player.maxHp, player.hp + 1);
    }
  }

  // Keep populations
  ensurePopulations();
}, TICK_RATE_MS);

setInterval(() => {
  // Broadcast lightweight state to all
  const state = {
    type: 'state',
    players: Array.from(players.values()).map((p) => ({ id: p.id, name: p.name, x: p.x, y: p.y, hp: p.hp, maxHp: p.maxHp })),
    mobs: Array.from(mobs.values()).map((m) => ({ id: m.id, type: m.type, name: m.name, color: m.color, x: m.x, y: m.y, hp: m.hp, maxHp: m.maxHp })),
    resources: Array.from(resources.values()).map((r) => ({ id: r.id, type: r.type, name: r.name, color: r.color, x: r.x, y: r.y })),
  };
  broadcast(state);
}, BROADCAST_RATE_MS);

// -----------------------
// WebSocket Handling
// -----------------------
wss.on('connection', (ws) => {
  const id = nanoid(10);
  sockets.set(id, ws);
  const player = makePlayer(id);
  players.set(id, player);

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      handleMessage(player, msg);
    } catch (err) {
      // ignore
    }
  });

  ws.on('close', () => {
    sockets.delete(id);
    players.delete(id);
  });

  // Welcome snapshot
  ensurePopulations();
  sendTo(id, {
    type: 'welcome',
    you: sanitizePlayer(player),
    world: {
      mapSize: MAP_SIZE,
      mobs: Array.from(mobs.values()),
      resources: Array.from(resources.values()),
      skills: SKILL_DEFS,
      resourcesDefs: RESOURCE_DEFS,
      mobDefs: MOB_DEFS,
    },
  });
});

function sanitizePlayer(p) {
  return {
    id: p.id,
    name: p.name,
    x: p.x,
    y: p.y,
    hp: p.hp,
    maxHp: p.maxHp,
    gold: p.gold,
    weaponLevel: p.weaponLevel,
    armorLevel: p.armorLevel,
    inventory: p.inventory,
    skills: p.skills,
  };
}

function handleMessage(player, msg) {
  switch (msg.type) {
    case 'input': {
      const i = msg.inputs || {};
      player.inputs.up = !!i.up;
      player.inputs.down = !!i.down;
      player.inputs.left = !!i.left;
      player.inputs.right = !!i.right;
      break;
    }
    case 'attack': {
      const now = Date.now();
      if (now - player.lastAttackAt < ATTACK_COOLDOWN_MS) break;
      player.lastAttackAt = now;
      // Find nearest mob in range
      let best = null;
      let bestDist = Infinity;
      for (const mob of mobs.values()) {
        const d = distance(player, mob);
        if (d < ATTACK_RANGE && d < bestDist) {
          best = mob;
          bestDist = d;
        }
      }
      if (!best) {
        sendTo(player.id, { type: 'combat', message: 'No target in range.' });
        break;
      }
      const dmg = playerDamage(player);
      best.hp -= dmg;
      if (best.hp <= 0) {
        const reward = Math.floor(randomInRange(best.goldRange[0], best.goldRange[1] + 1));
        player.gold += reward;
        sendTo(player.id, { type: 'combat', message: `You defeated ${best.name} and looted ${reward} gold!` });
        mobs.delete(best.id);
      } else {
        // Counter-attack
        const retaliation = applyArmorReduction(best.baseDamage, player.armorLevel);
        player.hp -= retaliation;
        if (player.hp <= 0) {
          player.hp = player.maxHp;
          player.x = randomInRange(200, MAP_SIZE - 200);
          player.y = randomInRange(200, MAP_SIZE - 200);
          sendTo(player.id, { type: 'death', message: 'You were defeated and respawned.' });
        }
      }
      // Inform self about your updated stats
      sendTo(player.id, { type: 'you', you: sanitizePlayer(player) });
      break;
    }
    case 'gather': {
      const now = Date.now();
      if (now - player.lastGatherAt < GATHER_COOLDOWN_MS) break;
      player.lastGatherAt = now;

      // Find nearest resource in range
      let best = null;
      let bestDist = Infinity;
      for (const res of resources.values()) {
        const d = distance(player, res);
        if (d < GATHER_RANGE && d < bestDist) {
          best = res;
          bestDist = d;
        }
      }
      if (!best) {
        sendTo(player.id, { type: 'gather', message: 'Nothing to gather nearby.' });
        break;
      }
      const skillKey = best.skill;
      const skill = player.skills[skillKey];
      const chance = Math.min(0.95, 0.4 + skill.level * 0.1); // better with level
      if (Math.random() < chance) {
        player.inventory[best.type] = (player.inventory[best.type] || 0) + 1;
        addSkillXp(player, skillKey, 20);
        resources.delete(best.id);
        sendTo(player.id, { type: 'gather', message: `Gathered 1 ${best.type}.` });
      } else {
        addSkillXp(player, skillKey, 8);
        sendTo(player.id, { type: 'gather', message: `Failed to gather ${best.type}.` });
      }
      sendTo(player.id, { type: 'you', you: sanitizePlayer(player) });
      break;
    }
    case 'upgrade': {
      const slot = msg.slot === 'armor' ? 'armor' : 'weapon';
      const level = slot === 'weapon' ? player.weaponLevel : player.armorLevel;
      const cost = upgradeCost(slot, level);
      if (player.gold >= cost) {
        player.gold -= cost;
        if (slot === 'weapon') player.weaponLevel += 1; else player.armorLevel += 1;
        sendTo(player.id, { type: 'upgrade', message: `${slot} upgraded to level ${slot === 'weapon' ? player.weaponLevel : player.armorLevel}!` });
      } else {
        sendTo(player.id, { type: 'upgrade', message: `Not enough gold. Need ${cost}.` });
      }
      sendTo(player.id, { type: 'you', you: sanitizePlayer(player) });
      break;
    }
    default:
      break;
  }
}

// -----------------------
// Start Server
// -----------------------
server.listen(PORT, () => {
  console.log(`MMO-RPG server listening on http://localhost:${PORT}`);
});