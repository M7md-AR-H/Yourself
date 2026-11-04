import { useLiveQuery } from 'dexie-react-hooks';
import { Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { db } from '../lib/db';
import { runCommands } from '../lib/commands';
import type { Note, Task } from '../lib/types';
import { addDays, uid, ymd } from '../lib/util';
import { Sheet } from './Sheet';
import { useToast } from './Toaster';

export type EditorTarget =
  | { kind: 'new'; mode?: 'note' | 'task' }
  | { kind: 'note'; note: Note }
  | { kind: 'task'; task: Task };

/** Add or edit a note / task by hand. Uses direct writes + journal so it is undoable. */
export function EditorSheet({ target, onClose }: { target: EditorTarget | null; onClose: () => void }) {
  const { toast } = useToast();
  const pillars = useLiveQuery(() => db.pillars.orderBy('index').filter((p) => !!p.title).toArray(), []) ?? [];
  const [mode, setMode] = useState<'note' | 'task'>('note');
  const [text, setText] = useState('');
  const [pillarId, setPillarId] = useState('');
  const [due, setDue] = useState<string>('');
  const [time, setTime] = useState<string>('');
  const today = ymd();

  useEffect(() => {
    if (!target) return;
    setTime(target.kind === 'task' ? target.task.time ?? '' : '');
    if (target.kind === 'new') { setMode(target.mode ?? 'note'); setText(''); setPillarId(''); setDue(''); }
    if (target.kind === 'note') { setMode('note'); setText(target.note.text); setPillarId(target.note.pillarId ?? ''); setDue(''); }
    if (target.kind === 'task') { setMode('task'); setText(target.task.title); setPillarId(target.task.pillarId ?? ''); setDue(target.task.due ?? ''); }
  }, [target]);

  const editing = target && target.kind !== 'new';

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    const now = Date.now();
    if (target?.kind === 'note') {
      const before = target.note;
      await db.notes.put({ ...before, text: value, pillarId: pillarId || undefined, updatedAt: now });
      toast({ title: 'Note updated', journal: [{ table: 'notes', key: before.id, before }] });
    } else if (target?.kind === 'task') {
      const before = target.task;
      const moved = (due || undefined) !== before.due || (time || undefined) !== before.time;
      await db.tasks.put({ ...before, title: value, pillarId: pillarId || undefined, due: due || (time ? today : undefined), time: time || undefined, notifiedAt: moved ? undefined : before.notifiedAt, updatedAt: now });
      toast({ title: 'Task updated', journal: [{ table: 'tasks', key: before.id, before }] });
    } else if (mode === 'note') {
      const id = uid();
      await db.notes.put({ id, text: value, pillarId: pillarId || undefined, source: 'manual', createdAt: now, updatedAt: now });
      toast({ title: 'Note saved', journal: [{ table: 'notes', key: id, before: undefined }] });
    } else {
      const id = uid();
      await db.tasks.put({ id, title: value, pillarId: pillarId || undefined, due: due || (time ? today : undefined), time: time || undefined, done: false, createdAt: now, updatedAt: now });
      toast({ title: 'Task added', journal: [{ table: 'tasks', key: id, before: undefined }] });
    }
    onClose();
  };

  const remove = async () => {
    if (!target || target.kind === 'new') return;
    const r = await runCommands([target.kind === 'note'
      ? { type: 'delete_note', note: target.note.text, id: target.note.id }
      : { type: 'delete_task', task: target.task.title, id: target.task.id }]);
    onClose();
    toast({ title: r.effects[0] ?? 'Deleted', journal: r.journal });
  };

  return (
    <Sheet open={!!target} onClose={onClose} label={editing ? `Edit ${mode}` : 'Add'}>
      <form className="stack" onSubmit={save}>
        <div className="between">
          {editing ? <h2 className="section-title">Edit {mode}</h2> : (
            <div className="seg" role="group" aria-label="Type">
              <button type="button" aria-pressed={mode === 'note'} onClick={() => setMode('note')}>Note</button>
              <button type="button" aria-pressed={mode === 'task'} onClick={() => setMode('task')}>Task</button>
            </div>
          )}
          {editing && (
            <button type="button" className="icon-btn" aria-label={`Delete ${mode}`} onClick={remove}>
              <Trash2 size={18} />
            </button>
          )}
        </div>
        <div className="field">
          <label htmlFor="ed-text">{mode === 'note' ? 'Note' : 'Task'}</label>
          {mode === 'note' ? (
            <textarea id="ed-text" className="textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder="What’s on your mind…" autoFocus />
          ) : (
            <input id="ed-text" className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="What will you do…" autoFocus enterKeyHint="done" />
          )}
        </div>
        {mode === 'task' && (
          <div className="field">
            <span className="label">Due</span>
            <div className="filter-row" role="group" aria-label="Due date">
              {[['', 'No date'], [today, 'Today'], [addDays(today, 1), 'Tomorrow'], [addDays(today, 7), 'Next week']].map(([v, l]) => (
                <button type="button" key={l} className="filter" aria-pressed={due === v} onClick={() => setDue(v)}>{l}</button>
              ))}
              <input type="date" aria-label="Pick a date" className="filter" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
          </div>
        )}
        {mode === 'task' && (
          <div className="field">
            <label htmlFor="ed-time">Time (optional, for a reminder)</label>
            <div className="row">
              <input id="ed-time" type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
              {time && <button type="button" className="btn btn-light" onClick={() => setTime('')}>Clear</button>}
            </div>
          </div>
        )}
        <div className="field">
          <label htmlFor="ed-pillar">Pillar</label>
          <select id="ed-pillar" className="select" value={pillarId} onChange={(e) => setPillarId(e.target.value)}>
            <option value="">None</option>
            {pillars.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
        <button className="btn btn-solid btn-block" type="submit" disabled={!text.trim()}>
          {editing ? 'Save' : mode === 'note' ? 'Save note' : 'Add task'}
        </button>
      </form>
    </Sheet>
  );
}
