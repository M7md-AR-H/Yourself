/**
 * Help content: one source for the Help page AND the assistant's knowledge.
 * `summary` is what the AI sees (keep it short); `steps` is what the page shows.
 */
export interface HelpSection {
  id: string;
  title: string;
  summary: string;
  steps: string[];
  keywords: string[];
}

export const HELP: HelpSection[] = [
  {
    id: 'install',
    title: 'Install the app on your phone',
    summary: 'Open the app link in Chrome, then menu (⋮) → Add to Home screen → Install.',
    steps: [
      'Open the app’s link in Chrome (not Mi Browser). Update Chrome first: Play Store → Chrome → Update.',
      'Tap the menu (⋮) at the top right → “Add to Home screen” → “Install”.',
      'Open Yourself from your home screen. It now runs full-screen and works offline.',
    ],
    keywords: ['install', 'home screen', 'app', 'download app', 'setup', 'set up', 'link', 'open'],
  },
  {
    id: 'gemma',
    title: 'Turn on the AI (Gemma)',
    summary: 'Settings → Assistant → tap “Get” next to a Gemma model. Use Wi‑Fi: Gemma 3 1B is 0.7 GB. It runs fully on the phone.',
    steps: [
      'Connect to Wi‑Fi. The first download is 0.7 GB (Gemma 3 · 1B), 1.9 GB or 3.4 GB for the bigger ones.',
      'Open Settings → Assistant and tap “Get” next to a model. Keep the app open until the bar reaches 100% and the dot turns green.',
      'After that it loads from the phone in a few seconds every time you open the app, even offline.',
      'Start with Gemma 3 · 1B. If answers feel off and your phone stays cool, try Gemma 2 · 2B.',
      'Until Gemma is on, a quick offline helper understands simple messages.',
    ],
    keywords: ['ai', 'gemma', 'model', 'assistant', 'download', 'turn on', 'enable', 'smarter', 'offline helper'],
  },
  {
    id: 'talk',
    title: 'Talk to it (the main way to use the app)',
    summary: 'Type or speak in the bar at the top of any page, or in Chat. Say what you did, will do, or feel; it makes tasks, notes and check-ins.',
    steps: [
      'Type in the bar at the top of any page, or tap the mic to speak. The Chat tab keeps the whole conversation.',
      'Things you did → logged on your chart: “I meditated and slept 8 hours”.',
      'Things you will do → tasks: “remind me to call mom tomorrow”, “pay rent friday”.',
      'Thoughts and feelings → notes: “felt calm after my walk”.',
      'Questions → answers: “how am I doing this week?”.',
      'It can also change the chart, the theme, your name, and open any page, including this one (“open help”).',
      'Every change shows a message with Undo for a few seconds.',
    ],
    keywords: ['talk', 'chat', 'speak', 'voice', 'mic', 'type', 'how to use', 'what can it do', 'commands', 'examples'],
  },
  {
    id: 'chart',
    title: 'Your chart (the Mandala method)',
    summary: 'One goal in the centre, 8 pillars around it, 8 small actions per pillar. Colour = how many of the last 7 days you did it. Tap a block to open it, tap an action to log it, long-press to rename.',
    steps: [
      'The centre is your main goal. Around it are the 8 things it depends on (pillars). Each pillar has 8 small daily actions.',
      'Colour shows the last 7 days: pale = not done, deep green = every day. A dark outline means done today.',
      'Each pillar’s centre square has a ring that fills as the pillar improves.',
      'Tap a block to zoom in. Tap an action to log it for today; tap again to undo.',
      'Long-press an action (or use the pencil) to rename or remove it. Tap the centre square to rename the pillar.',
      'Tap the middle block to change your goal and pillar names. Or just tell the assistant.',
    ],
    keywords: ['chart', 'mandala', 'grid', 'pillar', 'action', 'goal', 'colour', 'color', 'green', 'outline', 'ring', 'edit chart', 'rename'],
  },
  {
    id: 'today',
    title: 'Today, tasks and notes',
    summary: 'Today shows your week score, suggested actions and tasks. Tick a task to finish it. “+” adds a note or task by hand. Notes are searchable and filterable by pillar.',
    steps: [
      'Today: your weekly score, stat tiles, small actions to do today, and your tasks.',
      'Tick the circle next to a task to complete it. Tap the task to edit or delete it.',
      'The “+” button adds a note or task by hand.',
      'Notes: grouped by day, with search and pillar filters. Tap one to edit it.',
    ],
    keywords: ['today', 'task', 'tasks', 'todo', 'notes', 'note', 'add', 'plus', 'delete', 'edit', 'search'],
  },
  {
    id: 'review',
    title: 'Weekly review',
    summary: 'Today → “Weekly review” (or ask “how was my week?”). Shows this week, last week or 4 weeks: score, actions per day, each pillar’s trend, and a reflection.',
    steps: [
      'Open it from Today → “Weekly review”, or ask the assistant “how was my week?”.',
      'Switch between This week, Last week and 4 weeks.',
      'See your overall score, actions per day, each pillar’s change, what’s going well and what needs love.',
      'Tap “Ask Gemma” (or “Write it”) for a short reflection.',
    ],
    keywords: ['review', 'week', 'weekly', 'trend', 'progress', 'reflection', 'summary', 'stats'],
  },
  {
    id: 'backup',
    title: 'Backup and moving to another device',
    summary: 'Everything is stored only on this phone. Settings → Your data → Export backup saves a file; Import… on the other device restores it.',
    steps: [
      'Your data lives only on this device. Clearing Chrome’s site data or uninstalling deletes it.',
      'Settings → Your data → “Export backup” saves a file. Keep it somewhere safe (Drive, email to yourself).',
      'On another phone or laptop, open the app → Settings → “Import…” and pick the file. You can Undo right after.',
    ],
    keywords: ['backup', 'export', 'import', 'move', 'laptop', 'new phone', 'transfer', 'lost', 'data', 'sync'],
  },
  {
    id: 'privacy',
    title: 'Privacy',
    summary: 'Notes, tasks, chart and Gemma all stay on the phone. Only the one-time model download uses the internet. Voice uses on-device speech when the phone supports it, otherwise Chrome’s online speech service.',
    steps: [
      'No account, no server. Notes, tasks, your chart and the AI all run on this phone.',
      'The internet is only used to download the app and the Gemma model (once).',
      'Voice input: on-device when your phone supports it; otherwise Chrome sends the audio to Google’s speech service. The app tells you when that happens.',
    ],
    keywords: ['privacy', 'private', 'data', 'cloud', 'server', 'safe', 'google', 'voice', 'offline'],
  },
  {
    id: 'trouble',
    title: 'Troubleshooting',
    summary: 'AI won’t start: update Chrome, use Wi‑Fi, close other apps, try Gemma 3 1B, check chrome://gpu shows WebGPU. Slow or hot: use the 1B model. Something broke: reload; your data is kept.',
    steps: [
      '“No WebGPU” or the model won’t start: update Chrome to the latest version, then reopen the app.',
      'Still not starting: open chrome://gpu in Chrome and check “WebGPU” says Hardware accelerated.',
      'Download stuck: stay on Wi‑Fi with the app open. It resumes where it left off.',
      'Crashes or freezes while loading: close other apps and pick the smaller Gemma 3 · 1B.',
      'Answers are slow or the phone gets hot: use Gemma 3 · 1B; the first answer after loading is always the slowest.',
      'The assistant misunderstood: tap Undo, then say it more directly (“add task …”, “I did …”).',
      'A screen broke: tap Reload. Your data is not lost.',
    ],
    keywords: ['problem', 'error', 'broken', 'not working', 'slow', 'hot', 'crash', 'stuck', 'webgpu', 'fix', 'trouble', 'won’t', 'wont', 'cant', 'can’t'],
  },
  {
    id: 'test',
    title: 'Test how well the AI understands you',
    summary: 'Settings → Test the assistant → Run test. It scores 80 sample messages without touching your data; “Copy results” to share them with the developer.',
    steps: [
      'Settings → “Test the assistant” → “Run test”. With Gemma on it takes a few minutes.',
      'It uses a separate test space, so your data isn’t touched.',
      'Tap “Copy results” and send them to the developer to help tune the AI.',
    ],
    keywords: ['test', 'accuracy', 'eval', 'score', 'measure', 'results'],
  },
  {
    id: 'dev',
    title: 'For developers: run and deploy',
    summary: 'Code: github.com/m7md-ar-h/yourself. npm install, npm run dev. Push to main deploys to GitHub Pages (enable Pages → Source: GitHub Actions once).',
    steps: [
      'Get the code: github.com/m7md-ar-h/yourself. Needs Node 22.',
      'Run locally: `npm install` then `npm run dev` and open the shown address. WebGPU needs https or localhost.',
      'Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run e2e`.',
      'Deploy: one time, repo Settings → Pages → Source: “GitHub Actions”. After that every merge to main publishes to https://m7md-ar-h.github.io/yourself/.',
    ],
    keywords: ['developer', 'code', 'github', 'run', 'deploy', 'npm', 'build', 'host', 'pages', 'source'],
  },
];

export function findHelp(query: string): HelpSection | undefined {
  const q = query.toLowerCase();
  let best: HelpSection | undefined;
  let bestScore = 0;
  for (const h of HELP) {
    const score = h.keywords.reduce((n, k) => n + (q.includes(k) ? k.length : 0), 0) + (q.includes(h.id) ? 3 : 0);
    if (score > bestScore) { bestScore = score; best = h; }
  }
  return best;
}

/** Compact help for the model's prompt. */
export const helpForPrompt = () => HELP.map((h) => `- [${h.id}] ${h.title}: ${h.summary}`).join('\n');
