import { useCallback, useRef, useState } from 'react';
import { ask } from '../ai/agent';
import { navigate } from '../lib/hooks';
import { useToast } from './Toaster';

/** Send a message to the local AI from anywhere (top bar or chat). */
export function useAssistant() {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const inflight = useRef(false);

  const send = useCallback(async (text: string, opts: { toastReply?: boolean } = {}) => {
    const msg = text.trim();
    if (!msg || inflight.current) return false; // no double submit
    inflight.current = true;
    setBusy(true);
    try {
      const r = await ask(msg);
      if (r.run.navigate) navigate(r.run.navigate.page, { pillar: r.run.navigate.pillarIndex !== undefined ? r.run.navigate.pillarIndex + 1 : undefined, s: r.run.navigate.section });
      if (opts.toastReply) {
        toast({ title: r.reply, detail: r.run.effects.join(' · ') || undefined, journal: r.run.journal.length ? r.run.journal : undefined });
      } else if (r.run.journal.length) {
        toast({ title: r.run.effects[0] ?? 'Saved', detail: r.run.effects.length > 1 ? `+${r.run.effects.length - 1} more` : undefined, journal: r.run.journal });
      }
      return true;
    } catch (e) {
      toast({ title: 'The assistant hit a problem. Your message was kept.', detail: e instanceof Error ? e.message : undefined });
      return false;
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  }, [toast]);

  return { send, busy };
}
