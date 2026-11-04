import { AnimatePresence, motion } from 'framer-motion';
import { useState, type FormEvent } from 'react';
import * as engine from '../ai/engine';
import { db, DEFAULT_SETTINGS } from '../lib/db';
import { runCommands } from '../lib/commands';
import { STARTER, STARTER_GOAL, starterCommands } from '../lib/seed';

/** 3 quick steps: name → goal + chart → assistant. Every step has a one-tap default. */
export function Onboarding() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState(STARTER_GOAL);
  const [starter, setStarter] = useState(true);
  const [busy, setBusy] = useState(false);

  const finish = async (ai: boolean) => {
    if (busy) return;
    setBusy(true);
    const cmds = starter ? starterCommands(goal.trim() || STARTER_GOAL) : [{ type: 'set_goal' as const, title: goal.trim() || STARTER_GOAL }];
    try {
      await runCommands(cmds);
      await db.settings.put({ ...DEFAULT_SETTINGS, name: name.trim(), aiEnabled: ai, onboarded: true });
      if (ai) void engine.load(DEFAULT_SETTINGS.model);
    } catch {
      setBusy(false);
    }
  };

  const next = (e: FormEvent) => { e.preventDefault(); setStep((s) => s + 1); };

  return (
    <main className="onb">
      <div className="steps" aria-hidden>{[0, 1, 2].map((i) => <i key={i} className={i <= step ? 'on' : ''} />)}</div>
      <AnimatePresence mode="wait">
        <motion.div key={step} className="stack-lg" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
          {step === 0 && (
            <form className="stack-lg" onSubmit={next}>
              <div className="mini-mandala" aria-hidden>
                {Array.from({ length: 81 }, (_, i) => {
                  const r = Math.floor(i / 9), c = i % 9;
                  const centre = r % 3 === 1 && c % 3 === 1;
                  const goalCell = r === 4 && c === 4;
                  return <i key={i} style={goalCell ? { background: 'var(--accent)' } : centre ? { background: 'var(--solid)' } : undefined} />;
                })}
              </div>
              <div>
                <h1 className="display h-hero">Become who you’re working towards.</h1>
                <p className="subtitle">One goal, eight pillars, sixty-four small actions. You just talk; the app keeps the notes, tasks and score.</p>
              </div>
              <div className="field">
                <label htmlFor="onb-name">What should I call you?</label>
                <input id="onb-name" className="input glass" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" placeholder="Your first name" autoFocus enterKeyHint="next" />
              </div>
              <button className="btn btn-solid btn-block" type="submit">{name.trim() ? 'Continue' : 'Skip'}</button>
            </form>
          )}
          {step === 1 && (
            <form className="stack-lg" onSubmit={next}>
              <div>
                <h1 className="display h-hero">Your main goal</h1>
                <p className="subtitle">It sits in the centre of your chart. You can change it any time.</p>
              </div>
              <div className="field">
                <label htmlFor="onb-goal">Main goal</label>
                <input id="onb-goal" className="input glass" value={goal} onChange={(e) => setGoal(e.target.value)} maxLength={60} enterKeyHint="next" />
              </div>
              <div className="glass card stack" style={{ padding: 16 }}>
                <label className="between" style={{ cursor: 'pointer' }}>
                  <span>
                    <strong>Start with the suggested chart</strong>
                    <span className="meta" style={{ display: 'block', fontSize: 13, color: 'var(--muted)' }}>{STARTER.map((s) => s.pillar).join(' · ')}, each with 8 actions.</span>
                  </span>
                  <input type="checkbox" checked={starter} onChange={(e) => setStarter(e.target.checked)} style={{ width: 24, height: 24, accentColor: 'var(--accent)' }} />
                </label>
              </div>
              <button className="btn btn-solid btn-block" type="submit">Continue</button>
            </form>
          )}
          {step === 2 && (
            <div className="stack-lg">
              <div>
                <h1 className="display h-hero">Your private assistant</h1>
                <p className="subtitle">Gemma is a small AI that runs on your phone. It turns what you say into tasks, notes and check-ins. One download of about 0.7 GB — use Wi‑Fi. Nothing leaves your device.</p>
              </div>
              <button className="btn btn-accent btn-block" onClick={() => finish(true)} disabled={busy}>Download Gemma and start</button>
              <button className="btn btn-light btn-block" onClick={() => finish(false)} disabled={busy}>Start without it (quick offline helper)</button>
              <p className="label" style={{ textAlign: 'center' }}>You can turn it on later. Settings → Help explains everything.</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}
