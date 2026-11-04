import { describe, expect, it } from 'vitest';
import { filterItems, type CommandItem } from '../../src/ui/commandItems';

const mk = (id: string, label: string, keywords?: string[]): CommandItem => ({ id, label, group: 'Pages', keywords, run: () => {} });
const items = [
  mk('today', 'Go to Today'),
  mk('chart', 'Go to Chart', ['mandala']),
  mk('review', 'Go to Review', ['stats']),
  mk('note', 'New note'),
  mk('task', 'New task', ['todo']),
  mk('theme', 'Toggle theme', ['dark', 'light']),
  mk('chat', 'Open chat'),
];
const ids = (q: string) => filterItems(items, q).map((i) => i.id);

describe('filterItems', () => {
  it('returns all in order for empty query', () => {
    expect(ids('')).toEqual(items.map((i) => i.id));
    expect(ids('   ')).toEqual(items.map((i) => i.id));
  });
  it('does not alias the input', () => {
    expect(filterItems(items, '')).not.toBe(items);
  });
  it('is case-insensitive', () => {
    expect(ids('CHART')).toEqual(ids('chart'));
    expect(ids('chart')).toContain('chart');
  });
  it('ranks label prefix above word prefix', () => {
    expect(ids('new')).toEqual(['note', 'task']);
    const list = [mk('a', 'Open theme'), mk('b', 'Theme picker')];
    expect(filterItems(list, 'theme').map((i) => i.id)).toEqual(['b', 'a']);
  });
  it('ranks word prefix above substring', () => {
    const list = [mk('a', 'Restart app'), mk('b', 'Start here')];
    expect(filterItems(list, 'start').map((i) => i.id)).toEqual(['b', 'a']);
    const list2 = [mk('a', 'Multi-start'), mk('b', 'Go start')];
    expect(filterItems(list2, 'start').map((i) => i.id)).toEqual(['a', 'b']);
  });
  it('ranks substring above keyword match', () => {
    const list = [mk('a', 'Alpha', ['task']), mk('b', 'Multitask')];
    expect(filterItems(list, 'task').map((i) => i.id)).toEqual(['b', 'a']);
  });
  it('matches keywords', () => {
    expect(ids('mandala')).toEqual(['chart']);
    expect(ids('todo')).toEqual(['task']);
    expect(ids('dark')).toEqual(['theme']);
  });
  it('matches fuzzy subsequence within one word', () => {
    expect(ids('chrt')).toContain('chart');
  });
  it('matches label initials', () => {
    expect(ids('gtc')).toEqual(['chart']);
  });
  it('does not match unrelated items wildly', () => {
    expect(ids('gtc')).not.toContain('today');
    expect(ids('zzz')).toEqual([]);
    expect(ids('nts')).not.toContain('task');
  });
  it('requires at least two chars for fuzzy', () => {
    expect(ids('q')).toEqual([]);
  });
  it('is stable within ties', () => {
    expect(ids('go to')).toEqual(['today', 'chart', 'review']);
  });
  it('ignores diacritics and surrounding whitespace', () => {
    expect(ids('  chárt ')).toContain('chart');
  });
  it('returns empty for empty item list', () => {
    expect(filterItems([], 'x')).toEqual([]);
  });
});
