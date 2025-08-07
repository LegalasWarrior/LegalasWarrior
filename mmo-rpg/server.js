import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import { nanoid } from 'nanoid';

// Text RPG Server
const app = express();
app.use(express.static('public'));
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const PORT = process.env.PORT || 3000;

// -----------------------
// Game Data
// -----------------------
const LOCATIONS = [
  { key: 'city', name: 'Астер (Центральный город)', requiredLevel: 1, type: 'city' },
  { key: 'meadow', name: 'Изумрудные луга', requiredLevel: 1, type: 'combat' },
  { key: 'ruins', name: 'Погибшие руины', requiredLevel: 10, type: 'combat' },
  { key: 'caverns', name: 'Обсидиановые пещеры', requiredLevel: 20, type: 'combat' },
  { key: 'peaks', name: 'Грозовые пики', requiredLevel: 30, type: 'combat' },
  { key: 'fields', name: 'Ремесленные угодья', requiredLevel: 1, type: 'gather' },
];

// Items registry
// type: 'weapon' | 'armor' | 'tool' | 'consumable' | 'resource' | 'material' | 'junk'
const ITEMS = {
  // Weapons
  rusty_dagger: { key: 'rusty_dagger', name: 'Ржавый кинжал', type: 'weapon', atk: 4, basePrice: 20 },
  bronze_sword: { key: 'bronze_sword', name: 'Бронзовый меч', type: 'weapon', atk: 7, basePrice: 80 },
  iron_sword: { key: 'iron_sword', name: 'Железный меч', type: 'weapon', atk: 11, basePrice: 180 },
  steel_sword: { key: 'steel_sword', name: 'Стальной меч', type: 'weapon', atk: 16, basePrice: 400 },
  mythril_blade: { key: 'mythril_blade', name: 'Мифриловый клинок', type: 'weapon', atk: 24, basePrice: 1200 },

  // Armor
  cloth_garb: { key: 'cloth_garb', name: 'Тканевый наряд', type: 'armor', def: 2, basePrice: 25 },
  leather_armor: { key: 'leather_armor', name: 'Кожаная броня', type: 'armor', def: 5, basePrice: 110 },
  chainmail: { key: 'chainmail', name: 'Кольчуга', type: 'armor', def: 9, basePrice: 260 },
  plate_armor: { key: 'plate_armor', name: 'Латы', type: 'armor', def: 14, basePrice: 600 },
  dragonscale: { key: 'dragonscale', name: 'Драконья чешуя (доспех)', type: 'armor', def: 22, basePrice: 1600 },

  // Tools (tier influences gathering)
  crude_pickaxe: { key: 'crude_pickaxe', name: 'Грубая кирка', type: 'tool', tool: 'pickaxe', tier: 1, basePrice: 60 },
  sturdy_pickaxe: { key: 'sturdy_pickaxe', name: 'Крепкая кирка', type: 'tool', tool: 'pickaxe', tier: 2, basePrice: 180 },
  master_pickaxe: { key: 'master_pickaxe', name: 'Мастерская кирка', type: 'tool', tool: 'pickaxe', tier: 3, basePrice: 520 },
  crude_axe: { key: 'crude_axe', name: 'Грубый топор', type: 'tool', tool: 'axe', tier: 1, basePrice: 60 },
  sturdy_axe: { key: 'sturdy_axe', name: 'Крепкий топор', type: 'tool', tool: 'axe', tier: 2, basePrice: 180 },
  master_axe: { key: 'master_axe', name: 'Мастерский топор', type: 'tool', tool: 'axe', tier: 3, basePrice: 520 },
  twig_rod: { key: 'twig_rod', name: 'Ветвистая удочка', type: 'tool', tool: 'rod', tier: 1, basePrice: 50 },
  fiber_rod: { key: 'fiber_rod', name: 'Фибровая удочка', type: 'tool', tool: 'rod', tier: 2, basePrice: 150 },
  crystal_rod: { key: 'crystal_rod', name: 'Кристаллическая удочка', type: 'tool', tool: 'rod', tier: 3, basePrice: 480 },
  field_knife: { key: 'field_knife', name: 'Полевой нож', type: 'tool', tool: 'knife', tier: 1, basePrice: 50 },
  hunter_knife: { key: 'hunter_knife', name: 'Охотничий нож', type: 'tool', tool: 'knife', tier: 2, basePrice: 150 },
  butcher_knife: { key: 'butcher_knife', name: 'Разделочный нож', type: 'tool', tool: 'knife', tier: 3, basePrice: 480 },
  hand_sickle: { key: 'hand_sickle', name: 'Ручной серп', type: 'tool', tool: 'sickle', tier: 1, basePrice: 50 },
  iron_sickle: { key: 'iron_sickle', name: 'Железный серп', type: 'tool', tool: 'sickle', tier: 2, basePrice: 150 },
  moon_sickle: { key: 'moon_sickle', name: 'Лунный серп', type: 'tool', tool: 'sickle', tier: 3, basePrice: 480 },

  // Consumables
  small_potion: { key: 'small_potion', name: 'Малая лечебная настойка', type: 'consumable', heal: 30, basePrice: 40 },
  mid_potion: { key: 'mid_potion', name: 'Средняя лечебная настойка', type: 'consumable', heal: 70, basePrice: 110 },
  big_potion: { key: 'big_potion', name: 'Большая лечебная настойка', type: 'consumable', heal: 140, basePrice: 240 },

  // Resources
  ore: { key: 'ore', name: 'Руда', type: 'resource', basePrice: 14 },
  wood: { key: 'wood', name: 'Дерево', type: 'resource', basePrice: 10 },
  fish: { key: 'fish', name: 'Рыба', type: 'resource', basePrice: 9 },
  herb: { key: 'herb', name: 'Трава', type: 'resource', basePrice: 11 },
  hide: { key: 'hide', name: 'Шкура', type: 'resource', basePrice: 13 },

  // Materials
  bronze_ingot: { key: 'bronze_ingot', name: 'Бронзовый слиток', type: 'material', basePrice: 36 },
  iron_ingot: { key: 'iron_ingot', name: 'Железный слиток', type: 'material', basePrice: 62 },
  wood_plank: { key: 'wood_plank', name: 'Доска', type: 'material', basePrice: 18 },
  leather: { key: 'leather', name: 'Кожа', type: 'material', basePrice: 28 },
  tincture: { key: 'tincture', name: 'Эссенция трав', type: 'material', basePrice: 30 },

  // Junk/Loot
  torn_cloth: { key: 'torn_cloth', name: 'Рваная ткань', type: 'junk', basePrice: 4 },
  cracked_bone: { key: 'cracked_bone', name: 'Треснувшая кость', type: 'junk', basePrice: 5 },
  rusty_gear: { key: 'rusty_gear', name: 'Ржавое железо', type: 'junk', basePrice: 6 },
  obsidian_shard: { key: 'obsidian_shard', name: 'Обсидиановый осколок', type: 'junk', basePrice: 12 },
  storm_essence: { key: 'storm_essence', name: 'Сущность грозы', type: 'junk', basePrice: 14 },
};

// Crafting recipes
const RECIPES = [
  { key: 'bronze_ingot', name: 'Переплавка бронзы', out: 'bronze_ingot', qty: 1, inputs: { ore: 3 } },
  { key: 'iron_ingot', name: 'Переплавка железа', out: 'iron_ingot', qty: 1, inputs: { ore: 5 } },
  { key: 'wood_plank', name: 'Распил досок', out: 'wood_plank', qty: 2, inputs: { wood: 2 } },
  { key: 'leather', name: 'Выделка кожи', out: 'leather', qty: 1, inputs: { hide: 2 } },
  { key: 'tincture', name: 'Травяная эссенция', out: 'tincture', qty: 1, inputs: { herb: 3 } },
  { key: 'bronze_sword', name: 'Ковать бронзовый меч', out: 'bronze_sword', qty: 1, inputs: { bronze_ingot: 2, wood_plank: 1 } },
  { key: 'iron_sword', name: 'Ковать железный меч', out: 'iron_sword', qty: 1, inputs: { iron_ingot: 2, wood_plank: 1 } },
  { key: 'leather_armor', name: 'Шить кожаную броню', out: 'leather_armor', qty: 1, inputs: { leather: 3, tincture: 1 } },
  { key: 'chainmail', name: 'Ковать кольчугу', out: 'chainmail', qty: 1, inputs: { iron_ingot: 4, leather: 1 } },
  { key: 'mid_potion', name: 'Варить среднюю настойку', out: 'mid_potion', qty: 1, inputs: { tincture: 2, herb: 1 } },
];

// Demand-driven economy factors
const demandFactor = new Map(); // itemKey -> factor
function getDemandFactor(itemKey) {
  if (!demandFactor.has(itemKey)) demandFactor.set(itemKey, 1);
  return demandFactor.get(itemKey);
}
function adjustDemand(itemKey, delta) {
  const current = getDemandFactor(itemKey);
  const next = Math.max(0.6, Math.min(1.8, current + delta));
  demandFactor.set(itemKey, next);
}
function priceFor(itemKey) {
  const item = ITEMS[itemKey];
  if (!item) return 0;
  const p = Math.round(item.basePrice * getDemandFactor(itemKey));
  return Math.max(1, p);
}

// Merchants in the city
const MERCHANTS = [
  { key: 'general', name: 'Лавка ремесленника', sells: ['small_potion', 'mid_potion', 'crude_pickaxe', 'crude_axe', 'twig_rod', 'field_knife', 'hand_sickle'], buys: 'all' },
  { key: 'armorer', name: 'Оружейник', sells: ['rusty_dagger', 'bronze_sword', 'cloth_garb', 'leather_armor'], buys: ['weapon', 'armor', 'junk'] },
  { key: 'trader', name: 'Скупщик ресурсов', sells: [], buys: ['resource', 'material'] },
];

// 50 mobs across combat locations
const MOBS = [
  // Meadows (1+)
  m('meadow', 'field_rat', 'Полевой крыс', 1, 4, 24, 5, 6, 6, drops({ torn_cloth: [0.6, [1, 2]], small_potion: [0.12, [1, 1]] })),
  m('meadow', 'wild_hare', 'Дикий заяц', 1, 6, 30, 6, 7, 8, drops({ herb: [0.5, [1, 2]], hide: [0.25, [1, 1]] })),
  m('meadow', 'green_slime', 'Зелёный слизень', 2, 8, 36, 7, 8, 10, drops({ herb: [0.35, [1, 2]], torn_cloth: [0.4, [1, 2]] })),
  m('meadow', 'wolf_pup', 'Волчонок', 3, 9, 44, 8, 10, 14, drops({ hide: [0.5, [1, 2]], field_knife: [0.05, [1, 1]] })),
  m('meadow', 'bandit', 'Бандит', 5, 12, 55, 10, 12, 18, drops({ rusty_dagger: [0.08, [1, 1]], small_potion: [0.14, [1, 1]], wood: [0.3, [1, 2]] })),
  m('meadow', 'boar', 'Кабан', 6, 12, 62, 11, 13, 22, drops({ hide: [0.55, [1, 2]], herb: [0.25, [1, 2]] })),
  m('meadow', 'stray_goblin', 'Бродячий гоблин', 7, 13, 68, 12, 15, 26, drops({ wood: [0.35, [1, 2]], ore: [0.2, [1, 1]] })),
  m('meadow', 'lost_scout', 'Заблудший разведчик', 8, 14, 74, 13, 16, 28, drops({ torn_cloth: [0.5, [1, 3]], wood: [0.3, [1, 2]] })),
  m('meadow', 'thorn_sprite', 'Терновый дух', 9, 15, 80, 14, 18, 32, drops({ herb: [0.6, [1, 3]], small_potion: [0.14, [1, 1]] })),
  m('meadow', 'alpha_wolf', 'Вожак стаи', 10, 16, 95, 15, 22, 38, drops({ hide: [0.65, [2, 3]], leather: [0.18, [1, 1]] })),
  // Ruins (10+)
  m('ruins', 'skeletal_hand', 'Скелет в тряпьё', 10, 18, 90, 16, 18, 36, drops({ cracked_bone: [0.6, [1, 3]], torn_cloth: [0.5, [1, 2]] })),
  m('ruins', 'crypt_spider', 'Криптовый паук', 11, 19, 96, 18, 20, 40, drops({ herb: [0.35, [1, 2]] })),
  m('ruins', 'ghoul', 'Умертвие', 12, 20, 104, 20, 22, 44, drops({ small_potion: [0.16, [1, 1]], cracked_bone: [0.6, [1, 3]] })),
  m('ruins', 'ruin_bandit', 'Разбойник руин', 13, 22, 112, 22, 24, 48, drops({ bronze_sword: [0.06, [1, 1]], wood_plank: [0.25, [1, 2]] })),
  m('ruins', 'shadow_bat', 'Теневая летучая мышь', 14, 22, 118, 23, 26, 50, drops({ herb: [0.4, [1, 2]], small_potion: [0.12, [1, 1]] })),
  m('ruins', 'bone_soldier', 'Костяной солдат', 15, 24, 126, 26, 28, 54, drops({ chainmail: [0.05, [1, 1]], cracked_bone: [0.7, [1, 3]] })),
  m('ruins', 'ruin_mage', 'Маг руин', 16, 26, 132, 28, 32, 58, drops({ tincture: [0.2, [1, 1]] })),
  m('ruins', 'grave_robber', 'Мародёр', 17, 26, 138, 30, 34, 62, drops({ iron_sword: [0.05, [1, 1]], rusty_gear: [0.4, [1, 2]] })),
  m('ruins', 'wraith', 'Морок', 18, 28, 146, 32, 36, 66, drops({ small_potion: [0.16, [1, 1]], storm_essence: [0.14, [1, 1]] })),
  m('ruins', 'bone_champion', 'Костяной чемпион', 20, 30, 160, 36, 40, 72, drops({ chainmail: [0.07, [1, 1]], iron_ingot: [0.2, [1, 1]] })),
  // Caverns (20+)
  m('caverns', 'obsidian_bug', 'Обсидиановый жук', 20, 30, 170, 38, 42, 78, drops({ obsidian_shard: [0.6, [1, 2]], ore: [0.4, [1, 2]] })),
  m('caverns', 'lava_slime', 'Лавовый слизень', 21, 31, 178, 40, 45, 82, drops({ small_potion: [0.18, [1, 1]] })),
  m('caverns', 'deep_goblin', 'Глубинный гоблин', 22, 32, 186, 42, 48, 86, drops({ sturdy_pickaxe: [0.05, [1, 1]], ore: [0.5, [1, 2]] })),
  m('caverns', 'cave_wolf', 'Пещерный волк', 23, 33, 192, 44, 50, 90, drops({ hide: [0.5, [1, 2]] })),
  m('caverns', 'bat_swarm', 'Рой летучих мышей', 24, 34, 198, 46, 52, 94, drops({ herb: [0.35, [1, 2]] })),
  m('caverns', 'obsidian_guard', 'Обсидиановый страж', 25, 35, 210, 50, 58, 100, drops({ iron_ingot: [0.22, [1, 1]], steel_sword: [0.04, [1, 1]] })),
  m('caverns', 'tunnel_worm', 'Шахтный червь', 26, 36, 218, 52, 60, 104, drops({ ore: [0.6, [1, 3]] })),
  m('caverns', 'ash_elemental', 'Пепельный элементаль', 27, 37, 224, 54, 64, 108, drops({ obsidian_shard: [0.5, [1, 2]] })),
  m('caverns', 'fire_crawler', 'Огненный краулер', 28, 38, 232, 56, 68, 112, drops({ small_potion: [0.18, [1, 1]] })),
  m('caverns', 'ember_titan', 'Тлеющий титан', 30, 40, 250, 60, 72, 120, drops({ steel_sword: [0.05, [1, 1]], obsidian_shard: [0.6, [1, 3]] })),
  // Peaks (30+)
  m('peaks', 'storm_hawk', 'Грозовой ястреб', 30, 42, 260, 64, 76, 130, drops({ storm_essence: [0.5, [1, 2]], fish: [0.3, [1, 2]] })),
  m('peaks', 'frost_wolf', 'Морозный волк', 31, 43, 270, 66, 80, 134, drops({ hide: [0.55, [1, 2]] })),
  m('peaks', 'sky_goblin', 'Небесный гоблин', 32, 44, 280, 70, 84, 140, drops({ wood: [0.4, [1, 2]] })),
  m('peaks', 'storm_elemental', 'Грозовой элементаль', 33, 45, 292, 72, 88, 146, drops({ storm_essence: [0.6, [1, 2]] })),
  m('peaks', 'peak_yeti', 'Пиковый йети', 34, 46, 305, 76, 92, 152, drops({ leather: [0.24, [1, 1]] })),
  m('peaks', 'sky_serpent', 'Небесная змея', 35, 47, 318, 80, 96, 160, drops({ big_potion: [0.06, [1, 1]] })),
  m('peaks', 'storm_knight', 'Рыцарь бури', 36, 48, 330, 84, 100, 168, drops({ plate_armor: [0.05, [1, 1]] })),
  m('peaks', 'wind_warden', 'Страж ветров', 37, 49, 342, 88, 104, 176, drops({ mythril_blade: [0.04, [1, 1]] })),
  m('peaks', 'thunder_ogre', 'Громовой огр', 38, 50, 356, 92, 108, 184, drops({ storm_essence: [0.6, [1, 2]], iron_ingot: [0.2, [1, 1]] })),
  m('peaks', 'tempest_titan', 'Буревой титан', 40, 55, 380, 100, 120, 200, drops({ dragonscale: [0.04, [1, 1]], storm_essence: [0.7, [2, 3]] })),
];
// helper to create mob
function m(locationKey, key, name, minLevel, maxLevel, hp, atk, xp, gold, dropTable) {
  return { locationKey, key, name, minLevel, maxLevel, hp, atk, xp, gold, dropTable };
}
function drops(obj) {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const [chance, qty] = v; // qty as [min,max]
    out.push({ itemKey: k, chance, min: qty[0], max: qty[1] });
  }
  return out;
}

// -----------------------
// Utils
// -----------------------
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function chance(p) { return Math.random() < p; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// -----------------------
// Player State
// -----------------------
function makePlayer(id) {
  return {
    id,
    name: `Игрок-${id.slice(-4)}`,
    level: 1,
    xp: 0,
    hp: 100,
    maxHp: 100,
    gold: 100,
    location: 'city',
    equipment: { weapon: 'rusty_dagger', armor: 'cloth_garb', pickaxe: null, axe: null, rod: null, knife: null, sickle: null },
    inventory: {}, // itemKey -> count
    storage: {},   // city warehouse
    logs: [],
    encounter: null, // { mob, hp }
  };
}

function addLog(player, text) {
  player.logs.unshift(`[${new Date().toLocaleTimeString()}] ${text}`);
  if (player.logs.length > 200) player.logs.pop();
}

function addItem(bag, itemKey, qty) {
  if (!ITEMS[itemKey]) return false;
  bag[itemKey] = (bag[itemKey] || 0) + qty;
  if (bag[itemKey] <= 0) delete bag[itemKey];
  return true;
}

function countStacks(bag) { return Object.keys(bag).length; }
const INVENTORY_CAP = 30;

function canAddToInventory(player, itemKey) {
  if (player.inventory[itemKey]) return true; // stacking existing
  return countStacks(player.inventory) < INVENTORY_CAP;
}

function playerAttackPower(player) {
  const weapon = player.equipment.weapon ? ITEMS[player.equipment.weapon] : null;
  const base = 5 + player.level * 1.5;
  return Math.round(base + (weapon?.atk || 0));
}
function playerDefense(player) {
  const armor = player.equipment.armor ? ITEMS[player.equipment.armor] : null;
  const base = 1 + Math.floor(player.level / 5);
  return base + (armor?.def || 0);
}

function levelThreshold(level) {
  return 100 + (level - 1) * 80 + Math.floor((level - 1) * (level - 1) * 12);
}

function grantXp(player, amount) {
  player.xp += amount;
  let th = levelThreshold(player.level);
  while (player.xp >= th) {
    player.xp -= th;
    player.level += 1;
    player.maxHp += 12;
    player.hp = player.maxHp;
    th = levelThreshold(player.level);
    addLog(player, `Вы повысили уровень до ${player.level}! Здоровье восстановлено.`);
  }
}

function healCost(player) {
  const missing = Math.max(0, player.maxHp - player.hp);
  if (missing === 0) return 0;
  return Math.max(1, Math.ceil(missing * 0.4));
}

function canAccessLocation(player, locKey) {
  const loc = LOCATIONS.find(l => l.key === locKey);
  if (!loc) return false;
  return player.level >= loc.requiredLevel;
}

function randomMobForLocation(locKey, level) {
  const pool = MOBS.filter(m => m.locationKey === locKey && level >= m.minLevel - 3);
  if (pool.length === 0) return null;
  const m = pool[randInt(0, pool.length - 1)];
  // scale hp slightly by level
  const scale = 1 + Math.max(0, Math.floor((level - m.minLevel) / 5)) * 0.06;
  return { ...m, hp: Math.round(m.hp * scale) };
}

function calculateGatherChance(player, toolType) {
  const slot = toolType; // pickaxe/axe/rod/knife/sickle
  const key = player.equipment[slot];
  const tier = key ? (ITEMS[key].tier || 0) : 0;
  let chance = 0.4 + tier * 0.15;
  return clamp(chance, 0.2, 0.95);
}

// -----------------------
// Economy helpers
// -----------------------
function canMerchantBuy(merchant, itemKey) {
  if (merchant.buys === 'all') return true;
  const item = ITEMS[itemKey];
  if (!item) return false;
  return merchant.buys.includes(item.type);
}

function merchantSells(merchant) {
  return merchant.sells.map(k => ({ key: k, name: ITEMS[k].name, price: priceFor(k) }));
}

// -----------------------
// Network
// -----------------------
const sockets = new Map(); // id -> ws
const players = new Map(); // id -> player

function sendTo(playerId, msg) {
  const ws = sockets.get(playerId);
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function pushState(player) {
  sendTo(player.id, {
    type: 'state',
    you: sanitizePlayer(player),
    meta: {
      locations: LOCATIONS,
      merchants: MERCHANTS.map(m => ({ key: m.key, name: m.name, sells: merchantSells(m) })),
      recipes: RECIPES,
      prices: Object.fromEntries(Object.keys(ITEMS).map(k => [k, priceFor(k)])),
    }
  });
}

function sanitizePlayer(p) {
  return {
    id: p.id,
    name: p.name,
    level: p.level,
    xp: p.xp,
    hp: p.hp,
    maxHp: p.maxHp,
    gold: p.gold,
    location: p.location,
    equipment: p.equipment,
    inventory: p.inventory,
    storage: p.storage,
    logs: p.logs,
    encounter: p.encounter ? { name: p.encounter.name, hp: p.encounter.hp, maxHp: p.encounter.hp, atk: p.encounter.atk } : null,
  };
}

wss.on('connection', (ws) => {
  const id = nanoid(10);
  sockets.set(id, ws);
  const player = makePlayer(id);
  // Starter items
  addItem(player.inventory, 'small_potion', 3);
  addLog(player, 'Добро пожаловать в текстовую RPG! Вы в городе Астер.');
  players.set(id, player);

  pushState(player);

  ws.on('message', (buf) => {
    try {
      const msg = JSON.parse(buf);
      handleMessage(player, msg);
    } catch (_) {}
  });
  ws.on('close', () => {
    sockets.delete(id);
    players.delete(id);
  });
});

function handleMessage(player, msg) {
  switch (msg.type) {
    case 'navigate': {
      const to = msg.to;
      const loc = LOCATIONS.find(l => l.key === to);
      if (!loc) { addLog(player, 'Локация не найдена.'); break; }
      if (!canAccessLocation(player, to)) { addLog(player, `Недостаточный уровень для локации: требуется ${loc.requiredLevel}.`); break; }
      player.location = to;
      player.encounter = null;
      addLog(player, `Вы переместились в: ${loc.name}.`);
      pushState(player);
      break;
    }
    case 'heal': {
      if (player.location !== 'city') { addLog(player, 'Лечиться можно только в городе.'); break; }
      const cost = healCost(player);
      if (cost === 0) { addLog(player, 'Вы полностью здоровы.'); break; }
      if (player.gold < cost) { addLog(player, `Не хватает золота для лечения (нужно ${cost}).`); break; }
      player.gold -= cost;
      player.hp = player.maxHp;
      addLog(player, `Вы вылечились за ${cost} золота.`);
      pushState(player);
      break;
    }
    case 'search': {
      const loc = LOCATIONS.find(l => l.key === player.location);
      if (!loc || loc.type !== 'combat') { addLog(player, 'Здесь нельзя искать врагов.'); break; }
      if (player.encounter) { addLog(player, 'Вы уже в бою.'); break; }
      const mob = randomMobForLocation(player.location, player.level);
      if (!mob) { addLog(player, 'Вы никого не нашли.'); break; }
      player.encounter = { mobKey: mob.key, name: mob.name, hp: mob.hp, atk: mob.atk, xp: mob.xp, gold: mob.gold, dropTable: mob.dropTable };
      addLog(player, `Вас атакует: ${mob.name}! HP: ${mob.hp}`);
      pushState(player);
      break;
    }
    case 'attack': {
      if (!player.encounter) { addLog(player, 'Некого атаковать.'); break; }
      const atk = playerAttackPower(player);
      const dmg = randInt(Math.max(1, Math.floor(atk * 0.7)), Math.floor(atk * 1.1));
      player.encounter.hp -= dmg;
      addLog(player, `Вы ударили по ${player.encounter.name} на ${dmg}.`);
      if (player.encounter.hp <= 0) {
        const g = randInt(Math.floor(player.encounter.gold * 0.8), player.encounter.gold);
        player.gold += g;
        grantXp(player, player.encounter.xp);
        // Drops
        for (const d of player.encounter.dropTable) {
          if (chance(d.chance)) {
            const qty = randInt(d.min, d.max);
            if (canAddToInventory(player, d.itemKey)) {
              addItem(player.inventory, d.itemKey, qty);
              addLog(player, `Добыча: ${ITEMS[d.itemKey].name} x${qty}.`);
            } else {
              addLog(player, `Нет места в инвентаре для ${ITEMS[d.itemKey].name}.`);
            }
          }
        }
        addLog(player, `Победа! Золото +${g}, опыт +${player.encounter.xp}.`);
        player.encounter = null;
        pushState(player);
        break;
      }
      // Enemy turn
      const def = playerDefense(player);
      const enemyAtk = player.encounter.atk;
      const edmgBase = randInt(Math.max(1, Math.floor(enemyAtk * 0.7)), Math.floor(enemyAtk * 1.1));
      const red = Math.floor(def * 0.5);
      const edmg = Math.max(1, edmgBase - red);
      player.hp -= edmg;
      addLog(player, `${player.encounter.name} бьёт вас на ${edmg}.`);
      if (player.hp <= 0) {
        const penalty = Math.max(0, Math.floor(player.gold * 0.1));
        player.gold -= penalty;
        player.hp = player.maxHp;
        player.location = 'city';
        player.encounter = null;
        addLog(player, `Вы пали в бою. Потеряно золота: ${penalty}. Вы очнулись в городе.`);
      }
      pushState(player);
      break;
    }
    case 'flee': {
      if (!player.encounter) { addLog(player, 'Вам не от кого бежать.'); break; }
      if (chance(0.6)) {
        addLog(player, 'Вы успешно убежали.');
        player.encounter = null;
      } else {
        addLog(player, 'Не удалось сбежать!');
      }
      pushState(player);
      break;
    }
    case 'use': {
      const key = msg.itemKey;
      if (!player.inventory[key] || player.inventory[key] <= 0) { addLog(player, 'Нет такого предмета.'); break; }
      const it = ITEMS[key];
      if (!it || it.type !== 'consumable') { addLog(player, 'Этот предмет нельзя использовать.'); break; }
      player.inventory[key] -= 1; if (player.inventory[key] === 0) delete player.inventory[key];
      const before = player.hp;
      player.hp = Math.min(player.maxHp, player.hp + (it.heal || 0));
      addLog(player, `Вы использовали: ${it.name}. Восстановлено ${player.hp - before} HP.`);
      pushState(player);
      break;
    }
    case 'equip': {
      const key = msg.itemKey;
      const it = ITEMS[key];
      if (!it) { addLog(player, 'Неизвестный предмет.'); break; }
      if (!player.inventory[key]) { addLog(player, 'Нет предмета в инвентаре.'); break; }
      if (it.type === 'weapon') {
        // swap
        if (player.equipment.weapon) addItem(player.inventory, player.equipment.weapon, 1);
        player.equipment.weapon = key;
        addItem(player.inventory, key, -1);
        addLog(player, `Вы экипировали оружие: ${it.name}.`);
      } else if (it.type === 'armor') {
        if (player.equipment.armor) addItem(player.inventory, player.equipment.armor, 1);
        player.equipment.armor = key;
        addItem(player.inventory, key, -1);
        addLog(player, `Вы экипировали броню: ${it.name}.`);
      } else if (it.type === 'tool') {
        const slot = it.tool; // pickaxe/axe/rod/knife/sickle
        if (player.equipment[slot]) addItem(player.inventory, player.equipment[slot], 1);
        player.equipment[slot] = key;
        addItem(player.inventory, key, -1);
        addLog(player, `Вы вооружились инструментом: ${it.name}.`);
      } else {
        addLog(player, 'Этот предмет нельзя экипировать.');
      }
      pushState(player);
      break;
    }
    case 'unequip': {
      const slot = msg.slot; // weapon/armor/pickaxe/axe/rod/knife/sickle
      if (!player.equipment[slot]) { addLog(player, 'Слот пуст.'); break; }
      const key = player.equipment[slot];
      if (!canAddToInventory(player, key)) { addLog(player, 'Нет места в инвентаре.'); break; }
      addItem(player.inventory, key, 1);
      player.equipment[slot] = null;
      addLog(player, `Вы сняли предмет: ${ITEMS[key].name}.`);
      pushState(player);
      break;
    }
    case 'buy': {
      if (player.location !== 'city') { addLog(player, 'Покупать можно только в городе.'); break; }
      const { merchantKey, itemKey, qty } = msg;
      const m = MERCHANTS.find(x => x.key === merchantKey);
      if (!m) { addLog(player, 'Торговец не найден.'); break; }
      if (!m.sells.includes(itemKey)) { addLog(player, 'Этот торговец не продаёт такой товар.'); break; }
      const q = clamp(Math.floor(qty || 1), 1, 99);
      const price = priceFor(itemKey) * q;
      if (player.gold < price) { addLog(player, `Недостаточно золота. Нужно ${price}.`); break; }
      if (!canAddToInventory(player, itemKey) && !player.inventory[itemKey]) { addLog(player, 'Нет места в инвентаре.'); break; }
      player.gold -= price;
      addItem(player.inventory, itemKey, q);
      adjustDemand(itemKey, +0.05);
      addLog(player, `Покупка: ${ITEMS[itemKey].name} x${q} за ${price}.`);
      pushState(player);
      break;
    }
    case 'sell': {
      if (player.location !== 'city') { addLog(player, 'Продавать можно только в городе.'); break; }
      const { merchantKey, itemKey, qty } = msg;
      const m = MERCHANTS.find(x => x.key === merchantKey);
      if (!m) { addLog(player, 'Торговец не найден.'); break; }
      if (!canMerchantBuy(m, itemKey)) { addLog(player, 'Этот торговец не покупает такой товар.'); break; }
      const have = player.inventory[itemKey] || 0;
      if (have <= 0) { addLog(player, 'Нет товара для продажи.'); break; }
      const q = clamp(Math.floor(qty || 1), 1, have);
      const price = priceFor(itemKey) * q;
      addItem(player.inventory, itemKey, -q);
      player.gold += price;
      adjustDemand(itemKey, -0.05);
      addLog(player, `Продажа: ${ITEMS[itemKey].name} x${q} за ${price}.`);
      pushState(player);
      break;
    }
    case 'store': {
      if (player.location !== 'city') { addLog(player, 'Склад доступен только в городе.'); break; }
      const { itemKey, qty } = msg;
      const have = player.inventory[itemKey] || 0;
      if (have <= 0) { addLog(player, 'Нет предметов для перемещения на склад.'); break; }
      const q = clamp(Math.floor(qty || 1), 1, have);
      addItem(player.inventory, itemKey, -q);
      addItem(player.storage, itemKey, q);
      addLog(player, `Перемещено на склад: ${ITEMS[itemKey].name} x${q}.`);
      pushState(player);
      break;
    }
    case 'withdraw': {
      if (player.location !== 'city') { addLog(player, 'Склад доступен только в городе.'); break; }
      const { itemKey, qty } = msg;
      const have = player.storage[itemKey] || 0;
      if (have <= 0) { addLog(player, 'Нет предметов на складе.'); break; }
      const q = clamp(Math.floor(qty || 1), 1, have);
      if (!canAddToInventory(player, itemKey) && !player.inventory[itemKey]) { addLog(player, 'Нет места в инвентаре.'); break; }
      addItem(player.storage, itemKey, -q);
      addItem(player.inventory, itemKey, q);
      addLog(player, `Забрано со склада: ${ITEMS[itemKey].name} x${q}.`);
      pushState(player);
      break;
    }
    case 'gather': {
      const { which } = msg; // 'mine' | 'chop' | 'fish' | 'forage' | 'hunt'
      if (player.location !== 'fields') { addLog(player, 'Добывать ресурсы можно в Ремесленных угодьях.'); break; }
      const map = { mine: ['ore', 'pickaxe'], chop: ['wood', 'axe'], fish: ['fish', 'rod'], forage: ['herb', 'sickle'], hunt: ['hide', 'knife'] };
      const pair = map[which];
      if (!pair) { addLog(player, 'Неизвестный тип добычи.'); break; }
      const [resKey, toolSlot] = pair;
      const p = calculateGatherChance(player, toolSlot);
      if (chance(p)) {
        const qty = randInt(1, 3);
        if (canAddToInventory(player, resKey) || player.inventory[resKey]) {
          addItem(player.inventory, resKey, qty);
          addLog(player, `Успех! Добыто ${ITEMS[resKey].name} x${qty}.`);
        } else {
          addLog(player, `Нет места для ${ITEMS[resKey].name}.`);
        }
      } else {
        addLog(player, 'Неудача. Ничего не добыто.');
      }
      pushState(player);
      break;
    }
    case 'craft': {
      if (player.location !== 'fields' && player.location !== 'city') { addLog(player, 'Крафт доступен в городе и в угодьях.'); break; }
      const rec = RECIPES.find(r => r.key === msg.recipeKey);
      if (!rec) { addLog(player, 'Неизвестный рецепт.'); break; }
      const qty = clamp(Math.floor(msg.qty || 1), 1, 99);
      // Check resources
      for (const [k, v] of Object.entries(rec.inputs)) {
        if ((player.inventory[k] || 0) < v * qty) { addLog(player, 'Недостаточно ресурсов.'); pushState(player); return; }
      }
      for (const [k, v] of Object.entries(rec.inputs)) addItem(player.inventory, k, -v * qty);
      if (!canAddToInventory(player, rec.out) && !player.inventory[rec.out]) { addLog(player, 'Нет места для результата.'); pushState(player); return; }
      addItem(player.inventory, rec.out, rec.qty * qty);
      addLog(player, `Создано: ${ITEMS[rec.out].name} x${rec.qty * qty}.`);
      pushState(player);
      break;
    }
    default:
      break;
  }
}

server.listen(PORT, () => {
  console.log(`Text RPG server running at http://localhost:${PORT}`);
});