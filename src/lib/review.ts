import { pct, type ChartStats } from './stats';

/** Plain-words summary, always available (no model needed). */
export function summarize(cur: ChartStats, prev: ChartStats, days: number): string {
  const ps = cur.pillars.filter(Boolean).map((p, i) => ({ p: p!, prev: prev.pillars.find((x) => x?.pillar.id === p!.pillar.id)?.score ?? 0, i }));
  if (!ps.length) return 'Add pillars to your chart to see how your week is going.';
  if (cur.checkinsThisWeek === 0) return `No actions logged in the last ${days} days. Pick one small action today; that’s how it starts.`;
  const best = [...ps].sort((a, b) => b.p.score - a.p.score)[0];
  const worst = [...ps].sort((a, b) => a.p.score - b.p.score)[0];
  const riser = [...ps].sort((a, b) => b.p.score - b.prev - (a.p.score - a.prev))[0];
  const parts = [`${best.p.pillar.title} is your strongest pillar at ${pct(best.p.score)}.`];
  if (riser.p.score - riser.prev > 0.05 && riser !== best) parts.push(`${riser.p.pillar.title} improved the most.`);
  if (worst !== best) parts.push(`${worst.p.pillar.title} needs the most love (${pct(worst.p.score)}).`);
  const diff = cur.checkinsThisWeek - cur.checkinsLastWeek;
  parts.push(diff > 0 ? `You logged ${diff} more actions than the period before.` : diff < 0 ? `That’s ${-diff} fewer actions than the period before.` : 'Same number of actions as the period before.');
  return parts.join(' ');
}
