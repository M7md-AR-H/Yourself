/** Laptop layer: left icon rail, keyboard shortcuts, ⌘K items. Phone UI is untouched. */
import { BarChart3, HelpCircle, LayoutGrid, MessageCircle, NotebookPen, Plus, Settings as SettingsIcon, Sun } from 'lucide-react';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { HELP } from '../lib/help';
import { navigate, type Route } from '../lib/hooks';
import type { Page, Settings } from '../lib/types';
import type { CommandItem } from './commandItems';
import type { EditorTarget } from './EditorSheet';
import { useToast } from './Toaster';

const WIDE = '(min-width: 900px)';
export function useWide(): boolean {
  return useSyncExternalStore(
    (cb) => { const m = matchMedia(WIDE); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb); },
    () => matchMedia(WIDE).matches,
  );
}

export const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const MOD = IS_MAC ? '⌘' : 'Ctrl';

const NAV: { page: Page; label: string; icon: typeof Sun; keys: string }[] = [
  { page: 'today', label: 'Today', icon: Sun, keys: 'G T' },
  { page: 'chart', label: 'Chart', icon: LayoutGrid, keys: 'G C' },
  { page: 'review', label: 'Weekly review', icon: BarChart3, keys: 'G R' },
  { page: 'notes', label: 'Notes', icon: NotebookPen, keys: 'G N' },
  { page: 'chat', label: 'Chat', icon: MessageCircle, keys: 'G A' },
];
const NAV_END: typeof NAV = [
  { page: 'help', label: 'Help', icon: HelpCircle, keys: 'G H' },
  { page: 'settings', label: 'Settings', icon: SettingsIcon, keys: 'G S' },
];

export function Rail({ route, onPlus }: { route: Route; onPlus: () => void }) {
  const item = (n: (typeof NAV)[number]) => {
    const active = route.page === n.page;
    return (
      <button key={n.page} className={`rail-btn ${active ? 'on' : ''}`} aria-current={active ? 'page' : undefined} aria-label={n.label}
        data-tip={`${n.label}  ${n.keys}`} aria-keyshortcuts={n.keys.replace(' ', '+')} onClick={() => navigate(n.page)}>
        <n.icon size={20} aria-hidden />
      </button>
    );
  };
  return (
    <nav className="rail glass" aria-label="Main">
      {NAV.map(item)}
      <span className="rail-sep" aria-hidden />
      <button className="rail-btn rail-plus" aria-label="Add note or task" data-tip="New note  N" onClick={onPlus}><Plus size={20} aria-hidden /></button>
      <span style={{ flex: 1 }} />
      {NAV_END.map(item)}
    </nav>
  );
}

const typing = (el: EventTarget | null) => {
  const e = el as HTMLElement | null;
  return !!e && (e.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.tagName));
};

/** ⌘K / Ctrl+K menu, "/" focuses the assistant, G-then-letter jumps to pages, N new note, T new task. */
export function useShortcuts(opts: { onMenu: () => void; onEdit: (t: EditorTarget) => void; enabled: boolean }) {
  useEffect(() => {
    if (!opts.enabled) return;
    let g = 0;
    const map: Record<string, Page> = { t: 'today', c: 'chart', r: 'review', n: 'notes', a: 'chat', s: 'settings', h: 'help' };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); opts.onMenu(); return; }
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || document.querySelector('[role="dialog"]')) return;
      const k = e.key.toLowerCase();
      if (Date.now() - g < 900 && map[k]) { e.preventDefault(); g = 0; navigate(map[k]); return; }
      if (k === 'g') { g = Date.now(); return; }
      if (k === '/') { e.preventDefault(); (document.getElementById('cmd') ?? document.getElementById('chat-in'))?.focus(); return; }
      if (k === 'n') { e.preventDefault(); opts.onEdit({ kind: 'new', mode: 'note' }); return; }
      if (k === 't') { e.preventDefault(); opts.onEdit({ kind: 'new', mode: 'task' }); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [opts]);
}

export function useCommandItems(settings: Settings, onEdit: (t: EditorTarget) => void): CommandItem[] {
  const { exec } = useToast();
  const pillars = useLiveQuery(() => db.pillars.orderBy('index').filter((p) => !!p.title).toArray(), []) ?? [];
  return useMemo(() => {
    const icon: Record<string, string> = { today: 'today', chart: 'chart', review: 'review', notes: 'notes', chat: 'chat', settings: 'settings', help: 'help' };
    const pages: CommandItem[] = [...NAV, ...NAV_END].map((n) => ({
      id: `go-${n.page}`, label: `Go to ${n.label}`, group: 'Pages', icon: icon[n.page], shortcut: n.keys.split(' '), run: () => navigate(n.page),
    }));
    const dark = document.documentElement.dataset.theme === 'dark';
    const actions: CommandItem[] = [
      { id: 'new-note', label: 'New note…', group: 'Actions', icon: 'note', shortcut: ['N'], keywords: ['write', 'add', 'journal'], run: () => onEdit({ kind: 'new', mode: 'note' }) },
      { id: 'new-task', label: 'New task…', group: 'Actions', icon: 'task', shortcut: ['T'], keywords: ['todo', 'add', 'remind'], run: () => onEdit({ kind: 'new', mode: 'task' }) },
      { id: 'ask', label: 'Talk to the assistant', group: 'Actions', icon: 'ask', shortcut: ['/'], keywords: ['ai', 'gemma', 'chat'], run: () => document.getElementById('cmd')?.focus() },
      { id: 'theme', label: dark ? 'Switch to light mode' : 'Switch to dark mode', group: 'Actions', icon: 'theme', keywords: ['theme', 'dark', 'light'], run: () => void exec([{ type: 'set_theme', theme: dark ? 'light' : 'dark' }]) },
      { id: 'review-month', label: 'Review the last 4 weeks', group: 'Actions', icon: 'review', keywords: ['month', 'trend'], run: () => navigate('review', { range: 'month' }) },
      ...HELP.map((h) => ({ id: `help-${h.id}`, label: `Help: ${h.title}`, group: 'Actions' as const, icon: 'help', keywords: h.keywords, run: () => navigate('help', { s: h.id }) })),
    ];
    const blocks: CommandItem[] = [
      { id: 'pillar-goal', label: `Open the centre: ${settings.name ? 'your goal' : 'goal'}`, group: 'Pillars', icon: 'pillar', keywords: ['goal', 'centre', 'center'], run: () => navigate('chart', { pillar: 'goal' }) },
      ...pillars.map((p) => ({ id: `pillar-${p.id}`, label: `Open ${p.title}`, group: 'Pillars' as const, icon: 'pillar', keywords: ['pillar', 'block'], run: () => navigate('chart', { pillar: p.index + 1 }) })),
    ];
    return [...pages, ...actions, ...blocks];
  }, [pillars, settings.name, onEdit, exec]);
}

/** A tiny state holder so the top bar can show the ⌘K hint and open the menu. */
export function useMenuState() {
  const [open, setOpen] = useState(false);
  return { open, setOpen };
}
