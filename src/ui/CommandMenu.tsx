import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  BarChart3, CheckSquare, Circle, Command, HelpCircle, LayoutGrid, MessageCircle, Moon, NotebookPen, Plus, Settings, Sparkles, Sun,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { filterItems, type CommandItem } from './commandItems';

const ICONS: Record<string, LucideIcon> = {
  today: Sun, chart: LayoutGrid, review: BarChart3, notes: NotebookPen, chat: MessageCircle, settings: Settings,
  help: HelpCircle, note: Plus, task: CheckSquare, theme: Moon, pillar: Circle, ask: Sparkles,
};

export function CommandMenu({ open, onClose, items, onAsk }: {
  open: boolean;
  onClose: () => void;
  items: CommandItem[];
  /** Offered as the last row whenever the query is non-empty. */
  onAsk: (query: string) => void;
}) {
  const reduce = useReducedMotion();
  const uid = useId();
  const listId = `${uid}-list`;
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const trimmed = query.trim();
  const rows = useMemo<CommandItem[]>(() => {
    const found = filterItems(items, query);
    if (!trimmed) return found;
    return [...found, { id: '__ask', label: `Ask the assistant: “${trimmed}”`, group: 'Assistant', icon: 'ask', run: () => onAsk(trimmed) }];
  }, [items, query, trimmed, onAsk]);
  const activeIdx = Math.min(active, Math.max(rows.length - 1, 0));
  const optId = (i: number) => `${uid}-opt-${i}`;

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    const t = setTimeout(() => panel.current?.querySelector<HTMLElement>('input')?.focus(), 30);
    return () => {
      clearTimeout(t);
      // Restore focus only if the action didn't move it somewhere on purpose (e.g. "Talk to the assistant").
      const a = document.activeElement;
      if (!a || a === document.body || panel.current?.contains(a)) (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [open]);

  useEffect(() => { if (!open) { setQuery(''); setActive(0); } }, [open]);

  useEffect(() => {
    if (!open) return;
    document.getElementById(`${uid}-opt-${activeIdx}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [open, activeIdx, uid]);

  const runRow = (row: CommandItem | undefined) => {
    if (!row) return;
    close.current();
    setTimeout(() => row.run(), 0); // after the menu's focus restore, so the action's own focus wins
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); close.current(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!rows.length) return;
      const d = e.key === 'ArrowDown' ? 1 : -1;
      setActive((activeIdx + d + rows.length) % rows.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runRow(rows[activeIdx]);
    } else if (e.key === 'Tab') {
      // Only the input is focusable; keep focus trapped inside the panel.
      e.preventDefault();
      panel.current?.querySelector<HTMLElement>('input')?.focus();
    }
  };

  const fade = reduce ? { duration: 0 } : { duration: 0.15 };
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="scrim cmdk-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade} onClick={onClose} />
          <div className="cmdk-wrap" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <motion.div
              ref={panel}
              role="dialog"
              aria-modal="true"
              aria-label="Command menu"
              className="cmdk glass glass-strong"
              initial={reduce ? false : { opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
              transition={fade}
              onKeyDown={onKeyDown}
            >
              <input
                className="cmdk-input"
                type="text"
                autoFocus
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Search or ask…"
                aria-label="Search commands"
                role="combobox"
                aria-expanded={rows.length > 0}
                aria-controls={listId}
                aria-activedescendant={rows.length ? optId(activeIdx) : undefined}
                aria-autocomplete="list"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
              />
              {rows.length === 0 && <div className="cmdk-empty">No commands available.</div>}
              <ul id={listId} role="listbox" aria-label="Commands" className="cmdk-list" hidden={rows.length === 0}>
                {rows.map((row, i) => {
                  const heading = i === 0 || rows[i - 1].group !== row.group ? row.group : null;
                  const Icon = ICONS[row.icon ?? ''] ?? Command;
                  return (
                    <li key={row.id} role="presentation">
                      {heading && <div className="cmdk-group" aria-hidden>{heading}</div>}
                      <div
                        id={optId(i)}
                        role="option"
                        aria-selected={i === activeIdx}
                        className="cmdk-row"
                        onMouseMove={() => i !== activeIdx && setActive(i)}
                        onClick={() => runRow(row)}
                      >
                        <Icon size={18} aria-hidden />
                        <span className="cmdk-label">{row.label}</span>
                        {row.shortcut && row.shortcut.length > 0 && (
                          <span className="cmdk-keys" aria-hidden>
                            {row.shortcut.map((k, j) => <kbd key={j} className="kbd">{k}</kbd>)}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
