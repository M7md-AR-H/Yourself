import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { YourselfDB } from '../../src/lib/db';
import { resolveDate, runCommands, undo } from '../../src/lib/commands';
import { starterCommands } from '../../src/lib/seed';
import { computeStats } from '../../src/lib/stats';
import { parseModelOutput } from '../../src/ai/schema';
import { buildPrompt } from '../../src/ai/prompt';

const TODAY = '2026-11-04'; // a Wednesday
let db: YourselfDB;
beforeEach(async () => {
  db = new YourselfDB(`t-${Math.random()}`);
  await runCommands(starterCommands(), db, TODAY);
});

describe('resolveDate', () => {
  it.each([
    ['today', '2026-11-04'], ['tomorrow', '2026-11-05'], ['yesterday', '2026-11-03'],
    ['friday', '2026-11-06'], ['wednesday', '2026-11-11'], ['next monday', '2026-11-09'],
    ['in 3 days', '2026-11-07'], ['next week', '2026-11-11'], ['2026-12-01', '2026-12-01'],
  ])('%s → %s', (input, out) => expect(resolveDate(input, TODAY)).toBe(out));
  it('unknown → undefined', () => expect(resolveDate('someday', TODAY)).toBeUndefined());
});

describe('commands', () => {
  it('starter chart has 8 pillars × 8 actions', async () => {
    expect(await db.pillars.count()).toBe(8);
    expect(await db.actions.count()).toBe(64);
    expect((await db.goal.get('goal'))?.title).toBe('My best self');
  });

  it('check-in by fuzzy name, once per day', async () => {
    const r = await runCommands([{ type: 'check_in', action: 'meditate' }, { type: 'check_in', action: 'Meditate 10 min' }], db, TODAY);
    expect(r.errors).toEqual([]);
    expect(await db.checkins.count()).toBe(1);
  });

  it('task lifecycle', async () => {
    await runCommands([{ type: 'add_task', title: 'Call mom', due: 'tomorrow', pillar: 'mind' }], db, TODAY);
    const t = (await db.tasks.toArray())[0];
    expect(t.due).toBe('2026-11-05');
    expect(t.pillarId).toBeDefined();
    await runCommands([{ type: 'complete_task', task: 'call mom' }], db, TODAY);
    expect((await db.tasks.get(t.id))?.done).toBe(true);
    await runCommands([{ type: 'edit_task', task: 'mom', title: 'Call mum', due: 'friday' }], db, TODAY);
    expect((await db.tasks.get(t.id))?.title).toBe('Call mum');
    await runCommands([{ type: 'delete_task', task: 'call mum' }], db, TODAY);
    expect(await db.tasks.count()).toBe(0);
  });

  it('set_action fills a free slot, replace swaps, full pillar errors', async () => {
    const r1 = await runCommands([{ type: 'set_action', pillar: 'movement', title: 'Swim', replace: 'run' }], db, TODAY);
    expect(r1.effects[0]).toContain('Swim');
    const p = (await db.pillars.toArray()).find((x) => x.title === 'Movement')!;
    const titles = (await db.actions.where('pillarId').equals(p.id).toArray()).map((a) => a.title);
    expect(titles).toContain('Swim');
    expect(titles).not.toContain('Run');
    const r2 = await runCommands([{ type: 'set_action', pillar: 'movement', title: 'Climb' }], db, TODAY);
    expect(r2.errors[0]).toMatch(/already has 8/);
  });

  it('bad commands are reported, good ones still apply', async () => {
    const r = await runCommands([{ type: 'complete_task', task: 'nope' }, { type: 'add_note', text: 'hi' }], db, TODAY);
    expect(r.errors.length).toBe(1);
    expect(await db.notes.count()).toBe(1);
  });

  it('undo reverts everything in a batch', async () => {
    const before = await db.actions.toArray();
    const r = await runCommands([
      { type: 'add_task', title: 'X' }, { type: 'add_note', text: 'Y' }, { type: 'check_in', action: 'journal' },
      { type: 'remove_action', action: 'yoga' }, { type: 'set_goal', title: 'Doctor' }, { type: 'set_name', name: 'Sam' },
    ], db, TODAY);
    await undo(r.journal, db);
    expect(await db.tasks.count()).toBe(0);
    expect(await db.notes.count()).toBe(0);
    expect(await db.checkins.count()).toBe(0);
    expect((await db.actions.toArray()).length).toBe(before.length);
    expect((await db.goal.get('goal'))?.title).toBe('My best self');
    expect(await db.settings.get('settings')).toBeUndefined();
  });

  it('navigate returns a pillar index', async () => {
    const r = await runCommands([{ type: 'navigate', page: 'chart', pillar: 'skin' }], db, TODAY);
    expect(r.navigate).toEqual({ page: 'chart', pillarIndex: 2 });
  });
});

describe('stats', () => {
  it('scores actions over the last 7 days and counts streaks', async () => {
    for (const d of ['2026-11-02', '2026-11-03', '2026-11-04']) await runCommands([{ type: 'check_in', action: 'dark room', date: d }], db, TODAY);
    const s = computeStats(await db.pillars.toArray(), await db.actions.toArray(), await db.checkins.toArray(), [], TODAY);
    const a = s.pillars[0]!.actions[0]!;
    expect(a.action.title).toBe('Dark room');
    expect(a.score).toBeCloseTo(3 / 7);
    expect(a.streak).toBe(3);
    expect(a.doneToday).toBe(true);
    expect(s.pillars[0]!.score).toBeCloseTo(3 / 7 / 8);
    expect(s.checkinsThisWeek).toBe(3);
  });
});

describe('model output validation (AI output is untrusted)', () => {
  it('keeps valid commands, drops junk', () => {
    const out = parseModelOutput(JSON.stringify({
      reply: 'ok',
      commands: [
        { type: 'add_task', title: 'Buy milk', due: 'today' },
        { type: 'rm_rf' }, { type: 'add_task' }, 'bad', { type: 'navigate', page: 'hacker' },
        { type: 'check_in', action: 'Journal' },
      ],
    }));
    expect(out?.commands).toEqual([{ type: 'add_task', title: 'Buy milk', due: 'today', pillar: undefined }, { type: 'check_in', action: 'Journal', date: undefined }]);
  });
  it('extracts JSON wrapped in text; null on garbage', () => {
    expect(parseModelOutput('Sure! {"reply":"hi","commands":[]}')?.reply).toBe('hi');
    expect(parseModelOutput('no json here')).toBeNull();
  });
  it('prompt includes chart, tasks and the message', async () => {
    const s = computeStats(await db.pillars.toArray(), await db.actions.toArray(), [], [], TODAY);
    const p = buildPrompt('hello there', { name: 'Sam', goal: await db.goal.get('goal'), stats: s, tasks: [], notes: [], history: [], today: TODAY });
    expect(p).toContain('Dark room');
    expect(p).toContain('Wednesday 2026-11-04');
    expect(p.trim().endsWith('JSON:')).toBe(true);
    expect(p).toContain('User: hello there');
  });
});
