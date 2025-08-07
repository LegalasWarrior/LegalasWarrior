const locName = document.getElementById('locName');
const topActions = document.getElementById('topActions');
const logEl = document.getElementById('log');
const combatPanel = document.getElementById('combatPanel');
const combatInfo = document.getElementById('combatInfo');
const btnAttack = document.getElementById('btnAttack');
const btnFlee = document.getElementById('btnFlee');
const gatherPanel = document.getElementById('gatherPanel');
const pName = document.getElementById('pName');
const pLevel = document.getElementById('pLevel');
const pXp = document.getElementById('pXp');
const pHp = document.getElementById('pHp');
const pGold = document.getElementById('pGold');
const btnHeal = document.getElementById('btnHeal');
const equipEl = document.getElementById('equip');
const invEl = document.getElementById('inventory');
const storageEl = document.getElementById('storage');
const tradeEl = document.getElementById('trade');
const craftEl = document.getElementById('craft');

const tabs = document.querySelectorAll('.tab');
const tabcs = document.querySelectorAll('.tabc');

tabs.forEach(t => t.addEventListener('click', () => {
  tabs.forEach(x => x.classList.remove('active'));
  tabcs.forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  const key = t.dataset.tab;
  document.getElementById(`tab-${key}`).classList.add('active');
}));

let ws;
let state = null; // { you, meta }

function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}`);
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === 'state') {
      state = msg;
      renderAll();
    }
  });
  ws.addEventListener('close', () => setTimeout(connect, 1500));
}
connect();

function send(type, payload = {}) { ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type, ...payload })); }

function renderAll() {
  if (!state) return;
  const { you, meta } = state;

  // Topbar
  const loc = meta.locations.find(l => l.key === you.location);
  locName.textContent = loc ? loc.name : '—';
  // Top actions
  topActions.innerHTML = '';
  for (const l of meta.locations) {
    const btn = document.createElement('button');
    btn.textContent = l.name + (you.level < l.requiredLevel ? ` (треб. ур. ${l.requiredLevel})` : '');
    btn.disabled = you.location === l.key || you.level < l.requiredLevel;
    btn.addEventListener('click', () => send('navigate', { to: l.key }));
    topActions.appendChild(btn);
  }

  // Logs
  logEl.innerHTML = '';
  for (const line of you.logs) {
    const div = document.createElement('div');
    div.textContent = line;
    logEl.appendChild(div);
  }

  // Combat panel
  if (you.encounter) {
    combatPanel.style.display = '';
    combatInfo.textContent = `${you.encounter.name} — HP ${you.encounter.hp}`;
  } else {
    combatPanel.style.display = 'none';
  }
  btnAttack.onclick = () => send('attack');
  btnFlee.onclick = () => send('flee');

  // Gather panel
  const locType = (meta.locations.find(x => x.key === you.location) || {}).type;
  gatherPanel.style.display = locType === 'gather' ? '' : 'none';
  gatherPanel.querySelectorAll('button[data-gather]').forEach(btn => {
    btn.onclick = () => send('gather', { which: btn.dataset.gather });
  });

  // Character
  pName.textContent = you.name;
  pLevel.textContent = you.level;
  pXp.textContent = `${you.xp} / ${levelThreshold(you.level)}`;
  pHp.textContent = `${you.hp} / ${you.maxHp}`;
  pGold.textContent = you.gold;
  btnHeal.onclick = () => send('heal');

  // Equipment
  const equipSlots = [
    ['weapon', 'Оружие'],
    ['armor', 'Броня'],
    ['pickaxe', 'Кирка'],
    ['axe', 'Топор'],
    ['rod', 'Удочка'],
    ['knife', 'Нож'],
    ['sickle', 'Серп'],
  ];
  equipEl.innerHTML = '';
  for (const [key, label] of equipSlots) {
    const row = document.createElement('div');
    row.className = 'list';
    const val = you.equipment[key];
    const name = val ? itemName(val) : '—';
    row.innerHTML = `<div>${label}</div><div>${name}</div>`;
    const btn = document.createElement('button');
    btn.textContent = 'Снять';
    btn.disabled = !val;
    btn.onclick = () => send('unequip', { slot: key });
    row.appendChild(btn);
    equipEl.appendChild(row);
  }

  // Inventory
  invEl.innerHTML = '';
  const invList = Object.entries(you.inventory);
  if (invList.length === 0) invEl.innerHTML = '<div class="small">Инвентарь пуст</div>';
  for (const [k, cnt] of invList) {
    invEl.appendChild(renderInvRow(k, cnt, 'inv'));
  }

  // Storage
  storageEl.innerHTML = '';
  const stList = Object.entries(you.storage);
  if (stList.length === 0) storageEl.innerHTML = '<div class="small">Склад пуст</div>';
  for (const [k, cnt] of stList) {
    storageEl.appendChild(renderInvRow(k, cnt, 'storage'));
  }

  // Trade
  renderTrade(meta, you);

  // Craft
  renderCraft(meta, you);

  // Contextual actions in left column (search enemy)
  ensureSearchButton(locType, you);
}

function ensureSearchButton(locType, you) {
  const existing = document.getElementById('searchRow');
  if (locType === 'combat' && !you.encounter) {
    if (!existing) {
      const container = document.querySelector('.left .panel');
      const row = document.createElement('div');
      row.id = 'searchRow';
      row.className = 'row';
      const btn = document.createElement('button');
      btn.textContent = 'Искать противника';
      btn.onclick = () => send('search');
      row.appendChild(btn);
      container.parentNode.insertBefore(row, container.nextSibling);
    }
  } else if (existing) {
    existing.remove();
  }
}

function renderInvRow(k, cnt, where) {
  const item = itemData(k);
  const row = document.createElement('div');
  row.className = 'list';
  row.innerHTML = `<div>${item.name}</div><div class="badge">x${cnt}</div>`;
  const box = document.createElement('div');
  box.className = 'row';

  if (item.type === 'weapon' || item.type === 'armor' || item.type === 'tool') {
    const be = document.createElement('button');
    be.textContent = 'Экипировать';
    be.onclick = () => send('equip', { itemKey: k });
    box.appendChild(be);
  }
  if (item.type === 'consumable') {
    const bu = document.createElement('button');
    bu.textContent = 'Использовать';
    bu.onclick = () => send('use', { itemKey: k });
    box.appendChild(bu);
  }

  if (where === 'inv') {
    const bStore = document.createElement('button');
    bStore.textContent = 'На склад';
    bStore.onclick = () => numberPrompt(`Сколько переместить на склад? (1-${cnt})`, (q) => send('store', { itemKey: k, qty: q }));
    box.appendChild(bStore);
  } else if (where === 'storage') {
    const bTake = document.createElement('button');
    bTake.textContent = 'Забрать';
    bTake.onclick = () => numberPrompt(`Сколько забрать? (1-${cnt})`, (q) => send('withdraw', { itemKey: k, qty: q }));
    box.appendChild(bTake);
  }

  row.appendChild(box);
  return row;
}

function renderTrade(meta, you) {
  tradeEl.innerHTML = '';
  if (you.location !== 'city') {
    tradeEl.innerHTML = '<div class="small">Торговцы доступны в городе</div>';
    return;
  }
  for (const m of meta.merchants) {
    const panel = document.createElement('div');
    panel.className = 'panel';
    const title = document.createElement('h3');
    title.textContent = m.name;
    panel.appendChild(title);

    const list = document.createElement('div');
    list.className = 'list';
    for (const it of m.sells) {
      const price = itemPrice(it.key);
      const row = document.createElement('div');
      row.className = 'list';
      row.innerHTML = `<div>${it.name}</div><div class="badge">${price} зол.</div>`;
      const btn = document.createElement('button');
      btn.textContent = 'Купить';
      btn.onclick = () => numberPrompt('Сколько купить?', (q) => send('buy', { merchantKey: m.key, itemKey: it.key, qty: q }));
      row.appendChild(btn);
      list.appendChild(row);
    }

    // Sell section: show player's items merchant buys
    const sellTitle = document.createElement('div');
    sellTitle.innerHTML = '<hr><div class="small">Продать:</div>';
    panel.appendChild(list);
    panel.appendChild(sellTitle);

    const sellList = document.createElement('div');
    for (const [k, cnt] of Object.entries(you.inventory)) {
      if (!merchantCanBuy(m.key, k)) continue;
      const row = document.createElement('div');
      row.className = 'list';
      row.innerHTML = `<div>${itemName(k)}</div><div class="badge">${itemPrice(k)} зол.</div>`;
      const btn = document.createElement('button');
      btn.textContent = 'Продать';
      btn.onclick = () => numberPrompt(`Сколько продать? (1-${cnt})`, (q) => send('sell', { merchantKey: m.key, itemKey: k, qty: q }));
      row.appendChild(btn);
      sellList.appendChild(row);
    }
    panel.appendChild(sellList);

    tradeEl.appendChild(panel);
  }
}

function renderCraft(meta, you) {
  craftEl.innerHTML = '';
  const info = document.createElement('div');
  info.className = 'small';
  info.textContent = 'Крафт возможен в городе и ремесленных угодьях.';
  craftEl.appendChild(info);
  for (const r of meta.recipes) {
    const row = document.createElement('div');
    row.className = 'list';
    const need = Object.entries(r.inputs).map(([k,v]) => `${itemName(k)} x${v}`).join(', ');
    row.innerHTML = `<div>${r.name} → ${itemName(r.out)} x${r.qty}</div><div class="badge">Нужно: ${need}</div>`;
    const btn = document.createElement('button');
    btn.textContent = 'Создать';
    btn.onclick = () => numberPrompt('Сколько создать?', (q) => send('craft', { recipeKey: r.key, qty: q }));
    row.appendChild(btn);
    craftEl.appendChild(row);
  }
}

function numberPrompt(text, cb) {
  const val = prompt(text, '1');
  if (!val) return;
  const q = Math.max(1, Math.floor(Number(val)) || 1);
  cb(q);
}

function itemData(key) { return (state && state.meta && state.meta.prices && key) ? { key, price: state.meta.prices[key], name: resolveName(key) } : { key, price: 0, name: resolveName(key) }; }
function itemName(key) { return itemData(key).name; }
function itemPrice(key) { return (state && state.meta && state.meta.prices[key]) || 0; }
function resolveName(key) {
  // minimal client-side names (mirror server):
  const map = {
    rusty_dagger: 'Ржавый кинжал', bronze_sword: 'Бронзовый меч', iron_sword: 'Железный меч', steel_sword: 'Стальной меч', mythril_blade: 'Мифриловый клинок',
    cloth_garb: 'Тканевый наряд', leather_armor: 'Кожаная броня', chainmail: 'Кольчуга', plate_armor: 'Латы', dragonscale: 'Драконья чешуя (доспех)',
    crude_pickaxe: 'Грубая кирка', sturdy_pickaxe: 'Крепкая кирка', master_pickaxe: 'Мастерская кирка',
    crude_axe: 'Грубый топор', sturdy_axe: 'Крепкий топор', master_axe: 'Мастерский топор',
    twig_rod: 'Ветвистая удочка', fiber_rod: 'Фибровая удочка', crystal_rod: 'Кристаллическая удочка',
    field_knife: 'Полевой нож', hunter_knife: 'Охотничий нож', butcher_knife: 'Разделочный нож',
    hand_sickle: 'Ручной серп', iron_sickle: 'Железный серп', moon_sickle: 'Лунный серп',
    small_potion: 'Малая лечебная настойка', mid_potion: 'Средняя лечебная настойка', big_potion: 'Большая лечебная настойка',
    ore: 'Руда', wood: 'Дерево', fish: 'Рыба', herb: 'Трава', hide: 'Шкура',
    bronze_ingot: 'Бронзовый слиток', iron_ingot: 'Железный слиток', wood_plank: 'Доска', leather: 'Кожа', tincture: 'Эссенция трав',
    torn_cloth: 'Рваная ткань', cracked_bone: 'Треснувшая кость', rusty_gear: 'Ржавое железо', obsidian_shard: 'Обсидиановый осколок', storm_essence: 'Сущность грозы',
  };
  return map[key] || key;
}

function levelThreshold(level) { return 100 + (level - 1) * 80 + Math.floor((level - 1) * (level - 1) * 12); }