import { BellRing } from 'lucide-react';
import { useState } from 'react';
import { formatTime } from '../lib/commands';
import { permission, registerBackgroundCheck, requestPermission, startScheduler, tick, type Permission } from '../lib/reminders';
import type { Settings } from '../lib/types';
import { useToast } from './Toaster';

export function RemindersPanel({ settings }: { settings: Settings }) {
  const { exec, toast } = useToast();
  const [perm, setPerm] = useState<Permission>(permission());
  const r = settings.reminders ?? { enabled: false };

  const turnOn = async () => {
    const p = await requestPermission();
    setPerm(p);
    if (p !== 'granted') {
      toast({ title: p === 'denied' ? 'Notifications are blocked' : 'Notifications not allowed', detail: p === 'denied' ? 'Chrome menu (⋮) → Settings → Site settings → Notifications → allow this app.' : undefined });
      return;
    }
    await exec([{ type: 'set_reminders', enabled: true }]);
    startScheduler();
    await registerBackgroundCheck(true);
  };

  return (
    <section className="glass card stack" aria-labelledby="s-rem">
      <div className="between">
        <h2 className="section-title" id="s-rem">Reminders</h2>
        <span className="ai-status"><span className={`ai-dot ${r.enabled && perm === 'granted' ? 'on' : ''}`} />{r.enabled && perm === 'granted' ? 'On' : 'Off'}</span>
      </div>
      <p className="subtitle" style={{ marginTop: 0 }}>Get a notification when a task with a time is due (“call mom at 5pm”), and an optional daily check-in.</p>
      {perm === 'unsupported' ? (
        <p className="label">This browser can’t show notifications.</p>
      ) : !r.enabled || perm !== 'granted' ? (
        <button className="btn btn-solid" onClick={turnOn}><BellRing size={16} aria-hidden /> Turn on reminders</button>
      ) : (
        <>
          <div className="field">
            <label htmlFor="s-checkin">Daily check-in</label>
            <div className="row">
              <input id="s-checkin" type="time" className="input" value={r.checkin ?? ''} onChange={(e) => e.target.value && exec([{ type: 'set_reminders', checkin: e.target.value }])} />
              {r.checkin && <button className="btn btn-light" onClick={() => exec([{ type: 'set_reminders', checkin: 'off' }])}>No check-in</button>}
            </div>
            <span className="label">{r.checkin ? `Every day at ${formatTime(r.checkin)}: “How did today go?”` : 'Pick a time to get a daily nudge to log your day.'}</span>
          </div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button className="btn btn-light" onClick={async () => { const f = await tick(); if (!f.length) toast({ title: 'Nothing due right now', detail: 'Reminders will appear at each task’s time.' }); }}>Check now</button>
            <button className="btn btn-ghost" onClick={async () => { await exec([{ type: 'set_reminders', enabled: false }]); await registerBackgroundCheck(false); }}>Turn off</button>
          </div>
          <p className="label">Works while the app is open or in the background. If you install the app, you also get a once-a-day summary of today’s tasks, even when it’s closed. Exact-time alarms with the app fully closed aren’t possible for web apps yet.</p>
        </>
      )}
    </section>
  );
}
