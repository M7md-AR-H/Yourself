import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, CheckCircle2, Flame, ListTodo, Trophy } from 'lucide-react';
import { db } from '../lib/db';
import { navigate, useChart } from '../lib/hooks';
import { pct, type ActionStat } from '../lib/stats';
import type { Settings, Task } from '../lib/types';
import { formatDue, greeting } from '../lib/util';
import { formatTime } from '../lib/commands';
import { useToast } from '../ui/Toaster';
import type { EditorTarget } from '../ui/EditorSheet';

const lift = { whileHover: { y: -3 }, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } };

export function Today({ settings, onEdit }: { settings: Settings; onEdit: (t: EditorTarget) => void }) {
  const { stats, today, data } = useChart();
  const { exec } = useToast();
  const tasks = useLiveQuery(() => db.tasks.orderBy('createdAt').reverse().toArray(), []);

  if (!stats || !tasks || !data) return <TodaySkeleton />;

  const open = tasks.filter((t) => !t.done);
  const dueNow = open.filter((t) => !t.due || t.due <= today).sort((a, b) => (a.due ?? '9').localeCompare(b.due ?? '9') || (a.time ?? '99').localeCompare(b.time ?? '99'));
  const upcoming = open.filter((t) => t.due && t.due > today).sort((a, b) => a.due!.localeCompare(b.due!));
  const doneToday = tasks.filter((t) => t.done && t.doneAt && new Date(t.doneAt).toDateString() === new Date().toDateString());

  const pillars = stats.pillars.filter(Boolean).map((p) => p!);
  const best = [...pillars].sort((a, b) => b.score - a.score)[0];
  const allActions = pillars.flatMap((p) => p.actions.filter(Boolean).map((a) => ({ ...a!, pillar: p.pillar.title, pScore: p.score })));
  const loggedToday = allActions.filter((a) => a.doneToday).length;
  const bestStreak = allActions.reduce((m, a) => Math.max(m, a.streak), 0);
  // Suggest from the weakest pillars first, one action per pillar, skipping what's done.
  const suggestions = [...pillars].sort((a, b) => a.score - b.score)
    .map((p) => p.actions.filter((a): a is ActionStat => !!a).sort((a, b) => Number(a.doneToday) - Number(b.doneToday) || a.score - b.score)[0])
    .filter(Boolean)
    .slice(0, 6);
  const doneSugg = allActions.filter((a) => a.doneToday && !suggestions.some((s) => s.action.id === a.action.id));

  const diff = stats.checkinsThisWeek - stats.checkinsLastWeek;

  const toggleTask = (t: Task) => exec([{ type: t.done ? 'reopen_task' : 'complete_task', task: t.title, id: t.id }]);
  const toggleAction = (a: ActionStat) => exec([{ type: a.doneToday ? 'uncheck' : 'check_in', action: a.action.title, id: a.action.id }]);

  return (
    <div className="stack-lg today-layout">
      <div className="t-head">
        <h1 className="display h-hero">{greeting()}{settings.name ? `, ${settings.name}` : ''}</h1>
        <p className="subtitle">{data.goal?.title ? <>Working towards <strong>{data.goal.title}</strong>.</> : 'Set your main goal in the chart.'} Tell the assistant what you did or will do.</p>
      </div>

      <motion.section className="glass card hero-card t-hero" {...lift} aria-labelledby="wk">
        <div className="between">
          <span className="label" id="wk">This week · {data.goal?.title || 'overall'}</span>
          {stats.checkinsLastWeek > 0 || stats.checkinsThisWeek > 0 ? (
            <span className={`chip ${diff >= 0 ? 'up' : 'down'}`}>
              {diff >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {diff >= 0 ? '+' : ''}{diff} vs last week
            </span>
          ) : null}
        </div>
        <div className="big-num" style={{ marginTop: 8 }}>{pct(stats.overall)}</div>
        <div className="progress" style={{ marginTop: 12 }} aria-hidden><span style={{ transform: `scaleX(${stats.overall})` }} /></div>
        <div className="actions">
          <button className="btn btn-solid" onClick={() => navigate('chart')}>Open chart</button>
          <button className="btn btn-light" onClick={() => navigate('review')}>Weekly review</button>
        </div>
      </motion.section>

      <section className="bento t-tiles" aria-label="Stats">
        <motion.div className="glass tile accent" {...lift}>
          <div className="between"><span className="label">Logged today</span><span className="ico"><CheckCircle2 size={16} /></span></div>
          <div className="tile-value">{loggedToday}<span style={{ fontSize: 15, fontWeight: 600 }}> / {allActions.length}</span></div>
        </motion.div>
        <motion.div className="glass tile" {...lift}>
          <div className="between"><span className="label">Tasks done this week</span><span className="ico"><ListTodo size={16} /></span></div>
          <div className="tile-value">{stats.doneTasksThisWeek}</div>
        </motion.div>
        <motion.div className="glass tile" {...lift}>
          <div className="between"><span className="label">Strongest</span><span className="ico"><Trophy size={16} /></span></div>
          <div className="tile-value text">{best && best.score > 0 ? <>{best.pillar.title} <span className="tnum" style={{ color: 'var(--muted)', fontSize: 15 }}>{pct(best.score)}</span></> : '—'}</div>
        </motion.div>
        <motion.div className="glass tile" {...lift}>
          <div className="between"><span className="label">Best streak</span><span className="ico"><Flame size={16} /></span></div>
          <div className="tile-value">{bestStreak} <span style={{ fontSize: 15, fontWeight: 600 }}>day{bestStreak === 1 ? '' : 's'}</span></div>
        </motion.div>
      </section>

      <section className="glass card t-sugg" aria-labelledby="sugg">
        <div className="between" style={{ marginBottom: 12 }}>
          <h2 className="section-title" id="sugg">Small actions for today</h2>
        </div>
        {suggestions.length ? (
          <div className="habits">
            {[...suggestions, ...doneSugg].map((a) => (
              <button key={a.action.id} className="habit" aria-pressed={a.doneToday} onClick={() => toggleAction(a)}>
                {a.action.title}
              </button>
            ))}
          </div>
        ) : (
          <div className="empty">Your chart is empty.<br /><button className="btn btn-light" onClick={() => navigate('chart')}>Fill your chart</button></div>
        )}
      </section>

      <section className="glass card t-tasks" aria-labelledby="tasks">
        <div className="between" style={{ marginBottom: 4 }}>
          <h2 className="section-title" id="tasks">Tasks</h2>
          <button className="btn btn-ghost" style={{ height: 36, padding: '0 8px' }} onClick={() => onEdit({ kind: 'new', mode: 'task' })}>Add…</button>
        </div>
        {dueNow.length + upcoming.length + doneToday.length === 0 ? (
          <p className="empty">No tasks. Try typing “remind me to stretch tonight” up top.</p>
        ) : (
          <div className="list">
            {[...dueNow, ...upcoming, ...doneToday].map((t) => (
              <div className="list-item" key={t.id}>
                <button className="check" role="checkbox" aria-checked={t.done} aria-label={`${t.done ? 'Reopen' : 'Complete'} ${t.title}`} onClick={() => toggleTask(t)}>
                  {t.done && <CheckCircle2 size={16} />}
                </button>
                <button className="grow" style={{ background: 'none', border: 0, textAlign: 'left', padding: 0, minHeight: 44 }} onClick={() => onEdit({ kind: 'task', task: t })}>
                  <div className={t.done ? 'done-text' : ''}>{t.title}</div>
                  {t.due && <div className="meta tnum" style={{ color: !t.done && t.due < today ? 'var(--danger)' : undefined }}>{formatDue(t.due, today)}{t.time ? ` · ${formatTime(t.time)}` : ''}</div>}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function TodaySkeleton() {
  return (
    <div className="stack-lg" aria-busy="true" aria-label="Loading">
      <div className="skel" style={{ height: 44, width: '70%' }} />
      <div className="skel" style={{ height: 200, borderRadius: 24 }} />
      <div className="bento">{[0, 1, 2, 3].map((i) => <div key={i} className="skel" style={{ height: 120, borderRadius: 24 }} />)}</div>
    </div>
  );
}
