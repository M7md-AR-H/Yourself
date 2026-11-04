import { motion } from 'framer-motion';
import { ArrowUp, Mic, Plus, Settings as SettingsIcon, Sparkles, Square } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { navigate, useEngine, type Route } from '../lib/hooks';
import type { Page, Settings } from '../lib/types';
import { useAssistant } from './useAssistant';
import { useToast } from './Toaster';
import { useVoice } from './useVoice';

const TABS: { page: Page; label: string }[] = [
  { page: 'today', label: 'Today' },
  { page: 'chart', label: 'Chart' },
  { page: 'notes', label: 'Notes' },
  { page: 'chat', label: 'Chat' },
];

const PLACEHOLDERS = ['I slept 8 hours and meditated…', 'Remind me to call mom tomorrow…', 'Note: felt calm after the walk…', 'Show my sleep block…'];

export function TopBar({ settings, route }: { settings: Settings; route: Route }) {
  const [text, setText] = useState('');
  const { send, busy } = useAssistant();
  const status = useEngine();
  const [ph] = useState(() => PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)]);
  const initial = (settings.name || 'Y').trim().charAt(0).toUpperCase();

  const { toast } = useToast();
  const sendText = async (msg: string) => {
    setText('');
    const ok = await send(msg, { toastReply: true });
    if (!ok) setText(msg);
  };
  const submit = (e: FormEvent) => { e.preventDefault(); void sendText(text); };
  const voice = useVoice((t) => void sendText(t), setText, () => toast({ title: 'Using Chrome’s online speech service', detail: 'On-device speech isn’t available for your language on this phone.' }));

  return (
    <header className="topbar glass">
      <button className="avatar" aria-label={`Welcome, ${settings.name || 'you'}. Open settings`} onClick={() => navigate('settings')}>
        {initial}
      </button>
      {route.page === 'chat' ? (
        <div className="grow" style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Assistant</div>
          <div className="ai-status">
            <span className={`ai-dot ${status.state === 'ready' ? 'on' : ''}`} />
            {status.state === 'ready' ? 'Gemma · on device' : status.state === 'loading' ? `Loading Gemma… ${Math.round(status.progress * 100)}%` : 'Offline helper'}
          </div>
        </div>
      ) : (
        <form className="cmd" onSubmit={submit} role="search">
          <Sparkles size={16} aria-hidden style={{ color: 'var(--muted)', flex: 'none' }} />
          <label htmlFor="cmd" className="sr-only">Tell the assistant</label>
          <input id="cmd" value={text} onChange={(e) => setText(e.target.value)} placeholder={ph} autoComplete="off" enterKeyHint="send" readOnly={busy} aria-busy={busy} />
          {text && !voice.listening ? (
            <button className="icon-btn sm" type="submit" aria-label="Send" disabled={busy}>
              <ArrowUp size={18} />
            </button>
          ) : voice.supported && !busy ? (
            <button className={`icon-btn sm ${voice.listening ? 'rec' : ''}`} type="button" aria-label={voice.listening ? 'Stop listening' : 'Speak'} aria-pressed={voice.listening}
              onClick={() => (voice.listening ? voice.stop() : voice.start())}>
              {voice.listening ? <Square size={14} /> : <Mic size={18} />}
            </button>
          ) : null}
          {busy && <span className="typing" aria-label="Thinking…"><i /><i /><i /></span>}
        </form>
      )}
      <button className="icon-btn" aria-label="Settings" onClick={() => navigate('settings')}>
        <SettingsIcon size={18} />
      </button>
    </header>
  );
}

export function TabBar({ route, onPlus }: { route: Route; onPlus: () => void }) {
  return (
    <nav className="tabbar glass" aria-label="Main">
      {TABS.map((t) => {
        const active = route.page === t.page;
        return (
          <button key={t.page} className="tab" aria-current={active ? 'page' : undefined} onClick={() => navigate(t.page)}>
            {active && <motion.span layoutId="tab-pill" className="tab-pill" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
            {t.label}
          </button>
        );
      })}
      <button className="icon-btn solid tab-plus" aria-label="Add note or task" onClick={onPlus}>
        <Plus size={22} />
      </button>
    </nav>
  );
}
