/** Pure logic for the command menu: item shape + filtering/ranking. No React, no DOM. */

export interface CommandItem {
  id: string;
  label: string; // "Go to Chart"
  group: 'Pages' | 'Actions' | 'Pillars' | 'Assistant';
  keywords?: string[];
  shortcut?: string[]; // display only, e.g. ['G','C']
  icon?: string; // icon key the component maps, e.g. 'chart'
  run: () => void;
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
const words = (s: string) => norm(s).split(/[^a-z0-9]+/).filter(Boolean);

function isSubsequence(q: string, text: string): boolean {
  let i = 0;
  for (let j = 0; j < text.length && i < q.length; j++) if (text[j] === q[i]) i++;
  return i === q.length;
}

/** Lower is better; -1 means no match. */
function score(item: CommandItem, q: string): number {
  const label = norm(item.label);
  const lw = words(item.label);
  if (label.startsWith(q)) return 0;
  if (lw.some((w) => w.startsWith(q))) return 1;
  if (label.includes(q)) return 2;
  const kws = (item.keywords ?? []).map(norm);
  if (kws.some((k) => k.includes(q))) return 3;
  const compact = q.replace(/\s+/g, '');
  if (compact.length >= 2) {
    // Fuzzy: subsequence inside one word, or the label's word initials ("gtc" = Go To Chart).
    const initials = lw.map((w) => w[0]).join('');
    if (initials.startsWith(compact) || lw.some((w) => isSubsequence(compact, w))) return 4;
  }
  return -1;
}

export function filterItems(items: CommandItem[], query: string): CommandItem[] {
  const q = norm(query).trim();
  if (!q) return items.slice();
  const ranked: { item: CommandItem; s: number; i: number }[] = [];
  items.forEach((item, i) => {
    const s = score(item, q);
    if (s >= 0) ranked.push({ item, s, i });
  });
  ranked.sort((a, b) => a.s - b.s || a.i - b.i);
  return ranked.map((r) => r.item);
}
