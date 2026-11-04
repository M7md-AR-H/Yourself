import { AnimatePresence, motion } from 'framer-motion';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { runCommands, undo, type Command, type JournalEntry } from '../lib/commands';
import { navigate } from '../lib/hooks';

interface ToastItem { id: number; title: string; detail?: string; journal?: JournalEntry[] }
interface Ctx {
  toast: (t: Omit<ToastItem, 'id'>) => void;
  /** Run commands from the UI. Instant (local DB), with an Undo toast. */
  exec: (cmds: Command[], opts?: { silent?: boolean; label?: string }) => Promise<void>;
}
const ToastCtx = createContext<Ctx | null>(null);
export const useToast = () => useContext(ToastCtx)!;

export function Toaster({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setItems((xs) => xs.filter((x) => x.id !== id));
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const toast = useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = ++seq.current;
    // Only the newest change can be undone: older snapshots could overwrite newer edits.
    setItems((xs) => [...xs.slice(-1).map((x) => (t.journal ? { ...x, journal: undefined } : x)), { ...t, id }]);
    timers.current.set(id, setTimeout(() => dismiss(id), t.journal?.length ? 6000 : 3500));
  }, [dismiss]);

  const exec = useCallback<Ctx['exec']>(async (cmds, opts) => {
    try {
      const r = await runCommands(cmds);
      if (r.navigate) navigate(r.navigate.page, { pillar: r.navigate.pillarIndex !== undefined ? r.navigate.pillarIndex + 1 : undefined });
      if (r.errors.length) toast({ title: r.errors[0] });
      else if (!opts?.silent && (r.effects.length || opts?.label)) toast({ title: opts?.label ?? r.effects[0], detail: r.effects.length > 1 ? `+${r.effects.length - 1} more` : undefined, journal: r.journal.length ? r.journal : undefined });
    } catch (e) {
      toast({ title: 'Couldn’t save that. Try again.', detail: e instanceof Error ? e.message : undefined });
    }
  }, [toast]);

  return (
    <ToastCtx.Provider value={{ toast, exec }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div
              key={t.id}
              className="toast"
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={(_, i) => Math.abs(i.offset.x) > 80 && dismiss(t.id)}
            >
              <div className="msg">
                {t.title}
                {t.detail && <small>{t.detail}</small>}
              </div>
              {t.journal && (
                <button
                  onClick={async () => {
                    dismiss(t.id);
                    await undo(t.journal!);
                    toast({ title: 'Undone' });
                  }}
                >
                  Undo
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
