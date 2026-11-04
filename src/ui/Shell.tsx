import { motion } from 'framer-motion';
import { ArrowUp, Plus, Settings as SettingsIcon, Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { navigate, useEngine, type Route } from '../lib/hooks';
import type { Page, Settings } from '../lib/types';
import { useAssistant } from './useAssistant';

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

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const msg = text;
    setText('');
    const ok = await send(msg, { toastReply: true });
    if (!ok) setText(msg);
  };

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
          {text && (
            <button className="icon-btn sm" type="submit" aria-label="Send" disabled={busy}>
              <ArrowUp size={18} />
            </button>
          )}
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
