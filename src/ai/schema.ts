import { COMMAND_TYPES, type Command } from '../lib/commands';
import type { Page, ThemePref } from '../lib/types';

/** JSON schema the model is forced to follow (grammar-constrained decoding in WebLLM). */
export const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    commands: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: [...COMMAND_TYPES] },
          title: { type: 'string' },
          text: { type: 'string' },
          task: { type: 'string' },
          note: { type: 'string' },
          action: { type: 'string' },
          pillar: { type: 'string' },
          replace: { type: 'string' },
          due: { type: 'string' },
          date: { type: 'string' },
          page: { type: 'string', enum: ['today', 'chart', 'notes', 'chat', 'settings'] },
          theme: { type: 'string', enum: ['system', 'light', 'dark'] },
          name: { type: 'string' },
        },
        required: ['type'],
      },
    },
    reply: { type: 'string' },
  },
  required: ['commands', 'reply'],
} as const;

export interface ModelOutput {
  reply: string;
  commands: Command[];
}

const s = (v: unknown, max = 500): string | undefined => {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v !== 'string') return undefined;
  const t = v.trim().slice(0, max);
  return t || undefined;
};

/**
 * AI output is untrusted: keep only well-formed commands with the fields each needs,
 * drop everything else. Returns null when the text isn't usable JSON at all.
 */
export function parseModelOutput(raw: string): ModelOutput | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    try {
      data = m ? JSON.parse(m[0]) : null;
    } catch {
      data = null;
    }
  }
  if (!data) data = salvage(raw);
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  const list = Array.isArray(obj.commands) ? obj.commands.slice(0, 20) : [];
  const commands: Command[] = [];
  for (const item of list) {
    const c = sanitizeCommand(item);
    if (c) commands.push(c);
  }
  return { reply: s(obj.reply, 800) ?? '', commands };
}

/** Output cut off mid-JSON (token limit): keep every command object that did complete. */
function salvage(raw: string): { commands: unknown[]; reply: string } | null {
  const start = raw.indexOf('[', raw.indexOf('"commands"'));
  if (raw.indexOf('"commands"') < 0 || start < 0) return null;
  const commands: unknown[] = [];
  let depth = 0, from = -1, inStr = false, esc = false;
  for (let i = start + 1; i < raw.length; i++) {
    const ch = raw[i];
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === '{') { if (depth++ === 0) from = i; }
    else if (ch === '}' && --depth === 0 && from >= 0) {
      try { commands.push(JSON.parse(raw.slice(from, i + 1))); } catch { /* skip */ }
    } else if (ch === ']' && depth === 0) break;
  }
  return commands.length ? { commands, reply: '' } : null;
}

export function sanitizeCommand(item: unknown): Command | null {
  if (!item || typeof item !== 'object') return null;
  const o = item as Record<string, unknown>;
  const pillar = s(o.pillar, 60);
  switch (o.type) {
    case 'set_name': { const name = s(o.name ?? o.title, 60); return name ? { type: 'set_name', name } : null; }
    case 'set_goal': { const title = s(o.title ?? o.text, 120); return title ? { type: 'set_goal', title } : null; }
    case 'set_pillar': { const title = s(o.title, 40); return title && pillar ? { type: 'set_pillar', pillar, title } : null; }
    case 'set_action': {
      const title = s(o.title ?? o.action, 60);
      const slot = typeof o.slot === 'number' && Number.isInteger(o.slot) && o.slot >= 1 && o.slot <= 8 ? o.slot : undefined;
      return title && pillar ? { type: 'set_action', pillar, title, slot, replace: s(o.replace, 60) } : null;
    }
    case 'remove_action': { const action = s(o.action ?? o.title, 60); return action ? { type: 'remove_action', action, pillar } : null; }
    case 'check_in':
    case 'uncheck': { const action = s(o.action ?? o.title, 60); return action ? { type: o.type, action, date: s(o.date, 20) } : null; }
    case 'add_task': { const title = s(o.title ?? o.task ?? o.text, 140); return title ? { type: 'add_task', title, due: s(o.due ?? o.date, 20), pillar } : null; }
    case 'complete_task':
    case 'reopen_task':
    case 'delete_task': { const task = s(o.task ?? o.title, 140); return task ? { type: o.type, task } : null; }
    case 'edit_task': { const task = s(o.task, 140); return task ? { type: 'edit_task', task, title: s(o.title, 140), due: s(o.due, 20) } : null; }
    case 'clear_done_tasks': return { type: 'clear_done_tasks' };
    case 'add_note': { const text = s(o.text ?? o.note ?? o.title, 4000); return text ? { type: 'add_note', text, pillar } : null; }
    case 'edit_note': { const note = s(o.note, 200); const text = s(o.text, 4000); return note && text ? { type: 'edit_note', note, text } : null; }
    case 'delete_note': { const note = s(o.note ?? o.text, 200); return note ? { type: 'delete_note', note } : null; }
    case 'navigate': {
      const page = s(o.page, 20) as Page | undefined;
      return page && ['today', 'chart', 'notes', 'chat', 'settings'].includes(page) ? { type: 'navigate', page, pillar } : null;
    }
    case 'set_theme': {
      const theme = s(o.theme, 10) as ThemePref | undefined;
      return theme && ['system', 'light', 'dark'].includes(theme) ? { type: 'set_theme', theme } : null;
    }
    default: return null;
  }
}
