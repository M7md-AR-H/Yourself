/**
 * AI eval: message → expected commands, scored the same way for the offline parser
 * (in vitest) and for Gemma (on the phone, from Settings → AI test).
 */
import { resolveDate, type Command } from '../lib/commands';
import { normalize, similarity } from '../lib/util';

export interface EvalCase {
  id: string;
  message: string;
  /** Extra state on top of the starter chart. */
  setup?: { tasks?: string[]; doneTasks?: string[]; notes?: string[] };
  /** Every one of these must appear (same type + matching fields). Field values are matched loosely. */
  expect: Partial<Record<string, string | number>>[];
  /** Command types that must NOT appear (e.g. no delete when the user only talked). */
  forbid?: string[];
  tags?: string[];
}

export interface EvalScore {
  id: string;
  pass: boolean;
  missing: Partial<Record<string, string | number>>[];
  forbidden: string[];
  got: Command[];
}

const DESTRUCTIVE = ['delete_task', 'delete_note', 'remove_action', 'clear_done_tasks'];
const DATE_FIELDS = new Set(['due', 'date']);

function fieldMatches(key: string, want: string | number, got: unknown, today: string): boolean {
  if (got === undefined || got === null) return false;
  if (typeof want === 'number' || typeof got === 'number') return String(want) === String(got);
  if (DATE_FIELDS.has(key)) {
    const past = key === 'date';
    return (resolveDate(want, today, past) ?? want) === (resolveDate(String(got), today, past) ?? got);
  }
  const w = normalize(want), g = normalize(String(got));
  return g.includes(w) || w.includes(g) || similarity(w, g) >= 0.6;
}

export function matches(want: Partial<Record<string, string | number>>, c: Command, today: string): boolean {
  if (want.type !== c.type) return false;
  const rec = c as unknown as Record<string, unknown>;
  return Object.entries(want).every(([k, v]) => k === 'type' || v === undefined || fieldMatches(k, v, rec[k], today));
}

export function score(tc: EvalCase, got: Command[], today: string): EvalScore {
  const used = new Set<number>();
  const missing = tc.expect.filter((w) => {
    const i = got.findIndex((c, j) => !used.has(j) && matches(w, c, today));
    if (i < 0) return true;
    used.add(i);
    return false;
  });
  const forbidList = new Set([...(tc.forbid ?? []), ...DESTRUCTIVE.filter((t) => !tc.expect.some((e) => e.type === t))]);
  const forbidden = got.map((c) => c.type).filter((t) => forbidList.has(t));
  return { id: tc.id, pass: !missing.length && !forbidden.length, missing, forbidden, got };
}

export function summary(scores: EvalScore[]) {
  const passed = scores.filter((s) => s.pass).length;
  return { passed, total: scores.length, rate: scores.length ? passed / scores.length : 0 };
}
