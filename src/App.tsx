import { useEffect, useState } from 'react';
import * as engine from './ai/engine';
import { useRoute, useSettings, useTheme } from './lib/hooks';
import { Chart } from './pages/Chart';
import { Chat } from './pages/Chat';
import { Notes } from './pages/Notes';
import { Onboarding } from './pages/Onboarding';
import { Settings } from './pages/Settings';
import { Today } from './pages/Today';
import { EditorSheet, type EditorTarget } from './ui/EditorSheet';
import { TabBar, TopBar } from './ui/Shell';
import { Toaster } from './ui/Toaster';

export default function App() {
  const settings = useSettings();
  const route = useRoute();
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  useTheme(settings?.theme);

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
      {!settings ? null : !settings.onboarded ? (
        <Onboarding />
      ) : (
        <>
          <TopBar settings={settings} route={route} />
          <main className="shell" id="main">
            {route.page === 'today' && <Today settings={settings} onEdit={setEditor} />}
            {route.page === 'chart' && <Chart />}
            {route.page === 'notes' && <Notes onEdit={setEditor} />}
            {route.page === 'chat' && <Chat />}
            {route.page === 'settings' && <Settings settings={settings} />}
          </main>
          <TabBar route={route} onPlus={() => setEditor({ kind: 'new' })} />
          <EditorSheet target={editor} onClose={() => setEditor(null)} />
        </>
      )}
    </Toaster>
  );
}
