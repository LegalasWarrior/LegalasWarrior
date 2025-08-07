// Local-first game engine (offline), optional server chat/presence
const state = {
  meta: { version: '0.1.0' },
  player: null,
  location: null,
  flags: {},
  inventory: [],
  log: [],
  rngSeed: Date.now(),
};

const content = await fetch('../content/world.json').then(r=>r.json()).catch(()=>null);

// Utilities
const rng = (()=>{ let s = state.rngSeed >>> 0; return ()=> (s = (s*1664525+1013904223)>>>0) / 2**32; })();
function pick(arr){ return arr[Math.floor(rng()*arr.length)]; }
function save(){ localStorage.setItem('elarian.save', JSON.stringify(state)); }
function load(){ const s = localStorage.getItem('elarian.save'); if (s) { try { const obj = JSON.parse(s); Object.assign(state, obj); } catch{} } }
function reset(){ localStorage.removeItem('elarian.save'); location.reload(); }

// Rendering
const main = document.getElementById('main');
const charPanel = document.getElementById('char');
function renderChar(){
  if(!state.player){ charPanel.innerHTML = '<div class="muted">Нет персонажа</div>'; return; }
  const p = state.player;
  charPanel.innerHTML = `
    <div><span class="badge">${p.race}</span><span class="badge">${p.cls}</span> <strong>${p.name}</strong></div>
    <div>
      <span class="stat">❤ ${p.hp}/${p.maxHp}</span>
      <span class="stat">⚡ ${p.energy}/${p.maxEnergy}</span>
      <span class="stat">✦ Ур. ${p.level} (${p.xp}/${p.xpNext})</span>
    </div>
    <div class="muted">Регион: ${state.location?.name || '—'}</div>
  `;
}

function choice(text, action){ return `<a class="choice" data-action="${action}">${text}</a>`; }
function onChoice(handler){
  main.addEventListener('click', (e)=>{
    if (e.target.matches('a.choice')){
      const action = e.target.getAttribute('data-action');
      handler(action);
    }
  });
}

function startScreen(){
  main.innerHTML = `
  Добро пожаловать в мир Эларион — цивилизация пережила Сепарацию, смешав магию и технологии.\n\n
  ${choice('Новая игра', 'new')}
  ${choice('Загрузить', 'load')}
  ${choice('Сбросить сохранение', 'reset')}
  `;
}

function createCharacter(){
  const races = ['человек','эльф','мутант','механит'];
  const classes = ['воин','маг','инженер','разведчик','шаман'];
  const name = `Путник-${Math.floor(rng()*1000)}`;
  main.innerHTML = `
    Создание персонажа\n\n
    Имя: <strong>${name}</strong>\n
    Раса: ${races.map(r=>`<span class=\"badge\">${r}</span>`).join(' ')}\n
    Класс: ${classes.map(c=>`<span class=\"badge\">${c}</span>`).join(' ')}\n\n
    ${choice('Подтвердить', 'confirm')}
  `;
  onChoice((a)=>{
    if(a==='confirm'){
      state.player = {
        id: crypto.randomUUID(),
        name,
        race: pick(races),
        cls: pick(classes),
        level: 1, xp: 0, xpNext: 20,
        hp: 20, maxHp: 20,
        energy: 10, maxEnergy: 10,
        stats: { str: 4, agi: 4, int: 4, cha: 4, per: 4, vit: 4 },
        perks: [],
      };
      state.inventory = [];
      state.flags = {};
      state.location = content?.regions?.[0] || { id:'stub', name:'Пепельные пустоши' };
      save();
      renderLoop();
    }
  });
}

function renderLocation(){
  const loc = state.location;
  const events = [
    { id:'scavenge', label:'Обыскать окрестности', run: scavengeEvent },
    { id:'rest', label:'Отдохнуть', run: restEvent },
    { id:'explore', label:'Исследовать направление', run: exploreEvent },
  ];
  main.innerHTML = `
    ${loc.name}. ${loc.flavor || 'Земля после Сепарации хранит опасности и тайны.'}\n\n
    Доступные действия:\n
    ${events.map(e=>choice(e.label, e.id)).join('\n')}
  `;
  onChoice((a)=>{
    const ev = events.find(e=>e.id===a);
    if (ev) ev.run();
  });
}

function logPush(text){ state.log.push({ ts: Date.now(), text }); if (state.log.length>50) state.log.shift(); }

function scavengeEvent(){
  const roll = rng();
  if (roll < 0.5){
    const item = pick(content.items.common);
    state.inventory.push(item);
    logPush(`Вы находите: ${item.name}.`);
    gainXp(5);
  } else if (roll < 0.8){
    startCombat(pick(content.monsters.t1));
    return;
  } else {
    logPush('Ничего ценного. Только пепел и ржавчина.');
  }
  save();
  renderLoop();
}

function restEvent(){
  const p = state.player;
  const healed = Math.min(p.maxHp - p.hp, 5);
  p.hp += healed;
  p.energy = Math.min(p.maxEnergy, p.energy + 3);
  logPush(`Короткий отдых восстанавливает ${healed} здоровья и немного энергии.`);
  save();
  renderLoop();
}

function exploreEvent(){
  const next = pick(content.regions);
  state.location = next;
  logPush(`Вы направляетесь в регион: ${next.name}.`);
  save();
  renderLoop();
}

function gainXp(x){
  const p = state.player;
  p.xp += x;
  while (p.xp >= p.xpNext){
    p.xp -= p.xpNext;
    p.level += 1;
    p.xpNext = Math.floor(p.xpNext * 1.5);
    p.maxHp += 4; p.hp = p.maxHp; p.maxEnergy += 2; p.energy = p.maxEnergy;
    logPush(`Новый уровень! Ваш уровень теперь ${p.level}.`);
  }
}

// Combat system (simplified prototype)
let combat = null;
function startCombat(mon){
  combat = { mon: JSON.parse(JSON.stringify(mon)), turn: 'player', round: 1 };
  logPush(`На вас нападает ${mon.name}!`);
  renderCombat();
}

function renderCombat(){
  const p = state.player; const m = combat.mon;
  const text = `Враг: ${m.name} ❤ ${m.hp}/${m.maxHp}  |  Вы ❤ ${p.hp}/${p.maxHp}\n\n` +
    `${choice('Атака', 'atk')} ${choice('Уклонение', 'dodge')} ${choice('Способность', 'skill')} ${choice('Отступить', 'run')}`;
  main.innerHTML = text;
  onChoice((a)=>{
    if (combat.turn !== 'player') return;
    if (a==='atk'){ playerAttack(); }
    if (a==='dodge'){ playerDodge(); }
    if (a==='skill'){ playerSkill(); }
    if (a==='run'){ tryRun(); }
  });
}

function damageRoll(min, max){ return Math.floor(min + rng()*(max-min+1)); }

function playerAttack(){
  const m = combat.mon;
  const hit = rng() < 0.8; // TODO: stats
  if (hit){
    const dmg = damageRoll(3, 6);
    m.hp = Math.max(0, m.hp - dmg);
    logPush(`Вы наносите ${dmg} урона.`);
  } else { logPush('Вы промахиваетесь.'); }
  if (m.hp<=0){ endCombat(true); return; }
  combat.turn = 'mon';
  setTimeout(monAct, 300);
  renderCombat();
}

function playerDodge(){
  logPush('Вы готовитесь уклониться.');
  combat.playerDodge = true;
  combat.turn = 'mon';
  setTimeout(monAct, 300);
  renderCombat();
}

function playerSkill(){
  const p = state.player;
  if (p.energy < 3){ logPush('Недостаточно энергии.'); renderCombat(); return; }
  p.energy -= 3;
  const m = combat.mon;
  const dmg = damageRoll(6, 10);
  m.hp = Math.max(0, m.hp - dmg);
  logPush(`Вы применяете способность и наносите ${dmg} урона.`);
  if (m.hp<=0){ endCombat(true); return; }
  combat.turn = 'mon';
  setTimeout(monAct, 300);
  renderCombat();
}

function tryRun(){
  if (rng() < 0.5){ logPush('Удалось отступить.'); combat = null; save(); renderLoop(); }
  else { logPush('Не вышло!'); combat.turn = 'mon'; setTimeout(monAct, 300); renderCombat(); }
}

function monAct(){
  const p = state.player; const m = combat.mon;
  // Simple AI behavior
  const hit = rng() < 0.7;
  if (hit){
    let dmg = damageRoll(2, 5);
    if (combat.playerDodge && rng() < 0.6){ logPush(`${m.name} промахивается!`); dmg = 0; }
    if (dmg>0){ p.hp = Math.max(0, p.hp - dmg); logPush(`${m.name} наносит ${dmg} урона.`); }
  } else { logPush(`${m.name} промахивается.`); }
  combat.playerDodge = false;
  if (p.hp<=0){ endCombat(false); return; }
  combat.turn = 'player';
}

function endCombat(victory){
  const m = combat.mon;
  if (victory){
    const xp = m.xp || 10; gainXp(xp);
    logPush(`Победа над ${m.name}. Получено ${xp} опыта.`);
    if (m.loot && rng()<0.7){ const it = pick(m.loot); state.inventory.push(it); logPush(`Трофей: ${it.name}.`); }
  } else {
    logPush('Вы пали в бою. Очнулись спустя время.');
    const p = state.player; p.hp = Math.max(1, Math.floor(p.maxHp*0.5));
  }
  combat = null; save(); renderLoop();
}

function renderLoop(){
  renderChar();
  if (combat) { renderCombat(); return; }
  renderLocation();
}

// Chat / presence (optional)
let ws = null; let connected = false;
const modeEl = document.getElementById('mode');
const connectBtn = document.getElementById('connectBtn');
const chatLog = document.getElementById('chat-log');
const chatText = document.getElementById('chat-text');
const chatSend = document.getElementById('chat-send');

function renderChatEntry(e){
  const d = new Date(e.ts).toLocaleTimeString();
  const div = document.createElement('div');
  div.innerHTML = `<span class=\"muted\">[${d}]</span> <strong>${e.from.name}:</strong> ${e.text}`;
  chatLog.appendChild(div); chatLog.scrollTop = chatLog.scrollHeight;
}

function connect(){
  if (connected) return;
  const origin = location.origin.replace('http','ws');
  ws = new WebSocket(`${origin}/ws`);
  ws.onopen = () => { connected = true; modeEl.textContent = 'Онлайн'; };
  ws.onclose = () => { connected = false; modeEl.textContent = 'Офлайн'; };
  ws.onmessage = (ev)=>{
    const msg = JSON.parse(ev.data);
    if (msg.type==='hello' && msg.chatHistory){
      msg.chatHistory.forEach(renderChatEntry);
    }
    if (msg.type==='chat' && msg.entry){ renderChatEntry(msg.entry); }
  };
}

connectBtn.addEventListener('click', connect);
chatSend.addEventListener('click', ()=>{
  if (!connected || !ws) return;
  const text = chatText.value.trim();
  if (!text) return;
  ws.send(JSON.stringify({ type: 'chat', text }));
  chatText.value = '';
});
chatText.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ chatSend.click(); }});

// Boot
load();
renderChar();
if (!state.player) startScreen(); else renderLoop();

onChoice((a)=>{
  if (a==='new') createCharacter();
  if (a==='load'){ load(); renderLoop(); }
  if (a==='reset'){ reset(); }
});