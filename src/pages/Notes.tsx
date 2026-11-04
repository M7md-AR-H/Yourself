import { useLiveQuery } from 'dexie-react-hooks';
import { Search, Sparkles } from 'lucide-react';
import { db } from '../lib/db';
import { navigate, useRoute } from '../lib/hooks';
import type { EditorTarget } from '../ui/EditorSheet';
import { normalize } from '../lib/util';

function dayLabel(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

export function Notes({ onEdit }: { onEdit: (t: EditorTarget) => void }) {
  const route = useRoute();
  const q = route.params.get('q') ?? '';
  const pillarFilter = route.params.get('p') ?? '';
  const notes = useLiveQuery(() => db.notes.orderBy('createdAt').reverse().toArray(), []);
  const pillars = useLiveQuery(() => db.pillars.orderBy('index').filter((p) => !!p.title).toArray(), []) ?? [];
  const pName = new Map(pillars.map((p) => [p.id, p.title]));

  const setParam = (k: string, v: string) => {
    const params: Record<string, string> = { q, p: pillarFilter };
    params[k] = v;
    navigate('notes', params, true);
  };

  const shown = (notes ?? []).filter((n) => (!pillarFilter || n.pillarId === pillarFilter) && (!q || normalize(n.text).includes(normalize(q))));
  const groups: { label: string; items: typeof shown }[] = [];
  for (const n of shown) {
    const label = dayLabel(n.createdAt);
    if (groups.at(-1)?.label !== label) groups.push({ label, items: [] });
    groups.at(-1)!.items.push(n);
  }

  return (
    <div className="stack-lg">
      <div className="between">
        <h1 className="display h-hero">Notes</h1>
        <button className="btn btn-solid" onClick={() => onEdit({ kind: 'new', mode: 'note' })}>New note</button>
      </div>
      <div className="search glass">
        <Search size={18} aria-hidden style={{ color: 'var(--muted)' }} />
        <label htmlFor="nsearch" className="sr-only">Search notes</label>
        <input id="nsearch" type="search" placeholder="Search notes…" value={q} onChange={(e) => setParam('q', e.target.value)} />
      </div>
      {pillars.length > 0 && (
        <div className="filter-row" role="group" aria-label="Filter by pillar">
          <button className="filter" aria-pressed={!pillarFilter} onClick={() => setParam('p', '')}>All</button>
          {pillars.map((p) => (
            <button key={p.id} className="filter" aria-pressed={pillarFilter === p.id} onClick={() => setParam('p', pillarFilter === p.id ? '' : p.id)}>{p.title}</button>
          ))}
        </div>
      )}
      {!notes ? (
        <div className="stack" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="skel" style={{ height: 84, borderRadius: 16 }} />)}</div>
      ) : shown.length === 0 ? (
        <div className="glass card empty">
          {notes.length === 0 ? <>No notes yet. Just tell the assistant how your day went — it keeps the notes for you.</> : <>Nothing matches “{q || pName.get(pillarFilter)}”.</>}
          <div><button className="btn btn-light" onClick={() => navigate('chat')}><Sparkles size={16} /> Talk to the assistant</button></div>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.label} className="stack" aria-label={g.label}>
            <h2 className="day-label">{g.label}</h2>
            <div className="note-grid">
            {g.items.map((n) => (
              <button key={n.id} className="note glass" onClick={() => onEdit({ kind: 'note', note: n })}>
                <p>{n.text}</p>
                <div className="meta tnum">
                  <span>{new Date(n.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                  {n.pillarId && pName.get(n.pillarId) && <span>· {pName.get(n.pillarId)}</span>}
                  {n.source === 'chat' && <span>· from chat</span>}
                </div>
              </button>
            ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
