# Project rules (Yourself)

Read first: `HANDOFF.md`, then `README.md` (roadmap, decision log, known limitations), then `OWNER_TASKS.md`.

- Follow `docs/DESIGN_GUIDELINES.md` for any UI. The chosen style is **Style A "Glassy Dashboard"**, Glass palette (near-black + frosted white + emerald accent). Don't mix in Style B.
- Follow `docs/WORKING_RULES.md` for how to work (model tiers, markdown is lead-only, session start/end protocol).
- Phone first: target is a Xiaomi POCO F5 (non-Pro) in Chrome, ~393×873 CSS px. The laptop layout lives behind `@media (min-width: 900px)` and `useWide()`. Never let a laptop change alter the phone UI below 900 px.
- All data changes go through `src/lib/commands.ts`. If you add a feature, add a command for it so the AI can do it too, then add it to `src/ai/prompt.ts`, `src/ai/schema.ts` and (if simple) `src/ai/fallback.ts`.
- Model output is untrusted: always go through `parseModelOutput` / `sanitizeCommand`.
- Before saying done: `npm run typecheck && npm run lint && npm test && npm run e2e` (in the cloud box set `PW_CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`).
- **Standing permission (from the owner, 2026-11-04):** Claude may pull, merge PRs and run GitHub actions without asking, once all checks are green and the final check is done. Still never push straight to `main`; use a branch + squash-merged PR.
