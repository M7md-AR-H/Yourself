# Handoff — 2026-11-04 (session 3)

## What was done
**Sessions 1–2 (merged, PRs #1–#4):** the phone app and its main features (Mandala chart, Today, Notes, Chat, Settings, onboarding, Gemma via WebLLM, offline parser, one command layer with undo), the weekly review, the Help page, voice, the AI eval set with an on-phone test runner, the chart redesign, and the GitHub Pages deploy (live at https://m7md-ar-h.github.io/Yourself/).

**Session 3 (this one; the owner said to build every phase before testing):**
- **Task times and reminders (Phase 2B)**
  - Tasks can have a time: `add_task`/`edit_task` take a `time` field ("at 5pm" → 17:00), handled by `resolveTime` in `commands.ts`. The offline parser pulls the time out of the title (`withTime`).
  - `src/lib/reminders.ts` runs every 30 s while the app is alive. It notifies once per task (`notifiedAt`) and can also send a daily check-in nudge.
  - `public/sw-reminders.js` is imported into the Workbox SW. It shows a daily "tasks due" summary via Periodic Background Sync (installed app only) and handles notification clicks.
  - Settings → Reminders (`RemindersPanel`) and the `set_reminders` command, so the AI can change them.
  - Help has a new "reminders" section.
- **Laptop (Phase 3), from 900 px wide**
  - A floating left icon rail with tooltips and shortcut hints replaces the tab bar, and the top bar says "Welcome, {name}".
  - Today is a bento grid, Review uses two columns, and Notes uses 2–3 columns.
  - On the Chart, the overview and the open block sit side by side.
  - **⌘K / Ctrl+K** opens a command menu (pages, actions, pillars, help sections, "Ask the assistant"). It was built by a Sonnet subagent, then wired and checked by me.
  - Keyboard shortcuts: G then T/C/R/N/A/S/H, N for a new note, T for a new task, / to focus the assistant.
- **Tests:** 175 unit, 35 e2e (POCO F5 light/dark, 360 px, laptop 1440×900). The eval has 89 cases; the offline parser scores 79/89.

## Current state
- **Works (verified in headless Chromium):** everything above at phone and laptop sizes, in light and dark mode.
- **Not verified:** Gemma, voice, and real notifications on a device. Headless Chromium has no GPU, no microphone, and no OS notification centre.

## Next steps (in order)
1. Owner device tests (`OWNER_TASKS.md` §2, including the new rows), plus **Settings → Test the assistant → Copy results** with Gemma on.
2. Tune `src/ai/prompt.ts` from the Gemma eval numbers. Add examples for the weakest tags and re-measure.
3. Fix whatever the device tests find.
4. Sync between phone and laptop, once the owner picks an option (see below).

## Open questions for the owner
- **Sync between phone and laptop.** Options:
  - (a) Keep manual export/import. Free, works today.
  - (b) Auto-sync through a file in your Google Drive. Needs a Google Cloud project and OAuth app (a free account step).
  - (c) A small sync server, for example Cloudflare Workers + D1. Free tier, but needs an account and a domain or a workers.dev URL. End-to-end encryption is possible.
  
  This is your call, because it involves accounts and where your data lives.
- **Exact-time reminders with the app fully closed** need a push server (same account question as sync) or a native Android wrapper. Is the current behaviour enough? It notifies while the app is running, plus a daily summary when it's installed.
- After the phone test: is Gemma 3 1B good enough?

## Traps
- Run e2e here with `PW_CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`. The `laptop` project only runs `tests/e2e/laptop.spec.ts`, and the phone projects ignore that file.
- `public/sw-reminders.js` is plain JS running inside the service worker. It opens the `yourself` DB without a version and never creates or upgrades it. If you bump the Dexie version, stores stay compatible as long as names don't change.
- Notification permission must be requested from a tap. When the AI turns reminders on, the setting changes, but the user still has to allow notifications in Settings → Reminders.
- On the laptop chart split, `layoutId` is off on purpose; on the phone it's on.
- Gemma has no system role, so everything goes in one user turn.
- The AI addresses items by name; the UI passes ids.
- Only the newest toast keeps an Undo.
- Don't import `src/lib/hooks.ts` or pages into unit tests (they touch `location`). Pure logic lives in `src/lib/*`.
- Don't commit the TikTok reference images.
