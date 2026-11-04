import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { YourselfDB } from '../../src/lib/db';
import { resolveDate, runCommands } from '../../src/lib/commands';
import { starterCommands } from '../../src/lib/seed';
import { parseModelOutput } from '../../src/ai/schema';
import { similarity } from '../../src/lib/util';

const TODAY = '2026-11-04'; // Wednesday
let db: YourselfDB;
beforeEach(() => { db = new YourselfDB(`r-${Math.random()}`); });

describe('review fixes', () => {
  it('past weekdays resolve backwards for check-ins', () => {
    expect(resolveDate('monday', TODAY, true)).toBe('2026-11-02');
    expect(resolveDate('wednesday', TODAY, true)).toBe(TODAY);
    expect(resolveDate('last night', TODAY, true)).toBe('2026-11-03');
  });
  it('rejects impossible calendar dates', () => {
    expect(resolveDate('2026-13-45', TODAY)).toBeUndefined();
    expect(resolveDate('2026-02-30', TODAY)).toBeUndefined();
  });
  it('check-in in the future is refused', async () => {
    await runCommands(starterCommands(), db, TODAY);
    const r = await runCommands([{ type: 'check_in', action: 'journal', date: 'tomorrow' }], db, TODAY);
    expect(r.errors[0]).toMatch(/already did/);
    expect(await db.checkins.count()).toBe(0);
  });
  it('naming empty pillar slot 6 puts it in slot 6', async () => {
    await runCommands([{ type: 'set_pillar', pillar: 6, title: 'Fitness' }], db, TODAY);
    expect((await db.pillars.toArray())[0].index).toBe(5);
  });
  it('ids win over names (duplicate titles)', async () => {
    await runCommands([{ type: 'add_task', title: 'Buy milk' }], db, TODAY);
    await new Promise((r) => setTimeout(r, 2));
    await runCommands([{ type: 'add_task', title: 'Buy milk' }], db, TODAY);
    const older = (await db.tasks.orderBy('createdAt').toArray())[0];
    await runCommands([{ type: 'complete_task', task: 'Buy milk', id: older.id }], db, TODAY);
    expect((await db.tasks.get(older.id))?.done).toBe(true);
    expect((await db.tasks.filter((t) => t.done).count())).toBe(1);
  });
  it('fuzzy match works for non-Latin text and accents', () => {
    expect(similarity('café', 'Cafe visit')).toBeGreaterThan(0.5);
    expect(similarity('買牛奶', '買牛奶')).toBe(1);
    expect(similarity('заплатить', 'Заплатить аренду')).toBeGreaterThan(0.5);
  });
  it('salvages commands from truncated model output', () => {
    const out = parseModelOutput('{"commands":[{"type":"add_task","title":"A"},{"type":"add_note","text":"B"},{"type":"add_ta');
    expect(out?.commands.map((c) => c.type)).toEqual(['add_task', 'add_note']);
  });
  it('model cannot delete a note without naming it, and slot must be an integer', () => {
    expect(parseModelOutput('{"commands":[{"type":"delete_note"}],"reply":""}')?.commands).toEqual([]);
    const c = parseModelOutput('{"commands":[{"type":"set_action","pillar":"mind","title":"x","slot":2.5}],"reply":""}')?.commands[0];
    expect(c && 'slot' in c ? c.slot : 'none').toBeUndefined();
  });
});
