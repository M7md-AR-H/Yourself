import { motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, Minus, Sparkles } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { ask } from '../ai/agent';
import { db } from '../lib/db';
import { navigate, useChart, useEngine, useRoute } from '../lib/hooks';
import { computeStats, pct, type ActionStat } from '../lib/stats';
import { addDays } from '../lib/util';
import { useToast } from '../ui/Toaster';
import { summarize } from '../lib/review';

type Range = 'week' | 'last' | 'month';
const RANGES: { id: Range; label: string; days: number; offset: number }[] = [
  { id: 'week', label: 'This week', days: 7, offset: 0 },
  { id: 'last', label: 'Last week', days: 7, offset: 7 },
  { id: 'month', label: '4 weeks', days: 28, offset: 0 },
];

const fmtDay = (d: string, opts: Intl.DateTimeFormatOptions) => new Date(d + 'T12:00:00').toLocaleDateString(undefined, opts);

function Delta({ now, before, unit = 'pts' }: { now: number; before: number; unit?: string }) {
  const d = Math.round((now - before) * 100);
  const word = d > 0 ? 'up' : d < 0 ? 'down' : 'no change';
  const Icon = d > 0 ? ArrowUpRight : d < 0 ? ArrowDownRight : Minus;
  return (
    <span className={`chip ${d > 0 ? 'up' : d < 0 ? 'down' : ''}`} aria-label={d === 0 ? 'no change vs the period before' : `${word} ${Math.abs(d)} ${unit} vs the period before`}>
      <Icon size={14} aria-hidden />{d > 0 ? '+' : ''}{d} {unit}
    </span>
  );
}

export function Review() {
  const route = useRoute();
  const range = RANGES.find((r) => r.id === route.params.get('range')) ?? RANGES[0];
  const { data, today } = useChart();
  const status = useEngine();
  const { exec } = useToast();
  const [reflection, setReflection] = useState<{ key: string; text: string } | null>(null);
  const [thinking, setThinking] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const notesCount = useLiveQuery(async () => {
    const end = addDays(today, -range.offset);
    const from = new Date(addDays(end, -(range.days - 1)) + 'T00:00:00').getTime();
    const to = new Date(addDays(end, 1) + 'T00:00:00').getTime();
    return db.notes.where('createdAt').between(from, to, true, false).count();
  }, [today, range.id]);

  const end = addDays(today, -range.offset);
  const view = useMemo(() => {
    if (!data) return null;
    const cur = computeStats(data.pillars, data.actions, data.checkins, data.tasks, end, range.days);
    const prev = computeStats(data.pillars, data.actions, data.checkins, data.tasks, addDays(end, -range.days), range.days);
    const dates = Array.from({ length: range.days }, (_, i) => addDays(end, i - (range.days - 1)));
    const live = new Set(data.actions.filter((a) => a.title).map((a) => a.id)); // ignore check-ins of removed actions
    const perDay = dates.map((d) => ({ d, n: data.checkins.filter((c) => c.date === d && live.has(c.actionId)).length }));
    const actions = cur.pillars.flatMap((p) => (p ? p.actions.filter((a): a is ActionStat => !!a).map((a) => ({ a, pillar: p.pillar.title })) : []));
    const top = [...actions].filter((x) => x.a.score > 0).sort((x, y) => y.a.score - x.a.score || y.a.streak - x.a.streak).slice(0, 3);
    const weak = cur.pillars.filter(Boolean).map((p) => p!).sort((a, b) => a.score - b.score).slice(0, 2)
      .map((p) => ({ p, next: p.actions.filter((a): a is ActionStat => !!a).sort((a, b) => a.score - b.score)[0] }));
    return { cur, prev, perDay, top, weak };
  }, [data, end, range.days]);

  if (!view || !data) return <div className="stack-lg" aria-busy="true" aria-label="Loading review">{[200, 160, 280].map((h, i) => <div key={i} className="skel" style={{ height: h, borderRadius: 24 }} />)}</div>;

  const { cur, prev, perDay, top, weak } = view;
  const max = Math.max(1, ...perDay.map((x) => x.n));
  const sel = perDay.find((x) => x.d === picked) ?? null;
  const from = perDay[0].d;
  const pillars = cur.pillars.filter(Boolean).map((p) => ({ p: p!, before: prev.pillars.find((x) => x?.pillar.id === p!.pillar.id)?.score ?? 0 }));
  const key = `${range.id}:${end}`;

  const reflect = async () => {
    if (thinking) return;
    setThinking(true);
    try {
      const r = await ask(
        `Write a short, kind reflection on my last ${range.days} days in 3 sentences: what went well, what slipped, and one small thing to try next. Use the chart numbers. No commands.`,
        { readOnly: true },
      );
      setReflection({ key, text: r.usedModel && r.reply ? r.reply : summarize(cur, prev, range.days) });
    } finally {
      setThinking(false);
    }
  };

  return (
    <div className="stack-lg review-layout">
      <div>
        <h1 className="display h-hero">Your {range.id === 'month' ? 'month' : 'week'}</h1>
        <p className="subtitle tnum">{fmtDay(from, { day: 'numeric', month: 'short' })} – {fmtDay(end, { day: 'numeric', month: 'short' })}</p>
      </div>

      <div className="seg" role="group" aria-label="Period">
        {RANGES.map((r) => (
          <button key={r.id} aria-pressed={r.id === range.id} onClick={() => navigate('review', { range: r.id === 'week' ? undefined : r.id }, true)}>{r.label}</button>
        ))}
      </div>

      <section className="glass card r-score" aria-labelledby="rv-score">
        <div className="between">
          <span className="label" id="rv-score">Overall · {data.goal?.title || 'your goal'}</span>
          <Delta now={cur.overall} before={prev.overall} />
        </div>
        <div className="big-num" style={{ marginTop: 8 }}>{pct(cur.overall)}</div>
        <div className="row" style={{ gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
          <span className="label tnum"><strong style={{ color: 'var(--fg)' }}>{cur.checkinsThisWeek}</strong> action{cur.checkinsThisWeek === 1 ? '' : 's'} logged</span>
          <span className="label tnum"><strong style={{ color: 'var(--fg)' }}>{cur.doneTasksThisWeek}</strong> task{cur.doneTasksThisWeek === 1 ? '' : 's'} done</span>
          <span className="label tnum"><strong style={{ color: 'var(--fg)' }}>{notesCount ?? '–'}</strong> note{notesCount === 1 ? '' : 's'}</span>
        </div>
      </section>

      <section className="glass card stack r-days" aria-labelledby="rv-days">
        <div className="between">
          <h2 className="section-title" id="rv-days">Actions per day</h2>
          <span className="label tnum">{sel ? `${fmtDay(sel.d, { weekday: 'short', day: 'numeric' })}: ${sel.n}` : `Most: ${max === 1 && !perDay.some((x) => x.n) ? 0 : max}`}</span>
        </div>
        <div className="bars" role="group" aria-label="Actions logged per day">
          {perDay.map((x) => (
            <button key={x.d} className={`bar ${x.d === picked ? 'on' : ''}`} aria-pressed={x.d === picked} onClick={() => setPicked(x.d === picked ? null : x.d)}
              aria-label={`${fmtDay(x.d, { weekday: 'long', day: 'numeric', month: 'short' })}: ${x.n} action${x.n === 1 ? '' : 's'}`}>
              <motion.span className="bar-fill" initial={false} animate={{ scaleY: x.n / max }} transition={{ type: 'spring', stiffness: 260, damping: 30 }} />
            </button>
          ))}
        </div>
        {range.days === 7 && (
          <div className="bar-axis" aria-hidden>
            {perDay.map((x) => <span key={x.d}>{fmtDay(x.d, { weekday: 'narrow' })}</span>)}
          </div>
        )}
      </section>

      <section className="glass card stack r-pillars" aria-labelledby="rv-pillars">
        <h2 className="section-title" id="rv-pillars">Pillars</h2>
        {pillars.length === 0 ? <p className="empty">No pillars yet.</p> : (
          <div className="list">
            {[...pillars].sort((a, b) => b.p.score - a.p.score).map(({ p, before }) => (
              <button key={p.pillar.id} className="list-item pillar-row" onClick={() => navigate('chart', { pillar: p.pillar.index + 1 })} aria-label={`${p.pillar.title}: ${pct(p.score)}, was ${pct(before)}. Open block`}>
                <span className="grow">
                  <span className="between"><strong>{p.pillar.title}</strong><span className="row tnum" style={{ gap: 6 }}><span>{pct(p.score)}</span><Delta now={p.score} before={before} /></span></span>
                  <span className="progress" style={{ marginTop: 8, display: 'block' }}><span style={{ transform: `scaleX(${p.score})`, background: 'var(--chart)' }} /></span>
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="bento r-tiles">
        <section className="glass tile" aria-labelledby="rv-top" style={{ justifyContent: 'flex-start' }}>
          <h2 className="label" id="rv-top">Going well</h2>
          {top.length ? top.map(({ a }) => (
            <div key={a.action.id}><div style={{ fontWeight: 700, fontSize: 14 }}>{a.action.title}</div><div className="label tnum">{a.days.filter(Boolean).length}/{range.days} days{a.streak > 1 ? ` · ${a.streak}-day streak` : ''}</div></div>
          )) : <p className="label">Nothing logged yet.</p>}
        </section>
        <section className="glass tile" aria-labelledby="rv-weak" style={{ justifyContent: 'flex-start' }}>
          <h2 className="label" id="rv-weak">Needs love</h2>
          {weak.map(({ p, next }) => (
            <div key={p.pillar.id}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{p.pillar.title} <span className="label tnum">{pct(p.score)}</span></div>
              {next && range.offset === 0 && (
                <div className="between" style={{ marginTop: 4, gap: 8 }}>
                  <span className="label" style={{ minWidth: 0 }}>Try: {next.action.title}</span>
                  <button className="btn btn-light" style={{ height: 32, padding: '0 12px', fontSize: 13, flex: 'none' }} disabled={next.doneToday}
                    aria-label={`Log ${next.action.title} for today`}
                    onClick={() => exec([{ type: 'check_in', action: next.action.title, id: next.action.id }])}>
                    {next.doneToday ? 'Done' : 'Log'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </section>
      </div>

      <section className="glass card stack r-ref" aria-labelledby="rv-ref">
        <div className="between">
          <h2 className="section-title" id="rv-ref">Reflection</h2>
          <button className="btn btn-solid" style={{ height: 40 }} onClick={reflect} disabled={thinking}>
            <Sparkles size={16} aria-hidden />{thinking ? 'Thinking…' : status.state === 'ready' ? 'Ask Gemma' : 'Write it'}
          </button>
        </div>
        <p style={{ fontSize: 15 }} aria-live="polite">{reflection?.key === key ? reflection.text : summarize(cur, prev, range.days)}</p>
      </section>
    </div>
  );
}
