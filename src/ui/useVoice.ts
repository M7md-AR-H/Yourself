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

const ERRORS: Record<string, string> = {
  'not-allowed': 'Microphone blocked. Allow it in Chrome’s site settings.',
  'service-not-allowed': 'Speech recognition isn’t allowed on this device.',
  'no-speech': 'Didn’t hear anything. Try again.',
  'audio-capture': 'No microphone found.',
  network: 'Online speech needs internet. Try again on Wi‑Fi, or type instead.',
  'language-not-supported': 'Your language isn’t supported for speech yet.',
};

export interface VoiceHandlers {
  onFinal: (text: string) => void;
  onInterim?: (text: string) => void;
  /** Called every time audio goes to Google's online service (no on-device speech). */
  onCloud?: () => void;
  onError?: (message: string) => void;
}

/**
 * Speech → text. Tries on-device recognition first (Chrome's `processLocally`); otherwise
 * Chrome's normal recognition sends audio to Google, and `onCloud` lets the UI say so.
 */
export function useVoice(h: VoiceHandlers) {
  const [listening, setListening] = useState(false);
  const rec = useRef<SR | null>(null);
  /** Remembered per session: once on-device fails, go straight to cloud next time. */
  const localOk = useRef(true);
  const cb = useRef(h);
  useEffect(() => { cb.current = h; });

  const detach = (r: SR) => { r.onresult = null; r.onerror = null; r.onend = null; };

  const start = useCallback(() => {
    const C = Ctor();
    if (!C) return;
    if (rec.current) { detach(rec.current); rec.current.abort(); }
    const r = new C();
    r.lang = navigator.language || 'en-US';
    r.interimResults = true;
    r.continuous = false;
    const local = localOk.current && 'processLocally' in r;
    if (local) r.processLocally = true;
    else cb.current.onCloud?.();
    let gotFinal = false;
    let hadInterim = false;
    r.onresult = (e) => {
      let text = '';
      let final = false;
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        if (e.results[i].isFinal) final = true;
      }
      if (final) { gotFinal = true; cb.current.onFinal(text.trim()); }
      else { hadInterim = true; cb.current.onInterim?.(text); }
    };
    r.onerror = (e) => {
      if (local && ['language-not-supported', 'service-not-allowed'].includes(e.error)) {
        localOk.current = false; // on-device not available here → retry once via Chrome's online service
        detach(r);
        rec.current = null;
        setTimeout(start, 0);
        return;
      }
      if (e.error !== 'aborted') cb.current.onError?.(ERRORS[e.error] ?? 'Voice input stopped. Try again.');
    };
    r.onend = () => {
      if (rec.current !== r) return;
      if (!gotFinal && hadInterim) cb.current.onInterim?.(''); // don't leave half a sentence in the box
      setListening(false);
      rec.current = null;
    };
    rec.current = r;
    setListening(true);
    try { r.start(); } catch { setListening(false); rec.current = null; }
  }, []);

  const stop = useCallback(() => rec.current?.stop(), []);
  useEffect(() => () => { if (rec.current) { detach(rec.current); rec.current.abort(); } }, []);
  return { listening, start, stop, supported: voiceSupported() };
}
