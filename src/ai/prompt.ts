import type { ChartStats } from '../lib/stats';
import type { ChatMessage, Goal, Note, Task } from '../lib/types';
import { ymd } from '../lib/util';

export interface PromptContext {
  name: string;
  goal?: Goal;
  stats: ChartStats;
  tasks: Task[];
  notes: Note[];
  history: ChatMessage[];
  today?: string;
}

const RULES = `You are the assistant inside "Yourself", a notes + tasks app built on a Mandala chart:
1 main goal in the centre, 8 pillars around it, 8 small daily actions per pillar.
You change the app ONLY by returning commands. Reply with JSON: {"commands":[...],"reply":"..."}.

Commands (fields in brackets):
- add_task [title, due?, pillar?]  -> things the user will/must do. due: "today","tomorrow","friday",YYYY-MM-DD
- complete_task [task] / reopen_task [task] / delete_task [task] / edit_task [task, title?, due?] / clear_done_tasks
- check_in [action, date?] -> user says they DID a chart action ("I meditated"). action = exact action name from the chart.
- uncheck [action, date?]
- add_note [text, pillar?] -> facts, feelings, ideas, journal entries. Keep the user's words.
- edit_note [note, text] / delete_note [note]  ("last" = newest note)
- set_goal [title] / set_pillar [pillar, title] / set_action [pillar, title, replace?] / remove_action [action, pillar?]
- navigate [page: today|chart|notes|chat|settings, pillar?]
- set_theme [theme: light|dark|system] / set_name [name]

Rules:
- Do every part of the message. One message can need several commands.
- Past actions that match the chart -> check_in. Future plans -> add_task. Anything else worth keeping -> add_note.
- Never invent tasks the user did not ask for. Questions need no commands; answer from the data below.
- reply: one or two short, warm, plain sentences. No emojis. Do not list the JSON.`;

const EXAMPLES = `Examples:
User: I meditated and read in bed. tomorrow I need to call the bank
{"commands":[{"type":"check_in","action":"Meditate 10 min"},{"type":"check_in","action":"Read in bed"},{"type":"add_task","title":"Call the bank","due":"tomorrow","pillar":"Money"}],"reply":"Nice, two habits logged. I added calling the bank for tomorrow."}
User: feeling anxious about exams lately
{"commands":[{"type":"add_note","text":"Feeling anxious about exams lately.","pillar":"Mind"}],"reply":"Saved that to your Mind notes. Want me to add a small calming action for tonight?"}
User: how am I doing this week?
{"commands":[],"reply":"Sleep is your strongest pillar at 64%. Money is lowest at 10%, so one small money action today would help most."}`;

function chartText(stats: ChartStats): string {
  return stats.pillars
    .map((p, i) => {
      if (!p) return `${i + 1}. (empty)`;
      const acts = p.actions.filter(Boolean).map((a) => `${a!.action.title}${a!.doneToday ? ' ✓today' : ''}`);
      return `${i + 1}. ${p.pillar.title} (${Math.round(p.score * 100)}% this week): ${acts.join('; ') || 'no actions yet'}`;
    })
    .join('\n');
}

export function buildPrompt(message: string, ctx: PromptContext): string {
  const today = ctx.today ?? ymd();
  const weekday = new Date(today + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });
  const open = ctx.tasks.filter((t) => !t.done).slice(0, 15).map((t) => `- ${t.title}${t.due ? ` (due ${t.due})` : ''}`);
  const done = ctx.tasks.filter((t) => t.done).slice(0, 5).map((t) => `- ${t.title}`);
  const notes = ctx.notes.slice(0, 5).map((n) => `- ${n.text.slice(0, 120)}`);
  const hist = ctx.history.slice(-6).map((m) => `${m.role === 'user' ? 'User' : 'You'}: ${m.text.slice(0, 200)}`);

  return [
    RULES,
    EXAMPLES,
    `--- Current data ---
Today: ${weekday} ${today}. User: ${ctx.name || 'unknown'}.
Main goal: ${ctx.goal?.title || '(not set)'} — overall ${Math.round(ctx.stats.overall * 100)}% this week.
Chart:
${chartText(ctx.stats)}
Open tasks:
${open.join('\n') || '- none'}
Recently done:
${done.join('\n') || '- none'}
Latest notes:
${notes.join('\n') || '- none'}`,
    hist.length ? `--- Recent chat ---\n${hist.join('\n')}` : '',
    `--- New message ---\nUser: ${message}\nJSON:`,
  ]
    .filter(Boolean)
    .join('\n\n');
}
