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
