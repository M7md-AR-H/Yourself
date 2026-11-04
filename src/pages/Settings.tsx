import { Download, HelpCircle, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as engine from '../ai/engine';
import { db, TABLES, type TableName } from '../lib/db';
import type { JournalEntry } from '../lib/commands';
import { navigate, useEngine } from '../lib/hooks';
import type { ModelId, Settings as S, ThemePref } from '../lib/types';
import { ymd } from '../lib/util';
import { useToast } from '../ui/Toaster';
import { EvalPanel } from '../ui/EvalPanel';

export function Settings({ settings }: { settings: S }) {
  const { toast, exec } = useToast();
  const status = useEngine();
  const [name, setName] = useState(settings.name);
  const [cached, setCached] = useState<Record<string, boolean>>({});
  const [support, setSupport] = useState<string | null | undefined>(undefined);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    engine.checkSupport().then(setSupport);
    Promise.all(engine.MODELS.map(async (m) => [m.id, await engine.isCached(m.id)] as const)).then((r) => setCached(Object.fromEntries(r)));
  }, [status.state]);

  const save = (patch: Partial<S>) => db.settings.put({ ...settings, ...patch });

  const turnOn = async (model: ModelId) => {
    await save({ model, aiEnabled: true });
    await engine.load(model);
    const s = engine.getStatus();
    if (s.state === 'ready') toast({ title: 'Gemma is ready on your phone' });
    if (s.state === 'error') toast({ title: 'Couldn’t start the model', detail: s.message });
  };

  const exportData = async () => {
    const out: Record<string, unknown> = { app: 'yourself', version: 1, exportedAt: new Date().toISOString() };
    for (const t of TABLES) out[t] = await db[t].toArray();
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `yourself-${ymd()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const importData = async (f: File) => {
    try {
      const data = JSON.parse(await f.text());
      if (data?.app !== 'yourself') throw new Error('This is not a Yourself backup file.');
      const clean = validateBackup(data);
      // Snapshot current data so the import can be undone from the toast.
      const journal: JournalEntry[] = [];
      for (const t of TABLES) {
        if (!clean[t]) continue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const row of (await db[t].toArray()) as any[]) journal.push({ table: t, key: row.id, before: row });
        for (const row of clean[t]!) if (!journal.some((j) => j.table === t && j.key === row.id)) journal.push({ table: t, key: row.id as string, before: undefined });
      }
      await db.transaction('rw', TABLES.map((t) => db[t]), async () => {
        for (const t of TABLES) {
          if (!clean[t]) continue;
          await db[t].clear();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (db[t] as any).bulkPut(clean[t]);
        }
      });
      toast({ title: 'Backup restored', detail: 'Your old data was replaced.', journal });
    } catch (e) {
      toast({ title: 'Import failed', detail: e instanceof Error ? e.message : undefined });
    }
  };

  return (
    <div className="stack-lg">
      <div className="between">
        <h1 className="display h-hero">Settings</h1>
        <button className="btn btn-light" onClick={() => navigate('help')}><HelpCircle size={16} aria-hidden /> Help</button>
      </div>

      <section className="glass card stack" aria-labelledby="s-you">
        <h2 className="section-title" id="s-you">You</h2>
        <form className="field" onSubmit={(e) => { e.preventDefault(); exec([{ type: 'set_name', name }]); }}>
          <label htmlFor="s-name">Name</label>
          <div className="row">
            <input id="s-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
            <button className="btn btn-light" type="submit" disabled={!name.trim() || name === settings.name}>Save</button>
          </div>
        </form>
        <div className="field">
          <span className="label">Theme</span>
          <div className="seg" role="group" aria-label="Theme">
            {(['system', 'light', 'dark'] as ThemePref[]).map((t) => (
              <button key={t} aria-pressed={settings.theme === t} onClick={() => save({ theme: t })} style={{ textTransform: 'capitalize' }}>{t}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="glass card stack" aria-labelledby="s-ai">
        <div className="between">
          <h2 className="section-title" id="s-ai">Assistant</h2>
          <span className="ai-status"><span className={`ai-dot ${status.state === 'ready' ? 'on' : ''}`} />{status.state === 'ready' ? 'Gemma running' : status.state === 'loading' ? 'Loading…' : 'Offline helper'}</span>
        </div>
        <p className="subtitle" style={{ marginTop: 0 }}>Gemma runs fully on your phone. Nothing you write leaves the device. It downloads once over Wi‑Fi, then works offline.</p>
        {support && <p style={{ color: 'var(--danger)', fontSize: 14 }}>{support}</p>}
        {status.state === 'loading' && (
          <div className="stack" style={{ gap: 8 }}>
            <div className="progress"><span style={{ transform: `scaleX(${status.progress})` }} /></div>
            <p className="label tnum" style={{ overflowWrap: 'anywhere' }}>{Math.round(status.progress * 100)}% · {status.text}</p>
          </div>
        )}
        {status.state === 'error' && <p style={{ color: 'var(--danger)', fontSize: 14, overflowWrap: 'anywhere' }}>{status.message}</p>}
        <div className="list">
          {engine.MODELS.map((m) => {
            const active = status.state === 'ready' && status.model === m.id;
            return (
              <div className="list-item" key={m.id}>
                <div className="grow">
                  <div style={{ fontWeight: 700 }}>{m.label} {settings.model === m.id && <span className="chip up">Chosen</span>}</div>
                  <div className="meta">{m.size} · {m.note}{cached[m.id] ? ' · downloaded' : ''}</div>
                </div>
                {active ? (
                  <button className="btn btn-light" onClick={() => engine.unload().then(() => save({ aiEnabled: false }))}>Turn off</button>
                ) : (
                  <button className="btn btn-solid" disabled={!!support || status.state === 'loading'} onClick={() => turnOn(m.id)}>{cached[m.id] ? 'Use' : 'Get'}</button>
                )}
              </div>
            );
          })}
        </div>
        {Object.entries(cached).some(([, v]) => v) && (
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {engine.MODELS.filter((m) => cached[m.id]).map((m) => (
              <button key={m.id} className="btn btn-ghost" style={{ height: 36, padding: '0 8px', fontSize: 13 }}
                onClick={async () => { await engine.deleteModel(m.id); setCached((c) => ({ ...c, [m.id]: false })); toast({ title: `Removed ${m.label} (${m.size} freed)` }); }}>
                Delete {m.label} download
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="glass card stack" aria-labelledby="s-data">
        <h2 className="section-title" id="s-data">Your data</h2>
        <p className="subtitle" style={{ marginTop: 0 }}>Everything is stored only on this device. Export a backup to move it to another phone or your laptop.</p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-light" onClick={exportData}><Download size={16} /> Export backup</button>
          <button className="btn btn-light" onClick={() => file.current?.click()}><Upload size={16} /> Import…</button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importData(f); e.target.value = ''; }} />
        </div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={async () => {
            const before = await db.chat.toArray();
            await db.chat.clear();
            toast({ title: 'Chat history cleared', journal: before.map((m) => ({ table: 'chat' as const, key: m.id, before: m })) });
          }}>Clear chat history</button>
        </div>
      </section>
      <EvalPanel />
      <p className="label" style={{ textAlign: 'center' }}>Yourself · v0.2</p>
    </div>
  );
}

type Row = Record<string, unknown>;
const isStr = (v: unknown) => typeof v === 'string';
const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const slot = (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 7;
const RULES: Record<TableName, (r: Row) => boolean> = {
  goal: (r) => r.id === 'goal' && isStr(r.title),
  pillars: (r) => isStr(r.id) && isStr(r.title) && slot(r.index),
  actions: (r) => isStr(r.id) && isStr(r.pillarId) && isStr(r.title) && slot(r.index),
  checkins: (r) => isStr(r.id) && isStr(r.actionId) && isStr(r.date) && /^\d{4}-\d{2}-\d{2}$/.test(r.date as string),
  tasks: (r) => isStr(r.id) && isStr(r.title) && typeof r.done === 'boolean' && isNum(r.createdAt),
  notes: (r) => isStr(r.id) && isStr(r.text) && isNum(r.createdAt),
  chat: (r) => isStr(r.id) && isStr(r.text) && (r.role === 'user' || r.role === 'assistant') && isNum(r.createdAt),
  settings: (r) => r.id === 'settings' && isStr(r.name),
};

/** Backup files are untrusted input: keep only rows with the right shape, reject the file if too much is wrong. */
function validateBackup(data: Record<string, unknown>): Partial<Record<TableName, Row[]>> {
  const out: Partial<Record<TableName, Row[]>> = {};
  let bad = 0, total = 0;
  for (const t of TABLES) {
    const rows = data[t];
    if (!Array.isArray(rows)) continue;
    total += rows.length;
    out[t] = rows.filter((r) => {
      const ok = !!r && typeof r === 'object' && RULES[t](r as Row);
      if (!ok) bad++;
      return ok;
    });
  }
  if (!total) throw new Error('The backup is empty.');
  if (bad > total / 10) throw new Error(`${bad} of ${total} rows look broken, so nothing was imported.`);
  return out;
}
