# Handoff — 2026-11-04 (session 1)

## What was done
- Built the whole Phase 1 phone app from an empty repo: React 19 + Vite 8 + TypeScript PWA, Dexie (IndexedDB), framer-motion, lucide-react.
- Mandala chart (9×9) as the stats page, zoomable 3×3 blocks with tap-to-log, Today dashboard, Notes, Chat, Settings, 3-step onboarding with a starter chart.
- On-device AI: Gemma via WebLLM in a Web Worker, 3 model choices, JSON-schema-constrained output → validated commands. Offline rule-based parser as fallback (written by a Sonnet subagent, reviewed and spot-checked).
- One command layer (`src/lib/commands.ts`) used by both the UI and the AI, with an undo journal → every change shows an Undo toast.
- Tests: 97 unit (vitest), 18 e2e (Playwright; POCO F5 light/dark + 360 px). CI (`.github/workflows/ci.yml`) and GitHub Pages deploy (`deploy.yml`).
- Docs: README (roadmap, decision log, limitations), ADR 0001, OWNER_TASKS, project CLAUDE.md; your two rule files are in `docs/`.

## Current state
- **Works (verified here):** all pages, onboarding, offline parser, undo, dark mode, no horizontal scroll at 360/393 px, build + PWA.
- **Not verified:** Gemma actually loading and answering. huggingface.co is blocked from the cloud box, and there's no WebGPU in headless Chromium. The code path is written against the WebLLM 0.2.87 types and compiles, but has never run.
- Lint: only warnings (React-compiler style hints), no errors.

## Next steps (in order)
1. Owner: do `OWNER_TASKS.md` §1 (enable Pages) and §2 (phone test). Collect results.
2. If Gemma fails on the phone: read the error in Settings. Likely causes: WebGPU off (chrome://flags → "Unsafe WebGPU" is NOT needed on Chrome 121+; check `chrome://gpu`), memory (try Gemma 3 1B), or the `json_object` + schema option being slow on the first message (XGrammar compiles the grammar once per load).
3. Build a small eval set (`tests/eval/*.json`: message → expected commands), run it on the phone in a hidden dev page, and tune `src/ai/prompt.ts` (examples, rules) by measured accuracy.
4. Phase 2 items in the README roadmap.

## Open questions for the owner
- Is the repo public? (GitHub Pages on a private repo needs a paid plan.)
- Do you want reminders/notifications for tasks? (Phase 2.)
- Later, for the laptop: should phone and laptop sync? That needs either a small backend or a file-sync approach.

## Traps
- `@playwright/test` here is newer than the browser pre-installed in the cloud box: run e2e with `PW_CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`. CI installs its own browser.
- Gemma's chat template has no system role: keep all instructions in the single user message (`buildPrompt`).
- The model runs with a fresh context every message (`resetChat` after each call). History is passed as text in the prompt (last 6 messages). Don't switch to multi-turn without checking the 4k context limit.
- Commands address pillars/actions/tasks **by name** (fuzzy). That's on purpose (small models are bad with ids). See `bestMatch` thresholds in `src/lib/util.ts` and `commands.ts`.
- `navigate()` only uses View Transitions when the page changes; inside the chart, framer-motion `layoutId` does the zoom. Using both at once looks broken.
- Don't commit third-party images (the TikTok slides) — they aren't ours.
