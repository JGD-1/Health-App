/* Sport app engine: workout generator, progression, skill ladders, weekly goals.
   Pure functions on the app state, so they can be tested without a browser. Rules come from the research plan:
   RAMP warm-up, movement-pattern slots by least recently trained, always push + pull + legs, antagonist supersets,
   effort by reps-in-reserve, load/reps from last session, trimmed to the chosen time.
   Runs: mostly easy, max 1 in 5 intervals, never >10% longer than the longest run of the last 30 days. */
'use strict';

const EX_BY_ID = Object.fromEntries(EXERCISES.map((x) => [x.id, x]));
const TIMES = [15, 20, 30, 45, 60];
const WORK_S = 40; // assumed time per set of reps
const SUPERSET_REST = 75; // 60–90 s between superset rounds
const PUSH = ['hpush', 'vpush'], PULL = ['hpull', 'vpull'], SQUATS = ['squat', 'lunge'];
const RANK_ORDER = ['squat', 'hpush', 'hpull', 'hinge', 'vpull', 'vpush', 'lunge', 'core'];

// Which ladder (or fixed exercise) trains each pattern, per mode. gym = gym session, cali = bodyweight at the gym, home = bodyweight at home.
const LADDERS = {
  gym: { squat: 'Squat (gym)', lunge: 'Lunge (gym)', hinge: 'Hinge (gym)', hpush: 'Push (gym)', vpush: 'Overhead (gym)', hpull: 'Row (gym)', vpull: 'Vertical pull (gym)', core: 'Core' },
  cali: { squat: 'Single-leg squat', hinge: 'Hinge (bodyweight)', hpush: ['Push-up', 'Dip'], vpush: 'Handstand', hpull: '#EX062', vpull: 'Pull-up', core: 'Core' },
  home: { squat: 'Single-leg squat', hinge: 'Hinge (bodyweight)', hpush: 'Push-up', vpush: 'Handstand', hpull: '#EX062', core: 'Core' },
};
// Ladders shown on the Skills screen
const SKILL_LADDERS = {
  gym: ['Squat (gym)', 'Lunge (gym)', 'Hinge (gym)', 'Push (gym)', 'Overhead (gym)', 'Row (gym)', 'Vertical pull (gym)'],
  bodyweight: ['Push-up', 'Dip', 'Pull-up', 'Single-leg squat', 'Hinge (bodyweight)', 'Core', 'Handstand'],
};
const MAIN_PATTERNS = { gym: ['squat', 'hinge', 'hpush', 'vpull', 'vpush', 'hpull'], cali: ['vpull', 'hpush', 'squat', 'vpush', 'hinge'], home: ['hpush', 'squat', 'vpush', 'hinge'] };
const GYM_ACCESSORIES = [['EX031', 'EX032'], ['EX020', 'EX024'], ['EX012', 'EX033']];
// Weight tiers for the big gym lifts, as multiples of bodyweight (lift ids that count for each tier list)
const TIERS = [
  { key: 'squat', name: 'Squat', ids: ['EX001', 'EX002'], at: [0.75, 1, 1.25, 1.5] },
  { key: 'deadlift', name: 'Deadlift', ids: ['EX008', 'EX009'], at: [1, 1.25, 1.5, 2] },
  { key: 'bench', name: 'Bench press', ids: ['EX013'], at: [0.5, 0.75, 1, 1.25] },
  { key: 'ohp', name: 'Overhead press', ids: ['EX018'], at: [0.35, 0.5, 0.65, 0.8] },
  { key: 'row', name: 'Barbell row', ids: ['EX021'], at: [0.5, 0.75, 1, 1.25] },
];

/* ---------- small helpers ---------- */
function dayKey(d) {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
function parseDay(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }
function daysBetween(a, b) { return Math.round((parseDay(dayKey(b)) - parseDay(dayKey(a))) / 86400000); }
function weekStart(d) { const x = parseDay(dayKey(d)); const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); return x; }
function weekKey(d) { return dayKey(weekStart(d)); }

// "6-10/leg" → { lo: 6, hi: 10, unit: 'reps', side: 'leg' }
function parseReps(x) {
  const m = String(x || '').match(/^(\d+)(?:-(\d+))?\s*(s|m|min)?(?:\/(leg|side|arm))?/);
  if (!m) return { lo: 1, hi: 1, unit: 'reps', side: '' };
  const lo = Number(m[1]), hi = Number(m[2] || m[1]);
  const unit = m[3] === 's' ? 's' : m[3] === 'm' ? 'm' : m[3] === 'min' ? 'min' : 'reps';
  const side = m[4] || (/each way/.test(x) ? 'way' : '');
  return { lo, hi, unit, side };
}
function parseSets(s, short) {
  const m = String(s || '3').match(/^(\d+)(?:-(\d+))?/);
  if (!m) return 3;
  return short ? Number(m[1]) : Number(m[2] || m[1]);
}
// Level-up test: "3x10/leg with 2x16 kg", "3x6 at 1x bodyweight", "3x30 s", "60 s hold", "1 clean rep/side = mastered"
function parseTest(up) {
  const t = String(up || '');
  let m = t.match(/^(\d+)x(\d+)\s*(s\b)?/);
  let sets, val, unit = 'reps';
  if (m) { sets = Number(m[1]); val = Number(m[2]); if (m[3]) unit = 's'; }
  else if ((m = t.match(/^(\d+)\s*s\b/))) { sets = 1; val = Number(m[1]); unit = 's'; }
  else if ((m = t.match(/^(\d+) clean rep/))) { sets = 1; val = Number(m[1]); }
  else return null;
  const test = { sets, val, unit, kg: 0, bw: 0, bwExtra: 0 };
  let k;
  if ((k = t.match(/with (?:(\d+)x)?(\d+(?:\.\d+)?) kg/))) test.kg = Number(k[2]);
  if ((k = t.match(/at (\d+(?:\.\d+)?)x bodyweight/))) test.bw = Number(k[1]);
  if ((k = t.match(/\+(\d+)% bodyweight/))) test.bwExtra = Number(k[1]) / 100;
  if (/next bell/.test(t)) return null; // needs a heavier kettlebell, not tracked
  return test;
}
function isTimed(ex) { return parseReps(ex.x).unit === 's'; }
function kgStep(ex) {
  if (/Kettlebell|kettlebell/.test(ex.e)) return 4;
  if (/Dumbbell|dumbbell/.test(ex.e)) return 2;
  return 2.5;
}
function roundKg(kg, ex) { const st = kgStep(ex) === 2.5 ? 2.5 : kgStep(ex) === 4 ? 4 : 1; return Math.max(0, Math.round(kg / st) * st); }

/* ---------- state helpers ---------- */
function ladderLevel(state, ladder) { return (state.ladders[ladder] && state.ladders[ladder].level) || 1; }
function ladderExercises(ladder) { return EXERCISES.filter((x) => x.l === ladder).sort((a, b) => a.lv - b.lv); }
function maxLevel(ladder) { const xs = ladderExercises(ladder); return xs.length ? xs[xs.length - 1].lv : 1; }
function available(ex, mode) {
  if (mode === 'home') return !!ex.home;
  if (mode === 'cali') return ex.t === 'Calisthenics';
  return ex.t !== 'Run' && ex.t !== 'Warm-up';
}
// The exercise for a ladder at the person's level (or the highest available below it)
function exerciseFor(state, ladder, mode) {
  if (ladder.startsWith('#')) return EX_BY_ID[ladder.slice(1)];
  const lv = ladderLevel(state, ladder);
  const xs = ladderExercises(ladder).filter((x) => available(x, mode));
  const below = xs.filter((x) => x.lv <= lv);
  return below.length ? below[below.length - 1] : xs[0] || null;
}
function strengthWorkouts(state) { return state.workouts.filter((w) => w.kind === 'gym' || w.kind === 'cali'); }
function runWorkouts(state) { return state.workouts.filter((w) => w.kind === 'run'); }

// Last time each pattern was trained (from the log)
function lastTrained(state) {
  const out = {};
  for (const w of state.workouts) for (const p of w.patterns || []) if (!out[p] || out[p] < w.date) out[p] = w.date;
  return out;
}
function rankPatterns(state, patterns, today) {
  const lt = lastTrained(state);
  const score = (p) => (lt[p] ? daysBetween(lt[p], today) : 999);
  return [...patterns].sort((a, b) => score(b) - score(a) || RANK_ORDER.indexOf(a) - RANK_ORDER.indexOf(b));
}

// Most recent logged sets of an exercise: { date, sets: [{ reps, kg }], rir }
function lastLog(state, exId, beforeId) {
  for (let i = state.workouts.length - 1; i >= 0; i--) {
    const w = state.workouts[i];
    if (beforeId && w.id === beforeId) continue;
    for (const it of w.items || []) {
      if (it.ex === exId && it.sets.some((s) => s.done)) return { date: w.date, sets: it.sets.filter((s) => s.done), rir: it.rir, w };
    }
  }
  return null;
}
function recentLogs(state, exId, n) {
  const out = [];
  for (let i = state.workouts.length - 1; i >= 0 && out.length < n; i--) {
    for (const it of state.workouts[i].items || []) if (it.ex === exId && it.sets.some((s) => s.done)) { out.push(it); break; }
  }
  return out;
}

/* ---------- prescription: sets, reps, weight from the last session ---------- */
function prescribe(state, ex, sets, role) {
  const r = parseReps(ex.x);
  const item = { ex: ex.id, role, sets: [], target: r.lo, kg: null, note: '' };
  const last = lastLog(state, ex.id);
  const lastKg = last ? Math.max(...last.sets.map((s) => Number(s.kg) || 0)) : 0;
  if (ex.w) {
    if (last && lastKg > 0) {
      const kg = Math.max(...last.sets.map((s) => Number(s.kg) || 0));
      const atKg = last.sets.filter((s) => (Number(s.kg) || 0) === kg);
      const allTop = atKg.length >= Math.min(sets, last.sets.length) && atKg.every((s) => s.reps >= r.hi);
      const missed = atKg.some((s) => s.reps < r.lo);
      if (allTop) {
        const jump = last.rir != null && last.rir >= 3 ? 2 : 1;
        item.kg = roundKg(kg + kgStep(ex) * jump, ex); item.target = r.lo; item.note = 'up';
      } else if (missed && recentLogs(state, ex.id, 3).length === 3 && recentLogs(state, ex.id, 3).every((it) => it.sets.filter((s) => s.done).some((s) => s.reps < r.lo))) {
        item.kg = roundKg(kg * 0.9, ex); item.target = r.lo; item.note = 'deload';
      } else {
        item.kg = kg; item.target = Math.min(r.hi, Math.max(r.lo, Math.min(...atKg.map((s) => s.reps)) + 1)); item.note = 'same';
      }
    } else {
      item.note = 'first';
      if (last) { const worst = Math.min(...last.sets.map((s) => Number(s.reps) || 0)); item.target = Math.min(r.hi, Math.max(r.lo, worst + 1)); }
    }
  } else if (last) {
    const worst = Math.min(...last.sets.map((s) => Number(s.reps) || 0));
    const step = r.unit === 's' ? 5 : 1;
    item.target = Math.min(r.hi, Math.max(r.lo, worst + step));
    item.note = worst >= r.hi ? 'top' : 'same';
  }
  for (let i = 0; i < sets; i++) item.sets.push({ reps: item.target, kg: item.kg, done: false });
  item.rest = role === 'main' ? Math.min(180, Math.max(120, ex.rest || 150)) : role === 'finisher' ? 45 : SUPERSET_REST;
  return item;
}

/* ---------- warm-up (RAMP: Raise, Activate, Mobilise, Potentiate) ---------- */
function warmup(mode, minutes, firstEx) {
  const raise = mode === 'gym' ? 'EX100' : 'EX099';
  const steps = [
    { ex: raise, dose: mode === 'gym' ? '2 min' : '2 × 30 s' },
    { ex: 'EX095', dose: '10' },
    { ex: 'EX103', dose: '10' },
    { ex: 'EX096', dose: '5' },
    { ex: mode === 'gym' ? 'EX101' : 'EX097', dose: mode === 'gym' ? '15' : '8' },
  ];
  if (minutes >= 30) steps.splice(4, 0, { ex: 'EX098', dose: '10' });
  if (firstEx && (firstEx.l === 'Handstand' || firstEx.l === 'Push-up')) steps.push({ ex: 'EX102', dose: '10' });
  return { minutes: minutes >= 30 ? 5 : 4, steps, ramp: !!(firstEx && firstEx.w) };
}

/* ---------- time estimate and trimming ---------- */
function itemSeconds(item) {
  const ex = EX_BY_ID[item.ex];
  const r = parseReps(ex.x);
  const work = r.unit === 's' ? Math.max(20, item.target) * (r.side ? 2 : 1) + 10 : r.side ? WORK_S * 1.6 : WORK_S;
  return work;
}
function estimate(plan) {
  let s = plan.warmup ? plan.warmup.minutes * 60 : 0;
  for (const b of plan.blocks) {
    const rounds = Math.max(...b.items.map((it) => it.sets.length));
    const work = b.items.reduce((a, it) => a + itemSeconds(it), 0);
    s += rounds * (work + (b.items[0].rest || SUPERSET_REST)) - (b.items[0].rest || SUPERSET_REST) + 30; // +30 s to set up
  }
  if (plan.cardio) s += plan.cardio.minutes * 60;
  return Math.round(s / 60);
}

function pairUp(patterns) {
  const left = [...patterns], pairs = [];
  const partner = (p) => (PUSH.includes(p) ? PULL : PULL.includes(p) ? PUSH : SQUATS.includes(p) ? ['hinge'] : p === 'hinge' ? SQUATS : []);
  while (left.length) {
    const p = left.shift();
    let i = left.findIndex((q) => partner(p).includes(q));
    if (i < 0) i = left.findIndex((q) => q === 'core');
    if (i < 0) i = left.length ? 0 : -1;
    pairs.push(i >= 0 ? [p, left.splice(i, 1)[0]] : [p]);
  }
  return pairs;
}

/* ---------- strength generator ---------- */
function generateStrength(state, opts) {
  const mode = opts.mode; // gym | cali | home
  const minutes = opts.minutes;
  const today = opts.today || new Date();
  const map = LADDERS[mode];
  const patterns = Object.keys(map).filter((p) => p !== 'core');
  const ranked = rankPatterns(state, patterns, today);
  const best = (list) => ranked.find((p) => list.includes(p));
  const sets = minutes <= 15 ? 2 : 3;
  const used = new Set();
  const chosen = [];
  let main = null;
  if (minutes >= 30) { main = rankPatterns(state, MAIN_PATTERNS[mode], today)[0]; used.add(main); }
  const take = (p) => { if (p && !used.has(p)) { used.add(p); chosen.push(p); return true; } return false; };
  // always push + pull + legs (15–20 min: squat + hinge)
  const covered = (list) => [...used].some((p) => list.includes(p));
  if (!covered(PUSH)) take(best(PUSH));
  if (!covered(PULL)) take(best(PULL.filter((p) => map[p])));
  if (!covered([...SQUATS])) take(best(SQUATS.filter((p) => map[p])));
  if (!covered(['hinge'])) take('hinge');
  for (const p of ranked) if (chosen.length < 4) take(p);
  // pick exercises, avoid the same exercise twice
  const exUsed = new Set();
  const pickEx = (p, allowHarder) => {
    let lad = map[p];
    if (Array.isArray(lad)) { // alternate e.g. push-up and dip ladders
      const lt = state.ladderUsed || {};
      lad = [...lad].filter((l) => exerciseFor(state, l, mode)).sort((a, b) => (lt[a] || '').localeCompare(lt[b] || ''))[0];
    }
    let ex = exerciseFor(state, lad, mode);
    if (ex && exUsed.has(ex.id)) {
      const opts = ladderExercises(lad).filter((x) => available(x, mode) && !exUsed.has(x.id));
      ex = opts.filter((x) => x.lv < ex.lv).pop() || (allowHarder ? opts.find((x) => x.lv === ex.lv + 1) : null) || null;
    }
    if (ex) exUsed.add(ex.id);
    return ex;
  };
  const blocks = [];
  if (main) { const ex = pickEx(main); if (ex) blocks.push({ kind: 'main', patterns: [main], items: [prescribe(state, ex, 3, 'main')] }); }
  for (const pair of pairUp(chosen)) {
    const items = pair.map((p) => { const ex = pickEx(p); return ex ? prescribe(state, ex, sets, 'superset') : null; }).filter(Boolean);
    if (items.length) blocks.push({ kind: 'superset', patterns: pair, items });
  }
  if (minutes >= 45) {
    let extra = null;
    if (mode === 'gym') {
      const lt = lastTrainedEx(state);
      extra = [...GYM_ACCESSORIES].sort((a, b) => (lt[a[0]] || '').localeCompare(lt[b[0]] || ''))[0].map((id) => EX_BY_ID[id]);
      blocks.push({ kind: 'accessory', patterns: [], items: extra.map((ex) => prescribe(state, ex, 3, 'superset')) });
    } else {
      let rest = rankPatterns(state, patterns.filter((p) => !used.has(p)), today).slice(0, 2);
      if (rest.length < 2) rest = [...rest, ...ranked.filter((p) => !rest.includes(p))].slice(0, 2); // repeat a pattern with an easier variant
      const items = rest.map((p) => { used.add(p); const ex = pickEx(p, true); return ex ? prescribe(state, ex, 3, 'superset') : null; }).filter(Boolean);
      if (items.length) blocks.push({ kind: 'accessory', patterns: rest, items });
    }
    const core = pickEx('core');
    if (core) blocks.push({ kind: 'core', patterns: ['core'], items: [prescribe(state, core, 3, 'finisher')] });
  }
  const firstEx = blocks.length ? EX_BY_ID[blocks[0].items[0].ex] : null;
  const plan = {
    kind: mode === 'gym' ? 'gym' : 'cali', place: mode === 'home' ? 'home' : 'gym', mode, minutes,
    warmup: warmup(mode, minutes, firstEx), blocks,
    cardio: minutes >= 60 ? { minutes: 10, what: mode === 'home' ? 'walk' : 'bike' } : null,
  };
  fitToTime(state, plan, mode);
  plan.estimate = estimate(plan);
  return plan;
}
function lastTrainedEx(state) {
  const out = {};
  for (const w of state.workouts) for (const it of w.items || []) out[it.ex] = w.date;
  return out;
}
// Too long → drop a set from the last superset; too short → add a core finisher, then sets.
function fitToTime(state, plan, mode) {
  const target = plan.minutes;
  let guard = 40;
  while (estimate(plan) > target && guard--) {
    const b = [...plan.blocks].reverse().find((x) => x.kind !== 'main' && Math.max(...x.items.map((i) => i.sets.length)) > 2);
    if (!b) { const m = plan.blocks.find((x) => x.kind === 'main' && x.items[0].sets.length > 2); if (m) { m.items[0].sets.pop(); continue; } break; }
    for (const it of b.items) if (it.sets.length > 2) it.sets.pop();
  }
  if (target - estimate(plan) >= 3 && !plan.blocks.some((b) => b.kind === 'core')) {
    const ex = exerciseFor(state, 'Core', mode);
    if (ex) plan.blocks.push({ kind: 'core', patterns: ['core'], items: [prescribe(state, ex, 2, 'finisher')] });
    while (estimate(plan) > target && plan.blocks[plan.blocks.length - 1].items[0].sets.length > 1) plan.blocks[plan.blocks.length - 1].items[0].sets.pop();
    if (estimate(plan) > target) plan.blocks.pop();
  }
  guard = 20;
  while (target - estimate(plan) >= 3 && guard--) {
    const b = plan.blocks.find((x) => x.kind !== 'core' && Math.max(...x.items.map((i) => i.sets.length)) < 4);
    if (!b) break;
    for (const it of b.items) it.sets.push({ ...it.sets[it.sets.length - 1], done: false });
    if (estimate(plan) > target) { for (const it of b.items) it.sets.pop(); break; }
  }
  if (plan.cardio) plan.cardio.minutes = Math.min(20, plan.cardio.minutes + Math.max(0, target - estimate(plan)));
}

/* ---------- runs ---------- */
// Run-walk steps (Couch to 5K logic): run minutes / walk minutes per week of the programme.
const RUN_WALK = [[1, 1.5], [1.5, 2], [2, 1.5], [3, 1.5], [5, 2], [8, 2], [12, 2], [20, 2], [30, 0]];
function runLevel(state) {
  if (state.settings.runner === 'runner') return Math.max(2, state.runLevel || 2);
  return state.runLevel || 1;
}
function longestRun(state, today, days) {
  let m = 0;
  for (const w of runWorkouts(state)) if (daysBetween(w.date, today) <= days && daysBetween(w.date, today) >= 0) m = Math.max(m, w.minutes || 0);
  return m;
}
function generateRun(state, opts) {
  const today = opts.today || new Date();
  let minutes = opts.minutes;
  const runs = runWorkouts(state);
  const lv = runLevel(state);
  const longest = longestRun(state, today, 30);
  const notes = [];
  if (longest > 0 && minutes > Math.floor(longest * 1.1)) {
    const cap = Math.max(15, Math.floor(longest * 1.1));
    if (cap < minutes) { notes.push({ k: 'capped', from: minutes, to: cap, longest }); minutes = cap; }
  }
  const lastRun = runs[runs.length - 1];
  if (lastRun && daysBetween(lastRun.date, today) === 1 && lv === 1) notes.push({ k: 'restday' });
  let type, segments = [];
  if (lv === 1) {
    type = 'runwalk';
    if (minutes > 30) { notes.push({ k: 'beginnercap', from: minutes, to: 30 }); minutes = 30; } // Couch to 5K sessions last about 30 min
    const done = runs.filter((w) => w.run && w.run.type === 'runwalk').length;
    const week = Math.min(RUN_WALK.length - 1, Math.floor(done / 3));
    const [run, walk] = RUN_WALK[week];
    const warm = 5, cool = minutes >= 25 ? 4 : 3;
    let left = minutes - warm - cool;
    segments.push({ k: 'walk', s: warm * 60 });
    if (walk === 0) { segments.push({ k: 'run', s: left * 60 }); segments.push({ k: 'walk', s: cool * 60 }); }
    else {
      while (left >= run) {
        segments.push({ k: 'run', s: run * 60 }); left -= run;
        if (left >= walk + run) { segments.push({ k: 'walk', s: walk * 60 }); left -= walk; } else break;
      }
      cool + left > 0 && segments.push({ k: 'walk', s: Math.round((cool + left) * 60) });
    }
    if (walk !== 0) segments = mergeTail(segments);
    notes.push({ k: 'week', week: week + 1 });
  } else {
    const last4 = runs.slice(-4);
    const hadIntervals = last4.some((w) => w.run && w.run.type === 'intervals');
    const legsToday = strengthWorkouts(state).some((w) => w.date === dayKey(today) && (w.patterns || []).some((p) => ['squat', 'hinge', 'lunge'].includes(p)));
    const weekend = [0, 6].includes(parseDay(dayKey(today)).getDay());
    if (weekend && minutes >= 45 && lv >= 2) type = 'long';
    else if (!hadIntervals && runs.length >= 4 && lv >= 3 && minutes >= 20 && !legsToday) type = 'intervals';
    else type = 'easy';
    if (type === 'intervals') {
      const reps = Math.max(3, Math.min(10, Math.floor((minutes - 12) / 3)));
      segments.push({ k: 'easy', s: 8 * 60 });
      for (let i = 0; i < reps; i++) { segments.push({ k: 'hard', s: 60 }); segments.push({ k: 'easy', s: 120 }); }
      const used = 8 + reps * 3;
      segments[segments.length - 1].s += Math.max(0, minutes - used) * 60;
    } else segments.push({ k: 'easy', s: minutes * 60 });
    if (legsToday && type === 'easy' && !hadIntervals && lv >= 3) notes.push({ k: 'legs' });
  }
  return { kind: 'run', minutes, run: { type, segments }, notes, estimate: Math.round(segments.reduce((a, s) => a + s.s, 0) / 60) };
}
function mergeTail(seg) {
  const out = [];
  for (const s of seg) { const l = out[out.length - 1]; if (l && l.k === s.k) l.s += s.s; else out.push({ ...s }); }
  return out;
}

/* ---------- after a workout: level-ups, records, run level ---------- */
function bodyweight(state) { return Number(state.settings.bodyweight) || Number(state.trackerWeight) || 0; }
function testPassed(state, ex, item) {
  const t = parseTest(ex.up);
  if (!t) return false;
  const sets = item.sets.filter((s) => s.done);
  if (sets.length < t.sets) return false;
  const bw = bodyweight(state);
  let needKg = t.kg;
  if (t.bw) { if (!bw) return false; needKg = t.bw * bw; }
  if (t.bwExtra) { if (!bw) return false; needKg = t.bwExtra * bw; }
  const good = sets.filter((s) => (Number(s.reps) || 0) >= t.val && (!needKg || (Number(s.kg) || 0) >= needKg - 0.01));
  return good.length >= t.sets;
}
// Applies level-ups for a finished workout. Returns a list of events to celebrate.
function applyProgress(state, w) {
  const events = [];
  for (const it of w.items || []) {
    const ex = EX_BY_ID[it.ex];
    if (!ex) continue;
    if (ex.l && ladderLevel(state, ex.l) === ex.lv && testPassed(state, ex, it)) {
      const next = ladderExercises(ex.l).find((x) => x.lv > ex.lv);
      state.ladders[ex.l] = { level: next ? next.lv : ex.lv, at: w.date, mastered: !next };
      events.push({ k: next ? 'levelup' : 'mastered', ladder: ex.l, from: ex.id, to: next ? next.id : null });
    }
    // personal records: heaviest weight for these reps, or most reps / longest hold
    const prev = bestBefore(state, ex.id, w.id);
    const done = it.sets.filter((s) => s.done);
    if (!done.length) continue;
    if (!prev) { events.push({ k: 'first', ex: ex.id }); continue; }
    if (ex.w) {
      const kg = Math.max(...done.map((s) => Number(s.kg) || 0));
      if (kg > prev.kg) events.push({ k: 'pr', ex: ex.id, kg });
    } else {
      const reps = Math.max(...done.map((s) => Number(s.reps) || 0));
      if (reps > prev.reps) events.push({ k: 'pr', ex: ex.id, reps });
    }
    if (ex.l && Array.isArray(LADDERS.cali.hpush) && LADDERS.cali.hpush.includes(ex.l)) { state.ladderUsed = state.ladderUsed || {}; state.ladderUsed[ex.l] = w.date + w.id; }
  }
  if (w.kind === 'run') {
    const lv = runLevel(state);
    const cont = w.run && (w.run.type !== 'runwalk' || (w.run.segments || []).every((s) => s.k !== 'walk' || s === w.run.segments[0] || s === w.run.segments[w.run.segments.length - 1]));
    if (lv === 1 && cont && w.minutes >= 30 && w.completed) { state.runLevel = 2; events.push({ k: 'runlevel', to: 2 }); }
    else if (lv === 2 && runWorkouts(state).filter((r) => r.run && r.run.type !== 'runwalk').length >= 5) { state.runLevel = 3; events.push({ k: 'runlevel', to: 3 }); }
    else if (lv === 3 && w.minutes >= 45) { state.runLevel = 4; events.push({ k: 'runlevel', to: 4 }); }
  }
  return events;
}
function bestBefore(state, exId, wid) {
  let b = null;
  for (const w of state.workouts) {
    if (w.id === wid) continue;
    for (const it of w.items || []) {
      if (it.ex !== exId) continue;
      for (const s of it.sets) if (s.done) {
        b = b || { kg: 0, reps: 0 };
        b.kg = Math.max(b.kg, Number(s.kg) || 0); b.reps = Math.max(b.reps, Number(s.reps) || 0);
      }
    }
  }
  return b;
}

/* ---------- weight tiers + character level ---------- */
function tierFor(state, tier) {
  const bw = bodyweight(state);
  let best = 0;
  for (const w of state.workouts) for (const it of w.items || []) if (tier.ids.includes(it.ex)) for (const s of it.sets) if (s.done && (Number(s.reps) || 0) >= 5) best = Math.max(best, Number(s.kg) || 0);
  if (!bw) return { level: 0, best, next: null };
  const level = tier.at.filter((m) => best >= m * bw - 0.01).length;
  return { level, best, next: level < tier.at.length ? roundKg(tier.at[level] * bw, EX_BY_ID[tier.ids[0]]) : null };
}
function characterLevel(state) {
  let n = 0;
  for (const l of [...SKILL_LADDERS.gym, ...SKILL_LADDERS.bodyweight]) n += ladderLevel(state, l);
  n += runLevel(state);
  for (const t of TIERS) n += tierFor(state, t).level;
  return n;
}

/* ---------- weekly goals, streak and rest tokens ---------- */
function weekStats(state, wk) {
  const ws = state.workouts.filter((w) => weekKey(w.date) === wk);
  return {
    strength: ws.filter((w) => w.kind === 'gym' || w.kind === 'cali').length,
    runs: ws.filter((w) => w.kind === 'run').length,
    minutes: ws.reduce((a, w) => a + (Number(w.minutes) || 0), 0),
    sessions: ws.length,
  };
}
// A week counts when the goal is met. One rest token per week covers one missing session.
function weekResult(state, wk) {
  const g = state.settings.goals;
  const s = weekStats(state, wk);
  const short = Math.max(0, g.strength - s.strength) + Math.max(0, g.runs - s.runs);
  return { ...s, short, met: short === 0, token: short === 1 };
}
function streak(state, today) {
  const cur = weekStart(today || new Date());
  const first = state.workouts.length ? weekStart(state.workouts.reduce((a, w) => (w.date < a ? w.date : a), state.workouts[0].date)) : cur;
  let n = 0, tokens = 0;
  const d = new Date(cur); d.setDate(d.getDate() - 7);
  while (d >= first) {
    const r = weekResult(state, dayKey(d));
    if (r.met) n++;
    else if (r.token) { n++; tokens++; }
    else break;
    d.setDate(d.getDate() - 7);
  }
  const now = weekResult(state, dayKey(cur));
  if (now.met) n++;
  return { weeks: n, tokensUsed: tokens, thisWeek: now };
}

if (typeof module !== 'undefined') module.exports = { generateStrength, generateRun, applyProgress, parseReps, parseTest, characterLevel, streak, weekResult, tierFor, TIERS, estimate, exerciseFor, LADDERS, SKILL_LADDERS, EX_BY_ID, dayKey, weekKey, ladderExercises, maxLevel, runLevel, ladderLevel, lastLog, bodyweight, longestRun };
