import { describe, expect, it } from 'vitest';
import cases from '../../src/ai/eval-cases.json';
import { score, summary, type EvalCase } from '../../src/ai/eval';
import { parseFallback, type FallbackContext } from '../../src/ai/fallback';
import { COMMAND_TYPES } from '../../src/lib/commands';
import { STARTER } from '../../src/lib/seed';

const TODAY = '2026-11-04'; // a Wednesday
/** Regression floor: the measured pass rate rounded down to the nearest 5%. */
const FLOOR = 0.85;

const evalCases = cases as EvalCase[];

function ctxFor(tc: EvalCase): FallbackContext {
  return {
    pillars: STARTER.map((b) => b.pillar),
    actions: STARTER.flatMap((b) => b.actions.map((a) => ({ title: a, pillar: b.pillar }))),
    tasks: [
      ...(tc.setup?.tasks ?? []).map((title) => ({ title, done: false })),
      ...(tc.setup?.doneTasks ?? []).map((title) => ({ title, done: true })),
    ],
    notes: tc.setup?.notes ?? [],
  };
}

describe('eval-cases.json', () => {
  it('is well formed', () => {
    expect(evalCases.length).toBeGreaterThanOrEqual(60);
    const ids = evalCases.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of evalCases) {
      expect(c.message.trim(), c.id).not.toBe('');
      for (const e of c.expect) expect(COMMAND_TYPES as readonly string[], c.id).toContain(e.type);
      for (const t of c.forbid ?? []) expect(COMMAND_TYPES as readonly string[], c.id).toContain(t);
    }
  });
});

describe('offline parser vs eval set', () => {
  it('meets the regression floor', () => {
    const scores = evalCases.map((tc) => score(tc, parseFallback(tc.message, ctxFor(tc)).commands, TODAY));
    const { passed, total, rate } = summary(scores);
    const byId = new Map(evalCases.map((c) => [c.id, c]));
    const failures = scores
      .filter((s) => !s.pass)
      .map((s) => ({
        id: s.id,
        message: byId.get(s.id)!.message,
        missing: JSON.stringify(s.missing),
        forbidden: s.forbidden.join(','),
        got: JSON.stringify(s.got),
      }));
    console.log(`fallback eval: ${passed}/${total} = ${(rate * 100).toFixed(1)}% (floor ${FLOOR * 100}%)`);
    if (failures.length) console.table(failures);
    expect(rate).toBeGreaterThanOrEqual(FLOOR);
  });
});
