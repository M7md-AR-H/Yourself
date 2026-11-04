import { useCallback, useEffect, useRef, useState } from 'react';

/* Minimal typings for the Web Speech API (not in TS's DOM lib). */
interface SR extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  processLocally?: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SRCtor = new () => SR;
const Ctor = (): SRCtor | undefined =>
  (window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor }).SpeechRecognition ??
  (window as unknown as { webkitSpeechRecognition?: SRCtor }).webkitSpeechRecognition;

export const voiceSupported = () => !!Ctor();

/**
 * Speech → text. Tries on-device recognition first (Chrome's `processLocally`);
 * if the phone can't do that, Chrome's normal recognition sends audio to Google —
 * `onCloud` lets the UI say so.
 */
export function useVoice(onFinal: (text: string) => void, onInterim?: (text: string) => void, onCloud?: () => void) {
  const [listening, setListening] = useState(false);
  const rec = useRef<SR | null>(null);
  const triedCloud = useRef(false);
  const cb = useRef({ onFinal, onInterim, onCloud });
  useEffect(() => { cb.current = { onFinal, onInterim, onCloud }; });

  const start = useCallback((local = true) => {
    const C = Ctor();
    if (!C) return;
    rec.current?.abort();
    const r = new C();
    r.lang = navigator.language || 'en-US';
    r.interimResults = true;
    r.continuous = false;
    if (local && 'processLocally' in r) r.processLocally = true;
    else if (!local) cb.current.onCloud?.();
    r.onresult = (e) => {
      let text = '';
      let final = false;
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        if (e.results[i].isFinal) final = true;
      }
      if (final) cb.current.onFinal(text.trim());
      else cb.current.onInterim?.(text);
    };
    r.onerror = (e) => {
      // On-device model missing for this language → fall back once to Chrome's normal recognition.
      if (local && !triedCloud.current && ['language-not-supported', 'service-not-allowed'].includes(e.error)) {
        triedCloud.current = true;
        setTimeout(() => start(false), 0);
      }
    };
    r.onend = () => { if (rec.current === r) { setListening(false); rec.current = null; } };
    rec.current = r;
    setListening(true);
    try { r.start(); } catch { setListening(false); }
  }, []);

  const stop = useCallback(() => rec.current?.stop(), []);
  useEffect(() => () => rec.current?.abort(), []);
  return { listening, start: () => start(true), stop, supported: voiceSupported() };
}
