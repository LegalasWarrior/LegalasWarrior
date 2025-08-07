import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

// Text RPG Server
const app = express();
app.use(express.static('public'));
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.resolve('./data');
const PLAYERS_FILE = path.join(DATA_DIR, 'players.json');

async function ensureDataDir() {
  try { await fs.mkdir(DATA_DIR, { recursive: true }); } catch {}
}

// -----------------------
// Game Data (unchanged items but ensure type info exists)
// -----------------------
const LOCATIONS = [
  { key: 'city', name: 'Астер (Центральный город)', requiredLevel: 1, type: 'city' },
  { key: 'meadow', name: 'Изумрудные луга', requiredLevel: 1, type: 'combat' },
  { key: 'ruins', name: 'Погибшие руины', requiredLevel: 10, type: 'combat' },
  { key: 'caverns', name: 'Обсидиановые пещеры', requiredLevel: 20, type: 'combat' },
  { key: 'peaks', name: 'Грозовые пики', requiredLevel: 30, type: 'combat' },
  { key: 'fields', name: 'Ремесленные угодья', requiredLevel: 1, type: 'gather' },
];

// Rarity helper
const RARITY = { common: 1, uncommon: 1.3, rare: 1.8, epic: 2.6, legendary: 4.0 };
function priceWithRarity(base, rarity) { return Math.round(base * (RARITY[rarity] || 1)); }

const ITEMS = {
  // Weapons
  rusty_dagger: { key: 'rusty_dagger', name: 'Ржавый кинжал', type: 'weapon', rarity: 'common', atk: 4, critChance: 0.05, critMult: 1.5, attackSpeed: 0.05, basePrice: priceWithRarity(20, 'common') },
  bronze_sword: { key: 'bronze_sword', name: 'Бронзовый меч', type: 'weapon', rarity: 'common', atk: 7, critChance: 0.06, critMult: 1.6, attackSpeed: 0.08, basePrice: priceWithRarity(80, 'common') },
  iron_sword: { key: 'iron_sword', name: 'Железный меч', type: 'weapon', rarity: 'uncommon', atk: 11, critChance: 0.08, critMult: 1.7, attackSpeed: 0.12, basePrice: priceWithRarity(180, 'uncommon') },
  steel_sword: { key: 'steel_sword', name: 'Стальной меч', type: 'weapon', rarity: 'rare', atk: 16, critChance: 0.10, critMult: 1.8, attackSpeed: 0.16, basePrice: priceWithRarity(400, 'rare') },
  mythril_blade: { key: 'mythril_blade', name: 'Мифриловый клинок', type: 'weapon', rarity: 'epic', atk: 24, critChance: 0.12, critMult: 2.0, attackSpeed: 0.22, basePrice: priceWithRarity(1200, 'epic') },
  ultra_blade: { key: 'ultra_blade', name: 'Ультраклинок', type: 'weapon', rarity: 'legendary', atk: 36, critChance: 0.15, critMult: 2.3, attackSpeed: 0.28, basePrice: priceWithRarity(2600, 'legendary') },

  // Armor
  cloth_garb: { key: 'cloth_garb', name: 'Тканевый наряд', type: 'armor', rarity: 'common', def: 2, dmgReduction: 0.02, basePrice: priceWithRarity(25, 'common') },
  leather_armor: { key: 'leather_armor', name: 'Кожаная броня', type: 'armor', rarity: 'common', def: 5, dmgReduction: 0.05, basePrice: priceWithRarity(110, 'common') },
  chainmail: { key: 'chainmail', name: 'Кольчуга', type: 'armor', rarity: 'uncommon', def: 9, dmgReduction: 0.08, basePrice: priceWithRarity(260, 'uncommon') },
  plate_armor: { key: 'plate_armor', name: 'Латы', type: 'armor', rarity: 'rare', def: 14, dmgReduction: 0.12, basePrice: priceWithRarity(600, 'rare') },
  dragonscale: { key: 'dragonscale', name: 'Драконья чешуя (доспех)', type: 'armor', rarity: 'epic', def: 22, dmgReduction: 0.18, basePrice: priceWithRarity(1600, 'epic') },
  ultra_armor: { key: 'ultra_armor', name: 'Ультракераса', type: 'armor', rarity: 'legendary', def: 32, dmgReduction: 0.24, basePrice: priceWithRarity(3000, 'legendary') },

  // Tools
  crude_pickaxe: { key: 'crude_pickaxe', name: 'Грубая кирка', type: 'tool', rarity: 'common', tool: 'pickaxe', tier: 1, gatherSpeed: 0.10, gatherLuck: 0.05, basePrice: priceWithRarity(60, 'common') },
  sturdy_pickaxe: { key: 'sturdy_pickaxe', name: 'Крепкая кирка', type: 'tool', rarity: 'uncommon', tool: 'pickaxe', tier: 2, gatherSpeed: 0.20, gatherLuck: 0.10, basePrice: priceWithRarity(180, 'uncommon') },
  master_pickaxe: { key: 'master_pickaxe', name: 'Мастерская кирка', type: 'tool', rarity: 'rare', tool: 'pickaxe', tier: 3, gatherSpeed: 0.35, gatherLuck: 0.15, basePrice: priceWithRarity(520, 'rare') },
  crude_axe: { key: 'crude_axe', name: 'Грубый топор', type: 'tool', rarity: 'common', tool: 'axe', tier: 1, gatherSpeed: 0.10, gatherLuck: 0.05, basePrice: priceWithRarity(60, 'common') },
  sturdy_axe: { key: 'sturdy_axe', name: 'Крепкий топор', type: 'tool', rarity: 'uncommon', tool: 'axe', tier: 2, gatherSpeed: 0.20, gatherLuck: 0.10, basePrice: priceWithRarity(180, 'uncommon') },
  master_axe: { key: 'master_axe', name: 'Мастерский топор', type: 'tool', rarity: 'rare', tool: 'axe', tier: 3, gatherSpeed: 0.35, gatherLuck: 0.15, basePrice: priceWithRarity(520, 'rare') },
  twig_rod: { key: 'twig_rod', name: 'Ветвистая удочка', type: 'tool', rarity: 'common', tool: 'rod', tier: 1, gatherSpeed: 0.08, gatherLuck: 0.06, basePrice: priceWithRarity(50, 'common') },
  fiber_rod: { key: 'fiber_rod', name: 'Фибровая удочка', type: 'tool', rarity: 'uncommon', tool: 'rod', tier: 2, gatherSpeed: 0.16, gatherLuck: 0.12, basePrice: priceWithRarity(150, 'uncommon') },
  crystal_rod: { key: 'crystal_rod', name: 'Кристаллическая удочка', type: 'tool', rarity: 'rare', tool: 'rod', tier: 3, gatherSpeed: 0.28, gatherLuck: 0.18, basePrice: priceWithRarity(480, 'rare') },
  field_knife: { key: 'field_knife', name: 'Полевой нож', type: 'tool', rarity: 'common', tool: 'knife', tier: 1, gatherSpeed: 0.08, gatherLuck: 0.05, basePrice: priceWithRarity(50, 'common') },
  hunter_knife: { key: 'hunter_knife', name: 'Охотничий нож', type: 'tool', rarity: 'uncommon', tool: 'knife', tier: 2, gatherSpeed: 0.16, gatherLuck: 0.10, basePrice: priceWithRarity(150, 'uncommon') },
  butcher_knife: { key: 'butcher_knife', name: 'Разделочный нож', type: 'tool', rarity: 'rare', tool: 'knife', tier: 3, gatherSpeed: 0.28, gatherLuck: 0.16, basePrice: priceWithRarity(480, 'rare') },
  hand_sickle: { key: 'hand_sickle', name: 'Ручной серп', type: 'tool', rarity: 'common', tool: 'sickle', tier: 1, gatherSpeed: 0.08, gatherLuck: 0.05, basePrice: priceWithRarity(50, 'common') },
  iron_sickle: { key: 'iron_sickle', name: 'Железный серп', type: 'tool', rarity: 'uncommon', tool: 'sickle', tier: 2, gatherSpeed: 0.16, gatherLuck: 0.10, basePrice: priceWithRarity(150, 'uncommon') },
  moon_sickle: { key: 'moon_sickle', name: 'Лунный серп', type: 'tool', rarity: 'rare', tool: 'sickle', tier: 3, gatherSpeed: 0.28, gatherLuck: 0.16, basePrice: priceWithRarity(480, 'rare') },

  // Consumables (rarity influences price only)
  small_potion: { key: 'small_potion', name: 'Малая лечебная настойка', type: 'consumable', rarity: 'common', heal: 30, basePrice: priceWithRarity(20, 'common') },
  mid_potion: { key: 'mid_potion', name: 'Средняя лечебная настойка', type: 'consumable', rarity: 'common', heal: 70, basePrice: priceWithRarity(60, 'common') },
  big_potion: { key: 'big_potion', name: 'Большая лечебная настойка', type: 'consumable', rarity: 'uncommon', heal: 140, basePrice: priceWithRarity(120, 'uncommon') },

  // Resource tiers
  ore: { key: 'ore', name: 'Руда', type: 'resource', rarity: 'common', basePrice: priceWithRarity(14, 'common') },
  iron_ore: { key: 'iron_ore', name: 'Железная руда', type: 'resource', rarity: 'common', basePrice: priceWithRarity(20, 'common') },
  steel_ore: { key: 'steel_ore', name: 'Стальная руда', type: 'resource', rarity: 'uncommon', basePrice: priceWithRarity(32, 'uncommon') },
  ultrasteel_ore: { key: 'ultrasteel_ore', name: 'Ультраруда', type: 'resource', rarity: 'rare', basePrice: priceWithRarity(60, 'rare') },
  wood: { key: 'wood', name: 'Дерево', type: 'resource', rarity: 'common', basePrice: priceWithRarity(10, 'common') },
  hard_wood: { key: 'hard_wood', name: 'Твёрдая древесина', type: 'resource', rarity: 'uncommon', basePrice: priceWithRarity(22, 'uncommon') },
  fish: { key: 'fish', name: 'Рыба', type: 'resource', rarity: 'common', basePrice: priceWithRarity(9, 'common') },
  herb: { key: 'herb', name: 'Трава', type: 'resource', rarity: 'common', basePrice: priceWithRarity(11, 'common') },
  rare_herb: { key: 'rare_herb', name: 'Редкая трава', type: 'resource', rarity: 'rare', basePrice: priceWithRarity(48, 'rare') },
  hide: { key: 'hide', name: 'Шкура', type: 'resource', rarity: 'common', basePrice: priceWithRarity(13, 'common') },
  rare_resin: { key: 'rare_resin', name: 'Редкая смола', type: 'resource', rarity: 'rare', basePrice: priceWithRarity(52, 'rare') },

  // Materials
  bronze_ingot: { key: 'bronze_ingot', name: 'Бронзовый слиток', type: 'material', rarity: 'common', basePrice: priceWithRarity(36, 'common') },
  iron_ingot: { key: 'iron_ingot', name: 'Железный слиток', type: 'material', rarity: 'common', basePrice: priceWithRarity(62, 'common') },
  steel_ingot: { key: 'steel_ingot', name: 'Стальной слиток', type: 'material', rarity: 'uncommon', basePrice: priceWithRarity(120, 'uncommon') },
  ultrasteel_ingot: { key: 'ultrasteel_ingot', name: 'Ультрасталь', type: 'material', rarity: 'epic', basePrice: priceWithRarity(520, 'epic') },
  wood_plank: { key: 'wood_plank', name: 'Доска', type: 'material', rarity: 'common', basePrice: priceWithRarity(18, 'common') },
  hard_plank: { key: 'hard_plank', name: 'Твёрдая доска', type: 'material', rarity: 'uncommon', basePrice: priceWithRarity(40, 'uncommon') },
  leather: { key: 'leather', name: 'Кожа', type: 'material', rarity: 'common', basePrice: priceWithRarity(28, 'common') },
  tincture: { key: 'tincture', name: 'Эссенция трав', type: 'material', rarity: 'uncommon', basePrice: priceWithRarity(30, 'uncommon') },
  resin_core: { key: 'resin_core', name: 'Смоляное ядро', type: 'material', rarity: 'rare', basePrice: priceWithRarity(180, 'rare') },

  // Junk/Loot
  torn_cloth: { key: 'torn_cloth', name: 'Рваная ткань', type: 'junk', rarity: 'common', basePrice: priceWithRarity(4, 'common') },
  cracked_bone: { key: 'cracked_bone', name: 'Треснувшая кость', type: 'junk', rarity: 'common', basePrice: priceWithRarity(5, 'common') },
  rusty_gear: { key: 'rusty_gear', name: 'Ржавое железо', type: 'junk', rarity: 'common', basePrice: priceWithRarity(6, 'common') },
  obsidian_shard: { key: 'obsidian_shard', name: 'Обсидиановый осколок', type: 'junk', rarity: 'rare', basePrice: priceWithRarity(12, 'rare') },
  storm_essence: { key: 'storm_essence', name: 'Сущность грозы', type: 'junk', rarity: 'rare', basePrice: priceWithRarity(14, 'rare') },
};

// Expand catalog for tooltips
const CATALOG = Object.fromEntries(Object.values(ITEMS).map(i => [
  i.key,
  { key: i.key, name: i.name, type: i.type, rarity: i.rarity || 'common', atk: i.atk || 0, def: i.def || 0, heal: i.heal || 0, tier: i.tier || 0, gatherSpeed: i.gatherSpeed || 0, gatherLuck: i.gatherLuck || 0, critChance: i.critChance || 0, critMult: i.critMult || 0, attackSpeed: i.attackSpeed || 0, dmgReduction: i.dmgReduction || 0 }
]));

// Crafting recipes (extended)
const RECIPES = [
  { key: 'bronze_ingot', name: 'Переплавка бронзы', out: 'bronze_ingot', qty: 1, inputs: { ore: 3 } },
  { key: 'iron_ingot', name: 'Переплавка железа', out: 'iron_ingot', qty: 1, inputs: { iron_ore: 4 } },
  { key: 'steel_ingot', name: 'Переплавка стали', out: 'steel_ingot', qty: 1, inputs: { steel_ore: 5, iron_ingot: 1 } },
  { key: 'ultrasteel_ingot', name: 'Закалка ультрастали', out: 'ultrasteel_ingot', qty: 1, inputs: { ultrasteel_ore: 3, resin_core: 1 } },
  { key: 'wood_plank', name: 'Распил досок', out: 'wood_plank', qty: 2, inputs: { wood: 2 } },
  { key: 'hard_plank', name: 'Распил твёрдых досок', out: 'hard_plank', qty: 2, inputs: { hard_wood: 2 } },
  { key: 'leather', name: 'Выделка кожи', out: 'leather', qty: 1, inputs: { hide: 2 } },
  { key: 'tincture', name: 'Травяная эссенция', out: 'tincture', qty: 1, inputs: { herb: 3, rare_herb: 1 } },
  { key: 'resin_core', name: 'Смоляное ядро', out: 'resin_core', qty: 1, inputs: { rare_resin: 3 } },

  // Weapons
  { key: 'iron_sword', name: 'Ковать железный меч', out: 'iron_sword', qty: 1, inputs: { iron_ingot: 2, wood_plank: 1 } },
  { key: 'steel_sword', name: 'Ковать стальной меч', out: 'steel_sword', qty: 1, inputs: { steel_ingot: 2, hard_plank: 1 } },
  { key: 'mythril_blade', name: 'Ковать мифриловый клинок', out: 'mythril_blade', qty: 1, inputs: { steel_ingot: 3, tincture: 2 } },
  { key: 'ultra_blade', name: 'Ковать ультраклинок', out: 'ultra_blade', qty: 1, inputs: { ultrasteel_ingot: 2, resin_core: 1 } },

  // Armor
  { key: 'chainmail', name: 'Ковать кольчугу', out: 'chainmail', qty: 1, inputs: { iron_ingot: 4, leather: 1 } },
  { key: 'plate_armor', name: 'Ковать латы', out: 'plate_armor', qty: 1, inputs: { steel_ingot: 4, leather: 1 } },
  { key: 'dragonscale', name: 'Шить драконью броню', out: 'dragonscale', qty: 1, inputs: { leather: 4, resin_core: 1 } },
  { key: 'ultra_armor', name: 'Ковать ультракерасу', out: 'ultra_armor', qty: 1, inputs: { ultrasteel_ingot: 3, resin_core: 2 } },

  // Tools
  { key: 'sturdy_pickaxe', name: 'Ковать крепкую кирку', out: 'sturdy_pickaxe', qty: 1, inputs: { iron_ingot: 2, wood_plank: 1 } },
  { key: 'master_pickaxe', name: 'Ковать мастерскую кирку', out: 'master_pickaxe', qty: 1, inputs: { steel_ingot: 2, hard_plank: 1 } },
  { key: 'sturdy_axe', name: 'Ковать крепкий топор', out: 'sturdy_axe', qty: 1, inputs: { iron_ingot: 2, wood_plank: 1 } },
  { key: 'master_axe', name: 'Ковать мастерский топор', out: 'master_axe', qty: 1, inputs: { steel_ingot: 2, hard_plank: 1 } },
  { key: 'fiber_rod', name: 'Изготовить фибровую удочку', out: 'fiber_rod', qty: 1, inputs: { wood_plank: 2, tincture: 1 } },
  { key: 'crystal_rod', name: 'Изготовить кристаллическую удочку', out: 'crystal_rod', qty: 1, inputs: { hard_plank: 2, tincture: 2 } },
  { key: 'hunter_knife', name: 'Точить охотничий нож', out: 'hunter_knife', qty: 1, inputs: { iron_ingot: 1, wood_plank: 1 } },
  { key: 'butcher_knife', name: 'Точить разделочный нож', out: 'butcher_knife', qty: 1, inputs: { steel_ingot: 1, hard_plank: 1 } },
  { key: 'iron_sickle', name: 'Ковать железный серп', out: 'iron_sickle', qty: 1, inputs: { iron_ingot: 1, wood_plank: 1 } },
  { key: 'moon_sickle', name: 'Ковать лунный серп', out: 'moon_sickle', qty: 1, inputs: { steel_ingot: 1, hard_plank: 1 } },

  // Potions
  { key: 'mid_potion', name: 'Варить среднюю настойку', out: 'mid_potion', qty: 1, inputs: { tincture: 2, herb: 1 } },
];

// Ensure ultrasteel cannot be bought: exclude from merchants' sells by design
// (we already don't add it into MERCHANTS sells lists)

// Demand-driven economy factors (defined later in a single place)
// Placeholder declarations removed to avoid duplication


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
// Player State + Persistence
// -----------------------
const sockets = new Map(); // id -> ws
const players = new Map(); // id -> player
let dirty = false;

function defaultSkills() {
  return {
    mining: { level: 1, xp: 0 },
    woodcutting: { level: 1, xp: 0 },
    fishing: { level: 1, xp: 0 },
    herbalism: { level: 1, xp: 0 },
    hunting: { level: 1, xp: 0 },
  };
}

function makePlayer(id) {
  return {
    id,
    name: `Игрок-${id.slice(0, 6)}`,
    level: 1,
    xp: 0,
    hp: 100,
    maxHp: 100,
    gold: 100,
    location: 'city',
    equipment: { weapon: 'rusty_dagger', armor: 'cloth_garb', pickaxe: null, axe: null, rod: null, knife: null, sickle: null },
    inventory: {},
    storage: {},
    skills: defaultSkills(),
    logs: [],
    encounter: null,
    busyUntil: 0,
    busyAction: null,
  };
}

function addLog(player, text) {
  player.logs.unshift(`[${new Date().toLocaleTimeString()}] ${text}`);
  if (player.logs.length > 200) player.logs.pop();
}

function levelThreshold(level) { return 100 + (level - 1) * 80 + Math.floor((level - 1) * (level - 1) * 12); }
function skillThreshold(level) { return 60 + (level - 1) * 50 + Math.floor((level - 1) * (level - 1) * 10); }

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

function addSkillXp(player, key, xp) {
  const s = player.skills[key];
  if (!s) return;
  s.xp += xp;
  let th = skillThreshold(s.level);
  while (s.xp >= th) {
    s.xp -= th;
    s.level += 1;
    th = skillThreshold(s.level);
    addLog(player, `Навык ${key} повышен до ${s.level}!`);
  }
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
  if (player.inventory[itemKey]) return true;
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
function armorDamageReduction(player) {
  const armor = player.equipment.armor ? ITEMS[player.equipment.armor] : null;
  return clamp(armor?.dmgReduction || 0, 0, 0.4);
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
  const scale = 1 + Math.max(0, Math.floor((level - m.minLevel) / 5)) * 0.06;
  return { ...m, hp: Math.round(m.hp * scale) };
}

function calculateGatherChance(player, toolType, skillKey) {
  const slot = toolType;
  const key = player.equipment[slot];
  const tool = key ? ITEMS[key] : null;
  const tier = tool ? (tool.tier || 0) : 0;
  const skillLvl = player.skills[skillKey]?.level || 1;
  let chance = 0.25 + tier * 0.15 + (skillLvl - 1) * 0.025 + (tool?.gatherLuck || 0);
  return clamp(chance, 0.2, 0.97);
}

// Economy
// Separate buy/sell market factors
const buyFactor = new Map();
const sellFactor = new Map();
function getFactor(map, key) { if (!map.has(key)) map.set(key, 1); return map.get(key); }
function adjustBuy(itemKey, delta) { buyFactor.set(itemKey, clamp(getFactor(buyFactor, itemKey) + delta, 0.8, 2.2)); }
function adjustSell(itemKey, delta) { sellFactor.set(itemKey, clamp(getFactor(sellFactor, itemKey) + delta, 0.5, 1.2)); }
function buyPriceFor(itemKey) { const it = ITEMS[itemKey]; if (!it) return 0; return Math.max(1, Math.round(it.basePrice * getFactor(buyFactor, itemKey))); }
function sellPriceFor(itemKey) { const it = ITEMS[itemKey]; if (!it) return 0; const base = Math.max(1, Math.round(it.basePrice * 0.6)); return Math.max(1, Math.round(base * getFactor(sellFactor, itemKey))); }

const MERCHANTS = [
  { key: 'general', name: 'Лавка ремесленника', sells: ['small_potion', 'mid_potion', 'crude_pickaxe', 'crude_axe', 'twig_rod', 'field_knife', 'hand_sickle'], buys: 'all' },
  { key: 'armorer', name: 'Оружейник', sells: ['rusty_dagger', 'bronze_sword', 'cloth_garb', 'leather_armor'], buys: ['weapon', 'armor', 'junk'] },
  { key: 'trader', name: 'Скупщик ресурсов', sells: [], buys: ['resource', 'material'] },
];
function canMerchantBuy(merchant, itemKey) { if (merchant.buys === 'all') return true; const t = ITEMS[itemKey]?.type; return t ? merchant.buys.includes(t) : false; }
function merchantSells(merchant) { return merchant.sells.map(k => ({ key: k, name: ITEMS[k].name, price: buyPriceFor(k) })); }

// Busy handling
function isBusy(player) { return Date.now() < player.busyUntil; }
function beginBusy(player, ms, label, onDone) {
  const now = Date.now();
  player.busyUntil = now + ms;
  player.busyAction = label;
  addLog(player, `${label}...`);
  dirty = true;
  setTimeout(() => { onDone(); dirty = true; pushState(player); }, ms);
}

// Persistence
async function loadPlayers() {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(PLAYERS_FILE, 'utf8');
    const obj = JSON.parse(raw);
    for (const [id, p] of Object.entries(obj)) {
      // ensure required fields
      p.busyUntil = 0; p.busyAction = null; p.encounter = null;
      p.skills = p.skills || defaultSkills();
      players.set(id, p);
    }
  } catch {}
}

async function savePlayers() {
  if (!dirty) return;
  dirty = false;
  await ensureDataDir();
  const obj = Object.fromEntries(Array.from(players.entries()).map(([id, p]) => [id, p]));
  await fs.writeFile(PLAYERS_FILE, JSON.stringify(obj, null, 2));
}
setInterval(() => { savePlayers().catch(()=>{}); }, 2000);

function touch(player) { dirty = true; }

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
    skills: p.skills,
    logs: p.logs,
    encounter: p.encounter ? { name: p.encounter.name, hp: p.encounter.hp, maxHp: p.encounter.hp, atk: p.encounter.atk } : null,
    busy: { until: p.busyUntil, action: p.busyAction },
  };
}

function pushState(player) {
  const catalog = CATALOG;
  const merchants = MERCHANTS.map(m => ({ key: m.key, name: m.name, sells: merchantSells(m), buys: m.buys }));
  const buyPrices = Object.fromEntries(Object.keys(ITEMS).map(k => [k, buyPriceFor(k)]));
  const sellPrices = Object.fromEntries(Object.keys(ITEMS).map(k => [k, sellPriceFor(k)]));
  const msg = { type: 'state', you: sanitizePlayer(player), meta: { locations: LOCATIONS, merchants, recipes: RECIPES, buyPrices, sellPrices, catalog } };
  const ws = sockets.get(player.id);
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

// Connection + handshake
wss.on('connection', (ws) => {
  let attachedId = null;
  ws.on('message', async (buf) => {
    let msg = null; try { msg = JSON.parse(buf); } catch { return; }
    if (msg.type === 'hello') {
      // identify or create
      let id = msg.playerId;
      let player = id ? players.get(id) : null;
      if (!player) {
        id = randomUUID();
        player = makePlayer(id);
        addItem(player.inventory, 'small_potion', 3);
        addLog(player, 'Добро пожаловать в текстовую RPG! Вы в городе Астер.');
        players.set(id, player);
        touch(player);
      }
      sockets.set(id, ws);
      attachedId = id;
      pushState(player);
      return;
    }
    if (!attachedId) return; // ignore until hello
    const player = players.get(attachedId);
    if (!player) return;
    handleMessage(player, msg);
  });
  ws.on('close', () => {
    if (attachedId) sockets.delete(attachedId);
  });
});

function handleMessage(player, msg) {
  switch (msg.type) {
    case 'navigate': {
      if (isBusy(player)) { addLog(player, `Вы заняты: ${player.busyAction}.`); pushState(player); break; }
      const to = msg.to;
      const loc = LOCATIONS.find(l => l.key === to);
      if (!loc) { addLog(player, 'Локация не найдена.'); break; }
      if (!canAccessLocation(player, to)) { addLog(player, `Недостаточный уровень: требуется ${loc.requiredLevel}.`); break; }
      player.location = to;
      player.encounter = null;
      addLog(player, `Вы переместились в: ${loc.name}.`);
      touch(player);
      pushState(player);
      break;
    }
    case 'heal': {
      if (player.location !== 'city') { addLog(player, 'Лечиться можно только в городе.'); break; }
      if (isBusy(player)) { addLog(player, `Вы заняты: ${player.busyAction}.`); pushState(player); break; }
      const cost = healCost(player);
      if (cost === 0) { addLog(player, 'Вы полностью здоровы.'); break; }
      if (player.gold < cost) { addLog(player, `Не хватает золота для лечения (нужно ${cost}).`); break; }
      beginBusy(player, 600, 'Лечение', () => {
        player.gold -= cost;
        player.hp = player.maxHp;
        addLog(player, `Вы вылечились за ${cost} золота.`);
        touch(player);
      });
      pushState(player);
      break;
    }
    case 'search': {
      const loc = LOCATIONS.find(l => l.key === player.location);
      if (!loc || loc.type !== 'combat') { addLog(player, 'Здесь нельзя искать врагов.'); break; }
      if (player.encounter) { addLog(player, 'Вы уже в бою.'); break; }
      if (isBusy(player)) { addLog(player, `Вы заняты: ${player.busyAction}.`); pushState(player); break; }
      beginBusy(player, 800, 'Поиск противника', () => {
        const mob = randomMobForLocation(player.location, player.level);
        if (!mob) { addLog(player, 'Никого не нашли.'); return; }
        player.encounter = { mobKey: mob.key, name: mob.name, hp: mob.hp, atk: mob.atk, xp: mob.xp, gold: mob.gold, dropTable: mob.dropTable };
        addLog(player, `Вас атакует: ${mob.name}! HP: ${mob.hp}`);
        touch(player);
      });
      pushState(player);
      break;
    }
    case 'attack': {
      if (!player.encounter) { addLog(player, 'Некого атаковать.'); break; }
      if (isBusy(player)) { addLog(player, `Вы заняты: ${player.busyAction}.`); pushState(player); break; }
      const weapon = player.equipment.weapon ? ITEMS[player.equipment.weapon] : null;
      const baseMs = 350;
      const atkMs = Math.max(180, Math.floor(baseMs * (1 - (weapon?.attackSpeed || 0))));
      beginBusy(player, atkMs, 'Атака', () => {
        const atk = playerAttackPower(player);
        let dmg = randInt(Math.max(1, Math.floor(atk * 0.7)), Math.floor(atk * 1.1));
        const isCrit = Math.random() < (weapon?.critChance || 0);
        if (isCrit) dmg = Math.floor(dmg * (weapon?.critMult || 1.5));
        player.encounter.hp -= dmg;
        addLog(player, `Вы ударили по ${player.encounter.name} на ${dmg}${isCrit ? ' (крит!)' : ''}.`);
        if (player.encounter.hp <= 0) {
          const g = randInt(Math.floor(player.encounter.gold * 0.8), player.encounter.gold);
          player.gold += g;
          grantXp(player, player.encounter.xp);
          for (const d of player.encounter.dropTable) {
            if (chance(d.chance)) {
              let qty = randInt(d.min, d.max);
              // small bonus yield on victory based on level
              if (Math.random() < Math.min(0.2, player.level * 0.005)) qty += 1;
              if (canAddToInventory(player, d.itemKey)) { addItem(player.inventory, d.itemKey, qty); addLog(player, `Добыча: ${ITEMS[d.itemKey].name} x${qty}.`); }
              else { addLog(player, `Нет места для ${ITEMS[d.itemKey].name}.`); }
            }
          }
          addLog(player, `Победа! Золото +${g}, опыт +${player.encounter.xp}.`);
          player.encounter = null;
          touch(player);
          return;
        }
        const def = playerDefense(player);
        const enemyAtk = player.encounter.atk;
        const edmgBase = randInt(Math.max(1, Math.floor(enemyAtk * 0.7)), Math.floor(enemyAtk * 1.1));
        const red = Math.floor(def * 0.5);
        let edmg = Math.max(1, edmgBase - red);
        const dr = armorDamageReduction(player);
        edmg = Math.max(1, Math.floor(edmg * (1 - dr)));
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
        touch(player);
      });
      pushState(player);
      break;
    }
    case 'flee': {
      if (!player.encounter) { addLog(player, 'Вам не от кого бежать.'); break; }
      if (isBusy(player)) { addLog(player, `Вы заняты: ${player.busyAction}.`); pushState(player); break; }
      beginBusy(player, 400, 'Попытка бегства', () => {
        if (chance(0.6)) { addLog(player, 'Вы успешно убежали.'); player.encounter = null; }
        else { addLog(player, 'Не удалось сбежать!'); }
        touch(player);
      });
      pushState(player);
      break;
    }
    case 'use': {
      const key = msg.itemKey;
      if (!player.inventory[key] || player.inventory[key] <= 0) { addLog(player, 'Нет такого предмета.'); break; }
      const it = ITEMS[key];
      if (!it || it.type !== 'consumable') { addLog(player, 'Этот предмет нельзя использовать.'); break; }
      if (isBusy(player)) { addLog(player, `Вы заняты: ${player.busyAction}.`); pushState(player); break; }
      beginBusy(player, 300, 'Использование', () => {
        addItem(player.inventory, key, -1);
        const before = player.hp;
        player.hp = Math.min(player.maxHp, player.hp + (it.heal || 0));
        addLog(player, `Вы использовали: ${it.name}. Восстановлено ${player.hp - before} HP.`);
        touch(player);
      });
      pushState(player);
      break;
    }
    case 'equip': {
      const key = msg.itemKey; const it = ITEMS[key];
      if (!it) { addLog(player, 'Неизвестный предмет.'); break; }
      if (!player.inventory[key]) { addLog(player, 'Нет предмета в инвентаре.'); break; }
      if (isBusy(player)) { addLog(player, `Вы заняты: ${player.busyAction}.`); pushState(player); break; }
      beginBusy(player, 250, 'Экипировка', () => {
        if (it.type === 'weapon') {
          if (player.equipment.weapon) addItem(player.inventory, player.equipment.weapon, 1);
          player.equipment.weapon = key; addItem(player.inventory, key, -1); addLog(player, `Экипировано оружие: ${it.name}.`);
        } else if (it.type === 'armor') {
          if (player.equipment.armor) addItem(player.inventory, player.equipment.armor, 1);
          player.equipment.armor = key; addItem(player.inventory, key, -1); addLog(player, `Экипирована броня: ${it.name}.`);
        } else if (it.type === 'tool') {
          const slot = it.tool;
          if (player.equipment[slot]) addItem(player.inventory, player.equipment[slot], 1);
          player.equipment[slot] = key; addItem(player.inventory, key, -1); addLog(player, `Взят инструмент: ${it.name}.`);
        } else { addLog(player, 'Этот предмет нельзя экипировать.'); }
        touch(player);
      });
      pushState(player);
      break;
    }
    case 'unequip': {
      const slot = msg.slot; if (!player.equipment[slot]) { addLog(player, 'Слот пуст.'); break; }
      if (!canAddToInventory(player, player.equipment[slot])) { addLog(player, 'Нет места в инвентаре.'); break; }
      if (isBusy(player)) { addLog(player, `Вы заняты: ${player.busyAction}.`); pushState(player); break; }
      beginBusy(player, 200, 'Снятие', () => {
        const key = player.equipment[slot]; addItem(player.inventory, key, 1); player.equipment[slot] = null; addLog(player, `Снято: ${ITEMS[key].name}.`);
        touch(player);
      });
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
      const price = buyPriceFor(itemKey) * q;
      if (player.gold < price) { addLog(player, `Недостаточно золота. Нужно ${price}.`); break; }
      if (!canAddToInventory(player, itemKey) && !player.inventory[itemKey]) { addLog(player, 'Нет места в инвентаре.'); break; }
      if (isBusy(player)) { addLog(player, `Вы заняты: ${player.busyAction}.`); pushState(player); break; }
      beginBusy(player, 250, 'Покупка', () => {
        player.gold -= price; addItem(player.inventory, itemKey, q); adjustBuy(itemKey, +0.05); addLog(player, `Покупка: ${ITEMS[itemKey].name} x${q} за ${price}.`); touch(player);
      });
      pushState(player);
      break;
    }
    case 'sell': {
      if (player.location !== 'city') { addLog(player, 'Продавать можно только в городе.'); break; }
      const { merchantKey, itemKey, qty } = msg;
      const m = MERCHANTS.find(x => x.key === merchantKey);
      if (!m) { addLog(player, 'Торговец не найден.'); break; }
      if (!canMerchantBuy(m, itemKey)) { addLog(player, 'Этот торговец не покупает такой товар.'); break; }
      const have = player.inventory[itemKey] || 0; if (have <= 0) { addLog(player, 'Нет товара для продажи.'); break; }
      const q = clamp(Math.floor(qty || 1), 1, have);
      const price = sellPriceFor(itemKey) * q;
      if (isBusy(player)) { addLog(player, `Вы заняты: ${player.busyAction}.`); pushState(player); break; }
      beginBusy(player, 250, 'Продажа', () => {
        addItem(player.inventory, itemKey, -q); player.gold += price; adjustSell(itemKey, -0.05); addLog(player, `Продажа: ${ITEMS[itemKey].name} x${q} за ${price}.`); touch(player);
      });
      pushState(player);
      break;
    }
    case 'store': {
      if (player.location !== 'city') { addLog(player, 'Склад доступен только в городе.'); break; }
      const { itemKey, qty } = msg; const have = player.inventory[itemKey] || 0; if (have <= 0) { addLog(player, 'Нет предметов для склада.'); break; }
      const q = clamp(Math.floor(qty || 1), 1, have);
      if (isBusy(player)) { addLog(player, `Вы заняты: ${player.busyAction}.`); pushState(player); break; }
      beginBusy(player, 250, 'Перемещение на склад', () => { addItem(player.inventory, itemKey, -q); addItem(player.storage, itemKey, q); addLog(player, `На склад: ${ITEMS[itemKey].name} x${q}.`); touch(player); });
      pushState(player);
      break;
    }
    case 'withdraw': {
      if (player.location !== 'city') { addLog(player, 'Склад доступен только в городе.'); break; }
      const { itemKey, qty } = msg; const have = player.storage[itemKey] || 0; if (have <= 0) { addLog(player, 'Нет предметов на складе.'); break; }
      const q = clamp(Math.floor(qty || 1), 1, have);
      if (!canAddToInventory(player, itemKey) && !player.inventory[itemKey]) { addLog(player, 'Нет места в инвентаре.'); break; }
      if (isBusy(player)) { addLog(player, `Вы заняты: ${player.busyAction}.`); pushState(player); break; }
      beginBusy(player, 250, 'Забор со склада', () => { addItem(player.storage, itemKey, -q); addItem(player.inventory, itemKey, q); addLog(player, `Со склада: ${ITEMS[itemKey].name} x${q}.`); touch(player); });
      pushState(player);
      break;
    }
    case 'gather': {
      if (player.location !== 'fields') { addLog(player, 'Добывать ресурсы можно в Ремесленных угодьях.'); break; }
      if (isBusy(player)) { addLog(player, `Вы заняты: ${player.busyAction}.`); pushState(player); break; }
      const map = { mine: ['ore', 'pickaxe', 'mining'], chop: ['wood', 'axe', 'woodcutting'], fish: ['fish', 'rod', 'fishing'], forage: ['herb', 'sickle', 'herbalism'], hunt: ['hide', 'knife', 'hunting'] };
      const pair = map[msg.which]; if (!pair) { addLog(player, 'Неизвестный тип добычи.'); break; }
      const [resKey, toolSlot, skillKey] = pair;
      const toolKey = player.equipment[toolSlot];
      const tool = toolKey ? ITEMS[toolKey] : null;
      const skillLvl = player.skills[skillKey]?.level || 1;
      const baseMs = 1200;
      const skillSpeed = Math.min(0.5, (skillLvl - 1) * 0.01);
      const toolSpeed = tool?.gatherSpeed || 0;
      const ms = Math.max(500, Math.floor(baseMs * (1 - toolSpeed) * (1 - skillSpeed)));
      beginBusy(player, ms, 'Добыча', () => {
        const p = calculateGatherChance(player, toolSlot, skillKey);
        if (chance(p)) {
          let qty = randInt(1, 3);
          // Extra yield chance with tool luck and skill
          const extraChance = (tool?.gatherLuck || 0) + Math.min(0.25, (skillLvl - 1) * 0.005);
          if (Math.random() < extraChance) qty += 1;
          if (canAddToInventory(player, resKey) || player.inventory[resKey]) { addItem(player.inventory, resKey, qty); addLog(player, `Успех! Добыто ${ITEMS[resKey].name} x${qty}.`); addSkillXp(player, skillKey, 16); }
          else { addLog(player, `Нет места для ${ITEMS[resKey].name}.`); }
        } else {
          addLog(player, 'Неудача. Ничего не добыто.'); addSkillXp(player, skillKey, 7);
        }
        touch(player);
      });
      pushState(player);
      break;
    }
    case 'craft': {
      if (player.location !== 'city') { addLog(player, 'Крафт доступен только в центральном городе.'); break; }
      const rec = RECIPES.find(r => r.key === msg.recipeKey); if (!rec) { addLog(player, 'Неизвестный рецепт.'); break; }
      const qty = clamp(Math.floor(msg.qty || 1), 1, 99);
      for (const [k, v] of Object.entries(rec.inputs)) { if ((player.inventory[k] || 0) < v * qty) { addLog(player, 'Недостаточно ресурсов.'); pushState(player); return; } }
      if (!canAddToInventory(player, rec.out) && !player.inventory[rec.out]) { addLog(player, 'Нет места для результата.'); pushState(player); return; }
      if (isBusy(player)) { addLog(player, `Вы заняты: ${player.busyAction}.`); pushState(player); break; }
      const ms = Math.min(3500, 500 + 300 * qty);
      beginBusy(player, ms, 'Крафт', () => {
        for (const [k, v] of Object.entries(rec.inputs)) addItem(player.inventory, k, -v * qty);
        addItem(player.inventory, rec.out, rec.qty * qty);
        addLog(player, `Создано: ${ITEMS[rec.out].name} x${rec.qty * qty}.`);
        touch(player);
      });
      pushState(player);
      break;
    }
    default:
      break;
  }
}

await loadPlayers();
server.listen(PORT, () => {
  console.log(`Text RPG server running at http://localhost:${PORT}`);
});