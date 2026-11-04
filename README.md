# Yourself

A notes + tasks app built around the **Mandala chart** (the "Japanese method": 1 main goal → 8 pillars → 8 small actions each, on a 9×9 grid). You talk to a **private AI (Gemma) that runs on your phone**; it turns what you say into tasks, notes and check-ins, and the chart fills in with colour to show how your life is going.

**Status (2026-11-04, session 2):** Phase 1 done; Phase 2 part A done (weekly review, help page, voice, AI test set + on-phone test runner, chart redesign). Not yet tested on the real POCO F5, and Gemma has not run yet (the cloud build box can't reach Hugging Face). See `HANDOFF.md`.

## How it works (short)

- **Everything is local.** Data lives in IndexedDB on the device. No server, no account.
- **One command layer** (`src/lib/commands.ts`). The UI and the AI change data only through the same 18 commands, so the AI can do everything the UI can, and every change can be undone.
- **AI path:** message → prompt with your chart, tasks and notes → Gemma (WebLLM, WebGPU, JSON-schema-constrained output) → validated commands → run → reply + Undo toast.
- **No model? Still works.** A rule-based offline parser (`src/ai/fallback.ts`) handles common phrases until Gemma is downloaded, or if WebGPU isn't available.
- **Stats page = the chart.** Each cell is coloured by how many of the last 7 days you did that action. Pillar = average of its actions. Centre = average of the pillars.

## Run it

```bash
npm install
```

```bash
npm run dev
```

Checks: `npm run typecheck`, `npm run lint`, `npm test` (unit), `npm run e2e` (Playwright, phone viewports). In this cloud box, run e2e with `PW_CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome npm run e2e`.

Deploy: pushing to `main` runs `.github/workflows/deploy.yml` → GitHub Pages (needs a one-time setting, see `OWNER_TASKS.md`).

## Code map

| Path | What |
|---|---|
| `src/lib/types.ts`, `db.ts` | Data model + Dexie (IndexedDB) |
| `src/lib/commands.ts` | The command vocabulary, fuzzy matching, undo journal |
| `src/lib/stats.ts` | Scores, streaks, weekly counts |
| `src/lib/seed.ts` | Starter chart (from the Mandala example) |
| `src/ai/engine.ts`, `worker.ts` | Gemma via WebLLM in a Web Worker |
| `src/ai/prompt.ts`, `schema.ts` | Prompt builder; JSON schema + validator for model output |
| `src/ai/fallback.ts` | Offline rule-based parser |
| `src/ai/agent.ts` | The loop: message → commands → run → reply |
| `src/pages/*` | Today, Chart, Notes, Chat, Settings, Onboarding |
| `src/ui/*` | Shell (top bar, tab bar), sheets, toasts, assistant hook |
| `src/styles/app.css` | All tokens + styles (Style A "Glassy", light + dark) |

## Roadmap

### Phase 1 — Phone MVP (POCO F5) ✅ built, ⏳ waiting on real-phone test
- [x] Data model, IndexedDB storage, command layer with undo
- [x] Mandala chart overview (9×9) + zoomed 3×3 block with tap-to-log
- [x] Today page: greeting, weekly score, stat tiles, suggested actions, tasks
- [x] Notes: list by day, search, pillar filter, add/edit/delete with undo
- [x] Chat with the assistant + command bar on every page
- [x] Gemma on-device (3 model sizes), download progress, delete model
- [x] Offline fallback parser (76 tests)
- [x] Onboarding (3 steps, one-tap defaults)
- [x] Settings: name, theme, model, export/import backup, clear chat
- [x] PWA (installable, offline app shell), GitHub Pages deploy workflow, CI
- [x] Unit tests (105) + e2e tests (18 across POCO F5 light/dark + 360px)
- [x] Code review (Sonnet) — 15 medium/low findings fixed, no high-severity issues
- [ ] Owner: enable GitHub Pages and test on the POCO F5 (`OWNER_TASKS.md`)
- [ ] Tune the prompt against real Gemma output on the phone (needs a test run)

### Phase 2 — Phone polish
Part A (no phone needed, session 2):
- [x] Eval scorer (`src/ai/eval.ts`) + 85 eval cases (`src/ai/eval-cases.json`)
- [x] Offline-parser eval in vitest with a regression floor (75/85 = 88%, floor 85%)
- [x] In-app AI test runner (Settings → Test the assistant) to measure Gemma on the phone
- [x] Weekly review page (`#/review`): week/last week/4 weeks, pillar trends, daily bars, best/weakest, AI reflection
- [x] `navigate review` command for the AI
- [x] Voice input (mic in top bar + chat; on-device speech when Chrome supports it)
- [x] Chart redesign (owner feedback): frosted 3×3 cards, goal glow, pillar progress rings, serif labels, outline for "done today", pillar strip, liquid-fill action tiles
- [x] Help page (`#/help`, owner request): setup + usage + troubleshooting; the AI answers from it and opens the right section
- [x] Offline parser: past-tense task completion ("bought the milk"), fixed note-prefix safety bug
- [x] Deploy via `gh-pages` branch (owner asked Claude to deploy)

Part B (needs phone feedback):
- [ ] Fix whatever the phone test finds (performance, keyboard, model memory)
- [ ] Tune the prompt using measured Gemma eval results
- [ ] Reminders/notifications for due tasks

### Phase 3 — Laptop
- [ ] Wider layout: left icon rail, bento dashboard, chart + detail side by side
- [ ] ⌘K command menu with shortcut hints
- [ ] Sync between phone and laptop (needs a decision: file sync vs. a small backend)

## Decision log

| Date | Decision | Reason |
|---|---|---|
| 2026-11-04 | Web app (React + Vite + TS, PWA) instead of native Android | Same code runs on phone now and laptop later; testable in the cloud box; installable from Chrome. |
| 2026-11-04 | Gemma via **WebLLM** (MLC, WebGPU) — see `docs/adr/0001-local-ai.md` | Ungated mlc-ai builds (no Hugging Face login), JSON-schema-constrained output, runs in Chrome on Android. |
| 2026-11-04 | Default model **Gemma 3 1B** (0.7 GB); Gemma 2 2B and Gemma 4 E2B selectable | Smallest download and fastest on a phone; bigger ones for better understanding if memory allows. |
| 2026-11-04 | One command layer for UI **and** AI | "AI can do anything in the app" by design; one undo system; one place to validate. |
| 2026-11-04 | Model output treated as untrusted: schema-constrained + re-validated in `schema.ts` | Security rule §9; a 1B model will sometimes produce junk. |
| 2026-11-04 | All instructions in one user turn, context rebuilt each message | Gemma has no system role; small context window (4k) so we send a compact snapshot instead of full history. |
| 2026-11-04 | Rule-based offline parser as fallback | App must work before the 0.7 GB download, and on devices without WebGPU. |
| 2026-11-04 | Score = share of last 7 days an action was done | Simple, explainable, rewards consistency (the point of the method). |
| 2026-11-04 | Style A "Glassy Dashboard", Glass palette (near-black + frosted white + emerald) | App/dashboard product; emerald = calm progress colour. |
| 2026-11-04 | Background is a procedural blurred "warm interior" made of gradients, not a photo | No licensed photo available; avoids a large image download; easy to swap for a real photo later. |
| 2026-11-04 | Fonts: Instrument Serif (display) + Manrope (UI), self-hosted | Two families max, not default Inter; works offline. |
| 2026-11-04 | Hash routing (`#/chart?pillar=3`) | URL = state, works on GitHub Pages without server rewrites. |
| 2026-11-04 | UI passes record ids to commands; the AI passes names | Taps must be exact; small models are better with names |
| 2026-11-04 | One generation at a time (app-wide queue in `engine.complete`) | WebLLM runs one request at a time; prevents the top bar and chat from clobbering each other |
| 2026-11-04 | Backup import validates every row, and can be undone | Imported files are untrusted input; a bad file must not brick the app |
| 2026-11-04 | Eval set (85 cases) scored identically for offline parser (CI) and Gemma (on phone) | Prompt changes must be measured (working rules §2); the phone is the only place Gemma runs |
| 2026-11-04 | Help content in one file (`src/lib/help.ts`) used by the page and the AI | One source of truth; AI answers "how do I…" from the same text |
| 2026-11-04 | Help text enters the prompt only for how-to messages | Keeps the 1B model's prompt short (speed on phone) |
| 2026-11-04 | Chart marks use `--chart: #059669` | Passed the dataviz validator (≥3:1 contrast) on light and dark; `#10b981` failed on light |
| 2026-11-04 | Chart labels in Instrument Serif; "done today" = thin outline, not a dot | Owner feedback: smaller, nicer text; no big dots. Serif is narrower, fits 38 px cells |
| 2026-11-04 | Deploy by pushing `dist/` to `gh-pages` from Actions | Owner asked Claude to deploy; the Actions-source Pages flow needs a settings click Claude can't do, a `gh-pages` branch usually auto-enables Pages |
| 2026-11-04 | Starter chart includes the 8 pillars + sleep actions from the example; other 56 actions written by me | One-tap start = minimal effort; all editable. |

## Known limitations

| Limitation | Why (constraint) | What would remove it |
|---|---|---|
| Gemma not tested yet | Cloud box can't reach huggingface.co; no phone here | Owner phone test (`OWNER_TASKS.md`) |
| Needs Chrome 121+ with WebGPU for Gemma | WebLLM runs on WebGPU only | A native Android build (MediaPipe / LiteRT) if WebGPU proves unreliable |
| First AI use needs a 0.7–3.4 GB download | Model weights must be on the device | None (one-time); cached afterwards |
| No sync between devices | Local-first, no backend yet | Phase 3 decision (export/import works today) |
| Voice may use Google's servers | Chrome only does on-device speech for some languages/phones | Nothing in-app; the app says when it falls back |
| Weekly review has no history beyond ~400 days | The chart query loads 400 days of check-ins | Paging or pre-aggregated weekly stats |
| No reminders/notifications | Not in Phase 1 scope; web push on Android needs extra setup | Phase 2 |
| Offline parser misses subtle phrasing (e.g. "called mom" isn't matched to the task "Call mom") | It's rules, not a model | Gemma on; or more rules |
| Chart overview shows action colour only, no action names | 81 cells on a 393 px screen: ~38 px cells are too small for text | Tap a block for names; laptop layout can show them |
| No ⌘K menu, no left rail | Phone-first; those are laptop patterns | Phase 3 |
| AI addresses items by name; two items with the same name → it picks the best/newest match | Small models handle names far better than ids (the UI uses ids, so taps are exact) | A disambiguation question from the assistant |
| Only the newest change has an Undo button | Older snapshots could overwrite later edits | Per-field undo history |
| Gemma builds need a GPU with 16-bit float (`shader-f16`) | Only q4f16 builds are offered | Add q4f32 variants (bigger, slower) |
