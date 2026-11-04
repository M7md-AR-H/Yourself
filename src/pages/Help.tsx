import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Search } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { HELP } from '../lib/help';
import { navigate, useEngine, useRoute } from '../lib/hooks';
import { normalize } from '../lib/util';

/** Render `code` spans in help text. */
function Rich({ text }: { text: string }) {
  return <>{text.split(/(`[^`]+`)/).map((part, i) => (part.startsWith('`') ? <code key={i} className="kbd">{part.slice(1, -1)}</code> : part))}</>;
}

export function Help() {
  const route = useRoute();
  const open = route.params.get('s') ?? '';
  const q = route.params.get('q') ?? '';
  const status = useEngine();
  const refs = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    if (!open) return;
    const el = refs.current.get(open);
    const t = setTimeout(() => el?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }), 120);
    return () => clearTimeout(t);
  }, [open]);

  const nq = normalize(q);
  const shown = HELP.filter((h) => !nq || normalize([h.title, h.summary, ...h.steps, ...h.keywords].join(' ')).includes(nq));
  const setParams = (p: { s?: string; q?: string }) => navigate('help', { s: p.s ?? open, q: p.q ?? q }, true);

  return (
    <div className="stack-lg">
      <div>
        <h1 className="display h-hero">Help</h1>
        <p className="subtitle">How to set up the app, turn on the AI, and get the most out of it. You can also just ask the assistant, e.g. “how do I back up my data?”.</p>
      </div>

      <div className="glass card stack" style={{ padding: 16 }}>
        <div className="between">
          <span className="ai-status"><span className={`ai-dot ${status.state === 'ready' ? 'on' : ''}`} />{status.state === 'ready' ? 'Gemma is on' : 'Gemma is off'}</span>
          {status.state !== 'ready' && <button className="btn btn-accent" style={{ height: 40 }} onClick={() => navigate('settings')}>Set up Gemma</button>}
        </div>
        <ol className="quick-steps">
          <li>Install: Chrome menu (⋮) → <strong>Add to Home screen</strong>.</li>
          <li>Settings → Assistant → <strong>Get</strong> Gemma (on Wi‑Fi).</li>
          <li>Type or speak what you did or will do in the top bar.</li>
        </ol>
      </div>

      <div className="search glass">
        <Search size={18} aria-hidden style={{ color: 'var(--muted)' }} />
        <label htmlFor="hsearch" className="sr-only">Search help</label>
        <input id="hsearch" type="search" placeholder="Search help…" value={q} onChange={(e) => setParams({ q: e.target.value })} />
      </div>

      <div className="stack" style={{ gap: 8 }}>
        {shown.length === 0 && (
          <div className="glass card empty">Nothing found for “{q}”. Try asking the assistant instead.
            <div><button className="btn btn-light" onClick={() => navigate('chat')}>Ask the assistant</button></div>
          </div>
        )}
        {shown.map((h) => {
          const isOpen = open === h.id || (!!nq && shown.length <= 2);
          return (
            <section key={h.id} ref={(el) => { if (el) refs.current.set(h.id, el); }} className="glass help-item" style={{ scrollMarginTop: 'calc(var(--top-h) + 24px)' }}>
              <button className="help-head" aria-expanded={isOpen} aria-controls={`help-${h.id}`} onClick={() => setParams({ s: isOpen ? '' : h.id })}>
                <span>
                  <span className="help-title">{h.title}</span>
                  {!isOpen && <span className="help-sum">{h.summary}</span>}
                </span>
                <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }} style={{ display: 'grid', flex: 'none' }}><ChevronDown size={18} aria-hidden /></motion.span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div id={`help-${h.id}`} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} style={{ overflow: 'hidden' }}>
                    <ol className="help-steps">{h.steps.map((st, i) => <li key={i}><Rich text={st} /></li>)}</ol>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          );
        })}
      </div>
    </div>
  );
}
