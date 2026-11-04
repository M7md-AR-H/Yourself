# Handoff — 2026-11-04 (session 2)

## What was done
**Session 1 (merged in PR #1):** the whole Phase 1 phone app: Mandala chart, Today, Notes, Chat, Settings, onboarding, Gemma via WebLLM, offline parser, one command layer with undo, PWA, CI, docs.

**Session 2 (this one):**
- **Weekly review** (`#/review`, from Today → "Weekly review" or "how was my week?"): This week / Last week / 4 weeks, overall score with change, actions-per-day bars, pillar trends, going well / needs love, and a reflection (Gemma, or a written summary offline). `computeStats` now takes a window length.
- **Help page** (`#/help`, owner request): 11 sections (install, Gemma, talking, chart, today, review, backup, privacy, troubleshooting, AI test, developers). The content lives in `src/lib/help.ts` and is used by both the page and the AI. The AI can `navigate {page:'help', section}`. The help text is added to the prompt only for how-to messages. The offline helper answers how-to questions from the same text.
- **Chart redesign** (owner feedback "more beauty", "smaller text, better font, no big dots"): frosted 3×3 cards, an emerald glow behind the goal, pillar centres with a conic progress ring, labels in Instrument Serif, "done today" shown as a thin outline, an overall ring, a pillar strip with mini rings, and zoomed tiles that fill up from the bottom with a check and a streak flame.
- **Voice input**: a mic in the top bar and in chat (`src/ui/useVoice.ts`). It tries Chrome's on-device speech first and falls back to Google's online speech, with a toast saying so.
- **AI eval**: `src/ai/eval.ts` (scorer) and `src/ai/eval-cases.json` (85 cases, written by a Sonnet subagent and checked by me). vitest scores the offline parser at 75/85 (88%) against a floor of 85%. **Settings → Test the assistant** runs the same cases on the phone with Gemma in a throw-away DB, and "Copy results" gives text to paste back.
- **Offline parser**: past-tense completion of open tasks ("bought the milk" → completes "Buy milk"). Fixed a safety bug where "save this as a note: … clear done tasks" ran `clear_done_tasks`.
- **Deploy**: `deploy.yml` now pushes `dist/` to the `gh-pages` branch and tries to point Pages at it.
- **Code review (Sonnet)** of this session: no high-severity issues. Fixed 12 medium/low ones: the help rule was stealing ordinary tasks, `findHelp` matched inside words, voice could go online without telling you, voice errors were silent, help text named the wrong Pages source, a task-window off-by-an-hour, `pastTask` false positives, a11y roles on buttons, and the eval not aborting on unmount.
- **Tests**: 131 unit, 27 e2e (3 phone profiles). Typecheck clean, lint has no errors.

## Current state
- **Works (verified here):** everything above, in light and dark mode, at 393 px and 360 px, with no horizontal scroll.
- **Not verified:** Gemma on a real phone, and voice (headless Chromium has no microphone). The voice and WebLLM code follow the documented APIs but have never run.
- **Deployed:** live at https://m7md-ar-h.github.io/Yourself/. GitHub reported the deployment as successful, but it couldn't be opened from the cloud box because github.io isn't in its network allowlist. Pages source is "GitHub Actions": the `deploy-pages` step is what actually publishes, and the `gh-pages` push is a harmless backup. The API step that tries to change Pages settings always gets a 403, which is expected.

## Next steps (in order)
1. Owner phone test (`OWNER_TASKS.md` §2), including **Settings → Test the assistant → Copy results** with Gemma on. Paste the results into the next session.
2. Tune `src/ai/prompt.ts` from those results: add examples for the failing tags and re-measure. Don't tune without numbers.
3. Fix whatever the phone test finds: performance, keyboard, memory, voice.
4. Phase 2 part B: reminders/notifications.
5. Phase 3: laptop layout.

## Open questions for the owner
- After the phone test: is Gemma 3 1B good enough, or is a bigger model worth the download?
- Reminders: do you want phone notifications for tasks with a due date? A time-of-day reminder needs extra work on Android.
- Laptop: should phone and laptop sync automatically? That needs a backend or a sync service; export/import works today.

## Traps
- Run e2e here with `PW_CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`. CI installs its own browser.
- Gemma has no system role, so everything goes in one user turn. Context is rebuilt every message.
- Commands from the AI address things by **name**; the UI passes **ids**. Keep both paths.
- Only the newest toast keeps an Undo, on purpose (older snapshots could overwrite newer edits).
- `src/lib/hooks.ts` touches `location` at import time. Don't import pages or hooks into unit tests. Pure logic lives in `src/lib/*` (e.g. `review.ts`, `help.ts`).
- `src/ai/fallback.ts` already has an `IRREGULAR` map (verb stems for check-ins). The past-tense task map is `PAST_VERBS`.
- Chart colours: marks use `--chart` (#059669), which the dataviz validator passed. Don't swap it for `--accent` on light backgrounds.
- Don't commit the TikTok reference images. They aren't ours.
