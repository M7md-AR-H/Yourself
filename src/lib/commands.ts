/**
 * The single command vocabulary of the app.
 * Both the UI and the local AI change data ONLY through these commands, so:
 *  - the AI can do everything the UI can do,
 *  - every change (from either side) can be undone the same way.
 */
import { db as defaultDb, type TableName, type YourselfDB, DEFAULT_SETTINGS } from './db';
import type { Action, Note, Page, Pillar, Task, ThemePref } from './types';
import { addDays, bestMatch, formatDue, normalize, uid, ymd } from './util';
import { findHelp, HELP } from './help';

/** A pillar ref is its name ("sleep") or its 1-based slot number (1..8). */
export type PillarRef = string | number;

export type Command =
  | { type: 'set_name'; name: string }
  | { type: 'set_goal'; title: string }
  | { type: 'set_pillar'; pillar: PillarRef; title: string }
  | { type: 'set_action'; pillar: PillarRef; title: string; slot?: number; replace?: string }
  | { type: 'remove_action'; action: string; pillar?: PillarRef; id?: string }
  | { type: 'check_in'; action: string; date?: string; id?: string }
  | { type: 'uncheck'; action: string; date?: string; id?: string }
  | { type: 'add_task'; title: string; due?: string; time?: string; pillar?: PillarRef }
  | { type: 'complete_task'; task: string; id?: string }
  | { type: 'reopen_task'; task: string; id?: string }
  | { type: 'edit_task'; task: string; title?: string; due?: string; time?: string; id?: string }
  | { type: 'delete_task'; task: string; id?: string }
  | { type: 'clear_done_tasks' }
  | { type: 'add_note'; text: string; pillar?: PillarRef }
  | { type: 'edit_note'; note: string; text: string; id?: string }
  | { type: 'delete_note'; note: string; id?: string }
  | { type: 'navigate'; page: Page; pillar?: PillarRef; section?: string }
  | { type: 'set_theme'; theme: ThemePref }
  | { type: 'set_reminders'; enabled?: boolean; checkin?: string };

export const COMMAND_TYPES = [
  'set_name', 'set_goal', 'set_pillar', 'set_action', 'remove_action', 'check_in', 'uncheck',
  'add_task', 'complete_task', 'reopen_task', 'edit_task', 'delete_task', 'clear_done_tasks',
  'add_note', 'edit_note', 'delete_note', 'navigate', 'set_theme', 'set_reminders',
] as const;

export interface JournalEntry {
  table: TableName;
  key: string;
  before: unknown | undefined;
}

export interface RunResult {
  effects: string[];
  errors: string[];
  journal: JournalEntry[];
  navigate?: { page: Page; pillarIndex?: number; section?: string };
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** Turns "today", "tomorrow", "friday", "in 3 days", "2026-11-05" into YYYY-MM-DD. */
export function resolveDate(input: string | undefined, today = ymd(), past = false): string | undefined {
  if (!input) return undefined;
  const s = normalize(input);
  if (!s || s === 'none' || s === 'null') return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
    const [y, m, d] = input.trim().split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? input.trim() : undefined;
  }
  if (s === 'last night') return past ? addDays(today, -1) : undefined;
  if (s === 'today' || s === 'tonight' || s === 'now') return today;
  if (s === 'tomorrow' || s === 'tmrw' || s === 'tmr') return addDays(today, 1);
  if (s === 'yesterday') return addDays(today, -1);
  const inN = s.match(/^in (\d+) (day|days|week|weeks)$/);
  if (inN) return addDays(today, Number(inN[1]) * (inN[2].startsWith('week') ? 7 : 1));
  if (s === 'next week') return addDays(today, 7);
  const wd = WEEKDAYS.findIndex((w) => s === w || s === `next ${w}` || s === `this ${w}` || s === w.slice(0, 3));
  if (wd >= 0) {
    const [y, m, d] = today.split('-').map(Number);
    const cur = new Date(y, m - 1, d).getDay();
    if (past) return addDays(today, -((cur - wd + 7) % 7)); // "I ran on monday" → the last monday (or today)
    let diff = (wd - cur + 7) % 7;
    if (diff === 0 || s.startsWith('next ')) diff = diff === 0 ? 7 : diff;
    return addDays(today, diff);
  }
  return undefined;
}

/** "5pm", "17:30", "5:30 pm", "noon", "morning" → "HH:MM" (24h). */
export function resolveTime(input: string | undefined): string | undefined {
  if (!input) return undefined;
  const s = input.trim().toLowerCase().replace(/(\d)\.(\d)/, '$1:$2').replace(/\./g, '');
  const named: Record<string, string> = { noon: '12:00', midday: '12:00', midnight: '00:00', morning: '09:00', afternoon: '15:00', evening: '19:00', tonight: '20:00', night: '21:00' };
  if (named[s]) return named[s];
  const m = s.match(/^(?:at\s+)?(\d{1,2})(?:[:h](\d{2}))?\s*(am|pm|a|p)?$/);
  if (!m) return undefined;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const ap = m[3]?.[0];
  if (min > 59 || h > 23 || (ap && (h < 1 || h > 12))) return undefined;
  if (!m[2] && !ap && h < 7) h += 12; // "at 5" most likely means 5pm
  if (ap === 'p' && h < 12) h += 12;
  if (ap === 'a' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export const formatTime = (t: string | undefined) => {
  if (!t) return undefined;
  const [h, m] = t.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};

export class Runner {
  journal: JournalEntry[] = [];
  effects: string[] = [];
  errors: string[] = [];
  navigate?: RunResult['navigate'];
  private touched = new Set<string>();
  private d: YourselfDB;
  private today: string;
  constructor(d: YourselfDB, today: string) {
    this.d = d;
    this.today = today;
  }

  private async remember(table: TableName, key: string) {
    const tag = `${table}:${key}`;
    if (this.touched.has(tag)) return;
    this.touched.add(tag);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const before = await (this.d[table] as any).get(key);
    this.journal.push({ table, key, before });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async put(table: TableName, row: any) {
    await this.remember(table, row.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (this.d[table] as any).put(row);
  }
  private async del(table: TableName, key: string) {
    await this.remember(table, key);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (this.d[table] as any).delete(key);
  }

  private async findPillar(ref: PillarRef | undefined): Promise<Pillar | undefined> {
    if (ref === undefined || ref === null || ref === '') return undefined;
    const pillars = await this.d.pillars.toArray();
    const n = typeof ref === 'number' ? ref : /^\d+$/.test(String(ref).trim()) ? Number(ref) : NaN;
    if (!Number.isNaN(n)) return pillars.find((p) => p.index === n - 1);
    return bestMatch(String(ref), pillars.filter((p) => p.title), (p) => p.title, 0.5);
  }

  private async findAction(name: string, pillar?: PillarRef, id?: string): Promise<Action | undefined> {
    if (id) return this.d.actions.get(id);
    let actions = (await this.d.actions.toArray()).filter((a) => a.title);
    const p = await this.findPillar(pillar);
    if (p) actions = actions.filter((a) => a.pillarId === p.id);
    return bestMatch(name, actions, (a) => a.title, 0.45);
  }

  private async findTask(q: string, openOnly?: boolean, id?: string): Promise<Task | undefined> {
    if (id) return this.d.tasks.get(id);
    let tasks = await this.d.tasks.toArray();
    if (openOnly !== undefined) {
      const pref = tasks.filter((t) => t.done !== openOnly);
      const m = bestMatch(q, pref, (t) => t.title, 0.4);
      if (m) return m;
    }
    tasks = tasks.sort((a, b) => b.createdAt - a.createdAt);
    return bestMatch(q, tasks, (t) => t.title, 0.4);
  }

  private async findNote(q: string, id?: string): Promise<Note | undefined> {
    if (id) return this.d.notes.get(id);
    const notes = (await this.d.notes.toArray()).sort((a, b) => b.createdAt - a.createdAt);
    if (/^(last|latest|that|it|previous)( note)?$/.test(normalize(q))) return notes[0];
    return bestMatch(q, notes, (n) => n.text, 0.3);
  }

  async run(c: Command): Promise<void> {
    const now = Date.now();
    const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
    switch (c.type) {
      case 'set_name': {
        const name = str(c.name);
        if (!name) return void this.errors.push('No name given.');
        const s = (await this.d.settings.get('settings')) ?? DEFAULT_SETTINGS;
        await this.put('settings', { ...s, name });
        this.effects.push(`Name set to “${name}”`);
        return;
      }
      case 'set_goal': {
        const title = str(c.title);
        if (!title) return void this.errors.push('No goal given.');
        await this.put('goal', { id: 'goal', title, updatedAt: now });
        this.effects.push(`Main goal: “${title}”`);
        return;
      }
      case 'set_pillar': {
        const title = str(c.title);
        if (!title) return void this.errors.push('No pillar name given.');
        let p = await this.findPillar(c.pillar);
        const slotN = typeof c.pillar === 'number' ? c.pillar : /^[1-8]$/.test(String(c.pillar).trim()) ? Number(c.pillar) : NaN;
        if (!p && slotN >= 1 && slotN <= 8) p = { id: uid(), index: slotN - 1, title: '', updatedAt: now };
        if (!p) {
          const pillars = await this.d.pillars.toArray();
          const used = new Set(pillars.filter((x) => x.title).map((x) => x.index));
          const free = [0, 1, 2, 3, 4, 5, 6, 7].find((i) => !used.has(i));
          if (free === undefined) return void this.errors.push(`Couldn’t find pillar “${c.pillar}”.`);
          p = pillars.find((x) => x.index === free) ?? { id: uid(), index: free, title: '', updatedAt: now };
        }
        const old = p.title;
        await this.put('pillars', { ...p, title, updatedAt: now });
        this.effects.push(old ? `Renamed “${old}” → “${title}”` : `Added pillar “${title}”`);
        return;
      }
      case 'set_action': {
        const title = str(c.title);
        const p = await this.findPillar(c.pillar);
        if (!p) return void this.errors.push(`Couldn’t find pillar “${c.pillar}”.`);
        if (!title) return void this.errors.push('No action given.');
        const actions = await this.d.actions.where('pillarId').equals(p.id).toArray();
        let target: Action | undefined;
        if (c.replace) target = bestMatch(c.replace, actions, (a) => a.title, 0.45);
        if (!target && c.slot && Number.isInteger(c.slot) && c.slot >= 1 && c.slot <= 8) target = actions.find((a) => a.index === c.slot! - 1) ?? { id: uid(), pillarId: p.id, index: c.slot - 1, title: '', updatedAt: now };
        if (!target) {
          if (actions.some((a) => normalize(a.title) === normalize(title))) return void this.effects.push(`“${title}” is already in ${p.title}`);
          const used = new Set(actions.filter((a) => a.title).map((a) => a.index));
          const free = [0, 1, 2, 3, 4, 5, 6, 7].find((i) => !used.has(i));
          if (free === undefined) return void this.errors.push(`${p.title} already has 8 actions. Say which one to replace.`);
          target = actions.find((a) => a.index === free) ?? { id: uid(), pillarId: p.id, index: free, title: '', updatedAt: now };
        }
        const old = target.title;
        await this.put('actions', { ...target, title, updatedAt: now });
        this.effects.push(old ? `${p.title}: “${old}” → “${title}”` : `${p.title}: added “${title}”`);
        return;
      }
      case 'remove_action': {
        const a = await this.findAction(str(c.action), c.pillar, c.id);
        if (!a) return void this.errors.push(`Couldn’t find action “${c.action}”.`);
        await this.del('actions', a.id);
        const checks = await this.d.checkins.where('actionId').equals(a.id).toArray();
        for (const ch of checks) await this.del('checkins', ch.id);
        this.effects.push(`Removed “${a.title}”`);
        return;
      }
      case 'check_in':
      case 'uncheck': {
        const a = await this.findAction(str(c.action), undefined, c.id);
        if (!a) return void this.errors.push(`Couldn’t find “${c.action}” in your chart.`);
        const date = resolveDate(c.date, this.today, true) ?? this.today;
        if (date > this.today) return void this.errors.push('I can only log things you already did.');
        const id = `${a.id}:${date}`;
        if (c.type === 'check_in') {
          if (await this.d.checkins.get(id)) return void this.effects.push(`“${a.title}” was already logged`);
          await this.put('checkins', { id, actionId: a.id, date, createdAt: now });
          this.effects.push(`Logged “${a.title}”${date === this.today ? '' : ` for ${date}`}`);
        } else {
          if (!(await this.d.checkins.get(id))) return;
          await this.del('checkins', id);
          this.effects.push(`Unlogged “${a.title}”`);
        }
        return;
      }
      case 'add_task': {
        const raw = str(c.title);
        const title = raw.charAt(0).toUpperCase() + raw.slice(1);
        if (!title) return void this.errors.push('No task given.');
        const p = await this.findPillar(c.pillar);
        const time = resolveTime(c.time);
        const t: Task = { id: uid(), title, due: resolveDate(c.due, this.today) ?? (time ? this.today : undefined), time, done: false, pillarId: p?.id, createdAt: now, updatedAt: now };
        await this.put('tasks', t);
        this.effects.push(`Task: “${title}”${t.due ? ` · ${formatDue(t.due, this.today)}` : ''}${time ? ` ${formatTime(time)}` : ''}`);
        return;
      }
      case 'complete_task':
      case 'reopen_task': {
        const done = c.type === 'complete_task';
        const t = await this.findTask(str(c.task), done, c.id);
        if (!t) return void this.errors.push(`Couldn’t find task “${c.task}”.`);
        await this.put('tasks', { ...t, done, doneAt: done ? now : undefined, updatedAt: now });
        this.effects.push(done ? `Done: “${t.title}”` : `Reopened “${t.title}”`);
        return;
      }
      case 'edit_task': {
        const t = await this.findTask(str(c.task), undefined, c.id);
        if (!t) return void this.errors.push(`Couldn’t find task “${c.task}”.`);
        const title = str(c.title) || t.title;
        const due = c.due !== undefined ? resolveDate(c.due, this.today) : t.due;
        const time = c.time !== undefined ? resolveTime(c.time) : t.time;
        const moved = due !== t.due || time !== t.time;
        await this.put('tasks', { ...t, title, due: due ?? (time ? this.today : undefined), time, notifiedAt: moved ? undefined : t.notifiedAt, updatedAt: now });
        this.effects.push(`Updated “${title}”`);
        return;
      }
      case 'delete_task': {
        const t = await this.findTask(str(c.task), undefined, c.id);
        if (!t) return void this.errors.push(`Couldn’t find task “${c.task}”.`);
        await this.del('tasks', t.id);
        this.effects.push(`Deleted “${t.title}”`);
        return;
      }
      case 'clear_done_tasks': {
        const done = await this.d.tasks.filter((t) => t.done).toArray();
        for (const t of done) await this.del('tasks', t.id);
        this.effects.push(`Cleared ${done.length} done task${done.length === 1 ? '' : 's'}`);
        return;
      }
      case 'add_note': {
        const text = str(c.text);
        if (!text) return void this.errors.push('Empty note.');
        const p = await this.findPillar(c.pillar);
        await this.put('notes', { id: uid(), text, pillarId: p?.id, source: 'chat', createdAt: now, updatedAt: now });
        this.effects.push(`Note saved${p ? ` in ${p.title}` : ''}`);
        return;
      }
      case 'edit_note': {
        const n = await this.findNote(str(c.note), c.id);
        if (!n) return void this.errors.push(`Couldn’t find that note.`);
        await this.put('notes', { ...n, text: str(c.text) || n.text, updatedAt: now });
        this.effects.push('Note updated');
        return;
      }
      case 'delete_note': {
        const n = await this.findNote(str(c.note), c.id);
        if (!n) return void this.errors.push(`Couldn’t find that note.`);
        await this.del('notes', n.id);
        this.effects.push('Note deleted');
        return;
      }
      case 'navigate': {
        const pages: Page[] = ['today', 'chart', 'review', 'notes', 'chat', 'settings', 'help'];
        if (!pages.includes(c.page)) return void this.errors.push(`Unknown page “${c.page}”.`);
        const p = await this.findPillar(c.pillar);
        const section = c.page === 'help' && c.section ? (HELP.find((h) => h.id === c.section)?.id ?? findHelp(c.section)?.id) : undefined;
        this.navigate = { page: c.page, pillarIndex: c.page === 'chart' ? p?.index : undefined, section };
        return;
      }
      case 'set_theme': {
        if (!['system', 'light', 'dark'].includes(c.theme)) return void this.errors.push('Theme must be light, dark or system.');
        const s = (await this.d.settings.get('settings')) ?? DEFAULT_SETTINGS;
        await this.put('settings', { ...s, theme: c.theme });
        this.effects.push(`Theme: ${c.theme}`);
        return;
      }
      case 'set_reminders': {
        const s = (await this.d.settings.get('settings')) ?? DEFAULT_SETTINGS;
        const cur = s.reminders ?? { enabled: false };
        const off = typeof c.checkin === 'string' && /^(off|none|no|stop|disable)$/i.test(c.checkin.trim());
        const checkin = c.checkin === undefined ? cur.checkin : off ? undefined : resolveTime(c.checkin) ?? cur.checkin;
        const enabled = c.enabled ?? (checkin ? true : cur.enabled);
        await this.put('settings', { ...s, reminders: { ...cur, enabled, checkin } });
        this.effects.push(enabled ? `Reminders on${checkin ? ` · daily check-in ${formatTime(checkin)}` : ''}` : 'Reminders off');
        return;
      }
      default: {
        this.errors.push(`Unknown command “${(c as { type: string }).type}”.`);
      }
    }
  }
}

/** Runs commands atomically. Bad commands are skipped and reported, good ones still apply. */
export async function runCommands(commands: Command[], d: YourselfDB = defaultDb, today = ymd()): Promise<RunResult> {
  const r = new Runner(d, today);
  await d.transaction('rw', [d.goal, d.pillars, d.actions, d.checkins, d.tasks, d.notes, d.settings], async () => {
    for (const c of commands) {
      if (!c || typeof c !== 'object' || !('type' in c)) continue;
      await r.run(c);
    }
  });
  return { effects: r.effects, errors: r.errors, journal: r.journal, navigate: r.navigate };
}

/** Reverts a RunResult journal (newest change first). */
export async function undo(journal: JournalEntry[], d: YourselfDB = defaultDb): Promise<void> {
  await d.transaction('rw', [d.goal, d.pillars, d.actions, d.checkins, d.tasks, d.notes, d.settings, d.chat], async () => {
    for (const j of [...journal].reverse()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const t = d[j.table] as any;
      if (j.before === undefined) await t.delete(j.key);
      else await t.put(j.before);
    }
  });
}
