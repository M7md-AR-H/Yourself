import { useCallback, useEffect, useMemo, useState } from 'react';
import * as engine from './ai/engine';
import { startScheduler } from './lib/reminders';
import { navigate, useRoute, useSettings, useTheme, type Route } from './lib/hooks';
import type { Settings as SettingsT } from './lib/types';
import { CommandMenu } from './ui/CommandMenu';
import { Rail, useCommandItems, useShortcuts, useWide } from './ui/Desktop';
import { useAssistant } from './ui/useAssistant';
import { Chart } from './pages/Chart';
import { Chat } from './pages/Chat';
import { Notes } from './pages/Notes';
import { Onboarding } from './pages/Onboarding';
import { Review } from './pages/Review';
import { Help } from './pages/Help';
import { Settings } from './pages/Settings';
import { Today } from './pages/Today';
import { EditorSheet, type EditorTarget } from './ui/EditorSheet';
import { TabBar, TopBar } from './ui/Shell';
import { Toaster } from './ui/Toaster';

export default function App() {
  const settings = useSettings();
  const route = useRoute();
  useTheme(settings?.theme);

  // Reminder checks run while the app is alive (open or in the background).
  useEffect(() => { if (settings?.reminders?.enabled) startScheduler(); }, [settings?.reminders?.enabled]);

  // Start the model in the background if the user turned it on before.
  useEffect(() => {
    if (settings?.aiEnabled && engine.getStatus().state === 'off') void engine.load(settings.model);
  }, [settings?.aiEnabled, settings?.model]);

  // Keyboard detection: when the visual viewport shrinks a lot, hide the tab bar.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const full = { h: window.innerHeight };
    const onResize = () => {
      full.h = Math.max(full.h, window.innerHeight);
      document.documentElement.classList.toggle('kb', vv.height < full.h * 0.75);
    };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    document.title = `${route.page[0].toUpperCase()}${route.page.slice(1)} · Yourself`;
    window.scrollTo({ top: 0 });
  }, [route.page]);

  return (
    <Toaster>
      <div className="bg" aria-hidden />
      <div className="grain" aria-hidden />
      {!settings ? null : !settings.onboarded ? <Onboarding /> : <Workspace settings={settings} route={route} />}
    </Toaster>
  );
}

/** The signed-in app. Lives inside <Toaster> so the command menu can run commands with Undo. */
function Workspace({ settings, route }: { settings: SettingsT; route: Route }) {
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [menu, setMenu] = useState(false);
  const wide = useWide();
  const { send } = useAssistant();
  const edit = useCallback((t: EditorTarget) => setEditor(t), []);
  const items = useCommandItems(settings, edit);
  const shortcutOpts = useMemo(() => ({ onMenu: () => setMenu((o) => !o), onEdit: edit, enabled: true }), [edit]);
  useShortcuts(shortcutOpts);

  return (
    <>
      <TopBar settings={settings} route={route} onMenu={() => setMenu(true)} />
      {wide && <Rail route={route} onPlus={() => setEditor({ kind: 'new' })} />}
      <main className={`shell page-${route.page}`} id="main">
        {route.page === 'today' && <Today settings={settings} onEdit={setEditor} />}
        {route.page === 'chart' && <Chart />}
        {route.page === 'review' && <Review />}
        {route.page === 'help' && <Help />}
        {route.page === 'notes' && <Notes onEdit={setEditor} />}
        {route.page === 'chat' && <Chat />}
        {route.page === 'settings' && <Settings settings={settings} />}
      </main>
      {!wide && <TabBar route={route} onPlus={() => setEditor({ kind: 'new' })} />}
      <EditorSheet target={editor} onClose={() => setEditor(null)} />
      <CommandMenu open={menu} onClose={() => setMenu(false)} items={items}
        onAsk={(q) => { setMenu(false); navigate('chat'); void send(q); }} />
    </>
  );
}
