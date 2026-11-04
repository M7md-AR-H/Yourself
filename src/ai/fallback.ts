/**
 * Rule-based English intent parser, used when the on-device LLM is not loaded.
 * Pure and deterministic: text in, `Command[]` (the app's only vocabulary) out.
 *
 * Flow: (1) "whole message" rules that own a body of text (notes, goal, chart
 * edits); (2) otherwise split into clauses and try the ordered RULES on each;
 * (3) if nothing matched, save the message as a note.
 */
import type { Command, PillarRef } from '../lib/commands';
import type { Page, ThemePref } from '../lib/types';
import { bestMatch, normalize, similarity } from '../lib/util';
import { findHelp, HELP } from '../lib/help';

export interface FallbackContext {
  pillars: string[];
  actions: { title: string; pillar: string }[];
  tasks: { title: string; done: boolean }[];
  notes: string[];
}
export interface FallbackResult {
  reply: string;
  commands: Command[];
}

type Rule = {
  name: string;
  /** Also tried on the whole (unsplit) message first. */
  whole?: boolean;
  /** `s` = prepared clause, `o` = same clause with the user's original wording. */
  run: (s: string, ctx: FallbackContext, o: string) => Command[] | null;
};

/* ------------------------------------------------------------------ text helpers */

const POLITE_LEAD =
  /^(?:(?:hey|hi|hello|yo|ok|okay|so|well|um|uh|oh|oops|sorry|wait|please|pls|kindly|could you|can you|would you|will you|can u|could u|would u|i want you to|i would like you to|i'd like you to|i need you to|go ahead and|just|now|actually|and|then|also)[\s,]+)+/i;
const POLITE_TRAIL = /[\s,]+(?:please|pls|thanks|thank you|thx|for me|if you can)$/i;

function prep(raw: string): string {
  let s = raw
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
  s = s.replace(/^[\s,;.!?]+|[\s,;.!?]+$/g, '');
  for (let i = 0; i < 3; i++) {
    s = s.replace(POLITE_LEAD, '').replace(POLITE_TRAIL, '').trim();
  }
  return s;
}

function expandPronouns(s: string): string {
  return s
    .replace(/\bi'll\b/gi, 'I will')
    .replace(/\bi'm\b/gi, 'I am')
    .replace(/\bi've\b/gi, 'I have')
    .replace(/\bi'd\b/gi, 'I would');
}

function unquote(s: string): string {
  const t = s.trim().replace(/[\s.,;!?]+$/, '');
  const m = t.match(/^(["'`])(.*)\1$/s);
  return (m ? m[2] : t).trim();
}

const cleanTitle = (s: string): string =>
  unquote(s.replace(/^(?:that|about)\s+/i, '').replace(POLITE_TRAIL, '')).trim();

const cap = (s: string) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

/** Replaces text inside quotes with filler so separators in it are not split on. */
function maskQuotes(s: string): string {
  return s.replace(/"[^"]*"|(?<=^|[\s(])'[^']*'(?=$|[\s.,;:!?)])/g, (m) => 'x'.repeat(m.length));
}

/* ------------------------------------------------------------------ dates */

const WD = 'monday|tuesday|wednesday|thursday|friday|saturday|sunday';
const WD3 = 'mon|tue|wed|thu|fri|sat|sun';
const DATE_CORE = `today|tonight|tomorrow|tmrw|tmr|yesterday|next week|in \\d+ (?:days?|weeks?)|(?:next|this) (?:${WD}|${WD3})|${WD}|\\d{4}-\\d{2}-\\d{2}`;
const PREP = '(?:(?:due on|due|on|by|for|until|till|before)\\s+)?';
const DATE_RE = new RegExp(`\\b${PREP}(${DATE_CORE})\\b`, 'i');
const ABBR_RE = new RegExp(`\\b(?:on|by)\\s+(${WD3})\\b`, 'i');
const DATE_ONLY = new RegExp(`^${PREP}(${DATE_CORE})$`, 'i');

function extractDate(s: string): { rest: string; date?: string } {
  const m = DATE_RE.exec(s) ?? ABBR_RE.exec(s);
  if (!m) return { rest: s };
  const rest = (s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length)).replace(/\s+/g, ' ').replace(/^[\s,]+|[\s,]+$/g, '');
  return { rest, date: m[1].toLowerCase() };
}

function dateOnly(s: string): string | undefined {
  const m = DATE_ONLY.exec(s.trim().replace(/[.!]+$/, ''));
  if (m) return m[1].toLowerCase();
  const a = new RegExp(`^(?:on|by)\\s+(${WD3})$`, 'i').exec(s.trim());
  return a ? a[1].toLowerCase() : undefined;
}

/* ------------------------------------------------------------------ stemming + fuzzy matching */

const IRREGULAR: Record<string, string> = {
  ran: 'run', slept: 'sleep', ate: 'eat', drank: 'drink', took: 'take', woke: 'wake', went: 'go',
  did: 'do', swam: 'swim', wrote: 'write', got: 'get', bought: 'buy', paid: 'pay', saw: 'see',
  had: 'have', made: 'make', sat: 'sit', stood: 'stand', spoke: 'speak', taught: 'teach',
};

function stem(w: string): string {
  const irr = IRREGULAR[w];
  if (irr) return stem(irr);
  let s = w;
  if (s.endsWith('ies') && s.length > 4) s = s.slice(0, -3) + 'y';
  else if (/(?:sses|ches|shes|xes)$/.test(s)) s = s.slice(0, -2);
  else if (s.endsWith('s') && !s.endsWith('ss') && s.length > 3) s = s.slice(0, -1);
  if (s.endsWith('ing') && s.length > 5) s = s.slice(0, -3);
  else if (s.endsWith('ed') && s.length > 4) s = s.slice(0, -2);
  if (s.endsWith('e') && s.length > 3) s = s.slice(0, -1);
  if (/([b-df-hj-np-tv-z])\1$/.test(s) && !/(?:ll|ss|ff|zz)$/.test(s)) s = s.slice(0, -1);
  return s;
}

const STOP = new Set(
  ['i', 'me', 'my', 'a', 'an', 'the', 'to', 'of', 'in', 'on', 'at', 'for', 'and', 'with', 'some', 'just', 'did', 'do',
    'does', 'had', 'have', 'has', 'today', 'yesterday', 'last', 'night', 'this', 'morning', 'evening', 'also',
    'actually', 'really', 'again', 'it', 'was', 'am', 'been', 'got', 'so', 'up', 'is', 'are', 'be', 'every', 'each',
    'by', 'from', 'about', 'after', 'before', 'while', 'that', 'too', 'go', 'went', 'then', 'as', 'or'].map(stem),
);
/** Numbers and units carry little meaning when matching an action ("Meditate 10 min"). */
const LOW = new Set(['min', 'mins', 'minute', 'page', 'time', 'week', 'day', 'x'].map(stem));

function toks(s: string): string[] {
  return normalize(s)
    .split(/[\s-]+/)
    .filter(Boolean)
    .map(stem)
    .filter((t) => !STOP.has(t) && (t.length > 1 || /\d/.test(t)));
}

const tokEq = (a: string, b: string) => a === b || (a.length >= 6 && b.length >= 6 && (a.startsWith(b) || b.startsWith(a)));
const weight = (t: string) => (/^\d+$/.test(t) || LOW.has(t) ? 0.3 : 1);

function bestAction(text: string, ctx: FallbackContext, min = 0.5, forNegation = false) {
  const ct = toks(text);
  const n = ` ${normalize(text)} `;
  const hasNeg = /\b(?:no|not|without|never|skip|skipped|avoid|avoided|stopped|didnt|dont)\b/.test(n);
  const hasNo = /\bno\b/.test(n);
  let best: { title: string; pillar: string } | undefined;
  let top = min - 1e-9;
  for (const a of ctx.actions) {
    if (!a.title) continue;
    const at = Array.from(new Set(toks(a.title)));
    if (!at.length) continue;
    const negAction = /^(?:no|dont|without|avoid)\b/.test(normalize(a.title));
    if (negAction && (forNegation ? !hasNo : !hasNeg)) continue;
    let total = 0;
    let hit = 0;
    for (const t of at) {
      const w = weight(t);
      total += w;
      if (ct.some((c) => tokEq(c, t))) hit += w;
    }
    const score = hit / total;
    if (score > top) {
      top = score;
      best = a;
    }
  }
  return best ? { action: best, score: top } : undefined;
}

/* ------------------------------------------------------------------ pillars / tasks lookup */

const NUM_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8,
};

/** A pillar reference the chart knows: a slot number 1..8 or a name matching ctx.pillars. */
function knownPillar(text: string, ctx: FallbackContext): PillarRef | undefined {
  const x = unquote(text).replace(/^(?:the|my)\s+/i, '').replace(/\s+(?:pillar|block|area|category)$/i, '').trim();
  const num = x.match(/^(?:#|number\s+|no\.?\s*)?(\d)$/);
  if (num) return Number(num[1]) >= 1 && Number(num[1]) <= 8 ? Number(num[1]) : undefined;
  if (NUM_WORDS[x.toLowerCase()]) return NUM_WORDS[x.toLowerCase()];
  if (x.length < 3 || x.split(' ').length > 3) return undefined;
  const nx = normalize(x);
  return ctx.pillars.some((p) => normalize(p) === nx || similarity(x, p) >= 0.85) ? x : undefined;
}

/** The pillar ref to emit: a number stays a number, a name is the user's own words. */
const pillarRef = (text: string, known: PillarRef): PillarRef =>
  typeof known === 'number' ? known : unquote(text).replace(/\s+(?:pillar|block)$/i, '');

/** A pillar name appearing as whole word(s) inside free text, longest name first. */
function pillarIn(text: string, ctx: FallbackContext): string | undefined {
  const names = [...ctx.pillars].filter(Boolean).sort((a, b) => b.length - a.length);
  for (const p of names) {
    const m = new RegExp(`(?<![\\w])${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w])`, 'i').exec(text);
    if (m) return m[0];
  }
  return undefined;
}

function matchTask(ref: string, ctx: FallbackContext, openOnly = true) {
  const pool = openOnly ? ctx.tasks.filter((t) => !t.done) : ctx.tasks;
  const t = bestMatch(ref, pool, (x) => x.title, 0.4);
  return t ? { task: t, score: similarity(ref, t.title) } : undefined;
}

const taskRef = (s: string) =>
  cleanTitle(s).replace(/^(?:the|my|a|an)\s+/i, '').replace(/\s+(?:task|todo|reminder)$/i, '').trim();

/** Best ctx task title for the user's words (open first), else the words themselves. */
function resolveTask(words: string, ctx: FallbackContext, openOnly = true): string {
  const ref = taskRef(words);
  const m = matchTask(ref, ctx, openOnly) ?? (openOnly ? matchTask(ref, ctx, false) : undefined);
  return m ? m.task.title : ref;
}

/* ------------------------------------------------------------------ rules */

const noteBody = (body: string, ctx: FallbackContext): Command[] | null => {
  let text = body.trim();
  let pillar: string | undefined;
  const pm = text.match(/^(?:to|for|in|under|on)\s+(?:my\s+|the\s+)?([\w ]{2,30}?)\s*(?:pillar\s*)?[:-]\s*(.+)$/is);
  if (pm && knownPillar(pm[1], ctx) !== undefined) {
    pillar = pm[1].trim();
    text = pm[2].trim();
  }
  if (!text) return null;
  pillar ??= pillarIn(text, ctx);
  return [{ type: 'add_note', text, ...(pillar ? { pillar } : {}) }];
};

const NOTE_PREFIX = new RegExp(
  '^(?:' +
    '(?:add|make|create|write|save|take|jot|put|leave|keep|store)\\s+(?:me\\s+)?(?:this\\s+|that\\s+|it\\s+)?(?:as\\s+)?(?:a\\s+|an\\s+)?(?:new\\s+|quick\\s+)?note(?:\\s+(?:saying|that says|that|about))?\\s*[:\\-,]?' +
    '|note(?:\\s+to\\s+self)?(?:\\s+that)?\\s*[:\\-,]?' +
    '|remember\\s+that|remember\\s*:' +
    '|(?:write|jot|put|note)\\s+(?:this\\s+|that\\s+|it\\s+)?down(?:\\s+that|\\s*:)?' +
    '|journal\\s+entry\\s*[:\\-]?|journal\\s*[:\\-]|diary\\s*[:\\-]|dear diary\\s*[,:\\-]?' +
    ')\\s+(?=\\S)(.+)$',
  'is',
);

const noteRule: Rule = {
  name: 'note',
  whole: true,
  run: (_s, ctx, o) => {
    const m = NOTE_PREFIX.exec(o);
    return m ? noteBody(m[1], ctx) : null;
  },
};

const LAST = '(last|latest|previous|recent|most recent)';

const editNote: Rule = {
  name: 'edit_note',
  whole: true,
  run: (s) => {
    let m = s.match(new RegExp(`^(?:edit|change|update|rewrite|modify|fix|correct)\\s+(?:the\\s+|my\\s+)?${LAST}\\s+note\\s*(?:to say|to read|to|into|so it says|saying|should say|:|-)\\s*(.+)$`, 'i'));
    if (m) return [{ type: 'edit_note', note: 'last', text: unquote(m[2]) }];
    m = s.match(/^(?:edit|change|update|rewrite|modify)\s+(?:the\s+|my\s+)?note\s+(?:about|on|called|saying)\s+(.+?)\s+(?:to say|to|into)\s+(.+)$/i);
    if (m) return [{ type: 'edit_note', note: unquote(m[1]), text: unquote(m[2]) }];
    return null;
  },
};

const deleteNote: Rule = {
  name: 'delete_note',
  run: (s) => {
    const m = s.match(new RegExp(`^(?:delete|remove|erase|trash|discard|get rid of|scrap)\\s+(?:the\\s+|my\\s+|that\\s+)?${LAST}?\\s*notes?\\b\\s*(?:about|on|called|saying|that says)?\\s*(.*)$`, 'i'));
    if (!m) return null;
    const ref = unquote(m[2] ?? '');
    return [{ type: 'delete_note', note: m[1] || !ref ? 'last' : ref }];
  },
};

const setGoal: Rule = {
  name: 'set_goal',
  whole: true,
  run: (s) => {
    const G = '(?:main\\s+|big\\s+|life\\s+|overall\\s+|ultimate\\s+|central\\s+)?goal';
    const m =
      s.match(new RegExp(`^(?:my\\s+)?${G}\\s+(?:is|will be|would be|should be|:)\\s*(?:to\\s+)?(.+)$`, 'i')) ??
      s.match(new RegExp(`^(?:set|change|update|make|rename)\\s+(?:my\\s+)?${G}\\s+(?:to|as|=|:)\\s*(?:to\\s+)?(.+)$`, 'i')) ??
      s.match(/^i\s+want\s+my\s+(?:main\s+)?goal\s+to\s+be\s+(.+)$/i);
    const title = m ? cleanTitle(m[1]) : '';
    return title ? [{ type: 'set_goal', title }] : null;
  },
};

const setPillar: Rule = {
  name: 'set_pillar',
  whole: true,
  run: (s, ctx) => {
    let m = s.match(/^(?:rename|change|set|update|call|make|switch)\s+(?:my\s+|the\s+)?(?:pillar|block|area|category)\s+(.+?)\s+(?:to|as|into|=)\s+(.+)$/i);
    if (!m) m = s.match(/^(?:pillar|block)\s+(\d|one|two|three|four|five|six|seven|eight)\s*(?:is|:|=|should be|will be)\s*(.+)$/i);
    if (m) {
      const ref = knownPillar(m[1], ctx);
      const title = cleanTitle(m[2]);
      return title ? [{ type: 'set_pillar', pillar: ref === undefined ? unquote(m[1]) : pillarRef(m[1], ref), title }] : null;
    }
    // "rename skin to health" without the word pillar, only when the first part is a known pillar
    m = s.match(/^(?:rename|call)\s+(.+?)\s+(?:to|as|into)\s+(.+)$/i);
    if (m && !/\btask\b/i.test(m[1]) && typeof knownPillar(m[1], ctx) === 'string') {
      const title = cleanTitle(m[2]);
      return title ? [{ type: 'set_pillar', pillar: unquote(m[1]), title }] : null;
    }
    return null;
  },
};

const setAction: Rule = {
  name: 'set_action',
  whole: true,
  run: (s, ctx) => {
    const IN = '(?:in|on|from|under|within|inside|of)';
    const m = s.match(new RegExp(`^(?:replace|swap)\\s+(?:the\\s+)?(?:action\\s+|habit\\s+)?(.+?)\\s+(?:with|for|by|to)\\s+(.+?)\\s+${IN}\\s+(?:my\\s+|the\\s+)?(?:pillar\\s+)?(.+)$`, 'i'));
    if (m) {
      const pillar = knownPillar(m[3], ctx);
      if (pillar !== undefined) return [{ type: 'set_action', pillar: pillarRef(m[3], pillar), title: cleanTitle(m[2]), replace: cleanTitle(m[1]) }];
    }
    const m2 = s.match(/^(?:replace|swap)\s+(?:the\s+)?(?:action\s+|habit\s+)?(.+?)\s+(?:with|for|by)\s+(.+)$/i);
    if (m2) {
      const hit = bestMatch(cleanTitle(m2[1]), ctx.actions, (a) => a.title, 0.6);
      if (hit) return [{ type: 'set_action', pillar: hit.pillar, title: cleanTitle(m2[2]), replace: cleanTitle(m2[1]) }];
    }
    const ADD = '^(?:add|put|create|new|include)\\s+(?:a\\s+|an\\s+|the\\s+|new\\s+)*(?:action\\s+|habit\\s+)?';
    const TO = '\\s+(?:to|into|in|under|on)\\s+(?:my\\s+|the\\s+)?(?:pillar\\s+)?';
    for (const re of [new RegExp(`${ADD}(.+?)${TO}(.+)$`, 'i'), new RegExp(`${ADD}(.+)${TO}(.+)$`, 'i')]) {
      const a = s.match(re);
      if (!a || /^(?:task|todo|to-do|reminder|note)\b/i.test(a[1])) continue;
      const pillar = knownPillar(a[2], ctx);
      const title = cleanTitle(a[1]);
      if (pillar !== undefined && title) return [{ type: 'set_action', pillar: pillarRef(a[2], pillar), title }];
    }
    return null;
  },
};

const removeAction: Rule = {
  name: 'remove_action',
  run: (s, ctx) => {
    const V = '^(?:remove|delete|drop|erase|take out|get rid of|scrap)\\s+(?:the\\s+|my\\s+)?';
    let m = s.match(new RegExp(`${V}(?:action|habit)\\s+(.+?)(?:\\s+(?:from|in|under)\\s+(?:my\\s+|the\\s+)?(?:pillar\\s+)?(.+))?$`, 'i'));
    if (m) {
      const pillar = m[2] ? knownPillar(m[2], ctx) : undefined;
      return [{ type: 'remove_action', action: cleanTitle(m[1]), ...(pillar !== undefined ? { pillar: pillarRef(m[2], pillar) } : {}) }];
    }
    m = s.match(new RegExp(`${V}(.+?)\\s+(?:from|in|under)\\s+(?:my\\s+|the\\s+)?(?:pillar\\s+)?(.+)$`, 'i'));
    if (m) {
      const pillar = knownPillar(m[2], ctx);
      if (pillar !== undefined) return [{ type: 'remove_action', action: cleanTitle(m[1]), pillar: pillarRef(m[2], pillar) }];
    }
    return null;
  },
};

const clearDone: Rule = {
  name: 'clear_done_tasks',
  run: (s) =>
    /^(?:clear|clean up|clean out|archive|wipe|remove|delete|get rid of)\s+(?:(?:all|the|my|every|any)\s+)*(?:done|completed|finished|ticked off|checked off)(?:\s+(?:tasks?|to-?dos?|items?|ones|stuff))?(?:\s+(?:from|in|on)\s+.+)?$/i.test(s) ||
    /^(?:clear|archive|remove)\s+(?:all\s+)?(?:my\s+)?(?:tasks?|to-?dos?)\s+(?:that\s+are\s+|which are\s+)?(?:done|completed|finished)$/i.test(s)
      ? [{ type: 'clear_done_tasks' }]
      : null,
};

const setTheme: Rule = {
  name: 'set_theme',
  run: (s) => {
    if (s.split(' ').length > 8) return null;
    let m = s.match(/\b(?:turn|switch)\s+off\s+(dark|light)\s*(?:mode|theme)\b/i);
    if (m) return [{ type: 'set_theme', theme: m[1].toLowerCase() === 'dark' ? 'light' : 'dark' }];
    m = s.match(/\b(dark|light)\s*(?:mode|theme)\b/i) ?? s.match(/^(?:go|switch to|use|turn on|change to)\s+(dark|light)$/i);
    if (m) return [{ type: 'set_theme', theme: m[1].toLowerCase() as ThemePref }];
    if (/\b(?:system|auto|automatic|device)\s*(?:mode|theme|appearance)\b|\bfollow (?:the )?system\b/i.test(s)) return [{ type: 'set_theme', theme: 'system' }];
    return null;
  },
};

const setName: Rule = {
  name: 'set_name',
  run: (s) => {
    const m = s.match(/^(?:you can |from now on |please )*(?:call me|my name is|my name's|i am called|i go by|name me|change my name to|set my name to)\s+(.+)$/i);
    if (!m) return null;
    const name = unquote(m[1].replace(/\s+(?:from now on|instead|now|please)$/i, ''));
    if (!name || name.split(' ').length > 3) return null;
    return [{ type: 'set_name', name: cap(name) }];
  },
};

const PAGES: [Page, RegExp][] = [
  ['today', /^(?:today|home|tasks?|to-?dos?|todo list|task list|agenda|dashboard|schedule|day)$/],
  ['chart', /^(?:chart|mandala|mandala chart|stats|statistics|progress|pillars|goals?|overview|habits|actions|streaks?)$/],
  ['review', /^(?:review|weekly review|week|my week|this week|recap|summary|weekly summary|reflection|trends?)$/],
  ['notes', /^(?:notes?|journal|diary)$/],
  ['chat', /^(?:chat|assistant|ai|coach|messages)$/],
  ['settings', /^(?:settings?|preferences|options|profile|configuration)$/],
  ['help', /^(?:help|guide|instructions|tutorial|faq|manual)$/],
];
const pageOf = (t: string): Page | undefined => PAGES.find(([, re]) => re.test(t))?.[0];

const navigate: Rule = {
  name: 'navigate',
  run: (s, ctx) => {
    const lower = s.toLowerCase().replace(/[.!]+$/, '');
    const bare = pageOf(lower);
    if (bare && bare !== 'today') return [{ type: 'navigate', page: bare }];
    const m = lower.match(/^(?:show|open|go to|goto|go back to|take me to|bring up|pull up|view|display|switch to|see|check|jump to|navigate to|visit|launch|look at)\s+(?:me\s+)?(?:to\s+)?(?:(?:my|the|your)\s+)?(.+?)(?:\s+(?:page|tab|screen|view|section))?$/);
    if (!m) return null;
    const t = m[1].replace(/^(?:my|the)\s+/, '');
    const page = pageOf(t);
    if (page) return [{ type: 'navigate', page }];
    const stripped = t.replace(/\s+(?:progress|stats|chart|block|pillar|actions|habits|section)$/, '');
    const pillar = knownPillar(stripped, ctx);
    if (typeof pillar === 'string') return [{ type: 'navigate', page: 'chart', pillar }];
    return null;
  },
};

const QUESTION_START = /^(?:how|what|whats|what's|which|when|where|why|who|whom|whose)\b/i;
const QUESTION_AUX = /^(?:did|do|does|am|are|is|have|has|was|were|will|should|can)\s+(?:i|we|my|there|it|the)\b/i;

const question: Rule = {
  name: 'question',
  run: (s, ctx, o) => {
    if (!(QUESTION_START.test(o) || (/\?$/.test(o) && QUESTION_AUX.test(o)))) return null;
    if (/\b(?:how am i doing|how did i do|how was my week|this week|last week|my week|progress|trend|trends|review)\b/i.test(s)) return [{ type: 'navigate', page: 'review' }];
    if (/\b(?:today|tonight|tomorrow|task|tasks|todo|to do|schedule|plan|agenda|due|remind|reminders)\b/i.test(s)) return [{ type: 'navigate', page: 'today' }];
    if (/\b(?:notes?|wrote|journal|diary)\b/i.test(s)) return [{ type: 'navigate', page: 'notes' }];
    const pillar = pillarIn(s, ctx);
    return [{ type: 'navigate', page: 'chart', ...(pillar ? { pillar } : {}) }];
  },
};

/* ---- tasks */

const reopenTask: Rule = {
  name: 'reopen_task',
  run: (s, ctx) => {
    let m = s.match(/^mark\s+(?:the\s+|my\s+)?(?:task\s+)?(.+?)\s+(?:as\s+)?(?:not done|undone|incomplete|open|not finished|not complete)$/i);
    if (m) return [{ type: 'reopen_task', task: resolveTask(m[1], ctx, false) }];
    m = s.match(/^(?:reopen|re-open|reactivate|restore)\s+(?:the\s+|my\s+)?(?:task\s+)?(.+)$/i);
    if (m) return [{ type: 'reopen_task', task: resolveTask(m[1], ctx, false) }];
    m = s.match(/^(?:undo|uncomplete|unfinish|untick|uncheck|unmark)\s+(?:the\s+|my\s+)?(?:task\s+)?(.+)$/i);
    if (!m) return null;
    const ref = taskRef(m[1]);
    const tm = matchTask(ref, ctx, false);
    const am = bestAction(ref, ctx, 0.45, true);
    if (/\btask\b/i.test(s) || (tm && (!am || tm.score >= am.score))) return [{ type: 'reopen_task', task: tm ? tm.task.title : ref }];
    return null;
  },
};

const uncheck: Rule = {
  name: 'uncheck',
  run: (s, ctx) => {
    const { rest, date } = extractDate(s);
    const dt = date && date !== 'today' && date !== 'tonight' ? { date } : {};
    const neg = rest.match(/^(?:i\s+)?(?:did not|didn'?t|didnt|have not|haven'?t|havent|had not|hadn'?t|never|wasn'?t able to|was not able to)\s+(?:(?:actually|really|in fact|even|end up|manage to)\s+)*(.+)$/i);
    if (neg) {
      const hit = bestAction(neg[1], ctx, 0.5, true);
      return hit ? [{ type: 'uncheck', action: hit.action.title, ...dt }] : null;
    }
    const u = rest.match(/^(?:unlog|un-log|uncheck|un-check|untick|unmark|take back|undo)\s+(?:the\s+|my\s+)?(?:check-?in\s+(?:for|of)\s+)?(.+)$/i);
    if (u) {
      const hit = bestAction(u[1], ctx, 0.45, true);
      return hit ? [{ type: 'uncheck', action: hit.action.title, ...dt }] : null;
    }
    return null;
  },
};

const completeTask: Rule = {
  name: 'complete_task',
  run: (s, ctx) => {
    const { rest, date } = extractDate(s);
    const done = '(?:done|complete|completed|finished|checked off)';
    let body: string | undefined;
    let verb = 'done';
    let m = rest.match(new RegExp(`^mark\\s+(?:the\\s+|my\\s+)?(?:task\\s+)?(.+?)\\s+(?:task\\s+)?(?:as\\s+)?${done}$`, 'i'));
    if (m) body = m[1];
    if (!body && (m = rest.match(/^(?:check|tick|cross|strike)\s+off\s+(?:the\s+|my\s+)?(?:task\s+)?(.+)$/i))) body = m[1];
    if (!body && (m = rest.match(/^(?:i\s+)?(?:(?:am|have|just|already|ve)\s+)*(done|finished|completed|did)\s+(?:with\s+)?(?:the\s+|my\s+)?(.+)$/i))) {
      verb = m[1].toLowerCase();
      body = m[2];
    }
    if (!body && (m = rest.match(new RegExp(`^(?:the\\s+|my\\s+)?(.+?)\\s+(?:task\\s+)?(?:is|was)\\s+(?:now\\s+)?${done}$`, 'i')))) body = m[1];
    if (!body || /^not\b/i.test(body)) return null;
    const ref = taskRef(body);
    if (!ref) return null;
    const tm = matchTask(ref, ctx, true);
    const am = bestAction(ref, ctx, 0.5);
    if (tm && (!am || tm.score >= am.score)) return [{ type: 'complete_task', task: tm.task.title }];
    if (am) return [{ type: 'check_in', action: am.action.title, ...(date === 'yesterday' ? { date } : {}) }];
    if (verb === 'did') return null;
    return [{ type: 'complete_task', task: resolveTask(ref, ctx) }];
  },
};

const deleteTask: Rule = {
  name: 'delete_task',
  run: (s, ctx) => {
    const m = s.match(/^(?:delete|remove|cancel|drop|trash|scrap|get rid of|erase)\s+(?:the\s+|my\s+|a\s+)?(.+)$/i);
    if (!m || /^(?:notes?|actions?|habits?|pillars?|goal)\b/i.test(m[1])) return null;
    const body = m[1].replace(/\s+(?:from|off|on)\s+(?:my\s+|the\s+)?(?:tasks?|to-?do(?:\s+list)?|todos|list)$/i, '');
    const hasWord = /\b(?:task|todo|reminder)\b/i.test(m[1]);
    const ref = taskRef(body.replace(/^(?:task|todo|reminder)\s+/i, ''));
    if (!ref) return null;
    const tm = matchTask(ref, ctx, false);
    if (hasWord) return [{ type: 'delete_task', task: tm ? tm.task.title : ref }];
    const am = bestAction(ref, ctx, 0.6);
    if (tm && (!am || tm.score >= am.score)) return [{ type: 'delete_task', task: tm.task.title }];
    if (am) return [{ type: 'remove_action', action: am.action.title }];
    return [{ type: 'delete_task', task: ref }];
  },
};

const editTask: Rule = {
  name: 'edit_task',
  whole: true,
  run: (s, ctx) => {
    let m = s.match(/^(?:move|reschedule|postpone|push|delay|shift|bump)\s+(?:the\s+|my\s+)?(?:task\s+)?(.+?)(?:\s+task)?\s+(?:to|until|till|for|by)\s+(.+)$/i);
    if (m) {
      const due = dateOnly(m[2]);
      if (due) return [{ type: 'edit_task', task: resolveTask(m[1], ctx), due }];
    }
    m = s.match(/^(?:change|set|update)\s+(?:the\s+)?(?:due(?: date)?|deadline)\s+(?:of|for|on)\s+(?:the\s+|my\s+)?(?:task\s+)?(.+?)\s+(?:to|as)\s+(.+)$/i);
    if (m) {
      const due = dateOnly(m[2]);
      if (due) return [{ type: 'edit_task', task: resolveTask(m[1], ctx), due }];
    }
    m = s.match(/^(?:rename|retitle|edit|change|update)\s+(?:the\s+|my\s+)?task\s+(.+?)\s+(?:to|into|as)\s+(.+)$/i);
    if (m) {
      const title = cleanTitle(m[2]);
      return title ? [{ type: 'edit_task', task: resolveTask(m[1], ctx), title }] : null;
    }
    m = s.match(/^rename\s+(.+?)\s+(?:to|into|as)\s+(.+)$/i);
    if (m) {
      const tm = matchTask(taskRef(m[1]), ctx, false);
      const title = cleanTitle(m[2]);
      if (tm && title) return [{ type: 'edit_task', task: tm.task.title, title }];
    }
    return null;
  },
};

const FUTURE_PREFIX =
  '(?:i\\s+)?(?:really\\s+|just\\s+|still\\s+|also\\s+)?(?:need to|have to|has to|got to|have got to|gotta|must|ought to|should|will|am going to|going to|gonna|plan to|am planning to|promised to|supposed to)\\s+';

function taskFrom(s: string): { title: string; due?: string } | null {
  const { rest, date } = extractDate(s);
  const pats: RegExp[] = [
    /^(?:remind me|remind myself|reminder|don'?t forget|do not forget|dont forget|remember|dont let me forget)\s*(?:to|about|:)?\s+(.+)$/i,
    /^(?:add|create|make|put|new|set)\s+(?:a\s+|an\s+|new\s+|another\s+)*(?:task|todo|to-?do|to do|reminder|item)\s*(?:to|for|called|named|saying|that says|:|-)?\s*(.+)$/i,
    /^(?:add|put)\s+(.+?)\s+(?:to|on)\s+(?:my\s+)?(?:tasks?|to-?do(?:\s+list)?|todos|list|today)$/i,
    /^(?:todo|to-do|to do|task|tasks|reminder)\s*[:-]\s*(.+)$/i,
    /^(?:todo|to-do)\s+(.+)$/i,
    new RegExp(`^${FUTURE_PREFIX}(.+)$`, 'i'),
  ];
  for (const re of pats) {
    const m = re.exec(rest);
    if (!m) continue;
    const title = cleanTitle(m[1].replace(/^to\s+/i, ''));
    if (title && !/^(?:that|when)\b/i.test(title)) return { title, ...(date ? { due: date } : {}) };
  }
  return null;
}

const addTask: Rule = {
  name: 'add_task',
  run: (s) => {
    const t = taskFrom(s);
    return t ? [{ type: 'add_task', title: t.title, ...(t.due ? { due: t.due } : {}) }] : null;
  },
};

/* ---- check-ins */

const FUTURE = /\b(?:will|going to|gonna|need to|have to|must|should|tomorrow|tonight|next|plan to|want to|wanna|remind)\b/i;

const checkIn: Rule = {
  name: 'check_in',
  run: (s, ctx) => {
    const { rest, date } = extractDate(s);
    const explicit = rest.match(/^(?:log|check in|check-in|checkin|record|track|tick|tick off|count)\s+(?:the\s+|my\s+)?(.+)$/i);
    const body = explicit ? explicit[1] : rest;
    if (!explicit && (FUTURE.test(s) || body.split(' ').length > 12)) return null;
    if (explicit && date && date !== 'yesterday' && date !== 'today') return null;
    const hit = bestAction(body, ctx, explicit ? 0.4 : 0.5);
    if (!hit) return null;
    return [{ type: 'check_in', action: hit.action.title, ...(date === 'yesterday' ? { date: 'yesterday' } : {}) }];
  },
};

/** Late fallback: an imperative with a future date, e.g. "call mom tomorrow". */
const datedImperative: Rule = {
  name: 'dated_imperative',
  run: (s) => {
    const { rest, date } = extractDate(s);
    if (!date || date === 'today' || date === 'tonight' || date === 'yesterday') return null;
    if (!rest || rest.split(' ').length > 10 || /^(?:i|my|we|it|the|this|that|there|he|she|they|you|what|how)\b/i.test(rest)) return null;
    return [{ type: 'add_task', title: cleanTitle(rest), due: date }];
  },
};

const PAST_VERBS: Record<string, string> = {
  bought: 'buy', paid: 'pay', sent: 'send', made: 'make', got: 'get', wrote: 'write', took: 'take', went: 'go',
  ate: 'eat', ran: 'run', did: 'do', met: 'meet', read: 'read', sold: 'sell', found: 'find', gave: 'give', brought: 'bring', fixed: 'fix', drew: 'draw',
};
/** "bought the milk" / "paid rent!!" / "called mom" → complete the open task they clearly refer to. */
const pastTask: Rule = {
  name: 'past_task',
  run: (s, ctx) => {
    const t = s.replace(/^(?:i\s+|ok\s+|okay\s+)*(?:just\s+|finally\s+|already\s+)?/i, '').replace(/[,\s]+(?:done|finally|already)$/i, '');
    const m = t.match(/^([a-z]+)\s+(.+)$/i);
    if (!m || !ctx.tasks.some((x) => !x.done)) return null;
    const v = m[1].toLowerCase();
    if (/^(?:need|feed|seed|speed|bleed|breed|weed|heed|indeed|proceed|exceed|succeed|bed|red|shed|wed)$/.test(v) || /^to\b/i.test(m[2])) return null;
    const lemma = PAST_VERBS[v] ?? (/(?:[^aeiou])ied$/.test(v) ? v.slice(0, -3) + 'y' : /ed$/.test(v) ? v.replace(/(.)\1ed$/, '$1').replace(/ed$/, '') : null);
    if (!lemma) return null;
    const cands = [`${lemma} ${m[2]}`, `${lemma}e ${m[2]}`, ...(PAST_VERBS[v] ? [m[2]] : [])].map(taskRef);
    let best: { task: { title: string }; score: number } | undefined;
    for (const c of cands) {
      const r = matchTask(c, ctx, true);
      if (r && (!best || r.score > best.score)) best = r;
    }
    return best && best.score >= 0.55 ? [{ type: 'complete_task', task: best.task.title }] : null;
  },
};

/** "how do I turn on the AI?", "help", "how to backup" → open the help page at the right section. */
const helpRule: Rule = {
  name: 'help',
  whole: true,
  run: (_s, _ctx, o) => {
    const t = o.toLowerCase().trim();
    const asks = /^(?:help\b|how (?:do|can|should) (?:i|you)\b|how to\b|how does\b|where (?:do|can|is)\b|what can you do|what do i do|i need help|i'?m (?:stuck|lost|confused)|(?:show|open) (?:the )?(?:help|guide|instructions|tutorial))/.test(t)
      || /\b(?:help page|setup guide|instructions)\b/.test(t)
      || /[,.!]\s*(?:please\s+)?help[!?.]*$/.test(t) || /\b(?:not working|doesn'?t work|won'?t (?:load|start|open)|keeps crashing)\b/.test(t)
      || (/^(?:setup|set up|install|troubleshoot)/.test(t) && t.split(' ').length <= 8);
    if (!asks) return null;
    // "how do I add a task" is fine for help too, but "help me remember to X" is a task, not help
    if (/^help me (?:remember|to)\b/.test(t)) return null;
    const sec = findHelp(t);
    return [{ type: 'navigate', page: 'help', ...(sec ? { section: sec.id } : {}) }];
  },
};

/** Ordered: first rule that returns commands wins for a clause. */
const RULES: Rule[] = [
  helpRule, editNote, deleteNote, noteRule, setGoal, setPillar, setAction, removeAction, clearDone, setTheme, setName,
  question, navigate, editTask, reopenTask, uncheck, completeTask, pastTask, deleteTask, addTask, checkIn,
];

/* ------------------------------------------------------------------ driver */

interface Clause {
  text: string;
  start: number;
  sep: string; // separator that preceded it: 'and', ',', '.', 'then', ''
}

function splitClauses(raw: string): Clause[] {
  const masked = maskQuotes(raw);
  const re = /\s*(?:(,)|(;)|(!)|(\?)|\.(?=\s|$)|\s+(then)\s+|\s+(and then)\s+|\s+(and)\s+|\s+(also)\s+|\s+(plus)\s+)\s*/gi;
  const out: Clause[] = [];
  let last = 0;
  let sep = '';
  const push = (end: number, nextSep: string, nextStart: number) => {
    const chunk = raw.slice(last, end);
    if (chunk.trim()) out.push({ text: chunk.trim(), start: last + (chunk.length - chunk.trimStart().length), sep });
    last = nextStart;
    sep = nextSep;
  };
  for (const m of masked.matchAll(re)) {
    const kind = m[4] ? '?' : m[1] ? ',' : m[7] || m[8] ? 'and' : m[5] || m[6] || m[9] ? 'then' : '.';
    push(m.index, kind, m.index + m[0].length);
  }
  push(raw.length, '', raw.length);
  return out;
}

function describe(c: Command): string {
  switch (c.type) {
    case 'set_name': return `I will call you ${c.name}`;
    case 'set_goal': return `set your main goal to "${c.title}"`;
    case 'set_pillar': return `renamed pillar ${c.pillar} to "${c.title}"`;
    case 'set_action':
      return c.replace ? `swapped "${c.replace}" for "${c.title}" in ${c.pillar}` : `added "${c.title}" to ${c.pillar}`;
    case 'remove_action': return `removed "${c.action}"`;
    case 'check_in': return `logged "${c.action}"${c.date ? ` for ${c.date}` : ''}`;
    case 'uncheck': return `unlogged "${c.action}"${c.date ? ` for ${c.date}` : ''}`;
    case 'add_task': return `added the task "${c.title}"${c.due ? ` for ${c.due}` : ''}`;
    case 'complete_task': return `marked "${c.task}" as done`;
    case 'reopen_task': return `reopened "${c.task}"`;
    case 'edit_task': return c.title ? `renamed "${c.task}" to "${c.title}"` : `moved "${c.task}" to ${c.due}`;
    case 'delete_task': return `deleted the task "${c.task}"`;
    case 'clear_done_tasks': return 'cleared your finished tasks';
    case 'add_note': return 'saved that as a note';
    case 'edit_note': return 'updated that note';
    case 'delete_note': return 'deleted that note';
    case 'navigate': return c.pillar ? `opening ${c.pillar} on your chart` : `opening ${c.page}`;
    case 'set_theme': return c.theme === 'system' ? 'switched to the system theme' : `switched to ${c.theme} mode`;
  }
}

function replyFor(cmds: Command[]): string {
  if (cmds.length === 1 && cmds[0].type === 'navigate' && cmds[0].page === 'help') {
    const h = HELP.find((x) => x.id === (cmds[0] as { section?: string }).section);
    return h ? `${h.summary} I opened the help page for you.` : 'Here’s the help page: it explains setup and everything the app can do.';
  }
  if (cmds.length === 1 && cmds[0].type === 'add_note') return 'Saved that as a note.';
  const parts = cmds.map(describe);
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
  return `Okay, ${list}.`;
}

function questionReply(c: Command): string {
  if (c.type === 'navigate' && c.page === 'review') return 'Your weekly review shows how each pillar is trending, opening it now.';
  if (c.type === 'navigate' && c.page === 'today') return 'Your tasks and plan for the day are on the Today page, opening it now.';
  if (c.type === 'navigate' && c.page === 'notes') return 'Your notes live on the Notes page, opening it now.';
  return 'Your chart and progress are the best place to look, opening it now.';
}

export function parseFallback(text: string, ctx: FallbackContext): FallbackResult {
  const raw = prep(text ?? '');
  if (!raw) return { reply: 'Tell me what you would like to do, like adding a task or logging a habit.', commands: [] };

  const safe: FallbackContext = {
    pillars: ctx?.pillars ?? [],
    actions: ctx?.actions ?? [],
    tasks: ctx?.tasks ?? [],
    notes: ctx?.notes ?? [],
  };

  // 1) whole-message rules (notes, goal, chart edits, task edits)
  const whole = expandPronouns(raw);
  for (const rule of RULES) {
    if (!rule.whole) continue;
    const cmds = rule.run(whole, safe, raw);
    if (cmds?.length) return { reply: replyFor(cmds), commands: cmds };
  }

  // 2) clause by clause
  const commands: Command[] = [];
  let questionOnly = false;
  let carryDate = '';
  const endsQ = /\?[\s.!]*$/.test(text);
  const clauses = splitClauses(raw);
  for (let i = 0; i < clauses.length; i++) {
    const cl = clauses[i];
    let o = prep(cl.text);
    if (!o) continue;
    if (dateOnly(o)) {
      carryDate = o;
      continue;
    }
    if (carryDate) {
      o = `${carryDate} ${o}`;
      carryDate = '';
    }
    // a note prefix mid-message swallows the rest of the message verbatim
    if (i > 0) {
      const nm = NOTE_PREFIX.exec(raw.slice(cl.start).trim());
      const cmds = nm ? noteBody(nm[1], safe) : null;
      if (cmds) {
        commands.push(...cmds);
        break;
      }
    }
    const s = expandPronouns(o);
    const term = i + 1 < clauses.length ? clauses[i + 1].sep : endsQ ? '?' : '';
    const oq = term === '?' ? `${o}?` : o;
    const run = (rules: Rule[]) => {
      for (const rule of rules) {
        const cmds = rule.run(s, safe, oq);
        if (cmds?.length) return { rule, cmds };
      }
      return undefined;
    };
    let hit = run(RULES);
    if (!hit) {
      // continuation of a task or note ("buy milk and eggs")? then merge it back
      const prev = commands[commands.length - 1];
      const { rest, date } = extractDate(o);
      if ((cl.sep === 'and' || cl.sep === ',') && prev && (prev.type === 'add_task' || prev.type === 'add_note') && !(date && prev.type === 'add_task' && prev.due)) {
        const glue = cl.sep === 'and' ? ' and ' : ', ';
        if (prev.type === 'add_task') {
          prev.title += glue + rest;
          if (date && !prev.due) prev.due = date;
        } else {
          prev.text += glue + o;
        }
        continue;
      }
      hit = run([datedImperative]);
    }
    if (!hit) continue;
    if (hit.rule === question) questionOnly = true;
    commands.push(...hit.cmds);
  }

  if (commands.length) {
    if (questionOnly && commands.length === 1) return { reply: questionReply(commands[0]), commands };
    return { reply: replyFor(commands), commands };
  }

  // 3) nothing matched: keep the words as a note
  const pillar = pillarIn(raw, safe);
  return { reply: 'Saved that as a note.', commands: [{ type: 'add_note', text: raw, ...(pillar ? { pillar } : {}) }] };
}
