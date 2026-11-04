import type { Action, CheckIn, Pillar, Task } from './types';
import { addDays, ymd } from './util';

/** How many days back the chart looks when it scores an action. */
export const WINDOW_DAYS = 7;

export interface ActionStat {
  action: Action;
  /** 0..1 share of the last WINDOW_DAYS days the action was done. */
  score: number;
  doneToday: boolean;
  streak: number;
  days: boolean[]; // oldest → today
}

export interface PillarStat {
  pillar: Pillar;
  score: number; // average of its actions (0 when none)
  actions: (ActionStat | undefined)[]; // 8 slots
  openTasks: number;
}

export interface ChartStats {
  overall: number;
  pillars: (PillarStat | undefined)[]; // 8 slots
  checkinsThisWeek: number;
  checkinsLastWeek: number;
  doneTasksThisWeek: number;
}

export function computeStats(
  pillars: Pillar[],
  actions: Action[],
  checkins: CheckIn[],
  tasks: Task[],
  today = ymd(),
  windowDays = WINDOW_DAYS,
): ChartStats {
  const W = windowDays;
  const windowDates = Array.from({ length: W }, (_, i) => addDays(today, i - (W - 1)));
  const byAction = new Map<string, Set<string>>();
  for (const c of checkins) {
    if (!byAction.has(c.actionId)) byAction.set(c.actionId, new Set());
    byAction.get(c.actionId)!.add(c.date);
  }
  const weekStart = windowDates[0];
  const lastWeekStart = addDays(weekStart, -W);
  let thisWeek = 0;
  let lastWeek = 0;
  for (const c of checkins) {
    if (c.date >= weekStart && c.date <= today) thisWeek++;
    else if (c.date >= lastWeekStart && c.date < weekStart) lastWeek++;
  }

  const slots: (PillarStat | undefined)[] = Array(8).fill(undefined);
  for (const p of pillars) {
    if (p.index < 0 || p.index > 7 || !p.title) continue;
    const aSlots: (ActionStat | undefined)[] = Array(8).fill(undefined);
    for (const a of actions) {
      if (a.pillarId !== p.id || !a.title || a.index < 0 || a.index > 7) continue;
      const set = byAction.get(a.id) ?? new Set<string>();
      const days = windowDates.map((d) => set.has(d));
      let streak = 0;
      for (let d = set.has(today) ? today : addDays(today, -1); set.has(d); d = addDays(d, -1)) streak++;
      aSlots[a.index] = { action: a, score: days.filter(Boolean).length / W, doneToday: set.has(today), streak, days };
    }
    const filled = aSlots.filter(Boolean) as ActionStat[];
    slots[p.index] = {
      pillar: p,
      score: filled.length ? filled.reduce((s, a) => s + a.score, 0) / filled.length : 0,
      actions: aSlots,
      openTasks: tasks.filter((t) => !t.done && t.pillarId === p.id).length,
    };
  }
  const filledP = slots.filter(Boolean) as PillarStat[];
  const weekStartMs = new Date(weekStart + 'T00:00:00').getTime();
  return {
    overall: filledP.length ? filledP.reduce((s, p) => s + p.score, 0) / filledP.length : 0,
    pillars: slots,
    checkinsThisWeek: thisWeek,
    checkinsLastWeek: lastWeek,
    doneTasksThisWeek: tasks.filter((t) => t.done && (t.doneAt ?? 0) >= weekStartMs && (t.doneAt ?? 0) < weekStartMs + W * 864e5 + 36e5).length,
  };
}

export const pct = (n: number) => `${Math.round(n * 100)}%`;
