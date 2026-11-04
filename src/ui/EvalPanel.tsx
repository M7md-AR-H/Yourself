import { useRef, useState } from 'react';
import { report, runEval, type EvalRun } from '../ai/runEval';
import { useEngine } from '../lib/hooks';
import { useToast } from './Toaster';

/** Settings → "Test the assistant": measures accuracy on this phone. Never touches the user's data. */
export function EvalPanel() {
  const status = useEngine();
  const { toast } = useToast();
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [run, setRun] = useState<EvalRun | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  const start = async () => {
    ctrl.current = new AbortController();
    setRun(null);
    setProgress([0, 1]);
    try {
      setRun(await runEval((d, t) => setProgress([d, t]), ctrl.current.signal));
    } catch (e) {
      if (!ctrl.current.signal.aborted) toast({ title: 'Test stopped', detail: e instanceof Error ? e.message : undefined });
    } finally {
      setProgress(null);
    }
  };

  const copy = async () => {
    if (!run) return;
    try {
      await navigator.clipboard.writeText(report(run));
      toast({ title: 'Results copied. Paste them to Claude.' });
    } catch {
      toast({ title: 'Couldn’t copy. Long-press the results to select them.' });
    }
  };

  return (
    <section className="glass card stack" aria-labelledby="s-eval">
      <h2 className="section-title" id="s-eval">Test the assistant</h2>
      <p className="subtitle" style={{ marginTop: 0 }}>
        Runs 80 sample messages through {status.state === 'ready' ? 'Gemma' : 'the offline helper'} and scores the answers. Uses a separate test space; your data isn’t touched.{status.state === 'ready' ? ' Takes a few minutes.' : ''}
      </p>
      {progress ? (
        <div className="stack" style={{ gap: 8 }}>
          <div className="progress"><span style={{ transform: `scaleX(${progress[0] / progress[1]})` }} /></div>
          <div className="between"><span className="label tnum">{progress[0]} / {progress[1]}</span><button className="btn btn-ghost" style={{ height: 36 }} onClick={() => ctrl.current?.abort()}>Stop</button></div>
        </div>
      ) : (
        <button className="btn btn-light" onClick={start}>Run test</button>
      )}
      {run && (
        <div className="stack" style={{ gap: 8 }}>
          <div className="between">
            <span className="mid-num">{run.passed}/{run.total}</span>
            <span className="label tnum">{run.engine} · avg {run.avgMs} ms</span>
          </div>
          <button className="btn btn-solid" onClick={copy}>Copy results</button>
          <details>
            <summary className="label" style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>{run.total - run.passed} failed — show</summary>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {run.scores.filter((s) => !s.pass).map((s) => <li key={s.id} style={{ marginBottom: 6, overflowWrap: 'anywhere' }}><strong>{s.id}</strong> “{s.message}”</li>)}
            </ul>
          </details>
        </div>
      )}
    </section>
  );
}
