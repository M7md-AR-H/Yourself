import { describe, expect, it } from 'vitest';
import { parseFallback, type FallbackContext } from '../../src/ai/fallback';
import { STARTER } from '../../src/lib/seed';
import type { Command } from '../../src/lib/commands';

const ctx: FallbackContext = {
  pillars: STARTER.map((b) => b.pillar),
  actions: STARTER.flatMap((b) => b.actions.map((a) => ({ title: a, pillar: b.pillar }))),
  tasks: [
    { title: 'Buy milk', done: false },
    { title: 'Pay rent', done: false },
    { title: 'Call mom', done: false },
    { title: 'Finish the report', done: false },
    { title: 'Old thing', done: true },
  ],
  notes: ['Felt great after the run'],
};

const run = (t: string, c: FallbackContext = ctx) => parseFallback(t, c);
const cmds = (t: string, c: FallbackContext = ctx): Command[] => run(t, c).commands;
const first = (t: string) => cmds(t)[0];
const lc = (v: unknown) => String(v).toLowerCase();

describe('tasks', () => {
  it('remind me to ... tomorrow', () => {
    expect(cmds('remind me to call mom tomorrow')).toEqual([{ type: 'add_task', title: 'call mom', due: 'tomorrow' }]);
  });
  it('add task', () => {
    expect(cmds('add task buy milk')).toEqual([{ type: 'add_task', title: 'buy milk' }]);
  });
  it('add a task to ...', () => {
    expect(cmds('please add a task to water the plants')).toEqual([{ type: 'add_task', title: 'water the plants' }]);
  });
  it('todo: with weekday', () => {
    expect(cmds('todo: pay rent friday')).toEqual([{ type: 'add_task', title: 'pay rent', due: 'friday' }]);
  });
  it('I need to ... by monday', () => {
    expect(cmds('I need to finish the report by monday')).toEqual([{ type: 'add_task', title: 'finish the report', due: 'monday' }]);
  });
  it('I will ... tomorrow is a future task', () => {
    expect(cmds('I will go to the gym tomorrow')).toEqual([{ type: 'add_task', title: 'go to the gym', due: 'tomorrow' }]);
  });
  it("I'll contraction", () => {
    expect(cmds("I'll email Sara tomorrow")).toEqual([{ type: 'add_task', title: 'email Sara', due: 'tomorrow' }]);
  });
  it('tomorrow I have to ...', () => {
    expect(cmds('tomorrow I have to call the dentist')).toEqual([{ type: 'add_task', title: 'call the dentist', due: 'tomorrow' }]);
  });
  it('tolerates can you / please / punctuation', () => {
    expect(cmds('Can you please remind me to book flights next monday?!')).toEqual([{ type: 'add_task', title: 'book flights', due: 'next monday' }]);
  });
  it('in N days passes through', () => {
    expect(first('remind me to renew passport in 3 days')).toEqual({ type: 'add_task', title: 'renew passport', due: 'in 3 days' });
  });
  it('ISO dates pass through', () => {
    expect(first('add task file taxes on 2026-12-01')).toEqual({ type: 'add_task', title: 'file taxes', due: '2026-12-01' });
  });
  it('dated imperative becomes a task', () => {
    expect(cmds('call the bank tomorrow')).toEqual([{ type: 'add_task', title: 'call the bank', due: 'tomorrow' }]);
  });
  it('keeps "and" inside a task title', () => {
    expect(cmds('add task buy milk and eggs')).toEqual([{ type: 'add_task', title: 'buy milk and eggs' }]);
  });
  it('is case-insensitive', () => {
    expect(first('REMIND ME TO CALL MOM TOMORROW')).toMatchObject({ type: 'add_task', due: 'tomorrow' });
  });
});

describe('complete / reopen / delete / edit tasks', () => {
  it('done with X', () => {
    expect(cmds('done with buy milk')).toEqual([{ type: 'complete_task', task: 'Buy milk' }]);
  });
  it('I finished the report', () => {
    expect(cmds('I finished the report')).toEqual([{ type: 'complete_task', task: 'Finish the report' }]);
  });
  it('mark X as done', () => {
    expect(cmds('mark pay rent as done')).toEqual([{ type: 'complete_task', task: 'Pay rent' }]);
  });
  it('completed X', () => {
    expect(cmds('completed call mom')).toEqual([{ type: 'complete_task', task: 'Call mom' }]);
  });
  it('unknown task passes the user words', () => {
    expect(cmds('I finished cleaning the garage')).toEqual([{ type: 'complete_task', task: 'cleaning the garage' }]);
  });
  it('reopen', () => {
    expect(cmds('reopen buy milk')).toEqual([{ type: 'reopen_task', task: 'Buy milk' }]);
  });
  it('undo X task', () => {
    expect(cmds('undo buy milk task')).toEqual([{ type: 'reopen_task', task: 'Buy milk' }]);
  });
  it('delete task', () => {
    expect(cmds('delete task buy milk')).toEqual([{ type: 'delete_task', task: 'Buy milk' }]);
  });
  it('remove the milk task', () => {
    expect(cmds('remove the milk task')).toEqual([{ type: 'delete_task', task: 'Buy milk' }]);
  });
  it('move X to friday', () => {
    expect(cmds('move pay rent to friday')).toEqual([{ type: 'edit_task', task: 'Pay rent', due: 'friday' }]);
  });
  it('postpone to a relative date', () => {
    expect(first('postpone call mom until next monday')).toEqual({ type: 'edit_task', task: 'Call mom', due: 'next monday' });
  });
  it('rename task X to Y', () => {
    expect(cmds('rename task buy milk to buy oat milk')).toEqual([{ type: 'edit_task', task: 'Buy milk', title: 'buy oat milk' }]);
  });
  it('clear done tasks', () => {
    expect(cmds('clear done tasks')).toEqual([{ type: 'clear_done_tasks' }]);
    expect(cmds('clear completed')).toEqual([{ type: 'clear_done_tasks' }]);
  });
});

describe('check-ins', () => {
  it('I meditated today', () => {
    expect(cmds('I meditated today')).toEqual([{ type: 'check_in', action: 'Meditate 10 min' }]);
  });
  it('did 10k steps', () => {
    expect(cmds('did 10k steps')).toEqual([{ type: 'check_in', action: '10k steps' }]);
  });
  it('I journaled', () => {
    expect(cmds('I journaled')).toEqual([{ type: 'check_in', action: 'Journal' }]);
  });
  it('slept 8 hours last night', () => {
    expect(cmds('slept 8 hours last night')).toEqual([{ type: 'check_in', action: '8 hours' }]);
  });
  it('multiple check-ins in one sentence', () => {
    expect(cmds('I read in bed and had no late coffee')).toEqual([
      { type: 'check_in', action: 'Read in bed' },
      { type: 'check_in', action: 'No late coffee' },
    ]);
  });
  it('stems running / ran', () => {
    expect(first('I ran this morning')).toEqual({ type: 'check_in', action: 'Run' });
    expect(first('went running')).toEqual({ type: 'check_in', action: 'Run' });
  });
  it('yesterday carries the date', () => {
    expect(cmds('yesterday I did yoga')).toEqual([{ type: 'check_in', action: 'Yoga', date: 'yesterday' }]);
  });
  it('explicit "log" works with weaker matches', () => {
    expect(first('log stretching')).toEqual({ type: 'check_in', action: 'Stretch' });
  });
  it('negated habits uncheck', () => {
    expect(cmds("I didn't actually meditate")).toEqual([{ type: 'uncheck', action: 'Meditate 10 min' }]);
  });
  it('unlog', () => {
    expect(cmds('unlog meditate')).toEqual([{ type: 'uncheck', action: 'Meditate 10 min' }]);
  });
  it('uncheck with yesterday', () => {
    expect(cmds('I did not journal yesterday')).toEqual([{ type: 'uncheck', action: 'Journal', date: 'yesterday' }]);
  });
  it('"no late coffee" is not logged by a plain mention of coffee', () => {
    expect(first('I had a big coffee this afternoon')).toMatchObject({ type: 'add_note' });
  });
});

describe('chart edits', () => {
  it('my goal is to', () => {
    expect(cmds('my goal is to become a doctor')).toEqual([{ type: 'set_goal', title: 'become a doctor' }]);
  });
  it('set my main goal to', () => {
    expect(cmds('set my main goal to Live well')).toEqual([{ type: 'set_goal', title: 'Live well' }]);
  });
  it('rename pillar by name', () => {
    expect(cmds('rename pillar skin to health')).toEqual([{ type: 'set_pillar', pillar: 'skin', title: 'health' }]);
  });
  it('change pillar by number', () => {
    expect(cmds('change pillar 3 to health')).toEqual([{ type: 'set_pillar', pillar: 3, title: 'health' }]);
  });
  it('add quoted action to a pillar', () => {
    expect(cmds("add 'cold shower' to movement")).toEqual([{ type: 'set_action', pillar: 'movement', title: 'cold shower' }]);
  });
  it('add action to pillar', () => {
    expect(cmds('add action cold shower to mind')).toEqual([{ type: 'set_action', pillar: 'mind', title: 'cold shower' }]);
  });
  it('replace X with Y in pillar', () => {
    expect(cmds('replace run with swim in movement')).toEqual([{ type: 'set_action', pillar: 'movement', title: 'swim', replace: 'run' }]);
  });
  it('remove action from pillar', () => {
    expect(cmds('remove yoga from movement')).toEqual([{ type: 'remove_action', action: 'yoga', pillar: 'movement' }]);
  });
  it('delete action', () => {
    expect(cmds('delete action yoga')).toEqual([{ type: 'remove_action', action: 'yoga' }]);
  });
  it('"add X to todo list" stays a task, not a chart edit', () => {
    expect(first('add buy milk to my todo list')).toMatchObject({ type: 'add_task', title: 'buy milk' });
  });
});

describe('notes', () => {
  it('note:', () => {
    expect(cmds('note: the landlord called about the deposit')).toEqual([{ type: 'add_note', text: 'the landlord called about the deposit' }]);
  });
  it('remember that', () => {
    expect(cmds('remember that Sam likes oat milk')).toEqual([{ type: 'add_note', text: 'Sam likes oat milk' }]);
  });
  it('write down', () => {
    expect(first('write down the wifi password is hunter2')).toEqual({ type: 'add_note', text: 'the wifi password is hunter2' });
  });
  it('journal:', () => {
    expect(first('journal: today was calm')).toEqual({ type: 'add_note', text: 'today was calm' });
  });
  it('note body is never split or interpreted', () => {
    expect(cmds('note: I meditated, then remind me to buy eggs and call mom. Done')).toEqual([
      { type: 'add_note', text: 'I meditated, then remind me to buy eggs and call mom. Done' },
    ]);
  });
  it('note picks up a pillar that clearly appears', () => {
    expect(cmds('note: my sleep was bad last night')).toEqual([{ type: 'add_note', text: 'my sleep was bad last night', pillar: 'sleep' }]);
  });
  it('delete last note', () => {
    expect(cmds('delete last note')).toEqual([{ type: 'delete_note', note: 'last' }]);
  });
  it('edit last note', () => {
    expect(cmds('edit last note to felt even better')).toEqual([{ type: 'edit_note', note: 'last', text: 'felt even better' }]);
  });
  it('unmatched text becomes a note', () => {
    const r = run('the weather was lovely');
    expect(r.commands).toEqual([{ type: 'add_note', text: 'the weather was lovely' }]);
    expect(r.reply).toMatch(/note/i);
  });
  it('unmatched text mentioning a pillar gets that pillar', () => {
    expect(cmds('my money situation feels better')).toEqual([{ type: 'add_note', text: 'my money situation feels better', pillar: 'money' }]);
  });
});

describe('navigation, settings, questions', () => {
  it('show my chart / stats / progress', () => {
    for (const t of ['show my chart', 'show my stats', 'show my progress']) {
      expect(cmds(t)).toEqual([{ type: 'navigate', page: 'chart' }]);
    }
  });
  it('show me sleep opens that pillar', () => {
    expect(cmds('show me sleep')).toEqual([{ type: 'navigate', page: 'chart', pillar: 'sleep' }]);
  });
  it('open notes / go to today / open chat / settings', () => {
    expect(cmds('open notes')).toEqual([{ type: 'navigate', page: 'notes' }]);
    expect(cmds('go to today')).toEqual([{ type: 'navigate', page: 'today' }]);
    expect(cmds('open chat')).toEqual([{ type: 'navigate', page: 'chat' }]);
    expect(cmds('settings')).toEqual([{ type: 'navigate', page: 'settings' }]);
  });
  it('themes', () => {
    expect(cmds('dark mode')).toEqual([{ type: 'set_theme', theme: 'dark' }]);
    expect(cmds('switch to light mode')).toEqual([{ type: 'set_theme', theme: 'light' }]);
    expect(cmds('use system theme')).toEqual([{ type: 'set_theme', theme: 'system' }]);
  });
  it('names', () => {
    expect(cmds('call me Sam')).toEqual([{ type: 'set_name', name: 'Sam' }]);
    expect(cmds('my name is sam')).toEqual([{ type: 'set_name', name: 'Sam' }]);
  });
  it('"call mom" is a task-ish phrase, not a name', () => {
    expect(first('remind me to call mom')).toMatchObject({ type: 'add_task' });
  });
  it('questions only navigate, never change data', () => {
    const a = run('how am I doing?');
    expect(a.commands).toEqual([{ type: 'navigate', page: 'review' }]);
    expect(a.reply.length).toBeGreaterThan(5);
    expect(run("what's on today?").commands).toEqual([{ type: 'navigate', page: 'today' }]);
    expect(run('did I meditate today?').commands.every((c) => c.type === 'navigate')).toBe(true);
  });
});

describe('mixed sentences', () => {
  it('check-in plus task', () => {
    expect(cmds('I meditated and remind me to buy eggs tomorrow')).toEqual([
      { type: 'check_in', action: 'Meditate 10 min' },
      { type: 'add_task', title: 'buy eggs', due: 'tomorrow' },
    ]);
  });
  it('commas and "then"', () => {
    expect(cmds('I journaled, did yoga, then add task buy stamps')).toEqual([
      { type: 'check_in', action: 'Journal' },
      { type: 'check_in', action: 'Yoga' },
      { type: 'add_task', title: 'buy stamps' },
    ]);
  });
  it('sentences separated by periods', () => {
    expect(cmds('I meditated. Dark mode please.')).toEqual([
      { type: 'check_in', action: 'Meditate 10 min' },
      { type: 'set_theme', theme: 'dark' },
    ]);
  });
  it('does not split inside quotes', () => {
    expect(cmds("add 'rock, paper and scissors' to hobbies")).toEqual([
      { type: 'set_action', pillar: 'hobbies', title: 'rock, paper and scissors' },
    ]);
  });
  it('a later note takes the rest of the message', () => {
    expect(cmds('I journaled and note: felt calm, grateful and rested')).toEqual([
      { type: 'check_in', action: 'Journal' },
      { type: 'add_note', text: 'felt calm, grateful and rested' },
    ]);
  });
  it('separate dated tasks stay separate', () => {
    expect(cmds('remind me to call mom tomorrow and pay rent friday')).toEqual([
      { type: 'add_task', title: 'call mom', due: 'tomorrow' },
      { type: 'add_task', title: 'pay rent', due: 'friday' },
    ]);
  });
});

describe('robustness', () => {
  it('always returns a reply without emojis', () => {
    for (const t of ['', '   ', 'asdf qwer', 'remind me to call mom', 'dark mode', 'how am I doing?']) {
      const r = run(t);
      expect(typeof r.reply).toBe('string');
      expect(r.reply.length).toBeGreaterThan(0);
      expect(/\p{Extended_Pictographic}/u.test(r.reply)).toBe(false);
    }
  });
  it('empty input returns no commands', () => {
    expect(cmds('   ')).toEqual([]);
  });
  it('works with an empty chart', () => {
    const empty: FallbackContext = { pillars: [], actions: [], tasks: [], notes: [] };
    expect(cmds('I meditated', empty)).toEqual([{ type: 'add_note', text: 'I meditated' }]);
    expect(cmds('remind me to call mom tomorrow', empty)).toEqual([{ type: 'add_task', title: 'call mom', due: 'tomorrow' }]);
    expect(cmds('done with buy milk', empty)).toEqual([{ type: 'complete_task', task: 'buy milk' }]);
  });
  it('is deterministic', () => {
    expect(lc(JSON.stringify(run('I meditated and journaled')))).toBe(lc(JSON.stringify(run('I meditated and journaled'))));
  });
});
