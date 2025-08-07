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

// Add skills container
let skillsBox = document.getElementById('skills');
if (!skillsBox) {
  const rightPanels = document.querySelector('.right');
  const p = document.createElement('div');
  p.className = 'panel';
  p.innerHTML = '<h3>Навыки</h3><div id="skills" class="list"></div>';
  rightPanels.appendChild(p);
  skillsBox = p.querySelector('#skills');
}

const tabs = document.querySelectorAll('.tab');
const tabcs = document.querySelectorAll('.tabc');

tabs.forEach(t => t.addEventListener('click', () => {
  tabs.forEach(x => x.classList.remove('active'));
  tabcs.forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  const key = t.dataset.tab;
  document.getElementById(`tab-${key}`).classList.add('active');
}));

const btnOpenInv = document.getElementById('openInv');
const btnOpenStorage = document.getElementById('openStorage');
const btnOpenTrade = document.getElementById('openTrade');
const btnOpenCraft = document.getElementById('openCraft');

const modalInv = document.getElementById('modalInv');
const modalStorage = document.getElementById('modalStorage');
const modalTrade = document.getElementById('modalTrade');
const modalCraft = document.getElementById('modalCraft');

document.addEventListener('click', (e) => {
  const target = e.target;
  if (target.matches('[data-close]')) {
    const id = target.getAttribute('data-close');
    document.getElementById(id).classList.remove('show');
  }
});
btnOpenInv.onclick = () => modalInv.classList.add('show');
btnOpenStorage.onclick = () => modalStorage.classList.add('show');
btnOpenTrade.onclick = () => modalTrade.classList.add('show');
btnOpenCraft.onclick = () => modalCraft.classList.add('show');

let ws;
let state = null;

function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}`);
  ws.addEventListener('open', () => {
    const stored = localStorage.getItem('playerId');
    send('hello', { playerId: stored || null });
  });
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === 'state') {
      state = msg;
      // persist id
      if (msg.you?.id) localStorage.setItem('playerId', msg.you.id);
      renderAll();
    }
  });
  ws.addEventListener('close', () => setTimeout(connect, 1500));
}
connect();

function send(type, payload = {}) { ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type, ...payload })); }

function isBusy() {
  if (!state) return false;
  return Date.now() < (state.you.busy?.until || 0);
}

function busyPill() {
  const you = state?.you; if (!you) return '';
  if (!isBusy()) return '';
  const remain = Math.max(0, Math.ceil((you.busy.until - Date.now())/1000));
  return `<span class="pill">⏳ ${you.busy.action || 'Занято'} · ${remain}s</span>`;
}

function busyRemainMs() {
  if (!state) return 0;
  return Math.max(0, (state.you.busy?.until || 0) - Date.now());
}

function renderAll() {
  if (!state) return;
  const { you, meta } = state;

  const loc = meta.locations.find(l => l.key === you.location);
  locName.innerHTML = (loc ? loc.name : '—') + ' ' + busyPill();
  topActions.innerHTML = '';
  for (const l of meta.locations) {
    const btn = document.createElement('button');
    btn.textContent = l.name + (you.level < l.requiredLevel ? ` (треб. ур. ${l.requiredLevel})` : '');
    btn.disabled = you.location === l.key || you.level < l.requiredLevel || isBusy();
    btn.addEventListener('click', () => send('navigate', { to: l.key }));
    topActions.appendChild(btn);
  }

  // Logs
  logEl.innerHTML = '';
  for (const line of you.logs) { const div = document.createElement('div'); div.textContent = line; logEl.appendChild(div); }
  if (isBusy()) { const div = document.createElement('div'); div.textContent = `⏳ ${you.busy.action || 'Занято'} (${Math.ceil(busyRemainMs()/1000)}с)`; logEl.appendChild(div); }

  // Combat
  if (you.encounter) { combatPanel.style.display = ''; combatInfo.textContent = `${you.encounter.name} — HP ${you.encounter.hp}`; } else { combatPanel.style.display = 'none'; }
  btnAttack.onclick = () => send('attack'); btnFlee.onclick = () => send('flee');

  // Gather panel
  const locType = (meta.locations.find(x => x.key === you.location) || {}).type;
  gatherPanel.style.display = locType === 'gather' ? '' : 'none';
  gatherPanel.querySelectorAll('button[data-gather]').forEach(btn => { btn.disabled = isBusy(); btn.onclick = () => send('gather', { which: btn.dataset.gather }); });

  // Character
  pName.textContent = you.name; pLevel.textContent = you.level; pXp.textContent = `${you.xp} / ${levelThreshold(you.level)}`; pHp.textContent = `${you.hp} / ${you.maxHp}`; pGold.textContent = you.gold;
  btnHeal.disabled = isBusy() || you.location !== 'city'; btnHeal.onclick = () => send('heal');

  // Skills with progress bars
  skillsBox.innerHTML = '';
  for (const [k, s] of Object.entries(you.skills || {})) {
    const row = document.createElement('div'); row.className = 'list';
    const tip = skillTooltip(k, s);
    const pct = Math.min(99, Math.floor((s.xp / skillThreshold(s.level)) * 100));
    row.innerHTML = `<div class="tooltip">${skillName(k)}<div class="tip">${tip}</div></div><div class="badge" style="min-width:120px;"><div style="width:${pct}%;height:6px;background:#1f6feb;border-radius:4px"></div> ур. ${s.level}</div>`;
    skillsBox.appendChild(row);
  }

  // Equipment
  const equipSlots = [['weapon','Оружие'],['armor','Броня'],['pickaxe','Кирка'],['axe','Топор'],['rod','Удочка'],['knife','Нож'],['sickle','Серп']];
  equipEl.innerHTML = '';
  for (const [key, label] of equipSlots) {
    const row = document.createElement('div'); row.className = 'list';
    const val = you.equipment[key]; const data = meta.catalog[val] || null; const name = data ? data.name : '—';
    row.innerHTML = `<div>${label}</div><div class="badge ${data ? 'type-'+data.type : ''}">${name}</div>`;
    const btn = document.createElement('button'); btn.textContent = 'Снять'; btn.disabled = !val || isBusy(); btn.onclick = () => send('unequip', { slot: key }); row.appendChild(btn);
    equipEl.appendChild(row);
  }

  // Inventory modal content
  invEl.innerHTML = '';
  const groups = groupByType(you.inventory, meta.catalog);
  for (const [type, items] of Object.entries(groups)) {
    const title = document.createElement('div'); title.className = 'small'; title.textContent = typeName(type); invEl.appendChild(title);
    for (const [k, cnt] of items) invEl.appendChild(renderInvRow(k, cnt, 'inv', meta));
    invEl.appendChild(document.createElement('hr'));
  }

  // Storage modal content
  storageEl.innerHTML = '';
  const groupsS = groupByType(you.storage, meta.catalog);
  for (const [type, items] of Object.entries(groupsS)) {
    const title = document.createElement('div'); title.className = 'small'; title.textContent = typeName(type); storageEl.appendChild(title);
    for (const [k, cnt] of items) storageEl.appendChild(renderInvRow(k, cnt, 'storage', meta));
    storageEl.appendChild(document.createElement('hr'));
  }

  // Trade modal content with buy/sell prices
  renderTrade(meta, you);

  // Craft modal content (only city)
  renderCraft(meta, you);

  // Search button
  ensureSearchButton(locType, you);
}

function ensureSearchButton(locType, you) {
  const existing = document.getElementById('searchRow');
  if (locType === 'combat' && !you.encounter) {
    if (!existing) {
      const container = document.querySelector('.left .panel');
      const row = document.createElement('div'); row.id = 'searchRow'; row.className = 'row';
      const btn = document.createElement('button'); btn.textContent = 'Искать противника'; btn.disabled = isBusy(); btn.onclick = () => send('search'); row.appendChild(btn);
      container.parentNode.insertBefore(row, container.nextSibling);
    }
  } else if (existing) existing.remove();
}

function renderInvRow(k, cnt, where, meta) {
  const data = state.meta.catalog[k] || { name: k, type: 'прочее' };
  const row = document.createElement('div'); row.className = 'list';
  row.innerHTML = `<div class="tooltip">${data.name}<div class="tip">${itemTooltip(k, data)}</div></div><div class="badge type-${data.type}">x${cnt}</div>`;
  const box = document.createElement('div'); box.className = 'row';
  const itType = meta.catalog[k]?.type;
  if (itType === 'weapon' || itType === 'armor' || itType === 'tool') { const be = document.createElement('button'); be.textContent = 'Экипировать'; be.disabled = isBusy(); be.onclick = () => send('equip', { itemKey: k }); box.appendChild(be); }
  if (itType === 'consumable' && (meta.catalog[k]?.heal||0)>0) { const bu = document.createElement('button'); bu.textContent = 'Использовать'; bu.disabled = isBusy(); bu.onclick = () => send('use', { itemKey: k }); box.appendChild(bu); }
  if (where === 'inv') { const bStore = document.createElement('button'); bStore.textContent = 'На склад'; bStore.disabled = isBusy(); bStore.onclick = () => numberPrompt(`Сколько переместить на склад? (1-${cnt})`, (q) => send('store', { itemKey: k, qty: q })); box.appendChild(bStore); }
  else if (where === 'storage') { const bTake = document.createElement('button'); bTake.textContent = 'Забрать'; bTake.disabled = isBusy(); bTake.onclick = () => numberPrompt(`Сколько забрать? (1-${cnt})`, (q) => send('withdraw', { itemKey: k, qty: q })); box.appendChild(bTake); }
  row.appendChild(box); return row;
}

function renderTrade(meta, you) {
  tradeEl.innerHTML = '';
  if (you.location !== 'city') { tradeEl.innerHTML = '<div class="small">Торговцы доступны в городе</div>'; return; }
  for (const m of meta.merchants) {
    const panel = document.createElement('div'); panel.className = 'panel';
    const title = document.createElement('h3'); title.textContent = m.name; panel.appendChild(title);

    const list = document.createElement('div');
    for (const it of m.sells) {
      const price = meta.buyPrices[it.key];
      const row = document.createElement('div'); row.className = 'list';
      row.innerHTML = `<div>${it.name}</div><div class="badge">${price} зол.</div>`;
      const btn = document.createElement('button'); btn.textContent = 'Купить'; btn.disabled = isBusy(); btn.onclick = () => numberPrompt('Сколько купить?', (q) => send('buy', { merchantKey: m.key, itemKey: it.key, qty: q })); row.appendChild(btn);
      list.appendChild(row);
    }
    panel.appendChild(list);

    const sellTitle = document.createElement('div'); sellTitle.innerHTML = '<hr><div class="small">Продать:</div>'; panel.appendChild(sellTitle);
    const sellList = document.createElement('div');
    for (const [k, cnt] of Object.entries(you.inventory)) {
      if (!merchantCanBuy(meta, m, k)) continue;
      const row = document.createElement('div'); row.className = 'list';
      row.innerHTML = `<div>${itemName(k)}</div><div class="badge">${meta.sellPrices[k]} зол.</div>`;
      const btn = document.createElement('button'); btn.textContent = 'Продать'; btn.disabled = isBusy(); btn.onclick = () => numberPrompt(`Сколько продать? (1-${cnt})`, (q) => send('sell', { merchantKey: m.key, itemKey: k, qty: q })); row.appendChild(btn);
      sellList.appendChild(row);
    }
    panel.appendChild(sellList);
    tradeEl.appendChild(panel);
  }
}

function renderCraft(meta, you) {
  craftEl.innerHTML = '';
  const info = document.createElement('div'); info.className = 'small'; info.textContent = 'Крафт доступен только в городе.'; craftEl.appendChild(info);
  if (you.location !== 'city') return;

  const filters = [
    { key: 'all', name: 'Все' },
    { key: 'resource', name: 'Ресурсы' },
    { key: 'material', name: 'Материалы' },
    { key: 'weapon', name: 'Оружие' },
    { key: 'armor', name: 'Броня' },
    { key: 'tool', name: 'Инструменты' },
    { key: 'consumable', name: 'Расходники' },
  ];
  const bar = document.createElement('div'); bar.className = 'row';
  let current = 'all';
  filters.forEach(f => { const b = document.createElement('button'); b.textContent = f.name; b.onclick = () => { current = f.key; drawList(); }; bar.appendChild(b); });
  craftEl.appendChild(bar);

  const listWrap = document.createElement('div'); craftEl.appendChild(listWrap);
  const typeOfOut = (r) => (state.meta.catalog[r.out]?.type || 'прочее');

  function drawList() {
    listWrap.innerHTML = '';
    const recs = meta.recipes.filter(r => current === 'all' ? true : typeOfOut(r) === current);
    for (const r of recs) {
      const row = document.createElement('div'); row.className = 'list';
      const need = Object.entries(r.inputs).map(([k,v]) => `${itemName(k)} x${v}`).join(', ');
      row.innerHTML = `<div>${r.name} → ${itemName(r.out)} x${r.qty}</div><div class="badge">Нужно: ${need}</div>`;
      const btn = document.createElement('button'); btn.textContent = 'Создать'; btn.disabled = isBusy(); btn.onclick = () => numberPrompt('Сколько создать?', (q) => { showCraftProgress(); send('craft', { recipeKey: r.key, qty: q }); }); row.appendChild(btn);
      listWrap.appendChild(row);
    }
  }
  drawList();
}

// Visual craft progress bar while busy
function showCraftProgress() {
  if (!modalCraft.classList.contains('show')) modalCraft.classList.add('show');
  const bar = document.createElement('div'); bar.style.cssText = 'height:10px;background:#1f6feb;border-radius:6px;width:0%';
  const wrap = document.createElement('div'); wrap.style.cssText = 'width:100%;background:#2b313a;border:1px solid #3a4150;border-radius:6px;margin:6px 0;'; wrap.appendChild(bar);
  craftEl.prepend(wrap);
  const start = Date.now(); const target = (state.you.busy?.until || (start+1000));
  function tick() {
    const now = Date.now(); const pct = Math.min(100, Math.floor(((now - start) / (target - start)) * 100)); bar.style.width = pct + '%';
    if (pct < 100 && isBusy()) requestAnimationFrame(tick); else setTimeout(() => wrap.remove(), 500);
  }
  requestAnimationFrame(tick);
}

function groupByType(bag, catalog) {
  const out = {};
  for (const [k, cnt] of Object.entries(bag)) {
    const t = catalog[k]?.type || 'прочее';
    if (!out[t]) out[t] = [];
    out[t].push([k, cnt]);
  }
  return out;
}

function merchantCanBuy(meta, merchant, itemKey) {
  const buys = merchant.buys;
  if (buys === 'all') return true;
  const t = meta.catalog[itemKey]?.type;
  return t ? buys.includes(t) : false;
}

function numberPrompt(text, cb) {
  const val = prompt(text, '1'); if (!val) return; const q = Math.max(1, Math.floor(Number(val)) || 1); cb(q);
}

function itemData(key) { return (state && state.meta && state.meta.prices && key) ? { key, price: state.meta.prices[key], name: resolveName(key) } : { key, price: 0, name: resolveName(key) }; }
function itemName(key) { return itemData(key).name; }
function itemPrice(key) { return (state && state.meta && state.meta.prices[key]) || 0; }
function itemPriceBuy(key) { return (state && state.meta && state.meta.buyPrices[key]) || 0; }
function itemPriceSell(key) { return (state && state.meta && state.meta.sellPrices[key]) || 0; }
function resolveName(key) {
  // For brevity, show key as is if not in catalog map; server provides names in trade lists
  const cat = state?.meta?.catalog?.[key];
  return cat?.name || key;
}
function typeName(t) {
  const map = { weapon:'Оружие', armor:'Броня', tool:'Инструменты', consumable:'Расходники', resource:'Ресурсы', material:'Материалы', junk:'Хлам', прочее:'Прочее' };
  return map[t] || t;
}
function skillName(k) {
  const map = { mining:'Горное дело', woodcutting:'Лесоруб', fishing:'Рыболовство', herbalism:'Травничество', hunting:'Охота' };
  return map[k] || k;
}
function levelThreshold(level) { return 100 + (level - 1) * 80 + Math.floor((level - 1) * (level - 1) * 12); }
function skillThreshold(level) { return 100 + (level - 1) * 50 + Math.floor((level - 1) * (level - 1) * 5); }

function itemTooltip(key, data) {
  const parts = [];
  if (data.type === 'weapon') parts.push(`Атака: +${data.atk}`, `Крит: ${(data.critChance*100).toFixed(0)}% ×${data.critMult}`, `Скорость атаки: +${Math.round((data.attackSpeed||0)*100)}%`);
  if (data.type === 'armor') parts.push(`Защита: +${data.def}`, `Снижение урона: ${(data.dmgReduction*100).toFixed(0)}%`);
  if (data.type === 'tool') parts.push(`Тир инструмента: ${data.tier}`, `Скорость добычи: +${Math.round((data.gatherSpeed||0)*100)}%`, `Удача добычи: +${Math.round((data.gatherLuck||0)*100)}%`);
  if (data.type === 'consumable' && data.heal) parts.push(`Лечение: +${data.heal} HP`);
  if (parts.length === 0) parts.push(`Тип: ${typeName(data.type)}`);
  return parts.join('<br/>');
}

function skillTooltip(key, s) {
  const map = {
    mining: ['Добыча руды', 'Скорость +1%/ур.', 'Шанс успеха +2.5%/ур. (от базы)'],
    woodcutting: ['Рубка дерева', 'Скорость +1%/ур.', 'Шанс успеха +2.5%/ур. (от базы)'],
    fishing: ['Рыболовство', 'Скорость +1%/ур.', 'Шанс доп. улова растёт с уровнем'],
    herbalism: ['Сбор трав', 'Скорость +1%/ур.', 'Шанс успеха +2.5%/ур. (от базы)'],
    hunting: ['Охота', 'Скорость +1%/ур.', 'Шанс успеха +2.5%/ур. (от базы)'],
  }; const info = map[key] || ['Навык', 'Влияет на скорость и шанс']; return `${info[0]}<br/>${info[1]}<br/>${info[2]||''}`;
}