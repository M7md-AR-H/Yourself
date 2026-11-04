import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { YourselfDB } from '../../src/lib/db';
import { resolveTime, runCommands } from '../../src/lib/commands';
import { parseFallback } from '../../src/ai/fallback';
import { parseModelOutput } from '../../src/ai/schema';
import { findHelp } from '../../src/lib/help';

const TODAY = '2026-11-04';
const ctx = { pillars: ['Sleep'], actions: [{ title: 'Dark room', pillar: 'Sleep' }], tasks: [], notes: [] };

describe('resolveTime', () => {
  it.each([
    ['5pm', '17:00'], ['5 pm', '17:00'], ['5:30pm', '17:30'], ['17:30', '17:30'], ['12am', '00:00'], ['12pm', '12:00'],
    ['noon', '12:00'], ['evening', '19:00'], ['at 9', '09:00'], ['at 5', '17:00'], ['at 9am', '09:00'], ['8', '08:00'], ['10', '10:00'], ['7.30pm', '19:30'],
  ])('%s → %s', (i, o) => expect(resolveTime(i)).toBe(o));
  it.each(['25:00', '13pm', 'soon', '0pm'])('%s → undefined', (i) => expect(resolveTime(i)).toBeUndefined());
});

describe('task times', () => {
  it('add_task stores time and defaults due to today', async () => {
    const d = new YourselfDB(`r-${Math.random()}`);
    await runCommands([{ type: 'add_task', title: 'call mom', time: '5pm' }], d, TODAY);
    expect(await d.tasks.toArray()).toMatchObject([{ title: 'Call mom', due: TODAY, time: '17:00' }]);
  });
  it('moving a task re-arms its reminder', async () => {
    const d = new YourselfDB(`r-${Math.random()}`);
    await runCommands([{ type: 'add_task', title: 'gym', due: 'today', time: '18:00' }], d, TODAY);
    const t = (await d.tasks.toArray())[0];
    await d.tasks.update(t.id, { notifiedAt: 1 });
    await runCommands([{ type: 'edit_task', task: 'gym', time: '19:00' }], d, TODAY);
    expect((await d.tasks.get(t.id))?.notifiedAt).toBeUndefined();
    expect((await d.tasks.get(t.id))?.time).toBe('19:00');
  });
  it('offline parser pulls the time out of the title', () => {
    expect(parseFallback('remind me to call mom tomorrow at 5pm', ctx).commands).toEqual([{ type: 'add_task', title: 'call mom', due: 'tomorrow', time: '17:00' }]);
    expect(parseFallback('dentist friday 9:30am', ctx).commands[0]).toMatchObject({ type: 'add_task', time: '09:30' });
  });
  it('model output keeps time', () => {
    expect(parseModelOutput('{"commands":[{"type":"add_task","title":"x","time":"17:00"}],"reply":""}')?.commands[0]).toMatchObject({ time: '17:00' });
  });
});

describe('set_reminders', () => {
  it('turns on, sets and clears the check-in', async () => {
    const d = new YourselfDB(`r-${Math.random()}`);
    await runCommands([{ type: 'set_reminders', checkin: '9pm' }], d, TODAY);
    expect((await d.settings.get('settings'))?.reminders).toEqual({ enabled: true, checkin: '21:00' });
    await runCommands([{ type: 'set_reminders', checkin: 'off' }], d, TODAY);
    expect((await d.settings.get('settings'))?.reminders?.checkin).toBeUndefined();
    await runCommands([{ type: 'set_reminders', enabled: false }], d, TODAY);
    expect((await d.settings.get('settings'))?.reminders?.enabled).toBe(false);
  });
  it.each([
    ['turn on reminders', { enabled: true }],
    ['turn off notifications', { enabled: false }],
    ['remind me every evening at 9pm to check in', { enabled: true, checkin: '21:00' }],
    ['stop the daily check-in', { checkin: 'off' }],
  ])('offline: "%s"', (msg, want) => {
    expect(parseFallback(msg, ctx).commands[0]).toMatchObject({ type: 'set_reminders', ...want });
  });
  it('"check in with my boss" is not a reminder setting', () => {
    expect(parseFallback('I need to check in with my boss tomorrow', ctx).commands[0]?.type).toBe('add_task');
  });
  it('"remind me to X" is still a task', () => {
    expect(parseFallback('remind me to water the plants', ctx).commands[0]?.type).toBe('add_task');
  });
  it('help knows about reminders', () => {
    expect(findHelp('how do notifications work')?.id).toBe('reminders');
  });
});
