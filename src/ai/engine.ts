/**
 * Local Gemma model, run fully on the phone with WebGPU (WebLLM / MLC).
 * Weights download once from Hugging Face (mlc-ai, no account needed) and stay cached.
 */
import type { WebWorkerMLCEngine } from '@mlc-ai/web-llm';
import type { ModelId } from '../lib/types';
import { RESPONSE_SCHEMA } from './schema';

export const MODELS: { id: ModelId; label: string; size: string; note: string }[] = [
  { id: 'gemma3-1b-it-q4f16_1-MLC', label: 'Gemma 3 · 1B', size: '0.7 GB', note: 'Fastest. Good for everyday logging.' },
  { id: 'gemma-2-2b-it-q4f16_1-MLC', label: 'Gemma 2 · 2B', size: '1.9 GB', note: 'Smarter, a bit slower.' },
  { id: 'gemma-4-E2B-it-q4f16_1-MLC', label: 'Gemma 4 · E2B', size: '3.4 GB', note: 'Smartest. Needs lots of free memory.' },
];

export type EngineStatus =
  | { state: 'off' }
  | { state: 'unsupported'; reason: string }
  | { state: 'loading'; progress: number; text: string }
  | { state: 'ready'; model: ModelId }
  | { state: 'error'; message: string };

type Listener = (s: EngineStatus) => void;

let engine: WebWorkerMLCEngine | null = null;
let worker: Worker | null = null;
let loadedModel: ModelId | null = null;
let loading: { model: ModelId; p: Promise<void> } | null = null;
let status: EngineStatus = { state: 'off' };
const listeners = new Set<Listener>();
/** One generation at a time, across the whole app (top bar + chat share it). */
let queue: Promise<unknown> = Promise.resolve();

function set(s: EngineStatus) {
  status = s;
  listeners.forEach((l) => l(s));
}
export const getStatus = () => status;
export function subscribe(l: Listener) {
  listeners.add(l);
  return () => void listeners.delete(l);
}

export async function checkSupport(): Promise<string | null> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ features: Set<string> } | null> } }).gpu;
  if (!gpu) return 'This browser has no WebGPU. Use Chrome on Android (version 121 or newer).';
  try {
    const adapter = await gpu.requestAdapter();
    if (!adapter) return 'WebGPU is on, but no GPU adapter was found.';
    if (!adapter.features.has('shader-f16')) return 'This GPU lacks 16-bit float support, which these Gemma builds need.';
  } catch {
    return 'WebGPU could not start on this device.';
  }
  return null;
}

export async function isCached(model: ModelId): Promise<boolean> {
  try {
    const { hasModelInCache } = await import('@mlc-ai/web-llm');
    return await hasModelInCache(model);
  } catch {
    return false;
  }
}

export async function deleteModel(model: ModelId) {
  const { deleteModelAllInfoInCache } = await import('@mlc-ai/web-llm');
  if (loadedModel === model) await unload();
  await deleteModelAllInfoInCache(model);
}

async function teardown() {
  try {
    await engine?.unload();
  } catch {
    /* ignore */
  }
  worker?.terminate(); // frees GPU + WASM memory held by the old worker
  worker = null;
  engine = null;
  loadedModel = null;
}

export async function load(model: ModelId): Promise<void> {
  if (loadedModel === model && engine) return;
  if (loading?.model === model) return loading.p;
  if (loading) await loading.p.catch(() => {}); // a different model was loading: wait, then switch
  if (loadedModel === model && engine) return;
  const p = (async () => {
    const reason = await checkSupport();
    if (reason) {
      set({ state: 'unsupported', reason });
      return;
    }
    set({ state: 'loading', progress: 0, text: 'Starting…' });
    try {
      await teardown();
      const { CreateWebWorkerMLCEngine } = await import('@mlc-ai/web-llm');
      worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      engine = await CreateWebWorkerMLCEngine(worker, model, {
        initProgressCallback: (r) => set({ state: 'loading', progress: r.progress, text: r.text }),
      });
      loadedModel = model;
      set({ state: 'ready', model });
    } catch (e) {
      await teardown();
      set({ state: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  })().finally(() => {
    if (loading?.p === p) loading = null;
  });
  loading = { model, p };
  return p;
}

export async function unload() {
  await teardown();
  set({ state: 'off' });
}

export const isReady = () => status.state === 'ready' && !!engine;

/** One JSON-constrained completion. Returns raw text (validated by the caller). */
export function complete(prompt: string, signal?: AbortSignal): Promise<string> {
  const run = async () => {
    const e = engine;
    if (!e) throw new Error('Model not loaded');
    const onAbort = () => e.interruptGenerate();
    signal?.addEventListener('abort', onAbort);
    try {
      const res = await e.chat.completions.create({
        // Gemma has no system role, so all instructions live in one user turn.
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 800,
        response_format: { type: 'json_object', schema: JSON.stringify(RESPONSE_SCHEMA) },
      });
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      return res.choices[0]?.message?.content ?? '';
    } finally {
      signal?.removeEventListener('abort', onAbort);
      // Each message is independent (context is rebuilt), so drop the KV cache.
      await e.resetChat().catch(() => {});
    }
  };
  const next = queue.then(run, run);
  queue = next.catch(() => {});
  return next;
}
