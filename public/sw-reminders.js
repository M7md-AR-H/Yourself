/* Imported into the generated service worker (vite.config.ts → workbox.importScripts).
 * Plain JS on purpose: it runs in the SW, outside the app bundle.
 * - periodicsync 'yourself-daily': read IndexedDB directly and show a "tasks due today" summary.
 * - notificationclick: focus the app (or open it) on the right page. */
const DB = 'yourself';

function ymd(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function readAll(store) {
  return new Promise((resolve) => {
    const open = indexedDB.open(DB);
    open.onerror = () => resolve([]);
    open.onupgradeneeded = () => { open.transaction.abort(); resolve([]); }; // never create the DB from here
    open.onsuccess = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains(store)) { db.close(); resolve([]); return; }
      const req = db.transaction(store, 'readonly').objectStore(store).getAll();
      req.onsuccess = () => { db.close(); resolve(req.result || []); };
      req.onerror = () => { db.close(); resolve([]); };
    };
  });
}

async function dailySummary() {
  const [settings] = await readAll('settings');
  if (!settings || !settings.reminders || !settings.reminders.enabled) return;
  const today = ymd();
  const tasks = (await readAll('tasks')).filter((t) => !t.done && t.due && t.due <= today);
  if (!tasks.length) return;
  const names = tasks.slice(0, 3).map((t) => t.title).join(', ');
  await self.registration.showNotification(`${tasks.length} task${tasks.length === 1 ? '' : 's'} for today`, {
    body: tasks.length > 3 ? `${names}, and more` : names,
    tag: `daily-${today}`,
    icon: './icon-192.png',
    badge: './icon-192.png',
    data: { url: './#/today' },
  });
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'yourself-daily') event.waitUntil(dailySummary());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (c.url.startsWith(self.registration.scope)) { await c.focus(); c.navigate && c.navigate(url); return; }
    }
    await self.clients.openWindow(url);
  })());
});
