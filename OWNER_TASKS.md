# Owner tasks (things only you can do)

## 1. ☑ GitHub Pages — done (2026-11-04)
Claude deployed it. Every merge to `main` now publishes automatically to **https://m7md-ar-h.github.io/Yourself/**. Nothing for you to do. If the address ever shows a 404, open the repo's **Actions** tab → **Deploy to GitHub Pages** and send me the red step.

## 2. ☐ Test on the POCO F5
1. On the phone, open **Chrome** (not Mi Browser). Make sure Chrome is updated (Play Store → Chrome → Update).
2. Connect to **Wi‑Fi** (the AI download is 0.7 GB).
3. Open https://m7md-ar-h.github.io/Yourself/.
4. Chrome menu (⋮) → **Add to Home screen** → **Install**. Open it from the home screen.
5. Follow "Try it yourself" below and send me what broke (screenshots help).

## Try it yourself (Phase 1)

| Do this | You should see | Broken if… |
|---|---|---|
| Type your name → Continue → Continue → **Download Gemma and start** | The Today page, "Good morning, {name}" | Blank screen or stuck |
| Open **Settings** | Under Assistant: a progress bar filling up, then "Gemma running" (green dot) | Red error text (send me the text) |
| Tap the top bar and type: `I slept 8 hours and meditated, remind me to call mom tomorrow` → Enter | A dark message at the bottom with the reply and **Undo** | Nothing happens after ~20 s |
| Go to **Today** | "Call mom" under Tasks with "Tomorrow" | Task missing |
| Go to **Chart** | Green cells in Sleep and Mind blocks | All cells pale |
| Tap the **Sleep** block, tap "Dark room" | Cell turns green; tap again → back to normal | Nothing happens / page jumps |
| Go to **Chat**, ask `how am I doing this week?` | An answer that mentions your pillars | Nonsense or an error |
| Type `note: I felt calm after the walk` | It appears in **Notes** | Missing |
| Open a note → bin icon → **Undo** in the message | The note comes back | Gone for good |
| Settings → **Dark** | Whole app turns dark and is readable | Text hard to read |
| Turn on airplane mode, reopen the app, log something | Still works (offline) | "No internet" page |
| Rotate / type with the keyboard open | Nothing covered by the keyboard that you need | Input hidden behind keyboard |

### New in session 2

| Do this | You should see | Broken if… |
|---|---|---|
| Today → **Weekly review** | Your score, bars per day, each pillar with +/− change | Empty or error |
| Tap **4 weeks** | Title says "Your month" | Nothing changes |
| Type `how do I turn on the AI?` | The Help page opens on "Turn on the AI", and the answer shows at the bottom | Saved as a note |
| Settings → **Help** | 11 help sections; search works | Missing |
| Tap the **mic** in the top bar, say "I meditated and journaled" | Text appears, then it's logged | Mic does nothing (tell me what Chrome said) |
| **Chart** | Frosted blocks, rings in the pillar squares, outline on things done today | Text cut off in the squares |
| With Gemma on: Settings → **Test the assistant** → Run test → **Copy results** | A score like 60/85; paste the copied text to me | It stops with an error |

Also tell me: how long the first answer took after Gemma was ready, and whether the phone got hot.
