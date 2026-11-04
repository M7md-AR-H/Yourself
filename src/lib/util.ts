export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

/** Local calendar date as YYYY-MM-DD. */
export function ymd(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return ymd(dt);
}

export const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Fuzzy score 0..1 between a query and a candidate label.
 * Exact = 1, substring = 0.85, otherwise token overlap.
 */
export function similarity(query: string, label: string): number {
  const q = normalize(query);
  const l = normalize(label);
  if (!q || !l) return 0;
  if (q === l) return 1;
  if (l.includes(q) || q.includes(l)) return 0.85;
  const qt = new Set(q.split(' ').filter((t) => t.length > 1));
  const lt = new Set(l.split(' ').filter((t) => t.length > 1));
  if (!qt.size || !lt.size) return 0;
  let hit = 0;
  for (const t of qt) {
    if (lt.has(t)) hit++;
    else if ([...lt].some((x) => x.startsWith(t) || t.startsWith(x))) hit += 0.6;
  }
  return (hit / Math.max(qt.size, lt.size)) * 0.8;
}

export function bestMatch<T>(query: string, items: T[], label: (t: T) => string, min = 0.4): T | undefined {
  let best: T | undefined;
  let score = min;
  for (const it of items) {
    const s = similarity(query, label(it));
    if (s > score) {
      score = s;
      best = it;
    }
  }
  return best;
}

export function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function formatDue(due: string | undefined, today = ymd()): string | undefined {
  if (!due) return undefined;
  if (due === today) return 'Today';
  if (due === addDays(today, 1)) return 'Tomorrow';
  if (due === addDays(today, -1)) return 'Yesterday';
  const [y, m, d] = due.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}
