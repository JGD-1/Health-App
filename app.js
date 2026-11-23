/* Daily Log — local-first PWA. All data lives on this device (IndexedDB, with a localStorage mirror). */
'use strict';

const APP_VERSION = '1.0.0';
const SCHEMA = 1;
const ETHANOL_DENSITY = 0.789; // g per ml
const KCAL_PER_G_ALCOHOL = 7;
const GRAMS_PER_STANDARD_GLASS = 10; // NL/BE standard glass

/* ---------- Defaults ---------- */
const DEFAULT_PRESETS = [
  { id: 'pils',    name: 'Pils',        ml: 250, abv: 5,  kcal: 110 },
  { id: 'strong',  name: 'Strong beer', ml: 250, abv: 8,  kcal: 160 },
  { id: 'can',     name: 'Can of beer', ml: 330, abv: 5,  kcal: 145 },
  { id: 'red',     name: 'Red wine',    ml: 100, abv: 13, kcal: 82 },
  { id: 'white',   name: 'White wine',  ml: 100, abv: 12, kcal: 67 },
  { id: 'rose',    name: 'Rosé',        ml: 100, abv: 12, kcal: 71 },
  { id: 'port',    name: 'Port',        ml: 35,  abv: 20, kcal: 80 },
  { id: 'spirits', name: 'Spirits',     ml: 35,  abv: 35, kcal: 70 },
];

// Equipment vocabulary shared with the future workout generator (matches the exercise database's equipment field).
const EQUIPMENT = [
  ['barbell', 'Barbell'], ['dumbbell', 'Dumbbells'], ['kettlebell', 'Kettlebells'],
  ['cable', 'Cable machine'], ['machine', 'Machines'], ['bench', 'Bench'],
  ['pullup_bar', 'Pull-up bar'], ['dip_bars', 'Dip bars'], ['rings', 'Rings'],
  ['band', 'Resistance bands'], ['cardio', 'Cardio machines'],
];

const DEFAULT_LOCATIONS = [
  { id: 'gym',  name: 'Gym',  equipment: ['barbell', 'dumbbell', 'kettlebell', 'cable', 'machine', 'bench', 'pullup_bar', 'dip_bars', 'cardio'] },
  { id: 'home', name: 'Home', equipment: [] }, // empty = bodyweight only
];

const SPORT_TYPES = [
  { id: 'gym',          name: 'Gym',          icon: '🏋️', strength: true,  defaultLoc: 'gym' },
  { id: 'calisthenics', name: 'Calisthenics', icon: '🤸', strength: true,  defaultLoc: 'home' },
  { id: 'run',          name: 'Run',          icon: '🏃', strength: false, defaultLoc: 'outside' },
  { id: 'other',        name: 'Other',        icon: '⚡', strength: false, defaultLoc: 'outside' },
];
const SPORT_PLACES = [['gym', 'Gym'], ['home', 'Home'], ['outside', 'Outside']];
const EFFORTS = [['easy', 'Easy'], ['moderate', 'Moderate'], ['hard', 'Hard']];

const FOOD_ANCHORS = {
  5: 'All meals within the Schijf van Vijf, veg + fruit, no snacks outside it.',
  4: 'Mostly good, one small extra.',
  3: 'Mixed: one meal or several snacks outside the Schijf.',
  2: 'Mostly fast food, sweets or takeaway.',
  1: 'Off the rails all day.',
};

function freshState() {
  return {
    schema: SCHEMA,
    createdAt: new Date().toISOString(),
    settings: {
      heavyThreshold: 6,
      drinkPresets: DEFAULT_PRESETS.map(p => ({ ...p, hidden: false, custom: false })),
      locations: DEFAULT_LOCATIONS.map(l => ({ ...l, equipment: [...l.equipment] })),
    },
    // days['YYYY-MM-DD'] = { food: 1..5|null, drinks: [...], sport: [...] }
    days: {},
    // Reserved for roadmap step 2 (generated workouts with sets/reps/load) and step 3 (skill ladders).
    workouts: [],
    skills: {},
  };
}

/* ---------- Storage ---------- */
const DB_NAME = 'daily-log';
const LS_KEY = 'daily-log-state';
let db = null;
let state = null;

function openDb() {
  return new Promise((resolve) => {
    if (!('indexedDB' in window)) return resolve(null);
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}
function idbGet(key) {
  return new Promise((resolve) => {
    if (!db) return resolve(undefined);
    const tx = db.transaction('kv', 'readonly');
    const r = tx.objectStore('kv').get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => resolve(undefined);
  });
}
function idbPut(key, value) {
  return new Promise((resolve) => {
    if (!db) return resolve();
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

async function loadState() {
  db = await openDb();
  let s = await idbGet('state');
  if (!s) {
    try { const raw = localStorage.getItem(LS_KEY); if (raw) s = JSON.parse(raw); } catch (e) { /* ignore */ }
  }
  return migrate(s || freshState());
}

function migrate(s) {
  const base = freshState();
  s.schema = s.schema || 1;
  s.settings = Object.assign({}, base.settings, s.settings || {});
  if (!Array.isArray(s.settings.drinkPresets) || !s.settings.drinkPresets.length) s.settings.drinkPresets = base.settings.drinkPresets;
  if (!Array.isArray(s.settings.locations)) s.settings.locations = base.settings.locations;
  s.days = s.days || {};
  s.workouts = s.workouts || [];
  s.skills = s.skills || {};
  return s;
}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await idbPut('state', state);
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }, 150);
  askPersist();
}
let persistAsked = false;
function askPersist() {
  if (persistAsked || !navigator.storage || !navigator.storage.persist) return;
  persistAsked = true;
  navigator.storage.persist().catch(() => {});
}

/* ---------- Date helpers ---------- */
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const todayKey = () => ymd(new Date());
function mondayOf(d) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); const wd = (x.getDay() + 6) % 7; return addDays(x, -wd); }
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const fmtLong = d => d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtShort = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/* ---------- Domain helpers ---------- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function day(key, create) {
  let d = state.days[key];
  if (!d && create) d = state.days[key] = { food: null, drinks: [], sport: [] };
  return d || { food: null, drinks: [], sport: [] };
}
function pruneDay(key) {
  const d = state.days[key];
  if (d && d.food == null && !d.drinks.length && !d.sport.length) delete state.days[key];
}
const alcoholGrams = (ml, abv) => ml * (abv / 100) * ETHANOL_DENSITY;
const stdGlasses = (ml, abv) => alcoholGrams(ml, abv) / GRAMS_PER_STANDARD_GLASS;
const alcoholKcal = (ml, abv) => alcoholGrams(ml, abv) * KCAL_PER_G_ALCOHOL;
const round1 = n => Math.round(n * 10) / 10;
// 6 pils = 5.9 glasses by the gram, so compare on the nearest half glass.
const isHeavy = g => g > 0 && Math.round(g * 2) / 2 >= state.settings.heavyThreshold;
const glassesLabel = g => `${fmtNum(g)} glass${round1(g) === 1 ? '' : 'es'}`;
const fmtNum = n => (Math.round(n * 10) / 10).toLocaleString('en-GB');
const fmtMl = ml => `${round1(ml / 10)} cl`;

function dayTotals(d) {
  const drinks = d.drinks.length;
  const glasses = d.drinks.reduce((a, x) => a + stdGlasses(x.ml, x.abv), 0);
  const kcal = d.drinks.reduce((a, x) => a + x.kcal, 0);
  const minutes = d.sport.reduce((a, x) => a + (x.minutes || 0), 0);
  const strength = d.sport.filter(x => (SPORT_TYPES.find(t => t.id === x.type) || {}).strength).length;
  return { drinks, glasses, kcal, minutes, strength };
}

/* ---------- UI state ---------- */
let currentKey = todayKey();
let currentView = 'day';
let weekStart = mondayOf(new Date());
const $ = sel => document.querySelector(sel);
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'html') e.innerHTML = v;
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null) e.append(kid.nodeType ? kid : document.createTextNode(kid));
  return e;
};

/* ---------- Render: Day ---------- */
function renderHeader() {
  const d = parseYmd(currentKey);
  const isToday = currentKey === todayKey();
  const yest = currentKey === ymd(addDays(new Date(), -1));
  $('#dateLabel').textContent = isToday ? `Today · ${fmtShort(d)}` : yest ? `Yesterday · ${fmtShort(d)}` : fmtLong(d);
  $('#todayBtn').hidden = isToday;
  $('#nextDay').disabled = isToday;
  const showDayNav = currentView === 'day';
  $('#prevDay').style.visibility = showDayNav ? 'visible' : 'hidden';
  $('#nextDay').style.visibility = showDayNav ? 'visible' : 'hidden';
  if (!showDayNav) { $('#dateLabel').textContent = currentView === 'week' ? 'Week' : 'Settings'; $('#todayBtn').hidden = true; }
}

function renderFood() {
  const d = day(currentKey);
  const row = $('#foodRow');
  row.innerHTML = '';
  row.classList.toggle('unset', d.food == null);
  for (let s = 1; s <= 5; s++) {
    row.append(el('button', {
      class: `food-tile c${s}${d.food === s ? ' sel' : ''}`,
      'aria-label': `Food score ${s}`, 'aria-pressed': d.food === s ? 'true' : 'false',
      onclick: () => {
        const dd = day(currentKey, true);
        dd.food = dd.food === s ? null : s; // tap again to clear
        pruneDay(currentKey); save(); renderFood();
      },
    }, String(s)));
  }
  $('#foodAnchor').textContent = d.food ? `${d.food}: ${FOOD_ANCHORS[d.food]}` : '';
  $('#foodHint').textContent = d.food ? 'Tap again to clear' : 'How did you eat?';
}

function renderDrinks() {
  const d = day(currentKey);
  const grid = $('#drinkGrid');
  grid.innerHTML = '';
  const presets = state.settings.drinkPresets.filter(p => !p.hidden);
  for (const p of presets) {
    const count = d.drinks.filter(x => x.presetId === p.id).length;
    const tile = el('div', {
      class: `drink${count ? ' has' : ''}`, role: 'button', tabindex: '0',
      'aria-label': `Add ${p.name}`,
      onclick: () => addDrink(p),
    },
      el('div', { class: 'dn' }, p.name),
      el('div', { class: 'ds' }, `${fmtMl(p.ml)} · ${p.kcal} kcal`),
      count ? el('div', { class: 'dc' }, String(count)) : null,
      count ? el('button', { class: 'dm', 'aria-label': `Remove one ${p.name}`, onclick: (e) => { e.stopPropagation(); removeDrink(p.id); } }, '−') : null,
    );
    grid.append(tile);
  }
  // One-off drinks that aren't presets (or presets that were hidden later)
  const others = d.drinks.filter(x => !presets.some(p => p.id === x.presetId));
  const otherCount = others.length;
  grid.append(el('div', {
    class: `drink${otherCount ? ' has' : ''}`, role: 'button', tabindex: '0', onclick: openOtherDrink,
  },
    el('div', { class: 'dn' }, 'Other…'),
    el('div', { class: 'ds' }, otherCount ? others.map(o => o.name).slice(-2).join(', ') : 'enter size & %'),
    otherCount ? el('div', { class: 'dc' }, String(otherCount)) : null,
    otherCount ? el('button', { class: 'dm', 'aria-label': 'Remove last other drink', onclick: (e) => { e.stopPropagation(); removeDrinkEntry(others[others.length - 1].id); } }, '−') : null,
  ));

  const t = dayTotals(d);
  $('#drinkSummary').textContent = t.drinks ? `${t.drinks} drink${t.drinks > 1 ? 's' : ''} · ${glassesLabel(t.glasses)} · ${Math.round(t.kcal)} kcal` : 'None';
}

function addDrink(p) {
  const d = day(currentKey, true);
  d.drinks.push({ id: uid(), presetId: p.id, name: p.name, ml: p.ml, abv: p.abv, kcal: p.kcal, t: new Date().toISOString() });
  save(); renderDrinks();
}
function removeDrink(presetId) {
  const d = day(currentKey);
  for (let i = d.drinks.length - 1; i >= 0; i--) if (d.drinks[i].presetId === presetId) { d.drinks.splice(i, 1); break; }
  pruneDay(currentKey); save(); renderDrinks();
}
function removeDrinkEntry(id) {
  const d = day(currentKey);
  d.drinks = d.drinks.filter(x => x.id !== id);
  pruneDay(currentKey); save(); renderDrinks();
}

function renderSport() {
  const d = day(currentKey);
  const list = $('#sportList');
  list.innerHTML = '';
  if (!d.sport.length) list.append(el('li', { class: 'sport-empty' }, 'Nothing logged yet.'));
  for (const s of d.sport) {
    const t = SPORT_TYPES.find(x => x.id === s.type) || SPORT_TYPES[3];
    const place = (SPORT_PLACES.find(p => p[0] === s.location) || [, ''])[1];
    const effort = (EFFORTS.find(e => e[0] === s.effort) || [, ''])[1];
    list.append(el('li', {},
      el('span', { class: 'si' }, t.icon),
      el('div', { class: 'sx', onclick: () => openSportSheet(s) },
        el('b', {}, `${t.name}${s.note ? ' · ' + s.note : ''}`),
        el('span', { class: 'muted small' }, [`${s.minutes} min`, effort, place].filter(Boolean).join(' · ')),
      ),
      el('button', { class: 'del', 'aria-label': 'Delete', onclick: () => deleteSport(s.id) }, '✕'),
    ));
  }
  const tt = dayTotals(d);
  $('#sportSummary').textContent = tt.minutes ? `${tt.minutes} min` : '';
}

function deleteSport(id) {
  const key = currentKey;
  const d = day(key);
  const idx = d.sport.findIndex(x => x.id === id);
  if (idx < 0) return;
  const [removed] = d.sport.splice(idx, 1);
  pruneDay(key); save(); renderSport();
  toast('Sport entry deleted', 'Undo', () => {
    const dd = day(key, true); dd.sport.splice(idx, 0, removed); save(); render();
  });
}

/* ---------- Sheets ---------- */
function openSheet(content) {
  const sh = $('#sheet');
  sh.innerHTML = '';
  sh.append(content);
  $('#sheetBackdrop').hidden = false;
}
function closeSheet() { $('#sheetBackdrop').hidden = true; $('#sheet').innerHTML = ''; }

function seg(options, value, onChange) {
  const wrap = el('div', { class: 'seg' });
  const draw = (v) => {
    wrap.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  };
  for (const [v, label] of options) {
    const b = el('button', { type: 'button', 'data-v': v, onclick: () => { draw(v); onChange(v); } }, label);
    wrap.append(b);
  }
  draw(value);
  wrap.set = draw;
  return wrap;
}

function openSportSheet(existing) {
  const s = existing ? { ...existing } : { type: 'gym', location: 'gym', minutes: 45, effort: 'moderate', note: '' };
  let placeSeg;
  const typeSeg = seg(SPORT_TYPES.map(t => [t.id, `${t.icon} ${t.name}`]), s.type, v => {
    s.type = v;
    if (!existing) { s.location = SPORT_TYPES.find(t => t.id === v).defaultLoc; placeSeg.set(s.location); }
  });
  placeSeg = seg(SPORT_PLACES, s.location, v => { s.location = v; });
  const minInput = el('input', { type: 'number', inputmode: 'numeric', min: '1', max: '600', value: String(s.minutes) });
  const quick = el('div', { class: 'quick' }, [15, 20, 30, 45, 60, 90].map(m => el('button', { type: 'button', onclick: () => { minInput.value = m; } }, `${m}`)));
  const effortSeg = seg(EFFORTS, s.effort, v => { s.effort = v; });
  const noteInput = el('input', { type: 'text', maxlength: '40', placeholder: 'e.g. legs, 5 km, padel', value: s.note || '' });

  openSheet(el('div', {},
    el('h3', {}, existing ? 'Edit sport' : 'Add sport'),
    el('div', { class: 'field' }, el('span', { class: 'lbl' }, 'Type'), typeSeg),
    el('div', { class: 'field' }, el('span', { class: 'lbl' }, 'Where'), placeSeg),
    el('div', { class: 'field' }, el('label', {}, 'Minutes'), minInput, quick),
    el('div', { class: 'field' }, el('span', { class: 'lbl' }, 'Effort'), effortSeg),
    el('div', { class: 'field' }, el('label', {}, 'Note (optional)'), noteInput),
    el('div', { class: 'sheet-actions' },
      el('button', { class: 'btn', onclick: closeSheet }, 'Cancel'),
      el('button', { class: 'btn primary', onclick: () => {
        const minutes = Math.round(Number(minInput.value));
        if (!minutes || minutes < 1) { minInput.focus(); return; }
        s.minutes = Math.min(minutes, 600);
        s.note = noteInput.value.trim();
        const d = day(currentKey, true);
        if (existing) {
          const i = d.sport.findIndex(x => x.id === existing.id);
          if (i >= 0) d.sport[i] = s;
        } else {
          d.sport.push({ id: uid(), source: 'manual', workoutId: null, t: new Date().toISOString(), ...s });
        }
        save(); closeSheet(); renderSport();
      } }, 'Save'),
    ),
  ));
}

function drinkForm({ title, name = '', ml = '', abv = '', kcal = '', showSave, onSubmit, onDelete }) {
  const nameI = el('input', { type: 'text', maxlength: '24', placeholder: 'e.g. IPA, cocktail', value: name });
  const mlI = el('input', { type: 'number', inputmode: 'decimal', min: '1', value: ml !== '' ? String(round1(ml / 10)) : '', placeholder: 'cl' });
  const abvI = el('input', { type: 'number', inputmode: 'decimal', min: '0', max: '96', step: '0.1', value: abv !== '' ? String(abv) : '', placeholder: '%' });
  const kcalI = el('input', { type: 'number', inputmode: 'numeric', min: '0', value: kcal !== '' ? String(kcal) : '', placeholder: 'auto' });
  let kcalTouched = kcal !== '';
  const calc = el('div', { class: 'calc' });
  const update = () => {
    const mlv = Number(mlI.value) * 10, a = Number(abvI.value);
    if (mlv > 0 && a >= 0) {
      const auto = Math.round(alcoholKcal(mlv, a));
      calc.textContent = `${glassesLabel(stdGlasses(mlv, a))} · alcohol alone ≈ ${auto} kcal (${fmtNum(mlv)} ml × ${a}% × 0.789 g/ml × 7 kcal/g). Sugar in the drink adds more.`;
      if (!kcalTouched) kcalI.placeholder = String(auto);
    } else calc.textContent = '';
  };
  mlI.addEventListener('input', update); abvI.addEventListener('input', update);
  kcalI.addEventListener('input', () => { kcalTouched = kcalI.value !== ''; });
  update();
  const saveBox = showSave ? el('input', { type: 'checkbox', id: 'savePreset' }) : null;

  openSheet(el('div', {},
    el('h3', {}, title),
    el('div', { class: 'field' }, el('label', {}, 'Name'), nameI),
    el('div', { class: 'field' }, el('label', {}, 'Size (cl)'), mlI,
      el('div', { class: 'quick' }, [[3.5, 'shot'], [10, 'wine'], [25, 'small beer'], [33, 'can'], [50, 'pint']].map(([v, l]) => el('button', { type: 'button', onclick: () => { mlI.value = v; update(); } }, `${v} cl ${l}`)))),
    el('div', { class: 'field' }, el('label', {}, 'Alcohol %'), abvI),
    el('div', { class: 'field' }, el('label', {}, 'kcal per glass (leave empty to use the estimate)'), kcalI, calc),
    showSave ? el('div', { class: 'field' }, el('label', { for: 'savePreset', style: 'display:flex;gap:8px;align-items:center;color:inherit' }, saveBox, 'Also add as a tile')) : null,
    el('div', { class: 'sheet-actions' },
      onDelete ? el('button', { class: 'btn danger', onclick: onDelete }, 'Remove') : null,
      el('button', { class: 'btn', onclick: closeSheet }, 'Cancel'),
      el('button', { class: 'btn primary', onclick: () => {
        const mlv = Math.round(Number(mlI.value) * 10), a = Number(abvI.value);
        if (!(mlv > 0)) { mlI.focus(); return; }
        if (!(a >= 0 && a <= 96) || abvI.value === '') { abvI.focus(); return; }
        const k = kcalI.value !== '' ? Math.round(Number(kcalI.value)) : Math.round(alcoholKcal(mlv, a));
        onSubmit({ name: nameI.value.trim() || 'Drink', ml: mlv, abv: a, kcal: k, savePreset: saveBox && saveBox.checked });
        closeSheet();
      } }, 'Save'),
    ),
  ));
}

function openOtherDrink() {
  drinkForm({
    title: 'Other drink', showSave: true,
    onSubmit: (v) => {
      let presetId = null;
      if (v.savePreset) {
        presetId = 'c_' + uid();
        state.settings.drinkPresets.push({ id: presetId, name: v.name, ml: v.ml, abv: v.abv, kcal: v.kcal, hidden: false, custom: true });
      }
      const d = day(currentKey, true);
      d.drinks.push({ id: uid(), presetId, name: v.name, ml: v.ml, abv: v.abv, kcal: v.kcal, t: new Date().toISOString() });
      save(); renderDrinks(); renderSettings();
    },
  });
}

/* ---------- Render: Week ---------- */
function ringStyle(node, value, goal, label) {
  const pct = Math.min(1, goal ? value / goal : 0);
  node.style.background = `conic-gradient(var(--ring-fg) ${pct * 360}deg, var(--ring-bg) 0)`;
  node.innerHTML = '';
  node.append(el('span', {}, label));
}

function renderWeek() {
  const start = weekStart;
  const end = addDays(start, 6);
  const thisMonday = mondayOf(new Date());
  $('#weekLabel').textContent = ymd(start) === ymd(thisMonday) ? `This week · ${fmtShort(start)}–${fmtShort(end)}` : `${fmtShort(start)} – ${fmtShort(end)}`;
  $('#nextWeek').disabled = start >= thisMonday;

  const keys = [...Array(7)].map((_, i) => ymd(addDays(start, i)));
  const tKey = todayKey();

  // Food
  const wf = $('#weekFood'); wf.innerHTML = '';
  const scores = [];
  keys.forEach((k, i) => {
    const f = day(k).food;
    if (f) scores.push(f);
    wf.append(el('div', { class: `wf${k === tKey ? ' today' : ''}`, onclick: () => goToDay(k) },
      el('div', { class: `wt${f ? ' c' + f : ''}` }, f ? String(f) : ''),
      el('div', { class: 'wd' }, DAY_SHORT[i]),
    ));
  });
  $('#weekFoodAvg').textContent = scores.length ? `Average ${fmtNum(scores.reduce((a, b) => a + b, 0) / scores.length)} over ${scores.length} day${scores.length > 1 ? 's' : ''} rated.` : 'No days rated yet.';

  // Sport
  let minutes = 0, strength = 0;
  keys.forEach(k => { const t = dayTotals(day(k)); minutes += t.minutes; strength += t.strength; });
  ringStyle($('#ringMinutes'), minutes, 150, String(minutes));
  ringStyle($('#ringStrength'), strength, 2, `${strength}`);

  // Drinks
  const totals = keys.map(k => dayTotals(day(k)));
  const maxG = Math.max(4, ...totals.map(t => t.glasses));
  const bars = $('#drinkBars'); bars.innerHTML = '';
  const chartH = 130 - 18 - 20 - 16; // container - padding - day label - value label
  totals.forEach((t, i) => {
    const h = Math.round((t.glasses / maxG) * chartH);
    bars.append(el('div', { class: 'bar-col', onclick: () => goToDay(keys[i]) },
      el('div', { class: 'bar-v' }, t.glasses ? fmtNum(t.glasses) : ''),
      el('div', { class: `bar${isHeavy(t.glasses) ? ' heavy' : ''}`, style: `height:${t.glasses ? Math.max(h, 3) : 2}px` }),
      el('div', { class: 'bar-d' }, DAY_SHORT[i]),
    ));
  });
  const ref = el('div', { class: 'refline' });
  ref.style.bottom = `${20 + Math.round((1 / maxG) * chartH)}px`;
  bars.append(ref);

  const daysSoFar = keys.filter(k => k <= tKey).length;
  const glasses = totals.reduce((a, t) => a + t.glasses, 0);
  const kcal = totals.reduce((a, t) => a + t.kcal, 0);
  const freeDays = keys.filter((k, i) => k <= tKey && totals[i].drinks === 0).length;
  const heavy = totals.filter(t => isHeavy(t.glasses)).length;
  const st = $('#drinkStats'); st.innerHTML = '';
  [
    [fmtNum(glasses), 'standard glasses'],
    [Math.round(kcal).toLocaleString('en-GB'), 'kcal from drinks'],
    [`${freeDays}/${daysSoFar}`, 'alcohol-free days'],
    [String(heavy), `heavy days (${state.settings.heavyThreshold}+)`],
  ].forEach(([b, s]) => st.append(el('div', { class: 'stat' }, el('b', {}, b), el('span', {}, s))));

  renderHeat();
}

function renderHeat() {
  const heat = $('#heat'); heat.innerHTML = '';
  const thisMonday = mondayOf(new Date());
  const first = addDays(thisMonday, -7 * 11);
  const tKey = todayKey();
  for (let r = 0; r < 7; r++) {
    heat.append(el('div', { class: 'hl' }, r % 2 === 0 ? DAY_SHORT[r].slice(0, 1) : ''));
    for (let c = 0; c < 12; c++) {
      const k = ymd(addDays(first, c * 7 + r));
      const f = day(k).food;
      const future = k > tKey;
      heat.append(el('div', {
        class: `hc${f ? ' c' + f : ''}${future ? ' future' : ''}${k === tKey ? ' today' : ''}`,
        title: k, onclick: future ? null : () => goToDay(k),
      }));
    }
  }
}

function goToDay(k) { if (k > todayKey()) return; currentKey = k; setView('day'); }

/* ---------- Render: Settings ---------- */
function renderSettings() {
  const list = $('#presetList'); list.innerHTML = '';
  for (const p of state.settings.drinkPresets) {
    list.append(el('div', { class: `preset${p.hidden ? ' hidden-p' : ''}` },
      el('div', { class: 'preset-top' },
        el('b', {}, p.name),
        el('button', { class: 'link', onclick: () => { p.hidden = !p.hidden; save(); renderSettings(); renderDrinks(); } }, p.hidden ? 'Show' : 'Hide'),
        el('button', { class: 'link', onclick: () => editPreset(p) }, 'Edit'),
      ),
      el('div', { class: 'ps' }, `${fmtMl(p.ml)} · ${p.abv}% · ${p.kcal} kcal · ${glassesLabel(stdGlasses(p.ml, p.abv))}`),
    ));
  }

  const ll = $('#locationList'); ll.innerHTML = '';
  for (const loc of state.settings.locations) {
    ll.append(el('div', { class: 'loc' },
      el('b', {}, loc.name), ' ',
      el('span', { class: 'muted small' }, loc.equipment.length ? `${loc.equipment.length} items` : 'bodyweight only'),
      el('div', { class: 'chips' }, EQUIPMENT.map(([id, label]) => el('button', {
        class: `chip${loc.equipment.includes(id) ? ' on' : ''}`,
        onclick: () => {
          loc.equipment = loc.equipment.includes(id) ? loc.equipment.filter(x => x !== id) : [...loc.equipment, id];
          save(); renderSettings();
        },
      }, label))),
    ));
  }

  $('#heavySeg').querySelectorAll('button').forEach(b => b.classList.toggle('on', Number(b.dataset.v) === state.settings.heavyThreshold));
  const nDays = Object.keys(state.days).length;
  $('#storageInfo').textContent = `Everything is stored only on this phone (${nDays} day${nDays === 1 ? '' : 's'} logged). Download a backup now and then, because clearing Chrome's site data or uninstalling the app erases it.`;
  $('#versionInfo').textContent = `Daily Log v${APP_VERSION}`;
}

function editPreset(p) {
  drinkForm({
    title: `Edit ${p.name}`, name: p.name, ml: p.ml, abv: p.abv, kcal: p.kcal,
    onSubmit: (v) => { Object.assign(p, { name: v.name, ml: v.ml, abv: v.abv, kcal: v.kcal }); save(); renderSettings(); renderDrinks(); },
    onDelete: p.custom ? () => {
      state.settings.drinkPresets = state.settings.drinkPresets.filter(x => x.id !== p.id);
      save(); closeSheet(); renderSettings(); renderDrinks();
    } : null,
  });
}

/* ---------- Export / import / delete ---------- */
function download(name, text, type) {
  const blob = new Blob([text], { type });
  const a = el('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
function exportJson() {
  download(`daily-log-backup-${todayKey()}.json`, JSON.stringify({ app: 'daily-log', exportedAt: new Date().toISOString(), ...state }, null, 2), 'application/json');
}
function csvCell(v) { const s = v == null ? '' : String(v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
function exportCsv() {
  const rows = [['date', 'category', 'item', 'amount', 'unit', 'kcal', 'standard_glasses', 'effort', 'location', 'note']];
  for (const k of Object.keys(state.days).sort()) {
    const d = state.days[k];
    if (d.food != null) rows.push([k, 'food', 'score', d.food, '1-5', '', '', '', '', '']);
    for (const x of d.drinks) rows.push([k, 'drink', x.name, x.ml, 'ml', x.kcal, round1(stdGlasses(x.ml, x.abv)), '', '', `${x.abv}%`]);
    for (const s of d.sport) rows.push([k, 'sport', s.type, s.minutes, 'min', '', '', s.effort, s.location, s.note || '']);
  }
  download(`daily-log-${todayKey()}.csv`, rows.map(r => r.map(csvCell).join(',')).join('\n'), 'text/csv');
}
function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try { data = JSON.parse(reader.result); } catch (e) { toast('That file is not a valid backup.'); return; }
    if (!data || typeof data !== 'object' || !data.days || !data.settings) { toast('That file is not a Daily Log backup.'); return; }
    const n = Object.keys(data.days).length;
    openSheet(el('div', {},
      el('h3', {}, 'Restore backup?'),
      el('p', {}, `This replaces everything on this phone with the backup (${n} days). This can't be undone.`),
      el('div', { class: 'sheet-actions' },
        el('button', { class: 'btn', onclick: closeSheet }, 'Cancel'),
        el('button', { class: 'btn primary', onclick: () => {
          delete data.app; delete data.exportedAt;
          state = migrate(data); save(); closeSheet(); render(); toast('Backup restored.');
        } }, 'Restore'),
      ),
    ));
  };
  reader.readAsText(file);
}
function confirmDeleteAll() {
  const input = el('input', { type: 'text', placeholder: 'Type DELETE', autocomplete: 'off', autocapitalize: 'characters' });
  openSheet(el('div', {},
    el('h3', {}, 'Delete all data?'),
    el('p', {}, 'This erases every day you logged and your settings from this phone. Download a backup first if you might want it back.'),
    el('div', { class: 'field' }, input),
    el('div', { class: 'sheet-actions' },
      el('button', { class: 'btn', onclick: closeSheet }, 'Cancel'),
      el('button', { class: 'btn danger', onclick: async () => {
        if (input.value.trim().toUpperCase() !== 'DELETE') { input.focus(); return; }
        state = freshState();
        await idbPut('state', state);
        try { localStorage.removeItem(LS_KEY); } catch (e) { /* ignore */ }
        closeSheet(); currentKey = todayKey(); render(); toast('All data deleted.');
      } }, 'Delete everything'),
    ),
  ));
}

/* ---------- Toast ---------- */
let toastTimer = null;
function toast(msg, actionLabel, action) {
  const t = $('#toast');
  t.innerHTML = '';
  t.append(el('span', {}, msg));
  if (actionLabel) t.append(el('button', { onclick: () => { t.hidden = true; action(); } }, actionLabel));
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, actionLabel ? 5000 : 2500);
}

/* ---------- Views ---------- */
function setView(v) {
  currentView = v;
  for (const name of ['day', 'week', 'settings']) $(`#view-${name}`).hidden = name !== v;
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  if (v === 'week') weekStart = mondayOf(parseYmd(currentKey));
  render();
  window.scrollTo(0, 0);
}
function render() {
  renderHeader();
  if (currentView === 'day') { renderFood(); renderDrinks(); renderSport(); }
  if (currentView === 'week') renderWeek();
  if (currentView === 'settings') renderSettings();
}

function bind() {
  $('#prevDay').onclick = () => { currentKey = ymd(addDays(parseYmd(currentKey), -1)); render(); };
  $('#nextDay').onclick = () => { if (currentKey < todayKey()) { currentKey = ymd(addDays(parseYmd(currentKey), 1)); render(); } };
  $('#todayBtn').onclick = () => { currentKey = todayKey(); render(); };
  $('#prevWeek').onclick = () => { weekStart = addDays(weekStart, -7); renderWeek(); };
  $('#nextWeek').onclick = () => { if (weekStart < mondayOf(new Date())) { weekStart = addDays(weekStart, 7); renderWeek(); } };
  $('#addSportBtn').onclick = () => openSportSheet(null);
  $('#addPresetBtn').onclick = () => drinkForm({
    title: 'New drink tile',
    onSubmit: (v) => { state.settings.drinkPresets.push({ id: 'c_' + uid(), name: v.name, ml: v.ml, abv: v.abv, kcal: v.kcal, hidden: false, custom: true }); save(); renderSettings(); },
  });
  $('#heavySeg').querySelectorAll('button').forEach(b => b.onclick = () => { state.settings.heavyThreshold = Number(b.dataset.v); save(); renderSettings(); });
  $('#exportJson').onclick = exportJson;
  $('#exportCsv').onclick = exportCsv;
  $('#importFile').onchange = (e) => { const f = e.target.files[0]; if (f) importJson(f); e.target.value = ''; };
  $('#deleteAll').onclick = confirmDeleteAll;
  document.querySelectorAll('.tabbar button').forEach(b => b.onclick = () => setView(b.dataset.view));
  $('#sheetBackdrop').addEventListener('click', (e) => { if (e.target.id === 'sheetBackdrop') closeSheet(); });
  // Day rolls over while the app stays open
  let lastToday = todayKey();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    const t = todayKey();
    if (t !== lastToday) { if (currentKey === lastToday) currentKey = t; lastToday = t; }
    render();
  });
}

(async function init() {
  state = await loadState();
  bind();
  render();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
