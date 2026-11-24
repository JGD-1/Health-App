/* Training — the sports app next to Dagtracker. Generates gym / bodyweight / run sessions, logs them,
   and levels up skills. Data lives on the phone (IndexedDB + localStorage mirror). */
'use strict';

const APP_VERSION = '1.0.2';
const SCHEMA = 1;
const TRACKER_LS = 'daily-log-state'; // Dagtracker's data (same web address, so readable here)
const TRACKER_INBOX = 'dagtracker-sport-inbox'; // days the tracker should mark as "sport: yes"

function freshState() {
  return {
    schema: SCHEMA, createdAt: new Date().toISOString(),
    settings: { lang: 'nl', place: 'gym', type: 'gym', minutes: 30, goals: { strength: 2, runs: 1 }, bodyweight: null, runner: 'beginner', tracker: true },
    ladders: {}, runLevel: null, ladderUsed: {},
    workouts: [], // { id, date, start, end, kind: gym|cali|run|other, place, minutes, planned, effort 1-3, items, patterns, run, what, events }
    active: null, // workout in progress
  };
}

/* ---------- Storage ---------- */
const DB_NAME = 'sport-app', LS_KEY = 'sport-app-state';
let db = null, state = null;
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
    r.onsuccess = () => resolve(r.result); r.onerror = () => resolve(undefined);
  });
}
function idbPut(key, value) {
  return new Promise((resolve) => {
    if (!db) return resolve();
    const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(value, key);
    tx.oncomplete = () => resolve(); tx.onerror = () => resolve();
  });
}
async function loadState() {
  db = await openDb();
  let s = await idbGet('state');
  if (!s) { try { const raw = localStorage.getItem(LS_KEY); if (raw) s = JSON.parse(raw); } catch (e) { /* ignore */ } }
  return migrate(s || freshState());
}
function migrate(s) {
  const f = freshState();
  s.settings = Object.assign(f.settings, s.settings || {});
  s.settings.goals = Object.assign({ strength: 2, runs: 1 }, s.settings.goals || {});
  s.ladders = s.ladders || {}; s.workouts = s.workouts || []; s.ladderUsed = s.ladderUsed || {};
  s.schema = SCHEMA;
  return s;
}
let saveTimer = null;
function save(now) {
  clearTimeout(saveTimer);
  const run = async () => { await idbPut('state', JSON.parse(JSON.stringify(state))); try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } };
  if (now) run(); else saveTimer = setTimeout(run, 150);
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}

/* ---------- Dagtracker link ---------- */
function readTrackerWeight() {
  try {
    const t = JSON.parse(localStorage.getItem(TRACKER_LS) || 'null');
    if (!t || !t.days) return null;
    const keys = Object.keys(t.days).filter((k) => t.days[k] && t.days[k].weight).sort();
    return keys.length ? Number(t.days[keys[keys.length - 1]].weight) : null;
  } catch (e) { return null; }
}
function markTrackerSport(day) {
  if (!state.settings.tracker) return;
  try {
    const inbox = JSON.parse(localStorage.getItem(TRACKER_INBOX) || '{}');
    inbox[day] = new Date().toISOString();
    localStorage.setItem(TRACKER_INBOX, JSON.stringify(inbox));
  } catch (e) { /* ignore */ }
}

/* ---------- UI helpers ---------- */
const $ = (sel) => document.querySelector(sel);
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) { if (v) e.addEventListener(k.slice(2), v); }
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) e.append(kid.nodeType ? kid : document.createTextNode(kid));
  return e;
};
function openSheet(content) { const sh = $('#sheet'); sh.innerHTML = ''; sh.append(content); $('#sheetBackdrop').hidden = false; sh.scrollTop = 0; }
function closeSheet() { $('#sheetBackdrop').hidden = true; $('#sheet').innerHTML = ''; }
let toastTimer = null;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2600); }
const todayKey = () => dayKey(new Date());
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function fmtDate(k, opts) { return parseDay(k).toLocaleDateString(LOC(), opts || { weekday: 'short', day: 'numeric', month: 'short' }); }
function exName(ex) { return lang() === 'nl' ? ex.nl : ex.en; }
function exCue(ex) { return lang() === 'nl' ? ex.cnl : ex.cen; }
function ladderName(l) { return tr(l); }
function vibrate(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* ignore */ } }
let audioCtx = null;
function beep(n = 1, hi) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < n; i++) {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = hi ? 1180 : 880; o.connect(g); g.connect(audioCtx.destination);
      const t0 = audioCtx.currentTime + i * 0.22;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
      o.start(t0); o.stop(t0 + 0.18);
    }
  } catch (e) { /* ignore */ }
}
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { /* ignore */ }
}
function mmss(sec) { sec = Math.max(0, Math.round(sec)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; }

// Start/end photos flip every 1.2 s (CSS), like a two-frame animation
function photo(ex, cls = '') {
  if (!ex.a) return el('div', { class: `ph none ${cls}` }, el('span', {}, iconFor(ex)));
  return el('div', { class: `ph ${cls}` },
    el('img', { src: ex.a, alt: exName(ex), loading: 'lazy' }),
    el('img', { src: ex.b, alt: '', class: 'b', loading: 'lazy' }));
}
function iconFor(ex) {
  const p = ex.p;
  return { hpush: '💪', vpush: '🙌', hpull: '🚣', vpull: '🧗', squat: '🦵', lunge: '🦵', hinge: '🍑', core: '🧱', run: '🏃', warm: '🔥' }[p] || '🏋️';
}
function repsText(ex, item) {
  const r = parseReps(ex.x);
  const n = item ? item.target : r.lo === r.hi ? r.lo : `${r.lo}–${r.hi}`;
  const unit = r.unit === 's' ? ' s' : r.unit === 'm' ? ' m' : r.unit === 'min' ? ' min' : '';
  const side = r.side === 'leg' ? tr('/leg') : r.side === 'side' ? tr('/side') : r.side === 'arm' ? tr('/arm') : r.side === 'way' ? ' ' + tr('each way') : '';
  return `${n}${unit}${side}`;
}
function testText(ex) {
  const t = parseTest(ex.up);
  if (!t) return ex.up ? tr('Move up when it feels easy') : '';
  const bw = bodyweight(state);
  let s = `${t.sets} × ${t.val}${t.unit === 's' ? ' s' : ''}`;
  const r = parseReps(ex.x);
  if (r.side === 'leg') s += tr('/leg'); else if (r.side === 'side') s += tr('/side'); else if (r.side === 'arm') s += tr('/arm');
  if (t.kg) s += ' ' + tr('with {kg} kg', { kg: t.kg });
  if (t.bw) s += ' ' + tr('with {x}× bodyweight', { x: String(t.bw).replace('.', lang() === 'nl' ? ',' : '.') }) + (bw ? ` (${Math.round(t.bw * bw)} kg)` : '');
  if (t.bwExtra) s += ' ' + tr('with +{p}% bodyweight', { p: Math.round(t.bwExtra * 100) });
  if (/clean/.test(ex.up)) s += ' ' + tr('clean reps');
  return s;
}

/* ---------- Views ---------- */
let view = 'train';
function setView(v) {
  view = v;
  for (const name of ['train', 'workout', 'log', 'skills', 'settings']) $(`#view-${name}`).hidden = name !== v;
  document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.view === v || (v === 'workout' && b.dataset.view === 'train')));
  render();
  window.scrollTo(0, 0);
}
function render() {
  applyStatic();
  state.trackerWeight = readTrackerWeight();
  $('#title').textContent = view === 'workout' && state.active ? planTitle(state.active.plan) : tr({ train: 'Training', workout: 'Training', log: 'Log', skills: 'Skills', settings: 'Settings' }[view]);
  $('#lvlChip').textContent = tr('Level {n}', { n: characterLevel(state) });
  if (view === 'train') renderTrain();
  else if (view === 'workout') renderWorkout();
  else if (view === 'log') renderLog();
  else if (view === 'skills') renderSkills();
  else renderSettings();
}
function planTitle(p) {
  const k = p.kind === 'run' ? tr('Run') : p.mode === 'gym' ? tr('Gym') : p.mode === 'home' ? tr('Home') : tr('Bodyweight');
  return `${k} · ${p.minutes} min`;
}

/* ---------- Train (home screen) ---------- */
function renderTrain() {
  const root = $('#view-train'); root.innerHTML = '';
  if (state.active) {
    root.append(el('div', { class: 'card resume' },
      el('div', {}, el('b', {}, tr('Workout in progress')), el('div', { class: 'muted small' }, planTitle(state.active.plan))),
      el('button', { class: 'btn primary', onclick: () => setView('workout') }, tr('Continue'))));
  }
  root.append(weekCard());
  // generator
  const s = state.settings;
  const types = s.place === 'home' ? [['cali', 'Bodyweight'], ['run', 'Run']] : [['gym', 'Gym'], ['cali', 'Bodyweight'], ['run', 'Run']];
  if (!types.some(([v]) => v === s.type)) s.type = types[0][0];
  const gen = el('div', { class: 'card' },
    el('h2', {}, tr('New workout')),
    el('div', { class: 'lbl' }, tr('Where are you?')),
    seg([['gym', '🏋️ ' + tr('Gym')], ['home', '🏠 ' + tr('Home, no equipment')]], s.place, (v) => { s.place = v; save(); render(); }),
    el('div', { class: 'lbl' }, tr('What do you want to do?')),
    seg(types.map(([v, l]) => [v, tr(l)]), s.type, (v) => { s.type = v; save(); render(); }),
    el('div', { class: 'lbl' }, tr('How much time do you have?')),
    el('div', { class: 'chips' }, TIMES.map((m) => el('button', { class: 'chip' + (s.minutes === m ? ' on' : ''), onclick: () => { s.minutes = m; save(); render(); } }, `${m} min`))),
    el('button', { class: 'btn primary wide big', onclick: makeWorkout }, tr('Make my workout')),
    s.place === 'home' && s.type !== 'run' ? el('p', { class: 'muted small' }, tr('At home without equipment, pulling is done as a row under a sturdy table.')) : null,
  );
  root.append(gen);
  root.append(el('button', { class: 'btn wide ghost', onclick: openOtherSheet }, '＋ ' + tr('Log another sport')));
  const last = state.workouts[state.workouts.length - 1];
  if (last) root.append(el('p', { class: 'muted small center' }, tr('Last workout: {what}, {when}', { what: kindLabel(last), when: relDay(last.date) })));
}
function relDay(k) {
  const d = daysBetween(k, new Date());
  if (d === 0) return tr('today'); if (d === 1) return tr('yesterday');
  return tr('{n} days ago', { n: d });
}
function kindLabel(w) {
  if (w.kind === 'run') return tr({ runwalk: 'Run-walk', easy: 'Easy run', intervals: 'Intervals', long: 'Long run' }[w.run && w.run.type] || 'Run');
  if (w.kind === 'other') return w.what || tr('Other sport');
  return w.place === 'home' ? tr('Home workout') : w.kind === 'gym' ? tr('Gym') : tr('Bodyweight');
}
function seg(options, value, onchange, cls = '') {
  return el('div', { class: 'seg ' + cls }, options.map(([v, l]) => el('button', { class: value === v ? 'on' : '', onclick: () => onchange(v) }, l)));
}
function ring(value, goal, label, sub) {
  const pct = Math.min(1, goal ? value / goal : 0);
  const C = 2 * Math.PI * 26;
  return el('div', { class: 'ring' + (value >= goal ? ' done' : '') },
    el('div', { class: 'ring-svg', html: `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" class="rb"/><circle cx="32" cy="32" r="26" class="rf" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}"/></svg>` },
      el('div', { class: 'ring-n' }, value >= goal && goal ? '✓' : `${value}/${goal}`)),
    el('div', { class: 'ring-l' }, label), sub ? el('div', { class: 'ring-s' }, sub) : null);
}
function weekCard() {
  const st = streak(state, new Date());
  const w = st.thisWeek, g = state.settings.goals;
  const daysLeft = 6 - ((new Date().getDay() + 6) % 7);
  let tokenLine;
  if (w.met) tokenLine = tr('Week goal done. Nice!');
  else if (w.short === 1) tokenLine = tr('One session to go. If it doesn’t happen, your rest token saves the streak.');
  else tokenLine = tr('{n} sessions to go, {d} days left.', { n: w.short, d: daysLeft + 1 });
  return el('div', { class: 'card' },
    el('div', { class: 'card-head' }, el('h2', {}, tr('This week')), el('span', { class: 'streak' + (st.weeks ? ' on' : '') }, `🔥 ${tr('{n} wk', { n: st.weeks })}`)),
    el('div', { class: 'rings' },
      ring(w.strength, g.strength, tr('Strength')),
      ring(w.runs, g.runs, tr('Running')),
      ring(w.minutes, 150, tr('Minutes'), tr('guideline 150'))),
    el('p', { class: 'muted small tl' }, tokenLine));
}

function makeWorkout() {
  const s = state.settings;
  let plan;
  if (s.type === 'run') plan = generateRun(state, { minutes: s.minutes });
  else plan = generateStrength(state, { mode: s.type === 'gym' ? 'gym' : s.place === 'home' ? 'home' : 'cali', minutes: s.minutes });
  state.active = { id: uid(), plan, created: new Date().toISOString(), started: null, rest: null, run: null };
  save(); setView('workout');
}

/* ---------- Workout (preview + doing it) ---------- */
let tick = null;
function renderWorkout() {
  const root = $('#view-workout'); root.innerHTML = '';
  const a = state.active;
  if (!a) { setView('train'); return; }
  clearInterval(tick); tick = null;
  if (a.plan.kind === 'run') return renderRun(root, a);
  const p = a.plan;
  root.append(el('div', { class: 'card plan-head' },
    el('div', {}, el('b', {}, planTitle(p)), el('div', { class: 'muted small' }, tr('About {n} min', { n: p.estimate }) + (a.started ? ' · ' + tr('started {t}', { t: new Date(a.started).toLocaleTimeString(LOC(), { hour: '2-digit', minute: '2-digit' }) }) : ''))),
    a.started ? el('div', { class: 'clock', id: 'clock' }, '0:00') : el('button', { class: 'btn primary', onclick: () => { a.started = new Date().toISOString(); save(); keepAwake(true); render(); } }, tr('Start'))));
  // warm-up
  const wu = p.warmup;
  root.append(el('div', { class: 'card' },
    el('div', { class: 'card-head' }, el('h2', {}, tr('Warm-up')), el('span', { class: 'muted' }, `${wu.minutes} min`)),
    el('div', { class: 'wu' }, wu.steps.map((st) => { const ex = EX_BY_ID[st.ex]; return el('button', { class: 'wu-i', onclick: () => openExercise(ex) }, photo(ex, 'sm'), el('span', {}, exName(ex)), el('small', {}, st.dose.replace('min', 'min'))); })),
    wu.ramp ? el('p', { class: 'muted small' }, tr('Then 1–2 light warm-up sets of your first exercise.')) : null));
  p.blocks.forEach((b, bi) => root.append(blockCard(a, b, bi)));
  if (p.cardio) root.append(el('div', { class: 'card' }, el('div', { class: 'card-head' }, el('h2', {}, tr('Cardio')), el('span', { class: 'muted' }, `${p.cardio.minutes} min`)),
    el('p', { class: 'small' }, p.cardio.what === 'walk' ? tr('Brisk walk or easy jog. You should still be able to talk.') : tr('Bike, rower or treadmill at an easy, steady pace.'))));
  root.append(el('button', { class: 'btn primary wide big', onclick: openFinishSheet }, tr('Finish workout')));
  root.append(el('button', { class: 'btn wide ghost', onclick: openDiscardSheet }, tr('Stop without saving')));
  if (a.rest) root.append(restBar(a));
  startClock(a);
}
function startClock(a) {
  const upd = () => {
    const c = $('#clock'); if (c && a.started) c.textContent = mmss((Date.now() - new Date(a.started)) / 1000);
    const rb = $('#restLeft');
    if (rb && a.rest) {
      const left = (a.rest.until - Date.now()) / 1000;
      if (left <= 0) { a.rest = null; save(); vibrate([200, 100, 200]); beep(2, true); const bar = $('#restBar'); if (bar) bar.remove(); toast(tr('Rest is over. Next set!')); }
      else { rb.textContent = mmss(left); const f = $('#restFill'); if (f) f.style.width = `${100 * left / a.rest.total}%`; }
    }
  };
  upd(); tick = setInterval(upd, 500);
}
function restBar(a) {
  return el('div', { class: 'restbar', id: 'restBar' },
    el('div', { class: 'rest-fill', id: 'restFill' }),
    el('span', {}, tr('Rest')), el('b', { id: 'restLeft' }, mmss((a.rest.until - Date.now()) / 1000)),
    el('button', { onclick: () => { a.rest.until += 15000; a.rest.total += 15; save(); } }, '+15 s'),
    el('button', { onclick: () => { a.rest = null; save(); $('#restBar').remove(); } }, tr('Skip')));
}
const BLOCK_TITLE = { main: 'Main lift', superset: 'Superset', accessory: 'Extra superset', core: 'Core finisher' };
function blockCard(a, b, bi) {
  let n = 0; for (let i = 0; i < bi; i++) if (['superset', 'accessory'].includes(a.plan.blocks[i].kind)) n++;
  const letter = String.fromCharCode(65 + bi);
  const title = b.kind === 'superset' || b.kind === 'accessory' ? `${tr(BLOCK_TITLE[b.kind])} ${letter}` : tr(BLOCK_TITLE[b.kind]);
  const sub = b.items.length > 1 ? tr('Alternate the two, {s} s rest after each round', { s: b.items[0].rest }) : tr('{s} s rest between sets', { s: b.items[0].rest });
  return el('div', { class: 'card block' },
    el('div', { class: 'card-head' }, el('h2', {}, title), el('span', { class: 'muted' }, `${b.items[0].sets.length} ×`)),
    el('p', { class: 'muted small tl' }, sub),
    b.items.map((it, ii) => itemView(a, b, it, `${letter}${b.items.length > 1 ? ii + 1 : ''}`, bi, ii)));
}
function itemView(a, b, it, label, bi, ii) {
  const ex = EX_BY_ID[it.ex];
  const r = parseReps(ex.x);
  const timed = r.unit === 's';
  const note = { up: tr('Heavier than last time 💪'), deload: tr('A bit lighter to reset, then build up again'), first: tr('First time: pick a weight you could lift 2–3 more times'), top: tr('Top of the range: try the level-up test') }[it.note];
  const rows = it.sets.map((s, si) => {
    const done = s.done;
    const repsBox = stepper(s.reps, timed ? 5 : 1, (v) => { s.reps = v; save(); }, timed ? 's' : tr('reps'));
    const kgBox = ex.w ? stepper(s.kg, kgStep(ex), (v) => { s.kg = v; save(); }, 'kg', true) : null;
    return el('div', { class: 'setrow' + (done ? ' done' : '') },
      el('span', { class: 'sn' }, si + 1), kgBox, repsBox,
      timed && !done ? el('button', { class: 'hold', onclick: () => holdTimer(s) }, '⏱') : null,
      el('button', { class: 'tick', 'aria-label': tr('Set done'), onclick: () => toggleSet(a, b, it, s, ii) }, done ? '✓' : ''));
  });
  const allDone = it.sets.every((s) => s.done);
  return el('div', { class: 'item' },
    el('button', { class: 'item-top', onclick: () => openExercise(ex, it, bi, ii) },
      photo(ex),
      el('div', { class: 'item-txt' },
        el('span', { class: 'tag' }, label),
        el('b', {}, exName(ex)),
        el('span', { class: 'rx' }, `${it.sets.length} × ${repsText(ex, it)}${it.kg ? ` · ${fmtKg(it.kg)} kg` : ''}`),
        ex.l ? el('span', { class: 'muted small' }, `${ladderName(ex.l)} · ${tr('level {n}', { n: ex.lv })}`) : null)),
    note ? el('p', { class: 'note' }, note) : null,
    el('div', { class: 'sets' }, rows),
    allDone ? rirRow(it) : null);
}
function fmtKg(v) { return String(Math.round(v * 10) / 10).replace('.', lang() === 'nl' ? ',' : '.'); }
function stepper(value, step, onchange, unit, isKg) {
  const input = el('input', { type: 'number', inputmode: 'decimal', value: value ?? '', placeholder: isKg ? '–' : '' });
  input.onchange = () => { const v = input.value === '' ? null : Number(String(input.value).replace(',', '.')); onchange(v); };
  const bump = (d) => { const v = Math.max(0, Math.round(((Number(input.value) || 0) + d) * 10) / 10); input.value = v; onchange(v); };
  return el('div', { class: 'stepper' + (isKg ? ' kg' : '') },
    el('button', { onclick: () => bump(-step) }, '−'), el('label', {}, input, el('small', {}, unit)), el('button', { onclick: () => bump(step) }, '+'));
}
function toggleSet(a, b, it, s, ii) {
  s.done = !s.done;
  if (s.done) {
    if (!a.started) { a.started = new Date().toISOString(); keepAwake(true); }
    vibrate(30);
    const lastInRound = ii === b.items.length - 1;
    const roundLeft = b.items.some((x) => x.sets.some((y) => !y.done));
    if (lastInRound && roundLeft) a.rest = { until: Date.now() + it.rest * 1000, total: it.rest };
    else if (!lastInRound) toast(tr('Now {name}', { name: exName(EX_BY_ID[b.items[ii + 1].ex]) }));
  }
  save(); renderKeepScroll();
}
function renderKeepScroll() { const y = window.scrollY; render(); window.scrollTo(0, y); }
function rirRow(it) {
  return el('div', { class: 'rir' },
    el('span', {}, tr('How many more could you have done?')),
    el('div', { class: 'seg mini' }, [0, 1, 2, 3].map((n) => el('button', { class: it.rir === n ? 'on' : '', onclick: () => { it.rir = n; save(); renderKeepScroll(); } }, n === 3 ? '3+' : String(n)))));
}
function holdTimer(s) {
  let left = Number(s.reps) || 30;
  const n = el('div', { class: 'bigtime' }, mmss(left));
  let t = null;
  const stop = () => { clearInterval(t); closeSheet(); };
  openSheet(el('div', {}, el('h3', {}, tr('Hold')), n, el('div', { class: 'sheet-actions' },
    el('button', { class: 'btn', onclick: stop }, tr('Cancel')))));
  beep(1);
  t = setInterval(() => {
    left -= 1; n.textContent = mmss(left);
    if (left <= 0) { clearInterval(t); vibrate([200, 100, 200]); beep(2, true); s.done = true; save(); closeSheet(); renderKeepScroll(); }
  }, 1000);
}

/* ---------- exercise detail + swap ---------- */
function openExercise(ex, it, bi, ii) {
  const kids = [photo(ex, 'big'), el('h3', {}, exName(ex)),
    el('div', { class: 'facts' },
      el('div', {}, el('b', {}, tr('Sets × reps')), `${ex.s} × ${repsText(ex)}`),
      ex.rest ? el('div', {}, el('b', {}, tr('Rest')), `${ex.rest} s`) : null,
      el('div', {}, el('b', {}, tr('Equipment')), tr(ex.e)),
      ex.l ? el('div', {}, el('b', {}, tr('Ladder')), `${ladderName(ex.l)} · ${ex.lv}`) : null,
      ex.up ? el('div', { class: 'wide' }, el('b', {}, tr('Level-up test')), testText(ex)) : null),
    el('p', {}, exCue(ex))];
  if (it && state.active) {
    const alts = alternatives(ex, state.active.plan.mode).filter((x) => x.id !== ex.id);
    if (alts.length) {
      kids.push(el('div', { class: 'lbl' }, tr('Swap for')));
      kids.push(el('div', { class: 'alts' }, alts.map((x) => el('button', { class: 'alt', onclick: () => {
        const fresh = prescribe(state, x, it.sets.length, it.role);
        state.active.plan.blocks[bi].items[ii] = fresh; save(); closeSheet(); renderKeepScroll();
      } }, photo(x, 'sm'), el('span', {}, exName(x)), x.l ? el('small', {}, tr('level {n}', { n: x.lv })) : null))));
    }
  }
  kids.push(el('button', { class: 'btn wide', onclick: closeSheet }, tr('Close')));
  openSheet(el('div', {}, kids));
}
function alternatives(ex, mode) {
  const avail = (x) => (mode === 'home' ? x.home : mode === 'cali' ? x.t === 'Calisthenics' : x.t !== 'Run' && x.t !== 'Warm-up');
  const same = EXERCISES.filter((x) => x.p === ex.p && avail(x) && x.t !== 'Warm-up');
  // keep ladder exercises at or below the person's level
  return same.filter((x) => !x.l || x.lv <= ladderLevel(state, x.l) + (x.l === ex.l ? 0 : 0)).slice(0, 12);
}

/* ---------- finishing ---------- */
function elapsedMin(a) { return a.started ? Math.max(1, Math.round((Date.now() - new Date(a.started)) / 60000)) : a.plan.estimate || a.plan.minutes; }
function openFinishSheet() {
  const a = state.active;
  const done = a.plan.kind === 'run' ? true : a.plan.blocks.some((b) => b.items.some((it) => it.sets.some((s) => s.done)));
  let effort = 2;
  const min = el('input', { type: 'number', inputmode: 'numeric', value: Math.min(180, elapsedMin(a)) });
  const km = a.plan.kind === 'run' ? el('input', { type: 'number', inputmode: 'decimal', placeholder: tr('optional') }) : null;
  const effSeg = el('div', { class: 'seg' });
  const drawEff = () => { effSeg.innerHTML = ''; [[1, 'Easy'], [2, 'Moderate'], [3, 'Hard']].forEach(([v, l]) => effSeg.append(el('button', { class: effort === v ? 'on' : '', onclick: () => { effort = v; drawEff(); } }, tr(l)))); };
  drawEff();
  openSheet(el('div', {},
    el('h3', {}, tr('Finish workout')),
    !done ? el('p', { class: 'warn' }, tr('You haven’t ticked any sets yet. Tick the sets you did, so the next workout can build on them.')) : null,
    el('div', { class: 'field' }, el('div', { class: 'lbl' }, tr('How hard was it?')), effSeg),
    el('div', { class: 'field' }, el('label', {}, tr('Minutes')), min),
    km ? el('div', { class: 'field' }, el('label', {}, tr('Distance (km)')), km) : null,
    el('div', { class: 'sheet-actions' },
      el('button', { class: 'btn', onclick: closeSheet }, tr('Back')),
      el('button', { class: 'btn primary', onclick: () => finish(effort, Number(min.value) || elapsedMin(a), km ? Number(String(km.value).replace(',', '.')) || null : null) }, tr('Save')))));
}
function finish(effort, minutes, km) {
  const a = state.active, p = a.plan;
  const date = dayKey(a.started || new Date());
  const w = { id: a.id, date, start: a.started, end: new Date().toISOString(), kind: p.kind, place: p.place || null, mode: p.mode || null, planned: p.minutes, minutes, effort };
  if (p.kind === 'run') {
    w.run = { type: p.run.type, segments: p.run.segments, km };
    w.completed = !!(a.run && a.run.finished);
    w.patterns = [];
  } else {
    w.items = p.blocks.flatMap((b) => b.items).map((it) => ({ ex: it.ex, sets: it.sets.map((s) => ({ reps: s.reps, kg: s.kg, done: !!s.done })), rir: it.rir ?? null }));
    w.patterns = [...new Set(p.blocks.filter((b) => b.items.some((it) => it.sets.some((s) => s.done))).flatMap((b) => b.patterns))];
  }
  state.workouts.push(w);
  state.workouts.sort((x, y) => (x.date + (x.end || '')).localeCompare(y.date + (y.end || '')));
  w.events = applyProgress(state, w);
  state.active = null;
  save(true); keepAwake(false);
  markTrackerSport(date);
  closeSheet(); setView('train');
  showSummary(w);
}
function showSummary(w) {
  const firsts = (w.events || []).filter((e) => e.k === 'first');
  const list = (w.events || []).filter((e) => e.k !== 'first' || firsts.length <= 2);
  if (firsts.length > 2) list.push({ k: 'firsts', n: firsts.length });
  const evs = list.map((e) => {
    if (e.k === 'firsts') return el('li', { class: 'ev' }, '✨ ', tr('{n} new exercises tried', { n: e.n }));
    if (e.k === 'levelup') return el('li', { class: 'ev big' }, '⬆️ ', tr('Level up! {ladder}: next time {ex}', { ladder: ladderName(e.ladder), ex: exName(EX_BY_ID[e.to]) }));
    if (e.k === 'mastered') return el('li', { class: 'ev big' }, '🏆 ', tr('{ladder} mastered!', { ladder: ladderName(e.ladder) }));
    if (e.k === 'pr') return el('li', { class: 'ev' }, '⭐ ', tr('New record: {ex}', { ex: exName(EX_BY_ID[e.ex]) }) + (e.kg ? ` (${fmtKg(e.kg)} kg)` : e.reps ? ` (${e.reps})` : ''));
    if (e.k === 'first') return el('li', { class: 'ev' }, '✨ ', tr('First time: {ex}', { ex: exName(EX_BY_ID[e.ex]) }));
    if (e.k === 'runlevel') return el('li', { class: 'ev big' }, '🏃 ', tr('Running level {n} unlocked!', { n: e.to }));
    return null;
  }).filter(Boolean);
  const wk = weekResult(state, weekKey(w.date));
  openSheet(el('div', { class: 'summary' },
    el('div', { class: 'confetti' }, '🎉'),
    el('h3', {}, tr('Well done!')),
    el('p', { class: 'muted' }, `${kindLabel(w)} · ${w.minutes} min`),
    evs.length ? el('ul', { class: 'evs' }, evs) : null,
    el('p', {}, wk.met ? tr('Week goal reached!') : tr('This week: {s} of {gs} strength, {r} of {gr} runs.', { s: wk.strength, gs: state.settings.goals.strength, r: wk.runs, gr: state.settings.goals.runs })),
    state.settings.tracker ? el('p', { class: 'muted small' }, tr('Dagtracker will show this day as “sport: yes”.')) : null,
    el('button', { class: 'btn primary wide', onclick: closeSheet }, tr('Done'))));
}
function openDiscardSheet() {
  openSheet(el('div', {}, el('h3', {}, tr('Stop without saving?')), el('p', { class: 'muted' }, tr('This workout will not be logged.')),
    el('div', { class: 'sheet-actions' }, el('button', { class: 'btn', onclick: closeSheet }, tr('Back')),
      el('button', { class: 'btn danger', onclick: () => { state.active = null; save(); keepAwake(false); closeSheet(); setView('train'); } }, tr('Stop')))));
}

/* ---------- run session with a segment timer ---------- */
const SEG_LABEL = { walk: 'Walk', run: 'Run', easy: 'Easy', hard: 'Hard' };
function runPos(a) {
  const segs = a.plan.run.segments;
  const r = a.run;
  if (!r) return { i: 0, left: segs[0].s, elapsed: 0 };
  const el2 = (r.pausedAt ? r.pausedAt : Date.now()) - r.startedAt - r.pausedMs;
  let t = el2 / 1000;
  for (let i = 0; i < segs.length; i++) { if (t < segs[i].s) return { i, left: segs[i].s - t, elapsed: el2 / 1000 }; t -= segs[i].s; }
  return { i: segs.length, left: 0, elapsed: el2 / 1000 };
}
function renderRun(root, a) {
  const p = a.plan, segs = p.run.segments;
  const typeName = tr({ runwalk: 'Run-walk', easy: 'Easy run', intervals: 'Intervals', long: 'Long run' }[p.run.type]);
  const ex = EX_BY_ID[{ runwalk: 'EX104', easy: 'EX105', intervals: 'EX106', long: 'EX108' }[p.run.type]];
  const notes = (p.notes || []).map((n) => {
    if (n.k === 'capped') return tr('Shortened to {to} min: never more than 10% longer than your longest run of the last 30 days ({l} min).', { to: n.to, l: n.longest });
    if (n.k === 'beginnercap') return tr('Beginner programme: sessions last about 30 min.');
    if (n.k === 'restday') return tr('You ran yesterday. Beginners do best with a rest day between runs.');
    if (n.k === 'week') return tr('Run-walk programme, week {w} of 9.', { w: n.week });
    if (n.k === 'legs') return tr('You trained legs today, so this is an easy run instead of intervals.');
    return null;
  }).filter(Boolean);
  const total = segs.reduce((x, s) => x + s.s, 0);
  root.append(el('div', { class: 'card' },
    el('div', { class: 'run-head' }, photo(ex, 'sm'), el('div', {}, el('b', {}, typeName), el('div', { class: 'muted small' }, `${Math.round(total / 60)} min · ${exCue(ex)}`))),
    notes.map((n) => el('p', { class: 'note' }, n))));
  const pos = runPos(a);
  const cur = segs[Math.min(pos.i, segs.length - 1)];
  const started = !!a.run, paused = a.run && a.run.pausedAt, finished = pos.i >= segs.length;
  const big = el('div', { class: 'card runner ' + (finished ? 'fin' : cur.k) },
    el('div', { class: 'r-what', id: 'rWhat' }, finished ? tr('Done!') : tr(SEG_LABEL[cur.k])),
    el('div', { class: 'r-time', id: 'rTime' }, mmss(finished ? 0 : pos.left)),
    el('div', { class: 'r-next', id: 'rNext' }, nextText(segs, pos.i)),
    el('div', { class: 'r-bar' }, el('div', { id: 'rFill', style: `width:${100 * Math.min(1, pos.elapsed / total)}%` })),
    el('div', { class: 'r-tot muted small', id: 'rTot' }, `${mmss(pos.elapsed)} / ${mmss(total)}`),
    el('div', { class: 'sheet-actions' },
      !started ? el('button', { class: 'btn primary', onclick: () => { a.run = { startedAt: Date.now(), pausedMs: 0, pausedAt: null, lastI: 0 }; a.started = new Date().toISOString(); save(); keepAwake(true); beep(1); vibrate(200); render(); } }, tr('Start'))
        : finished ? null
          : el('button', { class: 'btn', onclick: () => { if (a.run.pausedAt) { a.run.pausedMs += Date.now() - a.run.pausedAt; a.run.pausedAt = null; } else a.run.pausedAt = Date.now(); save(); render(); } }, paused ? tr('Resume') : tr('Pause')),
      started && !finished ? el('button', { class: 'btn', onclick: () => { const ps = runPos(a); a.run.startedAt -= ps.left * 1000; save(); render(); } }, tr('Skip')) : null));
  root.append(big);
  root.append(el('div', { class: 'card' }, el('h2', {}, tr('Plan')),
    el('div', { class: 'segs' }, segs.map((s, i) => el('div', { class: `sg ${s.k}${i === pos.i ? ' cur' : ''}${i < pos.i ? ' past' : ''}`, style: `flex:${s.s}` }))),
    el('ol', { class: 'seglist' }, compactSegs(segs).map((t) => el('li', {}, t)))));
  root.append(el('button', { class: 'btn primary wide big', onclick: openFinishSheet }, tr('Finish run')));
  root.append(el('button', { class: 'btn wide ghost', onclick: openDiscardSheet }, tr('Stop without saving')));
  if (started && !paused && !finished) {
    tick = setInterval(() => {
      const ps = runPos(a);
      if (ps.i !== a.run.lastI) {
        a.run.lastI = ps.i;
        if (ps.i >= segs.length) { a.run.finished = true; vibrate([300, 150, 300, 150, 300]); beep(3, true); save(); render(); return; }
        const k = segs[ps.i].k; vibrate(k === 'run' || k === 'hard' ? [400, 100, 400] : [200]); beep(k === 'run' || k === 'hard' ? 2 : 1, k === 'run' || k === 'hard');
        save(); render(); return;
      }
      $('#rTime').textContent = mmss(ps.left);
      $('#rTot').textContent = `${mmss(ps.elapsed)} / ${mmss(total)}`;
      $('#rFill').style.width = `${100 * Math.min(1, ps.elapsed / total)}%`;
    }, 500);
  }
}
function nextText(segs, i) {
  if (i >= segs.length - 1) return i >= segs.length ? '' : tr('Last part');
  const n = segs[i + 1];
  return tr('Then: {what} {t}', { what: tr(SEG_LABEL[n.k]).toLowerCase(), t: mmss(n.s) });
}
function compactSegs(segs) {
  const out = [];
  let i = 0;
  while (i < segs.length) {
    const a = segs[i], b = segs[i + 1];
    if (b && (a.k === 'run' || a.k === 'hard')) {
      let n = 0, j = i;
      while (segs[j] && segs[j + 1] && segs[j].k === a.k && segs[j].s === a.s && segs[j + 1].k === b.k && segs[j + 1].s === b.s) { n++; j += 2; }
      if (n > 1) { out.push(`${n} × (${mmss(a.s)} ${tr(SEG_LABEL[a.k]).toLowerCase()} + ${mmss(b.s)} ${tr(SEG_LABEL[b.k]).toLowerCase()})`); i = j; continue; }
    }
    out.push(`${mmss(a.s)} ${tr(SEG_LABEL[a.k]).toLowerCase()}`); i++;
  }
  return out;
}

/* ---------- other sport ---------- */
function openOtherSheet() {
  let effort = 2;
  const what = el('input', { type: 'text', placeholder: tr('e.g. football, cycling, swimming') });
  const min = el('input', { type: 'number', inputmode: 'numeric', value: 45 });
  const date = el('input', { type: 'date', value: todayKey(), max: todayKey() });
  const effSeg = el('div', { class: 'seg' });
  const drawEff = () => { effSeg.innerHTML = ''; [[1, 'Easy'], [2, 'Moderate'], [3, 'Hard']].forEach(([v, l]) => effSeg.append(el('button', { class: effort === v ? 'on' : '', onclick: () => { effort = v; drawEff(); } }, tr(l)))); };
  drawEff();
  openSheet(el('div', {}, el('h3', {}, tr('Log another sport')),
    el('div', { class: 'field' }, el('label', {}, tr('What did you do?')), what),
    el('div', { class: 'field' }, el('label', {}, tr('Minutes')), min),
    el('div', { class: 'field' }, el('div', { class: 'lbl' }, tr('How hard was it?')), effSeg),
    el('div', { class: 'field' }, el('label', {}, tr('Date')), date),
    el('div', { class: 'sheet-actions' }, el('button', { class: 'btn', onclick: closeSheet }, tr('Cancel')),
      el('button', { class: 'btn primary', onclick: () => {
        const d = date.value || todayKey();
        const w = { id: uid(), date: d, end: new Date().toISOString(), kind: 'other', what: what.value.trim(), minutes: Number(min.value) || 0, effort, patterns: [] };
        state.workouts.push(w); state.workouts.sort((x, y) => (x.date + (x.end || '')).localeCompare(y.date + (y.end || '')));
        save(true); markTrackerSport(d); closeSheet(); render(); toast(tr('Saved'));
      } }, tr('Save')))));
}

/* ---------- Log ---------- */
function renderLog() {
  const root = $('#view-log'); root.innerHTML = '';
  if (!state.workouts.length) { root.append(el('div', { class: 'card empty' }, el('div', { class: 'big-emoji' }, '📒'), el('p', {}, tr('No workouts yet. Your first one will show up here.')))); return; }
  const weeks = {};
  for (const w of state.workouts) (weeks[weekKey(w.date)] = weeks[weekKey(w.date)] || []).push(w);
  const cur = weekKey(new Date());
  for (const wk of Object.keys(weeks).sort().reverse()) {
    const r = weekResult(state, wk);
    const status = r.met ? '✓ ' + tr('goal') : wk === cur ? tr('in progress') : r.token ? '🛟 ' + tr('rest token') : '';
    root.append(el('div', { class: 'card' },
      el('div', { class: 'card-head' }, el('h2', {}, tr('Week of {d}', { d: fmtDate(wk, { day: 'numeric', month: 'short' }) })), el('span', { class: 'muted' }, `${r.minutes} min ${status ? '· ' + status : ''}`)),
      weeks[wk].slice().reverse().map((w) => el('button', { class: 'logrow', onclick: () => openLogItem(w) },
        el('span', { class: 'li-ic' }, w.kind === 'run' ? '🏃' : w.kind === 'other' ? '⚽' : w.place === 'home' ? '🏠' : '🏋️'),
        el('span', { class: 'li-t' }, el('b', {}, kindLabel(w)), el('small', {}, fmtDate(w.date))),
        el('span', { class: 'li-m' }, `${w.minutes} min`, el('small', {}, tr(['', 'Easy', 'Moderate', 'Hard'][w.effort] || '')))))));
  }
}
function openLogItem(w) {
  const kids = [el('h3', {}, kindLabel(w)), el('p', { class: 'muted' }, `${fmtDate(w.date, { weekday: 'long', day: 'numeric', month: 'long' })} · ${w.minutes} min · ${tr(['', 'Easy', 'Moderate', 'Hard'][w.effort] || '')}`)];
  if (w.items) {
    for (const it of w.items) {
      const ex = EX_BY_ID[it.ex]; const done = it.sets.filter((s) => s.done);
      if (!done.length) continue;
      kids.push(el('div', { class: 'logex' }, el('b', {}, exName(ex)), el('span', {}, done.map((s) => (s.kg ? `${fmtKg(s.kg)}×` : '') + s.reps + (isTimed(ex) ? 's' : '')).join(' · '))));
    }
  }
  if (w.run) kids.push(el('p', {}, compactSegs(w.run.segments).join(', ') + (w.run.km ? ` · ${fmtKg(w.run.km)} km` : '')));
  let armed = false;
  const del = el('button', { class: 'btn danger', onclick: () => {
    if (!armed) { armed = true; del.textContent = tr('Tap again to delete'); return; }
    state.workouts = state.workouts.filter((x) => x.id !== w.id); save(true); closeSheet(); render(); toast(tr('Deleted'));
  } }, tr('Delete'));
  kids.push(el('div', { class: 'sheet-actions' }, el('button', { class: 'btn', onclick: closeSheet }, tr('Close')), del));
  openSheet(el('div', {}, kids));
}

/* ---------- Skills ---------- */
function renderSkills() {
  const root = $('#view-skills'); root.innerHTML = '';
  root.append(el('div', { class: 'card hero' },
    el('div', { class: 'hero-n' }, characterLevel(state)),
    el('div', {}, el('b', {}, tr('Character level')), el('p', { class: 'muted small' }, tr('The sum of all your skill levels. A level goes up when you pass its test in a workout.')))));
  const sec = (title, ladders, mode) => {
    root.append(el('h2', { class: 'sec' }, title));
    for (const l of ladders) root.append(ladderCard(l, mode));
  };
  sec(tr('Bodyweight'), SKILL_LADDERS.bodyweight, state.settings.place === 'home' ? 'home' : 'cali');
  sec(tr('Gym'), SKILL_LADDERS.gym, 'gym');
  // running
  const rl = runLevel(state);
  const runSteps = ['EX104', 'EX105', 'EX106', 'EX108'].map((id) => EX_BY_ID[id]);
  const runNext = [tr('Run 30 minutes without walking'), tr('Do 5 runs at an easy pace'), tr('Do one run of 45 minutes or more'), ''][rl - 1];
  root.append(el('h2', { class: 'sec' }, tr('Running')));
  root.append(el('div', { class: 'card ladder' },
    el('div', { class: 'card-head' }, el('h2', {}, tr('Running')), el('span', { class: 'lv' }, tr('level {n} of {m}', { n: rl, m: 4 }))),
    dots(rl, 4),
    el('div', { class: 'cur' }, photo(runSteps[rl - 1], 'sm'), el('div', {}, el('b', {}, exName(runSteps[rl - 1])), runNext ? el('small', {}, tr('Next: {t}', { t: runNext })) : el('small', {}, tr('Top level reached'))))));
  // weight tiers
  root.append(el('h2', { class: 'sec' }, tr('Weight tiers')));
  const bw = bodyweight(state);
  const tc = el('div', { class: 'card' });
  if (!bw) tc.append(el('p', { class: 'muted small' }, tr('Fill in your weight (in Dagtracker or Settings) to see your tiers.')));
  else tc.append(el('p', { class: 'muted small tl' }, tr('Based on your bodyweight of {kg} kg and your best set of 5+ reps.', { kg: fmtKg(bw) })));
  for (const t of TIERS) {
    const r = tierFor(state, t);
    tc.append(el('div', { class: 'tier' }, el('b', {}, tr(t.name)), dots(r.level, t.at.length, true),
      el('small', {}, r.next ? tr('next: {kg} kg', { kg: fmtKg(r.next) }) : bw ? tr('all tiers!') : '')));
  }
  root.append(tc);
}
function dots(n, max, small) {
  return el('div', { class: 'dots' + (small ? ' sm' : '') }, Array.from({ length: max }, (_, i) => el('span', { class: i < n ? 'on' : '' })));
}
function ladderCard(l, mode) {
  const lv = ladderLevel(state, l), max = maxLevel(l);
  const xs = ladderExercises(l);
  const cur = xs.filter((x) => x.lv <= lv).pop() || xs[0];
  const next = xs.find((x) => x.lv > cur.lv);
  const athome = mode === 'home' && !cur.home;
  return el('button', { class: 'card ladder', onclick: () => openLadder(l) },
    el('div', { class: 'card-head' }, el('h2', {}, ladderName(l)), el('span', { class: 'lv' }, tr('level {n} of {m}', { n: lv, m: max }))),
    dots(lv, max),
    el('div', { class: 'cur' }, photo(cur, 'sm'), el('div', {},
      el('b', {}, exName(cur)),
      cur.up && next ? el('small', {}, tr('Test: {t}', { t: testText(cur) })) : el('small', {}, next ? '' : (state.ladders[l] && state.ladders[l].mastered) ? tr('Mastered!') : tr('Top level')),
      athome ? el('small', { class: 'warn-t' }, tr('Needs equipment, not in home workouts')) : null)));
}
function openLadder(l) {
  const lv = ladderLevel(state, l);
  openSheet(el('div', {}, el('h3', {}, ladderName(l)),
    el('p', { class: 'muted small' }, tr('Already further? Tap the level you can do now. The app then starts there.')),
    el('div', { class: 'levels' }, ladderExercises(l).map((x) => el('button', { class: 'lvl' + (x.lv === lv ? ' cur' : x.lv < lv ? ' past' : ''), onclick: () => {
      state.ladders[l] = { level: x.lv, at: todayKey(), manual: true }; save(); closeSheet(); render();
    } }, el('span', { class: 'lvl-n' }, x.lv), photo(x, 'sm'), el('span', { class: 'lvl-t' }, el('b', {}, exName(x)), x.up ? el('small', {}, tr('Test: {t}', { t: testText(x) })) : null)))),
    el('button', { class: 'btn wide', onclick: closeSheet }, tr('Close'))));
}

/* ---------- Settings ---------- */
function renderSettings() {
  const root = $('#view-settings'); root.innerHTML = '';
  const s = state.settings;
  const num = (val, step, min, max, on) => {
    const n = el('b', {}, val);
    return el('div', { class: 'num' }, el('button', { class: 'cb', onclick: () => { const v = Math.max(min, Math.min(max, (Number(n.textContent) || 0) - step)); n.textContent = v; on(v); } }, '−'), n,
      el('button', { class: 'cb plus', onclick: () => { const v = Math.max(min, Math.min(max, (Number(n.textContent) || 0) + step)); n.textContent = v; on(v); } }, '+'));
  };
  root.append(el('div', { class: 'card' }, el('h2', {}, tr('Weekly goal')),
    el('div', { class: 'goal' }, el('span', {}, tr('Strength workouts')), num(s.goals.strength, 1, 0, 7, (v) => { s.goals.strength = v; save(); })),
    el('div', { class: 'goal' }, el('span', {}, tr('Runs')), num(s.goals.runs, 1, 0, 7, (v) => { s.goals.runs = v; save(); })),
    el('p', { class: 'muted small' }, tr('Dutch guideline: at least 150 minutes of moderate exercise a week, with muscle-strengthening at least twice. One rest token per week covers one missed session.'))));
  const bwIn = el('input', { type: 'number', inputmode: 'decimal', value: s.bodyweight ?? '', placeholder: state.trackerWeight ? fmtKg(state.trackerWeight) : 'kg' });
  bwIn.onchange = () => { s.bodyweight = bwIn.value ? Number(String(bwIn.value).replace(',', '.')) : null; save(); };
  root.append(el('div', { class: 'card' }, el('h2', {}, tr('About you')),
    el('div', { class: 'field' }, el('label', {}, tr('Bodyweight (kg)')), bwIn,
      el('small', { class: 'muted' }, state.trackerWeight ? tr('Empty = your latest weight from Dagtracker ({kg} kg).', { kg: fmtKg(state.trackerWeight) }) : tr('Used for level-up tests and weight tiers.'))),
    el('div', { class: 'lbl' }, tr('Running')),
    seg([['beginner', tr('Beginner (run-walk)')], ['runner', tr('I can run 30 min')]], s.runner, (v) => { s.runner = v; if (v === 'runner' && (state.runLevel || 1) < 2) state.runLevel = 2; save(); render(); })));
  root.append(el('div', { class: 'card' }, el('h2', {}, 'Dagtracker'),
    el('label', { class: 'toggle' }, el('input', { type: 'checkbox', checked: s.tracker, onchange: (e) => { s.tracker = e.target.checked; save(); } }), tr('Turn on “sport” in Dagtracker after a workout')),
    el('p', { class: 'muted small' }, tr('Works on this phone, also offline. Dagtracker picks it up the next time you open it.'))));
  root.append(el('div', { class: 'card' }, el('h2', {}, 'Taal / Language'),
    seg([['nl', 'Nederlands'], ['en', 'English']], s.lang, (v) => { s.lang = v; save(); render(); })));
  const file = el('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: (e) => { const f = e.target.files[0]; if (f) importJson(f); e.target.value = ''; } });
  let armed = false;
  const delBtn = el('button', { class: 'btn danger wide', onclick: () => {
    if (!armed) { armed = true; delBtn.textContent = tr('Tap again to delete everything'); return; }
    state = freshState(); save(true); try { localStorage.removeItem(LS_KEY); } catch (e) { /* ignore */ } render(); toast(tr('All data deleted.'));
  } }, tr('Delete all data'));
  root.append(el('div', { class: 'card' }, el('h2', {}, tr('Your data')),
    el('p', { class: 'muted small' }, tr('Everything is stored on this phone only. {n} workouts logged.', { n: state.workouts.length })),
    el('button', { class: 'btn wide', onclick: exportJson }, tr('Download backup (JSON)')),
    el('label', { class: 'btn wide file-btn' }, el('span', {}, tr('Restore from backup')), file),
    delBtn));
  root.append(el('p', { class: 'muted small center' }, `${tr('Training')} v${APP_VERSION} · ${tr('Photos: Free Exercise DB (public domain)')}`));
  root.append(el('p', { class: 'center' }, el('a', { href: '../', class: 'small' }, tr('Open Dagtracker'))));
}
function exportJson() {
  const blob = new Blob([JSON.stringify({ app: 'sport', ...state, active: null }, null, 1)], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: `training-backup-${todayKey()}.json` });
  document.body.append(a); a.click(); a.remove();
}
function importJson(f) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const s = JSON.parse(r.result);
      if (!Array.isArray(s.workouts)) throw new Error('bad');
      state = migrate(s); save(true); render(); toast(tr('Backup restored.'));
    } catch (e) { toast(tr('That file is not a Training backup.')); }
  };
  r.readAsText(f);
}

/* ---------- start ---------- */
function bind() {
  document.querySelectorAll('.tabbar button').forEach((b) => (b.onclick = () => setView(b.dataset.view === 'train' && state.active && view !== 'workout' ? 'workout' : b.dataset.view)));
  $('#sheetBackdrop').addEventListener('click', (e) => { if (e.target.id === 'sheetBackdrop') closeSheet(); });
  $('#lvlChip').onclick = () => setView('skills');
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (state.active && state.active.started) keepAwake(true);
    if ($('#sheetBackdrop').hidden) renderKeepScroll();
  });
}
(async function init() {
  state = await loadState();
  save(); bind();
  setView(state.active ? 'workout' : 'train');
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
