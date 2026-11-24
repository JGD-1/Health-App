# Daily Tracker

Guido's daily tracker (PWA for Android): food score 1–5, mood 1–5, weight, and drink counts (beer / wine / liquor).
Overviews per week, month and year. Optional sharing with a partner. The sports app is a separate project.

Live: https://jgd-1.github.io/Health-App/ (GitHub Pages from `main`, root).

## Files
Plain HTML/CSS/JS, no build step: `index.html`, `styles.css`, `app.js`, `sw.js` (offline cache), `manifest.webmanifest`, `icons/`.
When changing files, bump `CACHE` in `sw.js` and `APP_VERSION` in `app.js` so phones pick up the update.

## Data (on the phone, schema 2)
```
state = {
  days: { 'YYYY-MM-DD': { food: 1..5|null, mood: 1..5|null, weight: kg|null, beer, wine, liquor, u: last-change ISO time } },
  settings: { name },
  sync: { secret, lastPull, lastSync, dirty: { day: changeTime }, shareWeight, partner: { name, shareWeight, days } | null }
}
```

## Sharing (Supabase project `daily-tracker`, eu-central-1)
- No email/password. Each phone makes a random 32-byte key; the server stores only its SHA-256 hash.
- Tables live in the private `app` schema (not exposed by the API, RLS on, no policies).
  The app only calls `public.tracker_*` RPC functions (SECURITY DEFINER), which check the key.
- Pairing: one person creates an 8-character code (valid 24 h), the other enters it.
- Sync: changed days are pushed; newest edit per day wins. Partner's days are pulled read-only;
  partner weight is only returned if that partner enabled "share my weight".
- Moving phones: Settings → More options → Show my key; on the new phone "I already use the app on another phone".

## Reminders
- Settings → Reminders: daily (food/mood/drinks) at a chosen time, weekly weight on a chosen day + time. Needs online sync.
- The phone registers a Web Push subscription (`tracker_save_push`); times + time zone are stored per account (`tracker_set_reminders`).
- pg_cron job `send-reminders` calls the edge function `send-reminders` every 5 minutes. It asks `tracker_due_reminders()`
  (service role only) what is due, sends with web-push (VAPID keys in `app.config`), and marks it sent so each reminder
  goes out once per day. A day already filled in (food + mood, or weight for the weekly one) gets no reminder.

# Training (sports app) — `sport/`

Separate PWA next to the tracker: https://jgd-1.github.io/Health-App/sport/ (installs as its own app, "Training").
Plain HTML/CSS/JS: `index.html`, `styles.css`, `i18n.js` (Dutch default), `exercises.js` (108 exercises, photos in `img/` from
Free Exercise DB, public domain), `engine.js` (generator + progression, no DOM), `app.js` (screens), `sw.js`, `manifest.webmanifest`.
When changing files, bump `CACHE` in `sport/sw.js` and `APP_VERSION` in `sport/app.js`.

- Generator: gym / bodyweight (gym or home without equipment) / run, 15–60 min. RAMP warm-up, patterns by least recently trained,
  always push + pull + legs, antagonist supersets, main lift from 30 min, extra superset + core from 45, cardio at 60. Trimmed to time.
- Progression from the last session: top of the rep range on every set → heavier (double step if RIR ≥ 3); 3 sessions short → −10%.
- Skill ladders (`l`/`lv` in exercises.js) level up when the exercise's test is passed in a workout; level can be set by hand.
  Character level = sum of ladder levels + running level + weight tiers (bodyweight multiples).
- Runs: beginner run-walk (Couch to 5K, max 30 min), else easy; intervals max 1 in 5 runs and not on a leg day; long run on weekends;
  never > 10% longer than the longest run in the last 30 days.
- Weekly goal (default 2 strength + 1 run); a week one session short is saved by the rest token.
- Data: `sport-app-state` (IndexedDB + localStorage). After a workout the app writes the date to localStorage `dagtracker-sport-inbox`;
  Dagtracker turns "sport" on for those days when it opens (setting can be turned off in Training).
