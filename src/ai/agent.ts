/**
 * The assistant loop: message → (Gemma or offline parser) → validated commands → run → reply.
 */
import { db as defaultDb, getSettings, type YourselfDB } from '../lib/db';
import { runCommands, type Command, type RunResult } from '../lib/commands';
import { computeStats } from '../lib/stats';
import { uid, ymd } from '../lib/util';
import * as engine from './engine';
import { parseFallback, type FallbackContext } from './fallback';
import { buildPrompt } from './prompt';
import { parseModelOutput } from './schema';

export interface AgentResult {
  reply: string;
  run: RunResult;
  usedModel: boolean;
}

export async function gatherContext(d: YourselfDB, today = ymd()) {
  const [settings, goal, pillars, actions, checkins, tasks, notes, history] = await Promise.all([
    getSettings(d),
    d.goal.get('goal'),
    d.pillars.toArray(),
    d.actions.toArray(),
    d.checkins.where('date').aboveOrEqual(ymd(new Date(Date.now() - 15 * 864e5))).toArray(),
    d.tasks.orderBy('createdAt').reverse().toArray(),
    d.notes.orderBy('createdAt').reverse().limit(20).toArray(),
    d.chat.orderBy('createdAt').reverse().limit(6).toArray(),
  ]);
  const stats = computeStats(pillars, actions, checkins, tasks, today);
  return { settings, goal, pillars, actions, tasks, notes, history: history.reverse(), stats };
}

function fallbackCtx(c: Awaited<ReturnType<typeof gatherContext>>): FallbackContext {
  const pillarName = new Map(c.pillars.map((p) => [p.id, p.title]));
  return {
    pillars: c.pillars.filter((p) => p.title).sort((a, b) => a.index - b.index).map((p) => p.title),
    actions: c.actions.filter((a) => a.title).map((a) => ({ title: a.title, pillar: pillarName.get(a.pillarId) ?? '' })),
    tasks: c.tasks.map((t) => ({ title: t.title, done: t.done })),
    notes: c.notes.map((n) => n.text),
  };
}

export async function ask(message: string, opts: { db?: YourselfDB; signal?: AbortSignal; today?: string; readOnly?: boolean } = {}): Promise<AgentResult> {
  const d = opts.db ?? defaultDb;
  const today = opts.today ?? ymd();
  const text = message.trim().slice(0, 2000);
  const ctx = await gatherContext(d, today);
  if (!opts.readOnly) await d.chat.put({ id: uid(), role: 'user', text, createdAt: Date.now() });

  let commands: Command[] = [];
  let reply = '';
  let usedModel = false;
  if (engine.isReady()) {
    try {
      const raw = await engine.complete(buildPrompt(text, { ...ctx, name: ctx.settings.name, today }), opts.signal);
      const out = parseModelOutput(raw);
      if (out && (out.commands.length || out.reply)) {
        commands = out.commands;
        reply = out.reply;
        usedModel = true;
      }
    } catch (e) {
      if (opts.signal?.aborted) throw e;
      console.warn('Model failed, using offline parser', e);
    }
  }
  if (!usedModel) {
    const fb = parseFallback(text, fallbackCtx(ctx));
    commands = fb.commands;
    reply = fb.reply;
  }

  if (opts.readOnly) return { reply, run: { effects: [], errors: [], journal: [] }, usedModel };
  const run = await runCommands(commands, d, today);
  if (run.errors.length) reply = [reply, ...run.errors].filter(Boolean).join(' ');
  if (!reply) reply = run.effects.length ? 'Done.' : 'Got it.';
  await d.chat.put({ id: uid(), role: 'assistant', text: reply, effects: run.effects, createdAt: Date.now() + 1 });
  return { reply, run, usedModel };
}
