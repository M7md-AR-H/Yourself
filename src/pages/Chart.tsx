import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import { ChevronLeft, Pencil, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { db } from '../lib/db';
import { navigate, useChart, useRoute } from '../lib/hooks';
import { pct, type ActionStat, type ChartStats, type PillarStat } from '../lib/stats';
import type { Goal } from '../lib/types';
import { Sheet } from '../ui/Sheet';
import { useToast } from '../ui/Toaster';
import { starterCommands } from '../lib/seed';
import { hyph } from '../lib/util';

/** Grid positions 0..8 around a centre (4). Slot i (0..7) sits at RING[i]. */
const RING = [0, 1, 2, 3, 5, 6, 7, 8];
const spring = { type: 'spring' as const, stiffness: 340, damping: 34 };

const fit = (label: string) => {
  const longest = Math.max(...label.split(' ').map((w) => w.length));
  return longest > 8 ? { fontSize: 8.5 } : longest > 6 ? { fontSize: 9 } : undefined;
};

const heat = (score: number) =>
  score <= 0 ? undefined : { background: `color-mix(in srgb, var(--accent) ${Math.round(18 + score * 82)}%, var(--cell-empty))` };

type EditState =
  | { kind: 'goal'; value: string }
  | { kind: 'pillar'; slot: number; value: string }
  | { kind: 'action'; pillarSlot: number; slot: number; value: string; existing?: string };

export function Chart() {
  const { stats, data } = useChart();
  const route = useRoute();
  const [edit, setEdit] = useState<EditState | null>(null);
  const sel = route.params.get('pillar');

  if (!stats || !data) return <div className="skel" style={{ aspectRatio: '1', borderRadius: 24 }} aria-busy="true" aria-label="Loading chart" />;

  const pillarSlot = sel && /^[1-8]$/.test(sel) ? Number(sel) - 1 : sel === 'goal' ? -1 : null;
  const empty = !stats.pillars.some(Boolean) && !data.goal?.title;

  return (
    <div className="stack-lg">
      {pillarSlot === null ? (
        <Overview stats={stats} goal={data.goal} empty={empty} />
      ) : pillarSlot === -1 ? (
        <CenterDetail stats={stats} goal={data.goal} onEdit={setEdit} />
      ) : (
        <PillarDetail slot={pillarSlot} p={stats.pillars[pillarSlot]} onEdit={setEdit} />
      )}
      <EditCell state={edit} onClose={() => setEdit(null)} />
    </div>
  );
}

function Overview({ stats, goal, empty }: { stats: ChartStats; goal?: Goal; empty: boolean }) {
  const { exec } = useToast();
  return (
    <>
      <div>
        <h1 className="display h-hero">Your chart</h1>
        <p className="subtitle">Your goal in the middle, the 8 things it depends on around it, and 8 small actions for each. Colour shows the last 7 days. Tap a block.</p>
      </div>
      <div className="mandala glass" role="grid" aria-label="Mandala chart">
        {Array.from({ length: 9 }, (_, pos) => {
          if (pos === 4) {
            return (
              <motion.button key="c" layoutId="block-goal" transition={spring} className="block" onClick={() => navigate('chart', { pillar: 'goal' }, false)} aria-label={`Main goal: ${goal?.title || 'not set'}. Overall ${pct(stats.overall)}. Edit centre`}>
                {Array.from({ length: 9 }, (_, c) => {
                  if (c === 4) return <span key={c} className="cell goal" lang="en" style={fit(goal?.title || 'Your goal')}>{hyph(goal?.title || 'Your goal')}</span>;
                  const p = stats.pillars[RING.indexOf(c)];
                  return <span key={c} className={`cell ring ${p && p.score > 0.5 ? 'heat' : ''}`} style={{ ...(p ? heat(p.score) : {}), ...fit(p?.pillar.title ?? '') }} lang="en">{hyph(p?.pillar.title ?? '')}</span>;
                })}
              </motion.button>
            );
          }
          const slot = RING.indexOf(pos);
          const p = stats.pillars[slot];
          return (
            <motion.button key={pos} layoutId={`block-${slot}`} transition={spring} className="block" onClick={() => navigate('chart', { pillar: slot + 1 }, false)}
              aria-label={p ? `${p.pillar.title}: ${pct(p.score)} this week. Open` : `Empty pillar ${slot + 1}. Open`}>
              {Array.from({ length: 9 }, (_, c) => {
                if (c === 4) return <span key={c} className="cell pillar" lang="en" style={fit(p?.pillar.title ?? '')}>{hyph(p?.pillar.title ?? '+')}</span>;
                const a = p?.actions[RING.indexOf(c)];
                return (
                  <span key={c} className={`cell ${a && a.score > 0.5 ? 'heat' : ''}`} style={a ? heat(a.score) : undefined}>
                    {a?.doneToday && <span className="dot" />}
                  </span>
                );
              })}
            </motion.button>
          );
        })}
      </div>
      <div className="between">
        <div className="legend" aria-hidden>
          <span className="sw" style={{ background: 'var(--cell-empty)', border: '1px solid var(--faint)' }} /> 0
          <span className="sw" style={heat(0.4)} /> <span className="sw" style={heat(0.7)} /> <span className="sw" style={heat(1)} /> 7/7 days
        </div>
        <span className="label tnum">Overall {pct(stats.overall)}</span>
      </div>
      {empty && (
        <div className="glass card empty">
          Your chart is empty.
          <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-solid" onClick={() => exec(starterCommands(), { label: 'Starter chart added' })}>Use the starter chart</button>
            <button className="btn btn-light" onClick={() => navigate('chart', { pillar: 'goal' })}>Write my own</button>
          </div>
        </div>
      )}
    </>
  );
}

function BackHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="row" style={{ gap: 12 }}>
      <button className="icon-btn" aria-label="Back to chart" onClick={() => navigate('chart')}><ChevronLeft size={20} /></button>
      <div style={{ minWidth: 0 }}>
        <h1 className="display" style={{ fontSize: 32 }}>{title}</h1>
        {sub && <p className="label tnum">{sub}</p>}
      </div>
    </div>
  );
}

function PillarDetail({ slot, p, onEdit }: { slot: number; p?: PillarStat; onEdit: (e: EditState) => void }) {
  const { exec } = useToast();
  const pid = p?.pillar.id ?? '';
  const tasks = useLiveQuery(() => db.tasks.where('pillarId').equals(pid).filter((t) => !t.done).toArray(), [pid]) ?? [];
  const notes = useLiveQuery(() => db.notes.where('pillarId').equals(pid).reverse().sortBy('createdAt'), [pid]) ?? [];
  const toggle = (a: ActionStat) => exec([{ type: a.doneToday ? 'uncheck' : 'check_in', action: a.action.title }]);

  return (
    <>
      <BackHeader title={p?.pillar.title ?? `Pillar ${slot + 1}`} sub={p ? `${pct(p.score)} of the last 7 days` : 'Not set yet'} />
      <motion.div layoutId={`block-${slot}`} transition={spring} className="detail-grid">
        {Array.from({ length: 9 }, (_, pos) => {
          if (pos === 4) {
            return (
              <button key="c" className="dcell center" onClick={() => onEdit({ kind: 'pillar', slot, value: p?.pillar.title ?? '' })} aria-label={`Rename pillar ${p?.pillar.title ?? ''}`}>
                <span className="t" lang="en">{p?.pillar.title ?? 'Name it'}</span>
                <Pencil size={14} style={{ opacity: 0.6, marginTop: 6 }} aria-hidden />
              </button>
            );
          }
          const i = RING.indexOf(pos);
          const a = p?.actions[i];
          if (!a) {
            return (
              <button key={pos} className="dcell add" disabled={!p} onClick={() => onEdit({ kind: 'action', pillarSlot: slot, slot: i, value: '' })} aria-label="Add action">
                <Plus size={20} />
              </button>
            );
          }
          return (
            <button key={pos} className={`dcell ${a.doneToday ? 'done' : ''}`} aria-pressed={a.doneToday}
              aria-label={`${a.action.title}. ${a.days.filter(Boolean).length} of 7 days. ${a.doneToday ? 'Done today, tap to undo' : 'Tap to log today'}`}
              onClick={() => toggle(a)}
              onContextMenu={(e) => { e.preventDefault(); onEdit({ kind: 'action', pillarSlot: slot, slot: i, value: a.action.title, existing: a.action.title }); }}>
              <motion.span className="fill" initial={false} animate={{ opacity: a.doneToday ? 1 : a.score * 0.35 }} transition={{ duration: 0.2 }} />
              <span className="t" lang="en">{a.action.title}</span>
              <span className="between" style={{ width: '100%' }}>
                <span className="days" aria-hidden>{a.days.map((d, k) => <i key={k} className={d ? 'on' : ''} />)}</span>
              </span>
            </button>
          );
        })}
      </motion.div>
      <p className="label">Tap an action to log it for today. Long-press to rename or remove it.</p>
      {p && (
        <section className="glass card stack" aria-label="Edit actions">
          <h2 className="section-title">Actions</h2>
          <div className="list">
            {p.actions.map((a, i) => a && (
              <div className="list-item" key={a.action.id}>
                <span className="grow">{a.action.title}<div className="meta tnum">{a.streak ? `${a.streak}-day streak · ` : ''}{a.days.filter(Boolean).length}/7 days</div></span>
                <button className="icon-btn sm" aria-label={`Edit ${a.action.title}`} onClick={() => onEdit({ kind: 'action', pillarSlot: slot, slot: i, value: a.action.title, existing: a.action.title })}><Pencil size={16} /></button>
              </div>
            ))}
          </div>
        </section>
      )}
      {(tasks.length > 0 || notes.length > 0) && (
        <section className="glass card stack" aria-label="Linked items">
          {tasks.length > 0 && <><h2 className="section-title">Open tasks</h2><ul style={{ margin: 0, paddingLeft: 18 }}>{tasks.map((t) => <li key={t.id}>{t.title}</li>)}</ul></>}
          {notes.length > 0 && <><h2 className="section-title">Notes</h2>{notes.slice(0, 5).map((n) => <p key={n.id} style={{ fontSize: 15 }}>{n.text}</p>)}</>}
        </section>
      )}
    </>
  );
}

function CenterDetail({ stats, goal, onEdit }: { stats: ChartStats; goal?: Goal; onEdit: (e: EditState) => void }) {
  return (
    <>
      <BackHeader title="The centre" sub={`Overall ${pct(stats.overall)}`} />
      <motion.div layoutId="block-goal" transition={spring} className="detail-grid">
        {Array.from({ length: 9 }, (_, pos) => {
          if (pos === 4) {
            return (
              <button key="c" className="dcell center" style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }} onClick={() => onEdit({ kind: 'goal', value: goal?.title ?? '' })} aria-label="Edit main goal">
                <span className="t" lang="en">{goal?.title || 'Your main goal'}</span>
                <Pencil size={14} style={{ opacity: 0.6, marginTop: 6 }} aria-hidden />
              </button>
            );
          }
          const i = RING.indexOf(pos);
          const p = stats.pillars[i];
          return (
            <button key={pos} className={p ? 'dcell' : 'dcell add'} onClick={() => onEdit({ kind: 'pillar', slot: i, value: p?.pillar.title ?? '' })} aria-label={p ? `Rename ${p.pillar.title}` : 'Add pillar'}>
              {p ? <><span className="fill" style={{ opacity: p.score * 0.5 }} /><span className="t" lang="en">{p.pillar.title}</span><span className="label tnum">{pct(p.score)}</span></> : <Plus size={20} />}
            </button>
          );
        })}
      </motion.div>
      <p className="label">Tap the centre to change your goal, or a cell to rename a pillar.</p>
    </>
  );
}

function EditCell({ state, onClose }: { state: EditState | null; onClose: () => void }) {
  const { exec } = useToast();
  const [value, setValue] = useState('');
  const [prev, setPrev] = useState<EditState | null>(null);
  if (state !== prev) { setPrev(state); setValue(state?.value ?? ''); }

  const title = !state ? '' : state.kind === 'goal' ? 'Main goal' : state.kind === 'pillar' ? 'Pillar' : state.existing ? 'Edit action' : 'New action';
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!state || !value.trim()) return;
    if (state.kind === 'goal') await exec([{ type: 'set_goal', title: value }]);
    if (state.kind === 'pillar') await exec([{ type: 'set_pillar', pillar: state.slot + 1, title: value }]);
    if (state.kind === 'action') await exec([{ type: 'set_action', pillar: state.pillarSlot + 1, slot: state.slot + 1, title: value }]);
    onClose();
  };
  return (
    <Sheet open={!!state} onClose={onClose} label={title}>
      <form className="stack" onSubmit={submit}>
        <h2 className="section-title">{title}</h2>
        <div className="field">
          <label htmlFor="cell-in">{state?.kind === 'action' ? 'A small action you can do in a day' : 'Name'}</label>
          <input id="cell-in" className="input" value={value} onChange={(e) => setValue(e.target.value)} maxLength={60} autoFocus enterKeyHint="done" />
        </div>
        <div className="row">
          {state?.kind === 'action' && state.existing && (
            <button type="button" className="btn btn-danger" onClick={async () => { await exec([{ type: 'remove_action', action: state.existing!, pillar: state.pillarSlot + 1 }]); onClose(); }}>Remove</button>
          )}
          <button className="btn btn-solid" style={{ flex: 1 }} type="submit" disabled={!value.trim()}>Save</button>
        </div>
      </form>
    </Sheet>
  );
}
