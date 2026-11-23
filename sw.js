/* Offline cache for the app shell. Bump CACHE when files change so phones pick up the new version. */
const CACHE = 'daily-tracker-v2.4.0';
const FILES = ['./', 'index.html', 'styles.css', 'app.js', 'manifest.webmanifest', 'i18n.js', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network first (so updates arrive when online), cache as fallback (so it works offline).
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});

// Reminder notifications sent by the server (Supabase edge function "send-reminders")
self.addEventListener('push', (e) => {
  let data = { title: 'Dagtracker', body: 'Tijd om je dag in te vullen.' };
  try { if (e.data) data = Object.assign(data, e.data.json()); } catch (err) { /* plain text */ }
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: data.kind || 'reminder', renotify: true,
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow('./');
  }));
});
