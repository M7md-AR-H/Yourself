import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowUp, Mic, Square } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { db } from '../lib/db';
import { navigate, useEngine } from '../lib/hooks';
import { useAssistant } from '../ui/useAssistant';
import { useVoice } from '../ui/useVoice';

const STARTERS = [
  'I slept 8 hours and read in bed',
  'Remind me to pay rent on friday',
  'How am I doing this week?',
  'Note: I felt focused after my walk',
  'How do I turn on Gemma?',
];

export function Chat() {
  const messages = useLiveQuery(() => db.chat.orderBy('createdAt').toArray(), []);
  const { send, busy } = useAssistant();
  const status = useEngine();
  const [text, setText] = useState('');
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // keep toasts above the composer while on this page
    document.documentElement.style.setProperty('--toast-lift', '64px');
    return () => void document.documentElement.style.removeProperty('--toast-lift');
  }, []);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'end' });
  }, [messages?.length, busy]);

  const voice = useVoice((t) => void submit(undefined, t), setText);
  const submit = async (e?: FormEvent, preset?: string) => {
    e?.preventDefault();
    const msg = preset ?? text;
    setText('');
    if (!(await send(msg))) setText(msg);
  };

  return (
    <div className="chat-page">
      {status.state !== 'ready' && (
        <div className="glass card" style={{ padding: 16 }}>
          <p style={{ fontSize: 14 }}>
            {status.state === 'loading'
              ? `Loading Gemma… ${Math.round(status.progress * 100)}%. You can keep chatting; the offline helper answers until it’s ready.`
              : 'Using the quick offline helper. For smarter answers, turn on Gemma (runs on your phone, private).'}
          </p>
          {status.state !== 'loading' && <button className="btn btn-light" style={{ marginTop: 12 }} onClick={() => navigate('settings')}>Set up Gemma</button>}
        </div>
      )}
      {!messages ? (
        <div className="stack" aria-busy="true">{[0, 1].map((i) => <div key={i} className="skel" style={{ height: 56, width: i ? '60%' : '80%', borderRadius: 20, alignSelf: i ? 'flex-end' : 'flex-start' }} />)}</div>
      ) : messages.length === 0 ? (
        <div className="stack" style={{ marginTop: 24 }}>
          <h1 className="display h-hero">Tell me about your day.</h1>
          <p className="subtitle">What you did, what you will do, how you feel. I turn it into tasks, notes and chart check-ins.</p>
          <div className="suggest">
            {STARTERS.map((s) => <button key={s} className="habit" onClick={() => submit(undefined, s)} disabled={busy}>{s}</button>)}
          </div>
        </div>
      ) : (
        messages.map((m) => (
          <div key={m.id} className={`bubble ${m.role} ${m.role === 'assistant' ? 'glass' : ''}`}>
            {m.text}
            {m.effects && m.effects.length > 0 && (
              <div className="effects">{m.effects.map((e, i) => <span key={i} className="chip">{e}</span>)}</div>
            )}
          </div>
        ))
      )}
      {busy && <div className="bubble assistant glass" aria-label="Thinking…"><span className="typing"><i /><i /><i /></span></div>}
      <div ref={end} />
      <form className="composer glass glass-strong" onSubmit={submit}>
        <label htmlFor="chat-in" className="sr-only">Message</label>
        <input id="chat-in" value={text} onChange={(e) => setText(e.target.value)} placeholder="Message…" autoComplete="off" enterKeyHint="send" />
        {voice.supported && (!text.trim() || voice.listening) ? (
          <button className={`icon-btn solid ${voice.listening ? 'rec' : ''}`} type="button" aria-label={voice.listening ? 'Stop listening' : 'Speak'} aria-pressed={voice.listening} disabled={busy}
            onClick={() => (voice.listening ? voice.stop() : voice.start())}>
            {voice.listening ? <Square size={14} /> : <Mic size={18} />}
          </button>
        ) : (
          <button className="icon-btn solid" type="submit" aria-label="Send" disabled={!text.trim() || busy}><ArrowUp size={18} /></button>
        )}
      </form>
    </div>
  );
}
