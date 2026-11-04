import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { db, DEFAULT_SETTINGS } from './db';
import { computeStats } from './stats';
import type { Page, Settings } from './types';
import { addDays, ymd } from './util';
import * as engine from '../ai/engine';

/* ---------- Route = URL state (#/page?key=value) ---------- */
export interface Route { page: Page; params: URLSearchParams }
const PAGES: Page[] = ['today', 'chart', 'notes', 'chat', 'settings'];

function parseHash(): Route {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, q = ''] = h.split('?');
  const page = (PAGES.includes(path as Page) ? path : 'today') as Page;
  return { page, params: new URLSearchParams(q) };
}
const routeListeners = new Set<() => void>();
let current = parseHash();
window.addEventListener('hashchange', () => {
  current = parseHash();
  routeListeners.forEach((l) => l());
});
export function useRoute(): Route {
  return useSyncExternalStore(
    (l) => (routeListeners.add(l), () => void routeListeners.delete(l)),
    () => current,
  );
}
export function navigate(page: Page, params?: Record<string, string | number | undefined>, replace = false) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined && v !== '') q.set(k, String(v));
  const hash = `#/${page}${q.toString() ? `?${q}` : ''}`;
  if (location.hash === hash) return;
  const go = () => (replace ? history.replaceState(null, '', hash) : history.pushState(null, '', hash));
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const apply = () => {
    go();
    current = parseHash();
    routeListeners.forEach((l) => l());
  };
  if (doc.startViewTransition && !reduce && page !== current.page) doc.startViewTransition(apply);
  else apply();
}

/* ---------- Data ---------- */
export function useSettings(): Settings | undefined {
  return useLiveQuery(async () => (await db.settings.get('settings')) ?? DEFAULT_SETTINGS);
}

export function useToday(): string {
  const [today, setToday] = useState(ymd());
  useEffect(() => {
    const id = setInterval(() => setToday(ymd()), 60_000);
    const vis = () => setToday(ymd());
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);
  return today;
}

export function useChart() {
  const today = useToday();
  const data = useLiveQuery(async () => {
    const since = addDays(today, -400); // long window so streaks aren't capped
    const [goal, pillars, actions, checkins, tasks] = await Promise.all([
      db.goal.get('goal'),
      db.pillars.toArray(),
      db.actions.toArray(),
      db.checkins.where('date').aboveOrEqual(since).toArray(),
      db.tasks.toArray(),
    ]);
    return { goal, pillars, actions, checkins, tasks };
  }, [today]);
  const stats = useMemo(
    () => (data ? computeStats(data.pillars, data.actions, data.checkins, data.tasks, today) : undefined),
    [data, today],
  );
  return { data, stats, today };
}

/* ---------- Theme ---------- */
export function useTheme(pref: Settings['theme'] | undefined) {
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    if (!pref) return; // settings not loaded yet: keep the theme the inline script set
    const apply = () => {
      const p = pref;
      const dark = p === 'dark' || (p === 'system' && mq.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#12100e' : '#e7e1d8');
      try { localStorage.setItem('theme', p); } catch { /* private mode */ }
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [pref]);
}

/* ---------- AI engine status ---------- */
export function useEngine() {
  return useSyncExternalStore(engine.subscribe, engine.getStatus);
}
