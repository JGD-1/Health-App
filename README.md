# Daily Log

Guido's personal habit app, step 1 of the roadmap: a local-first web app (PWA) for Android.

- **Food**: one score per day, 1–5, red → green.
- **Drinks**: tap a tile per drink; kcal and standard glasses are added up. Presets are editable; "Other…" takes size + alcohol % (alcohol kcal = ml × % × 0.789 g/ml × 7 kcal/g).
- **Sport**: type (gym / calisthenics / run / other), where (gym / home / outside), minutes, effort.
- **Week**: food tiles, minutes and strength-session rings (Dutch guideline: 150 min, 2× strength), drinks per day, 12-week food heat-map.
- **Settings**: drink presets, training places (equipment per place, home = bodyweight only), heavy-day threshold, backup/restore, CSV export, delete all.

All data is stored on the phone (IndexedDB). Nothing is sent anywhere.

## Files
Plain HTML/CSS/JS, no build step: `index.html`, `styles.css`, `app.js`, `sw.js` (offline cache), `manifest.webmanifest`, `icons/`.
When changing files, bump `CACHE` in `sw.js` and `APP_VERSION` in `app.js`.

## Data model (schema 1)
```
state = {
  schema, createdAt,
  settings: {
    heavyThreshold,                       // 4 or 6 standard glasses
    drinkPresets: [{ id, name, ml, abv, kcal, hidden, custom }],
    locations: [{ id: 'gym'|'home', name, equipment: [...] }]   // [] = bodyweight only; read by the workout generator
  },
  days: { 'YYYY-MM-DD': {
    food: 1..5 | null,
    drinks: [{ id, presetId, name, ml, abv, kcal, t }],            // values copied at log time
    sport:  [{ id, type, location, minutes, effort, note, source: 'manual'|'generated', workoutId, t }]
  }},
  workouts: [],   // step 2: generated sessions (location, exercises, sets) — a sport entry links via workoutId
  skills: {}      // step 3: skill ladder levels
}
```
