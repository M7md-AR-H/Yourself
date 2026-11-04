/**
 * Reminders without a server.
 *  - While the app is running (open or in the background), a timer checks every 30 s and shows
 *    a notification when a task's time passes, plus an optional daily check-in nudge.
 *  - When the app is closed, an installed PWA on Android Chrome can wake roughly once a day via
 *    Periodic Background Sync (public/sw-reminders.js) and show a "tasks due today" summary.
 * Exact-time alarms while the app is fully closed are not possible on the web; see README limits.
 */
import { db, getSettings } from './db';
import { formatTime } from './commands';
import { ymd } from './util';

export type Permission = NotificationPermission | 'unsupported';

export const permission = (): Permission => ('Notification' in window ? Notification.permission : 'unsupported');

export async function requestPermission(): Promise<Permission> {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

async function show(title: string, body: string, tag: string, url = './#/today') {
  if (permission() !== 'granted') return false;
  const opts: NotificationOptions & { renotify?: boolean } = { body, tag, icon: './icon-192.png', badge: './icon-192.png', data: { url } };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, opts);
    else new Notification(title, opts);
    return true;
  } catch {
    try { new Notification(title, opts); return true; } catch { return false; }
  }
}

const nowHM = (d = new Date()) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** One pass: fire anything that's due. Exported for tests. */
let running = false;
export async function tick(now = new Date()): Promise<string[]> {
  const fired: string[] = [];
  if (running) return fired; // overlapping timer / visibility ticks
  running = true;
  try {
    const run = () => tickOnce(now, fired);
    const locks = (navigator as Navigator & { locks?: { request(n: string, o: { ifAvailable: boolean }, cb: (l: unknown) => Promise<void>): Promise<void> } }).locks;
    // one tab at a time; another tab already checking → skip this round
    if (locks) await locks.request('yourself-reminders', { ifAvailable: true }, async (lock) => { if (lock) await run(); });
    else await run();
  } finally {
    running = false;
  }
  return fired;
}

async function tickOnce(now: Date, fired: string[]) {
  const s = await getSettings();
  const r = s.reminders;
  // Without permission nothing is stamped, so reminders still fire once it's granted.
  if (!r?.enabled || permission() !== 'granted') return;
  const today = ymd(now);
  const hm = nowHM(now);

  const due = await db.tasks.filter((t) => !t.done && !!t.time && !t.notifiedAt && !!t.due && (t.due < today || (t.due === today && t.time! <= hm))).toArray();
  for (const t of due) {
    // only remind for things within the last 12 h (don't spam a backlog after a week away)
    const at = new Date(`${t.due}T${t.time}:00`).getTime(); // local time, same as how it was entered
    const stale = now.getTime() - at >= 12 * 3600e3; // don't spam a backlog after days away: drop quietly
    const shown = !stale && (await show(t.title, `Due ${formatTime(t.time)}. Tap to open.`, `task-${t.id}`));
    if (shown) fired.push(t.id);
    if (shown || stale) await db.tasks.update(t.id, { notifiedAt: now.getTime() });
  }

  if (r.checkin && r.lastCheckin !== today && r.checkin <= hm) {
    const open = await db.tasks.filter((t) => !t.done && (!t.due || t.due <= today)).count();
    const logged = await db.checkins.where('date').equals(today).count();
    const body = logged ? `You logged ${logged} action${logged === 1 ? '' : 's'} today. Anything else?` : 'How did today go? Tell me what you did.';
    if (await show('Daily check-in', open ? `${body} ${open} task${open === 1 ? '' : 's'} still open.` : body, 'checkin', './#/chat')) {
      fired.push('checkin');
      await db.settings.update('settings', { 'reminders.lastCheckin': today } as never); // nested update: no clobbering other settings
    }
  }
}

let timer: ReturnType<typeof setInterval> | undefined;
const runTick = () => void tick().catch(() => {});
export function startScheduler() {
  if (timer) return;
  runTick();
  timer = setInterval(runTick, 30_000);
  document.addEventListener('visibilitychange', runTick);
}
export function stopScheduler() {
  if (!timer) return;
  clearInterval(timer);
  timer = undefined;
  document.removeEventListener('visibilitychange', runTick);
}

/** Ask Chrome to wake the service worker about daily (installed PWA only; silently skipped elsewhere). */
export async function registerBackgroundCheck(on: boolean) {
  try {
    const reg = (await navigator.serviceWorker?.ready) as ServiceWorkerRegistration & { periodicSync?: { register(tag: string, o: { minInterval: number }): Promise<void>; unregister(tag: string): Promise<void> } };
    if (!reg?.periodicSync) return false;
    if (!on) { await reg.periodicSync.unregister('yourself-daily'); return true; }
    const st = await navigator.permissions.query({ name: 'periodic-background-sync' as PermissionName });
    if (st.state !== 'granted') return false;
    await reg.periodicSync.register('yourself-daily', { minInterval: 12 * 3600e3 });
    return true;
  } catch {
    return false;
  }
}
