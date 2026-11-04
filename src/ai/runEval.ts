/**
 * Runs the eval set on the device (Settings → Test the assistant).
 * Uses a separate, throw-away database so the user's data is never touched.
 */
import { runCommands } from '../lib/commands';
import { YourselfDB } from '../lib/db';
import { starterCommands } from '../lib/seed';
import { uid, ymd } from '../lib/util';
import { gatherContext } from './agent';
import * as engine from './engine';
import { score, summary, type EvalCase, type EvalScore } from './eval';
import { parseFallback } from './fallback';
import { buildPrompt } from './prompt';
import { parseModelOutput } from './schema';

export interface EvalRun {
  engine: string;
  scores: (EvalScore & { ms: number; message: string; raw?: string })[];
  passed: number;
  total: number;
  avgMs: number;
}

export async function loadCases(): Promise<EvalCase[]> {
  return (await import('./eval-cases.json')).default as EvalCase[];
}

export async function runEval(onProgress: (done: number, total: number) => void, signal?: AbortSignal): Promise<EvalRun> {
  const cases = await loadCases();
  const today = ymd();
  const d = new YourselfDB('yourself-eval');
  const useModel = engine.isReady();
  const st = engine.getStatus();
  const scores: EvalRun['scores'] = [];
  try {
    for (let i = 0; i < cases.length; i++) {
      if (signal?.aborted) break;
      const tc = cases[i];
      await Promise.all([d.goal, d.pillars, d.actions, d.checkins, d.tasks, d.notes, d.chat].map((t) => t.clear()));
      await runCommands(starterCommands(), d, today);
      const now = Date.now();
      await d.tasks.bulkPut([
        ...(tc.setup?.tasks ?? []).map((title, k) => ({ id: uid(), title, done: false, createdAt: now - k, updatedAt: now })),
        ...(tc.setup?.doneTasks ?? []).map((title, k) => ({ id: uid(), title, done: true, doneAt: now, createdAt: now - 100 - k, updatedAt: now })),
      ]);
      await d.notes.bulkPut((tc.setup?.notes ?? []).map((text, k) => ({ id: uid(), text, source: 'manual' as const, createdAt: now - k, updatedAt: now })));
      const ctx = await gatherContext(d, today);
      const t0 = performance.now();
      let got;
      let raw: string | undefined;
      if (useModel) {
        raw = await engine.complete(buildPrompt(tc.message, { ...ctx, name: 'Sam', today }), signal);
        got = parseModelOutput(raw)?.commands ?? [];
      } else {
        const pillarName = new Map(ctx.pillars.map((p) => [p.id, p.title]));
        got = parseFallback(tc.message, {
          pillars: ctx.pillars.filter((p) => p.title).sort((a, b) => a.index - b.index).map((p) => p.title),
          actions: ctx.actions.filter((a) => a.title).map((a) => ({ title: a.title, pillar: pillarName.get(a.pillarId) ?? '' })),
          tasks: ctx.tasks.map((t) => ({ title: t.title, done: t.done })),
          notes: ctx.notes.map((n) => n.text),
        }).commands;
      }
      scores.push({ ...score(tc, got, today), ms: Math.round(performance.now() - t0), message: tc.message, raw: raw?.slice(0, 600) });
      onProgress(i + 1, cases.length);
    }
  } finally {
    d.close();
    await YourselfDB.delete('yourself-eval').catch(() => {});
  }
  const s = summary(scores);
  return {
    engine: useModel && st.state === 'ready' ? st.model : 'offline helper',
    scores,
    passed: s.passed,
    total: s.total,
    avgMs: scores.length ? Math.round(scores.reduce((a, x) => a + x.ms, 0) / scores.length) : 0,
  };
}

/** Compact text the owner can paste back to the developer. */
export function report(r: EvalRun): string {
  const fails = r.scores.filter((s) => !s.pass).map((s) =>
    `- ${s.id} "${s.message}" missing=${JSON.stringify(s.missing)} forbidden=${JSON.stringify(s.forbidden)} got=${JSON.stringify(s.got)}${s.raw ? ` raw=${JSON.stringify(s.raw)}` : ''}`);
  return [`Yourself AI test · ${r.engine} · ${new Date().toISOString()}`, `${r.passed}/${r.total} passed · avg ${r.avgMs} ms`, `UA: ${navigator.userAgent}`, ...fails].join('\n');
}
