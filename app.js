/* Daily Tracker — food score + drinks per day, with week / month / year overviews.
   Data lives on the phone (IndexedDB + localStorage mirror). Partner sync plugs in via the Sync object. */
'use strict';

const APP_VERSION = '2.1.0';
const SCHEMA = 2;

const DRINKS = [
  { id: 'beer',   name: 'Beer',   icon: '🍺', hint: 'glass, bottle or can' },
  { id: 'wine',   name: 'Wine',   icon: '🍷', hint: 'glass' },
  { id: 'liquor', name: 'Liquor', icon: '🥃', hint: 'shot or mixed drink' },
];

const FOOD_ANCHORS = {
  5: 'All meals within the Schijf van Vijf, veg + fruit, no snacks outside it.',
  4: 'Mostly good, one small extra.',
  3: 'Mixed: one meal or several snacks outside the Schijf.',
  2: 'Mostly fast food, sweets or takeaway.',
  1: 'Off the rails all day.',
};

const MOODS = {
  1: { icon: '😞', label: 'Bad day' },
  2: { icon: '😕', label: 'Not great' },
  3: { icon: '😐', label: 'Okay' },
  4: { icon: '🙂', label: 'Good' },
  5: { icon: '😄', label: 'Great' },
};
const METRICS = { food: 'Food', mood: 'Mood' };

function freshState() {
  return {
    schema: SCHEMA,
    createdAt: new Date().toISOString(),
    // days['YYYY-MM-DD'] = { food: 1..5|null, mood: 1..5|null, weight: kg|null, beer, wine, liquor, u: ISO time of last change }
    days: {},
    settings: { name: '' },
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
    const r = db.transaction('kv', 'readonly').objectStore('kv').get(key);
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
  if (!s) { try { const raw = localStorage.getItem(LS_KEY); if (raw) s = JSON.parse(raw); } catch (e) { /* ignore */ } }
  return migrate(s || freshState());
}

// v1 (food + drink entries with kcal + sport) → v2 (food + beer/wine/liquor counts). Sport moves to the sports app.
function drinkKind(x) {
  const id = x.presetId || '';
  if (['pils', 'strong', 'can'].includes(id)) return 'beer';
  if (['red', 'white', 'rose'].includes(id)) return 'wine';
  if (['port', 'spirits'].includes(id)) return 'liquor';
  const abv = Number(x.abv) || 0;
  return abv <= 9 ? 'beer' : abv <= 16 ? 'wine' : 'liquor';
}
function migrate(s) {
  if (!s.schema || s.schema < 2) {
    const days = {};
    for (const [k, d] of Object.entries(s.days || {})) {
      const n = { food: d.food ?? null, beer: 0, wine: 0, liquor: 0, u: new Date().toISOString() };
      for (const x of d.drinks || []) n[drinkKind(x)]++;
      if (n.food != null || n.beer || n.wine || n.liquor) days[k] = { mood: null, weight: null, ...n };
    }
    s = { ...freshState(), days, legacyV1: { sport: Object.fromEntries(Object.entries(s.days || {}).filter(([, d]) => d.sport && d.sport.length).map(([k, d]) => [k, d.sport])) } };
  }
  s.days = s.days || {};
  for (const d of Object.values(s.days)) { if (d.mood === undefined) d.mood = null; if (d.weight === undefined) d.weight = null; }
  s.settings = Object.assign({ name: '' }, s.settings || {});
  return s;
}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await idbPut('state', state);
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }, 150);
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}

/* ---------- Sync hook (partner sharing) ----------
   Until sharing is set up, the partner has no data and the overview shows only "me". */
const Sync = {
  enabled: false,
  partnerName: '',
  partnerDays: {},
  dayChanged(/* key, day */) {},
};

/* ---------- Dates ---------- */
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const todayKey = () => ymd(new Date());
const mondayOf = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return addDays(x, -((x.getDay() + 6) % 7)); };
const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtLong = d => d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtShort = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const fmtMonth = d => d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
const fmt1 = n => (Math.round(n * 10) / 10).toLocaleString('en-GB');

/* ---------- Domain ---------- */
const EMPTY = Object.freeze({ food: null, mood: null, weight: null, beer: 0, wine: 0, liquor: 0 });
const myDay = k => state.days[k] || EMPTY;
const drinksOf = d => (d.beer || 0) + (d.wine || 0) + (d.liquor || 0);
function updateDay(k, fn) {
  const d = { ...EMPTY, ...(state.days[k] || {}) };
  fn(d);
  d.u = new Date().toISOString();
  if (d.food == null && d.mood == null && d.weight == null && !drinksOf(d)) delete state.days[k]; else state.days[k] = d;
  save();
  Sync.dayChanged(k, state.days[k] || null);
}
// Summary over a list of date keys for one person's days
function summarise(keys, days) {
  const t = todayKey();
  const past = keys.filter(k => k <= t);
  const rated = past.map(k => (days[k] || EMPTY).food).filter(Boolean);
  const moods = past.map(k => (days[k] || EMPTY).mood).filter(Boolean);
  const weights = past.map(k => (days[k] || EMPTY).weight).filter(w => w != null);
  const sum = { beer: 0, wine: 0, liquor: 0 };
  let free = 0, logged = 0;
  for (const k of past) {
    const d = days[k];
    if (!d) continue; // a day nobody logged doesn't count as alcohol-free
    logged++;
    for (const x of DRINKS) sum[x.id] += d[x.id] || 0;
    if (!drinksOf(d)) free++;
  }
  return {
    days: past.length, rated: rated.length,
    avgFood: rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : null,
    avgMood: moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null, moodDays: moods.length,
    weightFirst: weights.length ? weights[0] : null, weightLast: weights.length ? weights[weights.length - 1] : null,
    ...sum, drinks: sum.beer + sum.wine + sum.liquor, free, logged,
  };
}

/* ---------- UI helpers ---------- */
const $ = sel => document.querySelector(sel);
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on')) { if (v) e.addEventListener(k.slice(2), v); }
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) e.append(kid.nodeType ? kid : document.createTextNode(kid));
  return e;
};
const foodColor = f => f ? `var(--s${f})` : 'var(--empty)';
// One cell for "me", or split left/right for "both"
function cellBg(k, who) {
  const a = myDay(k)[metric], b = (Sync.partnerDays[k] || EMPTY)[metric];
  if (who === 'me') return foodColor(a);
  if (who === 'partner') return foodColor(b);
  return `linear-gradient(90deg, ${foodColor(a)} 50%, ${foodColor(b)} 50%)`;
}

/* ---------- State of the UI ---------- */
let view = 'day';
let dayKey = todayKey();
let period = 'week';
let who = 'me';
let metric = 'food'; // which score colours the overview: 'food' or 'mood'
let anchor = new Date(); // any date inside the shown week / month / year

/* ---------- Header ---------- */
function renderHeader() {
  const t = todayKey();
  const title = $('#title'), back = $('#backBtn'), prev = $('#prev'), next = $('#next');
  prev.style.visibility = next.style.visibility = view === 'settings' ? 'hidden' : 'visible';
  back.hidden = true;
  if (view === 'day') {
    const d = parseYmd(dayKey);
    title.textContent = dayKey === t ? `Today · ${fmtShort(d)}` : dayKey === ymd(addDays(new Date(), -1)) ? `Yesterday · ${fmtShort(d)}` : fmtLong(d);
    back.hidden = dayKey === t;
    next.disabled = dayKey >= t;
  } else if (view === 'overview') {
    const now = new Date();
    if (period === 'week') {
      const s = mondayOf(anchor), e = addDays(s, 6);
      title.textContent = `${fmtShort(s)} – ${fmtShort(e)}`;
      next.disabled = ymd(s) >= ymd(mondayOf(now));
    } else if (period === 'month') {
      title.textContent = fmtMonth(anchor);
      next.disabled = anchor.getFullYear() * 12 + anchor.getMonth() >= now.getFullYear() * 12 + now.getMonth();
    } else {
      title.textContent = String(anchor.getFullYear());
      next.disabled = anchor.getFullYear() >= now.getFullYear();
    }
    back.hidden = next.disabled;
    back.textContent = 'Back to now';
  } else {
    title.textContent = 'Settings';
  }
  if (view === 'day') back.textContent = 'Back to today';
}

/* ---------- Today ---------- */
function scoreRow(row, field, label, content) {
  const d = myDay(dayKey);
  row.innerHTML = '';
  row.classList.toggle('unset', d[field] == null);
  for (let s = 1; s <= 5; s++) {
    row.append(el('button', {
      class: `food-tile c${s}${d[field] === s ? ' sel' : ''}`, 'aria-label': `${label} ${s}`, 'aria-pressed': String(d[field] === s),
      onclick: () => { updateDay(dayKey, x => { x[field] = x[field] === s ? null : s; }); renderDay(); },
    }, content(s)));
  }
}
const lastWeightBefore = k => { const ks = Object.keys(state.days).filter(x => x <= k && state.days[x].weight != null).sort(); return ks.length ? state.days[ks[ks.length - 1]].weight : null; };
const fmtKg = w => `${w.toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`;

function renderDay() {
  const d = myDay(dayKey);
  scoreRow($('#foodRow'), 'food', 'Food score', s => String(s));
  $('#foodAnchor').textContent = d.food ? `${d.food}: ${FOOD_ANCHORS[d.food]}` : '';
  $('#foodHint').textContent = d.food ? 'Tap again to clear' : 'How did you eat?';
  scoreRow($('#moodRow'), 'mood', 'Mood', s => el('span', { class: 'mood-face' }, MOODS[s].icon, el('small', {}, String(s))));
  $('#moodAnchor').textContent = d.mood ? `${d.mood}: ${MOODS[d.mood].label}` : '';
  $('#moodHint').textContent = d.mood ? 'Tap again to clear' : 'How did you feel?';

  const prevW = lastWeightBefore(ymd(addDays(parseYmd(dayKey), -1)));
  const wv = $('#weightValue');
  wv.innerHTML = '';
  if (d.weight != null) {
    const diff = prevW != null ? Math.round((d.weight - prevW) * 10) / 10 : null;
    wv.append(el('b', { class: 'wbig' }, fmtKg(d.weight)), diff ? el('span', { class: 'muted small' }, ` ${diff > 0 ? '+' : ''}${fmt1(diff)} since last`) : null);
  } else {
    wv.append(el('span', { class: 'muted' }, prevW != null ? `Not weighed · last ${fmtKg(prevW)}` : 'Not weighed'));
  }
  $('#weightBtn').textContent = d.weight != null ? 'Change' : 'Add weight';

  const c = $('#counters');
  c.innerHTML = '';
  for (const x of DRINKS) {
    const n = d[x.id] || 0;
    c.append(el('div', { class: 'counter' },
      el('span', { class: 'ci' }, x.icon),
      el('div', { class: 'cx' }, el('b', {}, x.name), el('span', { class: 'muted small' }, x.hint)),
      el('button', { class: 'cb', 'aria-label': `Remove one ${x.name}`, disabled: n === 0, onclick: () => { updateDay(dayKey, y => { y[x.id] = Math.max(0, (y[x.id] || 0) - 1); }); renderDay(); } }, '−'),
      el('span', { class: `cn${n ? ' on' : ''}` }, String(n)),
      el('button', { class: 'cb plus', 'aria-label': `Add one ${x.name}`, onclick: () => { updateDay(dayKey, y => { y[x.id] = Math.min(50, (y[x.id] || 0) + 1); }); renderDay(); } }, '+'),
    ));
  }
  const total = drinksOf(d);
  $('#drinkSummary').textContent = total ? `${total} today` : 'None';

  const pc = $('#partnerToday');
  pc.hidden = !Sync.enabled;
  if (Sync.enabled) {
    const p = Sync.partnerDays[dayKey] || EMPTY;
    pc.innerHTML = '';
    pc.append(
      el('div', { class: 'card-head' }, el('h2', {}, Sync.partnerName || 'Partner'), el('span', { class: 'muted small' }, 'same day')),
      el('div', { class: 'partner-row' },
        el('div', { class: `mini-tile${p.food ? ' c' + p.food : ''}`, title: 'Food' }, p.food ? String(p.food) : '–'),
        el('div', { class: `mini-tile${p.mood ? ' c' + p.mood : ''}`, title: 'Mood' }, p.mood ? MOODS[p.mood].icon : '–'),
        el('div', {}, drinksOf(p) ? DRINKS.filter(x => p[x.id]).map(x => `${x.icon} ${p[x.id]}`).join('   ') : el('span', { class: 'muted' }, 'No drinks')),
      ),
    );
  }
}

function openWeightSheet() {
  const d = myDay(dayKey);
  const start = d.weight ?? lastWeightBefore(dayKey) ?? '';
  const input = el('input', { type: 'number', inputmode: 'decimal', step: '0.1', min: '20', max: '400', value: start === '' ? '' : String(start), placeholder: 'kg' });
  const nudge = n => { const v = Number(input.value) || 0; input.value = (Math.round((v + n) * 10) / 10).toFixed(1); };
  openSheet(el('div', {},
    el('h3', {}, 'Weight'),
    el('p', { class: 'muted small' }, 'Tip: weigh at the same moment each day, e.g. in the morning before breakfast.'),
    el('div', { class: 'field' }, el('div', { class: 'wrow' },
      el('button', { class: 'cb', type: 'button', onclick: () => nudge(-0.1) }, '−'), input, el('button', { class: 'cb plus', type: 'button', onclick: () => nudge(0.1) }, '+'))),
    el('div', { class: 'sheet-actions' },
      d.weight != null ? el('button', { class: 'btn danger', onclick: () => { updateDay(dayKey, x => { x.weight = null; }); closeSheet(); renderDay(); } }, 'Clear') : null,
      el('button', { class: 'btn', onclick: closeSheet }, 'Cancel'),
      el('button', { class: 'btn primary', onclick: () => {
        const v = Math.round(Number(String(input.value).replace(',', '.')) * 10) / 10;
        if (!(v >= 20 && v <= 400)) { input.focus(); return; }
        updateDay(dayKey, x => { x.weight = v; }); closeSheet(); renderDay();
      } }, 'Save'),
    ),
  ));
  setTimeout(() => input.focus(), 50);
}

/* ---------- Overview ---------- */
function drinkLine(s) {
  return DRINKS.map(x => `${x.icon} ${s[x.id]}`).join('   ');
}
function statsBlock(label, s, showLabel) {
  return el('div', { class: 'stats-person' },
    showLabel ? el('div', { class: 'sp-name' }, label) : null,
    el('div', { class: 'stats' },
      el('div', { class: 'stat' }, el('b', {}, s.avgFood != null ? fmt1(s.avgFood) : '–'), el('span', {}, `avg food (${s.rated}/${s.days} days)`)),
      el('div', { class: 'stat' }, el('b', {}, s.avgMood != null ? fmt1(s.avgMood) : '–'), el('span', {}, `avg mood (${s.moodDays}/${s.days} days)`)),
      el('div', { class: 'stat' }, el('b', {}, `${s.free}/${s.logged}`), el('span', {}, 'alcohol-free (of days logged)')),
      el('div', { class: 'stat' }, el('b', {}, s.weightLast != null ? fmtKg(s.weightLast) : '–'),
        el('span', {}, s.weightLast != null && s.weightFirst != null && s.weightLast !== s.weightFirst ? `weight, ${s.weightLast > s.weightFirst ? '+' : ''}${fmt1(s.weightLast - s.weightFirst)} kg in this period` : 'latest weight')),
      el('div', { class: 'stat wide' }, el('b', {}, drinkLine(s)), el('span', {}, `${s.drinks} drinks in total`)),
    ),
  );
}
function people() {
  const me = { label: state.settings.name || 'Me', days: state.days };
  const partner = { label: Sync.partnerName || 'Partner', days: Sync.partnerDays };
  return who === 'me' ? [me] : who === 'partner' ? [partner] : [me, partner];
}
function statsCard(keys) {
  const ps = people();
  return el('div', { class: 'card' }, el('h2', {}, 'Summary'), ps.map(p => statsBlock(p.label, summarise(keys, p.days), ps.length > 1)));
}
function metricSeg() {
  const w = el('div', { class: 'seg mini' });
  for (const [k, label] of Object.entries(METRICS)) w.append(el('button', { class: k === metric ? 'on' : '', onclick: () => { metric = k; render(); } }, label));
  return w;
}
function cardHead(title) { return el('div', { class: 'card-head' }, el('h2', {}, title), metricSeg()); }
// Weight line chart for the given keys (one line per person shown)
function weightCard(keys) {
  const ps = people();
  const series = ps.map((p, i) => ({ label: p.label, cls: i === 0 && who !== 'partner' ? 'w-me' : 'w-partner', pts: keys.map((k, x) => [x, (p.days[k] || EMPTY).weight]).filter(([, w]) => w != null) }));
  const all = series.flatMap(s => s.pts.map(p => p[1]));
  const card = el('div', { class: 'card' }, el('h2', {}, 'Weight'));
  if (!all.length) { card.append(el('p', { class: 'muted small' }, 'No weight logged in this period.')); return card; }
  const W = 320, H = 140, P = 28;
  let lo = Math.min(...all), hi = Math.max(...all);
  if (hi - lo < 2) { const mid = (hi + lo) / 2; lo = mid - 1; hi = mid + 1; }
  const X = x => P + (keys.length > 1 ? x / (keys.length - 1) : 0.5) * (W - P - 8);
  const Y = w => 8 + (1 - (w - lo) / (hi - lo)) * (H - 24);
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'wchart');
  const add = (tag, attrs, text) => { const n = document.createElementNS(NS, tag); for (const [a, v] of Object.entries(attrs)) n.setAttribute(a, v); if (text != null) n.textContent = text; svg.append(n); return n; };
  for (const v of [lo, (lo + hi) / 2, hi]) {
    add('line', { x1: P, x2: W - 8, y1: Y(v), y2: Y(v), class: 'grid' });
    add('text', { x: P - 4, y: Y(v) + 3, class: 'axis', 'text-anchor': 'end' }, fmt1(v));
  }
  add('text', { x: P, y: H - 2, class: 'axis' }, fmtShort(parseYmd(keys[0])));
  add('text', { x: W - 8, y: H - 2, class: 'axis', 'text-anchor': 'end' }, fmtShort(parseYmd(keys[keys.length - 1])));
  for (const s of series) {
    if (s.pts.length > 1) add('polyline', { points: s.pts.map(([x, w]) => `${X(x)},${Y(w)}`).join(' '), class: `wl ${s.cls}` });
    for (const [x, w] of s.pts) add('circle', { cx: X(x), cy: Y(w), r: keys.length > 60 ? 1.6 : 3, class: `wd ${s.cls}` });
  }
  card.append(svg);
  if (series.length > 1) card.append(el('p', { class: 'muted small' }, el('span', { class: 'key w-me' }), ` ${series[0].label}   `, el('span', { class: 'key w-partner' }), ` ${series[1].label}`));
  return card;
}

function legend() {
  if (who !== 'both') return null;
  return el('p', { class: 'muted small' }, `Left half: ${state.settings.name || 'you'} · right half: ${Sync.partnerName || 'partner'}`);
}

function renderWeek(box) {
  const s = mondayOf(anchor);
  const keys = [...Array(7)].map((_, i) => ymd(addDays(s, i)));
  const t = todayKey();
  const grid = el('div', { class: 'week-grid' });
  keys.forEach((k, i) => {
    const d = who === 'partner' ? (Sync.partnerDays[k] || EMPTY) : myDay(k);
    const n = drinksOf(d) + (who === 'both' ? drinksOf(Sync.partnerDays[k] || EMPTY) : 0);
    const sc = who === 'both' ? null : d[metric];
    const food = sc == null ? null : metric === 'mood' ? MOODS[sc].icon : String(sc);
    const drinkText = !n ? '' : who === 'both' ? `${n} drinks` : DRINKS.filter(x => d[x.id]).map(x => `${x.icon}${d[x.id]}`).join(' ');
    grid.append(el('div', { class: `wf${k === t ? ' today' : ''}${k > t ? ' future' : ''}`, onclick: k > t ? null : () => openDay(k) },
      el('div', { class: 'wt', style: `background:${cellBg(k, who)}` }, food || ''),
      el('div', { class: 'wd' }, DAY_SHORT[i]),
      el('div', { class: 'wdr' }, drinkText),
    ));
  });
  box.append(el('div', { class: 'card' }, cardHead('Your week'), grid, legend()), weightCard(keys), statsCard(keys));
}

function renderMonth(box) {
  const y = anchor.getFullYear(), m = anchor.getMonth();
  const n = daysInMonth(y, m);
  const first = new Date(y, m, 1);
  const lead = (first.getDay() + 6) % 7;
  const t = todayKey();
  const grid = el('div', { class: 'cal' }, DAY_SHORT.map(d => el('div', { class: 'cal-h' }, d.slice(0, 2))));
  for (let i = 0; i < lead; i++) grid.append(el('div'));
  const keys = [];
  for (let day = 1; day <= n; day++) {
    const k = ymd(new Date(y, m, day));
    keys.push(k);
    const d = who === 'partner' ? (Sync.partnerDays[k] || EMPTY) : myDay(k);
    const drinks = drinksOf(d) + (who === 'both' ? drinksOf(Sync.partnerDays[k] || EMPTY) : 0);
    grid.append(el('div', {
      class: `cal-d${k === t ? ' today' : ''}${k > t ? ' future' : ''}`, style: k > t ? '' : `background:${cellBg(k, who)}`,
      onclick: k > t ? null : () => openDay(k),
    }, el('span', { class: 'cal-n' }, String(day)), drinks ? el('span', { class: 'cal-x' }, String(drinks)) : null));
  }
  box.append(el('div', { class: 'card' },
    cardHead('Calendar'), grid,
    el('p', { class: 'muted small' }, `Colour = ${METRICS[metric].toLowerCase()} score. Small number = drinks that day.`), legend(),
  ), weightCard(keys), statsCard(keys));
}

function renderYear(box) {
  const y = anchor.getFullYear();
  const t = todayKey();
  const grid = el('div', { class: 'year' });
  const allKeys = [];
  const rows = [];
  for (let m = 0; m < 12; m++) {
    const keys = [];
    const row = el('div', { class: 'yr', onclick: () => { if (ymd(new Date(y, m, 1)) <= t) { anchor = new Date(y, m, 1); period = 'month'; render(); } } },
      el('span', { class: 'yl' }, MONTH_SHORT[m]));
    for (let day = 1; day <= 31; day++) {
      if (day > daysInMonth(y, m)) { row.append(el('span', { class: 'yc none' })); continue; }
      const k = ymd(new Date(y, m, day));
      keys.push(k); allKeys.push(k);
      row.append(el('span', { class: `yc${k > t ? ' future' : ''}`, style: k > t ? '' : `background:${cellBg(k, who)}` }));
    }
    grid.append(row);
    rows.push({ m, keys });
  }
  // Per-month table
  const ps = people();
  const table = el('table', { class: 'mt' },
    el('thead', {}, el('tr', {}, el('th', {}, ''), ps.length > 1 ? el('th', {}, '') : null, el('th', {}, 'Food'), el('th', {}, 'Mood'), el('th', {}, 'Drinks'), el('th', {}, 'Dry'))),
    el('tbody', {}, rows.filter(r => r.keys[0] <= t).flatMap(r => ps.map((p, i) => {
      const s = summarise(r.keys, p.days);
      return el('tr', { class: i === ps.length - 1 ? 'last' : '', onclick: () => { anchor = new Date(y, r.m, 1); period = 'month'; render(); } },
        el('td', {}, i === 0 ? MONTH_SHORT[r.m] : ''),
        ps.length > 1 ? el('td', { class: 'muted' }, p.label) : null,
        el('td', {}, s.avgFood != null ? el('span', { class: `pill c${Math.round(s.avgFood)}` }, fmt1(s.avgFood)) : '–'),
        el('td', {}, s.avgMood != null ? el('span', { class: `pill c${Math.round(s.avgMood)}` }, fmt1(s.avgMood)) : '–'),
        el('td', {}, String(s.drinks)),
        el('td', {}, s.logged ? `${s.free}/${s.logged}` : '–'),
      );
    }))),
  );
  box.append(
    el('div', { class: 'card' }, cardHead('Every day'), grid, el('p', { class: 'muted small' }, `One row per month, one square per day, coloured by ${METRICS[metric].toLowerCase()} score. Tap a month to open it.`), legend()),
    el('div', { class: 'card' }, el('h2', {}, 'Per month'), table),
    weightCard(allKeys.filter(k => k <= t)),
    statsCard(allKeys),
  );
}

function renderOverview() {
  $('#periodSeg').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === period));
  $('#whoSeg').hidden = !Sync.enabled;
  if (!Sync.enabled) who = 'me';
  $('#whoSeg').querySelectorAll('button').forEach(b => {
    b.classList.toggle('on', b.dataset.v === who);
    if (b.dataset.v === 'partner') b.textContent = Sync.partnerName || 'Partner';
  });
  const box = $('#overview');
  box.innerHTML = '';
  if (period === 'week') renderWeek(box);
  else if (period === 'month') renderMonth(box);
  else renderYear(box);
}

function openDay(k) { if (k > todayKey()) return; dayKey = k; setView('day'); }

/* ---------- Settings ---------- */
function renderSettings() {
  const sc = $('#shareCard');
  sc.innerHTML = '';
  sc.append(el('h2', {}, 'Share with your partner'), el('p', { class: 'muted small' }, 'Coming soon: see each other\'s days in the overview.'));

  const n = Object.keys(state.days).length;
  $('#storageInfo').textContent = `${n} day${n === 1 ? '' : 's'} logged, stored on this phone. Download a backup now and then: clearing Chrome's site data or uninstalling the app erases it.`;
  const g = $('#foodGuide'); g.innerHTML = '';
  for (let s = 5; s >= 1; s--) g.append(el('li', {}, el('span', { class: `pill c${s}` }, String(s)), ' ', FOOD_ANCHORS[s]));
  $('#versionInfo').textContent = `Daily Tracker v${APP_VERSION}`;
}

/* ---------- Export / import / delete ---------- */
function download(name, text, type) {
  const a = el('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
function exportJson() {
  download(`daily-tracker-backup-${todayKey()}.json`, JSON.stringify({ app: 'daily-tracker', exportedAt: new Date().toISOString(), ...state }, null, 2), 'application/json');
}
function exportCsv() {
  const rows = [['date', 'food', 'mood', 'weight_kg', 'beer', 'wine', 'liquor']];
  for (const k of Object.keys(state.days).sort()) {
    const d = state.days[k];
    rows.push([k, d.food ?? '', d.mood ?? '', d.weight ?? '', d.beer || 0, d.wine || 0, d.liquor || 0]);
  }
  download(`daily-tracker-${todayKey()}.csv`, rows.map(r => r.join(',')).join('\n'), 'text/csv');
}
function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try { data = JSON.parse(reader.result); } catch (e) { toast('That file is not a valid backup.'); return; }
    if (!data || typeof data !== 'object' || !data.days) { toast('That file is not a Daily Tracker backup.'); return; }
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
    el('p', {}, 'This erases every day you logged from this phone. Download a backup first if you might want it back.'),
    el('div', { class: 'field' }, input),
    el('div', { class: 'sheet-actions' },
      el('button', { class: 'btn', onclick: closeSheet }, 'Cancel'),
      el('button', { class: 'btn danger', onclick: async () => {
        if (input.value.trim().toUpperCase() !== 'DELETE') { input.focus(); return; }
        state = freshState();
        await idbPut('state', state);
        try { localStorage.removeItem(LS_KEY); } catch (e) { /* ignore */ }
        closeSheet(); dayKey = todayKey(); render(); toast('All data deleted.');
      } }, 'Delete everything'),
    ),
  ));
}

/* ---------- Sheet + toast ---------- */
function openSheet(content) { const sh = $('#sheet'); sh.innerHTML = ''; sh.append(content); $('#sheetBackdrop').hidden = false; }
function closeSheet() { $('#sheetBackdrop').hidden = true; $('#sheet').innerHTML = ''; }
let toastTimer = null;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2500);
}

/* ---------- Views ---------- */
function setView(v) {
  view = v;
  for (const name of ['day', 'overview', 'settings']) $(`#view-${name}`).hidden = name !== v;
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  if (v === 'overview') anchor = parseYmd(dayKey);
  render();
  window.scrollTo(0, 0);
}
function render() {
  renderHeader();
  if (view === 'day') renderDay();
  else if (view === 'overview') renderOverview();
  else renderSettings();
}
function step(dir) {
  if (view === 'day') {
    const k = ymd(addDays(parseYmd(dayKey), dir));
    if (k <= todayKey()) dayKey = k;
  } else if (view === 'overview') {
    const a = new Date(anchor);
    if (period === 'week') a.setDate(a.getDate() + 7 * dir);
    else if (period === 'month') { a.setDate(1); a.setMonth(a.getMonth() + dir); }
    else { a.setMonth(0, 1); a.setFullYear(a.getFullYear() + dir); }
    if (ymd(a) > todayKey()) return;
    anchor = a;
  }
  render();
}

function bind() {
  $('#prev').onclick = () => step(-1);
  $('#next').onclick = () => { if (!$('#next').disabled) step(1); };
  $('#backBtn').onclick = () => { if (view === 'day') dayKey = todayKey(); else anchor = new Date(); render(); };
  $('#periodSeg').querySelectorAll('button').forEach(b => b.onclick = () => { period = b.dataset.v; render(); });
  $('#whoSeg').querySelectorAll('button').forEach(b => b.onclick = () => { who = b.dataset.v; render(); });
  $('#exportJson').onclick = exportJson;
  $('#exportCsv').onclick = exportCsv;
  $('#importFile').onchange = (e) => { const f = e.target.files[0]; if (f) importJson(f); e.target.value = ''; };
  $('#deleteAll').onclick = confirmDeleteAll;
  $('#weightBtn').onclick = openWeightSheet;
  document.querySelectorAll('.tabbar button').forEach(b => b.onclick = () => setView(b.dataset.view));
  $('#sheetBackdrop').addEventListener('click', (e) => { if (e.target.id === 'sheetBackdrop') closeSheet(); });
  let lastToday = todayKey();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    const t = todayKey();
    if (t !== lastToday) { if (dayKey === lastToday) dayKey = t; lastToday = t; }
    render();
  });
}

(async function init() {
  state = await loadState();
  save();
  bind();
  render();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
