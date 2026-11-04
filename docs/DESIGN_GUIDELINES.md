# UI Design Guidelines

> **For the AI reading this:** These are my design rules for this project. Follow them when you build or change any UI.
> - Pick ONE visual style from Section 2 that fits the product (or the one I name). Do not mix them.
> - Apply Sections 3–9 to everything.
> - Before you say a UI task is done, go through the checklist in Section 10.
> - If a rule here conflicts with an existing design system in the project, the project's system wins. Use these rules to fill the gaps.

**Version:** 1.0 · **Last updated:** 2026-10-30

---

## 1. Core principles

- **Clean over clever.** Fewer elements, more space, clear hierarchy.
- **One accent does the work.** 2 calm base colors + 1 surprising accent color (Section 3).
- **Depth through layers.** Use blur, transparency and soft shadows. Avoid heavy borders.
- **Everything feels instant.** Show skeletons, update right away (optimistic UI), prefetch.
- **Small details make it feel premium.** Tabular numbers, balanced headlines, optical alignment, smooth corners.
- **Never ship "AI slop".** See Section 8.

---

## 2. Visual styles (pick one per product)

### Style A — "Glassy Dashboard" (apps, dashboards, fintech, admin)

**Look**
- A full-screen, **blurred photo background** (warm interior, nature, soft architecture). The UI floats on top of it.
- All panels are **frosted glass**: semi-transparent white, strong backdrop blur, thin light border, soft shadow.
- Neutral warm grays + near-black + **one accent** (example: emerald green `#10B981`, or orange `#F97316`).

**Layout**
- **Top bar (floating pill):** avatar + "Welcome, {name}" on the left; an **AI command input** in the center (placeholder like *"Can you send $250 to Jenny Wilson…"*); one round icon button on the right.
- **Left icon rail (floating pill, vertical):** icons only, round active state (white circle), **tooltip on hover** with the page name.
- **Bottom tab bar (floating pill, centered):** text tabs (Overview, Activity, Manage, Reports…) + a round **"+"** button at the end. Active tab = white pill.
- **Main glass panel** with a big greeting: *"Good morning, {name}"* + a short gray subtitle.
- Content in a **bento grid** of glass cards.

**Components seen**
- **Balance card:** small label, very large number, small % change chip, two buttons: dark solid pill (primary) + white pill (secondary).
- **Wallet mini-cards:** flag icon + currency + amount + small gray note.
- **Stat tiles (2×2):** label, big value, change chip, small icon in a circle top-right. **Exactly one tile uses the accent fill** (e.g. solid emerald) to draw the eye.
- **Charts:** bar chart (black + accent stacked), smooth line chart (accent + black, 2 lines), donut chart with total in the center + legend rows with progress bars and %.
- **Segmented control:** "This week / This month / This year" in a pill; active = dark pill.
- **Tables:** "Recent activities" with search + filter on the header row, light row dividers, status text.
- **Progress bar:** "Monthly spending limit" thin bar with accent fill.

**Starter code**

```css
:root {
  --glass-bg: rgba(255, 255, 255, 0.35);
  --glass-bg-strong: rgba(255, 255, 255, 0.55);
  --glass-border: rgba(255, 255, 255, 0.45);
  --glass-blur: 24px;
  --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  --radius-card: 24px;
  --radius-pill: 999px;
}
.glass-card {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(140%);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(140%);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow);
  border-radius: var(--radius-card);
}
/* Fallback when blur is not supported */
@supports not (backdrop-filter: blur(1px)) {
  .glass-card { background: rgba(245, 245, 245, 0.92); }
}
```

```jsx
// Stat card pattern (React + Framer Motion + lucide-react)
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';

const StatsCard = ({ title, value, change, icon: Icon, accent = false }) => (
  <motion.div
    whileHover={{ y: -5 }}
    transition={{ type: 'spring', stiffness: 300, damping: 24 }}
    className={`glass-card p-6 rounded-2xl ${accent ? 'bg-emerald-500/90 text-white' : ''}`}
  >
    <div className="flex items-center justify-between">
      <p className="text-sm opacity-70">{title}</p>
      <Icon size={18} className="opacity-70" />
    </div>
    <h2 className="text-2xl font-bold tabular-nums mt-2">{value}</h2>
    <p className="flex items-center gap-1 text-sm text-emerald-600">
      <ArrowUpRight size={16} /> {change}
    </p>
  </motion.div>
);
```

**Rules for Style A**
- Text on glass must still pass contrast. If the background is busy, raise glass opacity or darken the photo.
- Cards lift on hover (`y: -5`), no big scale jumps.
- Keep the grid on a strict spacing scale (Section 5).

---

### Style B — "Gradient Hero" (landing pages, marketing, SaaS sites)

**Look**
- A big hero with a **soft, blurry gradient or glow** background (looks like light, sky, or a horizon).
- Huge, short headline. Small subtitle. 1 primary + 1 secondary button.
- Glass cards or product screenshots floating at the bottom or side of the hero.

**Three examples to copy the feel of**
1. **Light + calm:** sky-blue blurred gradient, white text *"Your Personal Health Companion"*, small glass cards on the right with data, thin nav on top. A **hot-pink** blur shape adds the surprise.
2. **Dark + premium:** near-black background, **electric-blue glow rising from the bottom**, centered serif headline with an italic word (*"Edit at the Speed of **Thought.**"*). An **orange** glow and product cards at the bottom.
3. **Deep + trustworthy:** deep-blue starfield fading to a **white horizon glow**, centered headline *"Enterprise Security Without Complexity"*. **Bubblegum-pink** pills/badges and a pink gauge in the dashboard preview.

**Rules for Style B**
- Headline: 2–6 words per line, max 2 lines, `text-wrap: balance`.
- Mixing a serif display font with an italic word + clean sans body = instant "premium".
- Background glow = layered `radial-gradient`s + `filter: blur()`, or a subtle shader. Add light grain/noise to stop gradient banding.
- Nav: small logo left, centered links in a pill, CTA pill right.

---

## 3. Color: the "2 + 1" formula

**Rule:** 2 base colors that look clean together → add **1 unexpected accent** used sparingly (CTAs, badges, one highlight, one glow). The accent is what makes people stop scrolling.

| Palette | Base 1 | Base 2 | Unexpected accent | Feel |
|---|---|---|---|---|
| **Sky** | Sky Blue `#0593C6` | White `#FCFFFF` | Hot Pink `#D63A92` | fresh, friendly, health/consumer |
| **Midnight** | Midnight Black `#02070A` | Electric Blue `#0297DE` | Cantaloupe Orange `#F5734F` | premium, "costs money", creative tools |
| **Deep** | Deep Blue `#09318D` | Pure White `#FFFFFF` | Bubblegum Pink `#F091CC` | trustworthy, enterprise, security |
| **Glass (Style A)** | Warm gray / near-black `#111111` | Frosted white | Emerald `#10B981` | calm, financial |

**How to use the accent**
- ≤ 10% of the screen. One primary button, key badges, one highlighted card, one glow.
- Never use the accent for body text.
- Make every palette a set of CSS variables (`--bg`, `--fg`, `--muted`, `--accent`, `--accent-fg`, `--border`) and support dark mode by swapping them.
- Hex values above were read off the videos; tweak to taste.

---

## 4. Typography

- **Max 2 font families:** one display (can be a serif or a distinctive grotesk) + one clean sans for UI.
- **Clear scale:** e.g. 12 / 14 / 16 / 20 / 24 / 32 / 48 / 64 px. Big jump between headline and body.
- **Headlines:** tight letter-spacing (`-0.02em`), `text-wrap: balance`.
- **Body:** 15–17px, line-height 1.5–1.6, max ~70 characters per line, `text-wrap: pretty`.
- **Numbers that change or line up** (prices, stats, tables, timers): `font-variant-numeric: tabular-nums`.
- Use real typography: curly quotes `" "`, the ellipsis character `…`, non-breaking spaces in things like `10 MB` and `⌘ K`.
- Labels small + muted (60–70% opacity), values big + bold.

---

## 5. Layout, spacing, shape

- **Spacing scale:** 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64. Never random values.
- **Bento grids** for dashboards; generous gaps (16–24px).
- **Radius scale:** small 8–12px (inputs, chips), cards 16–24px, pills 999px. Nested radius = outer radius − padding.
- **Continuous corners (squircle):** prefer smooth corners on cards/icons where possible (e.g. `corner-shape: squircle` where supported, or an SVG mask) — they look more premium than plain `border-radius`.
- **Optical alignment:** nudge icons/play buttons ±1px when they *look* off-center, even if they are mathematically centered.
- **Safe-area insets:** on mobile, pad fixed bars with `env(safe-area-inset-*)`.
- **Hit targets:** at least 24×24px on desktop, 44×44px on mobile. Expand small icons' clickable area with padding or a pseudo-element (**hit slop**) without changing how they look.
- Responsive down to 360px wide, no horizontal scroll.

---

## 6. Motion

- Library: **Framer Motion** (React) or CSS transitions. Icons: **lucide-react**.
- Animate only `transform` and `opacity`. Never `transition: all`.
- Durations: 150–250ms for UI, up to 400ms for large panels. Use spring or ease-out; no bouncy easing on serious UI.
- **Interruptible animations:** if the user clicks again mid-animation, it must reverse/redirect smoothly from where it is (springs/transitions, not fixed keyframes).
- **View transitions:** use the View Transitions API (or shared-layout animations) when moving between pages or expanding a card into a detail view.
- Hover: small lift (`y: -2` to `-5`) or subtle background change.
- Respect `prefers-reduced-motion`: turn movement into simple fades or nothing.

---

## 7. UX polish — the 20 details that make an app feel pro

1. **Skeleton loaders** — show gray shapes matching the final layout while data loads. No spinners for content areas.
2. **Optimistic updates** — update the UI instantly (e.g. like count +1), sync in the background, roll back with a message if it fails.
3. **Command menu** — `⌘K` / `Ctrl+K` opens a searchable list of actions and pages.
4. **Shortcut hints** — show the keyboard shortcut next to menu items (`Copy ⌘C`) and in tooltips.
5. **Undo toasts** — for deletes, do it right away and show a toast with **Undo** instead of an "Are you sure?" dialog.
6. **Stale-while-revalidate** — show cached data instantly, refresh quietly, mark it "updated" when fresh data arrives (SWR / React Query).
7. **Pre-rendering / prefetching** — prefetch the next page on hover or when the link is visible, so it opens instantly.
8. **BlurHash placeholders** — show a blurred color preview of images while they load, then fade in.
9. **View transitions** — smooth animated changes between screens/states (Section 6).
10. **Swipe-to-dismiss sheets** — on mobile, bottom sheets close by dragging down.
11. **Interruptible animations** — animations can be reversed mid-way (Section 6).
12. **Predictive back** — on mobile, the back gesture previews the previous screen while dragging.
13. **Hit slop** — invisible bigger tap area around small buttons (Section 5).
14. **Safe-area insets** — no content under the notch or home bar.
15. **One-time code autofill** — OTP inputs use `autocomplete="one-time-code"` and `inputmode="numeric"`; pasting a full code fills all boxes.
16. **Tabular numbers** — numbers don't jump in width when they change.
17. **Balanced headlines** — `text-wrap: balance` so no single orphan word on the last line.
18. **Continuous corners** — squircle-style smooth corners (Section 5).
19. **Idempotency keys** — payment / submit requests send a unique key so double-clicks never charge or create twice. Disable the button while submitting.
20. **Menu "safe triangle"** (Amazon-style) — when moving the mouse diagonally from a menu item to its submenu, the submenu stays open instead of switching.

---

## 8. Avoid "AI slop" (instant red flags)

- ❌ Purple-to-blue gradients on everything; generic "glow" on every card.
- ❌ Default Inter/system font everywhere with no type hierarchy.
- ❌ Cards inside cards inside cards; borders on everything.
- ❌ Emojis as icons; random icon sizes.
- ❌ Gray text on colored backgrounds with poor contrast.
- ❌ Every section centered with the same layout; same-size everything.
- ❌ Fake-looking filler copy ("Unlock your potential", "Revolutionize your workflow").
- ❌ Bouncy/elastic animations on business UI; `transition: all`.
- ❌ Spinners where a skeleton fits; "Are you sure?" where Undo fits.
- ✅ Instead: one strong idea per screen, real hierarchy, strict spacing, one accent, purposeful motion.

**Self-review loop:** after building, look at the screen and ask "would a senior product designer ship this?" Then do 3 passes:
- **Polish** — fix spacing, alignment, radius, contrast, states.
- **Distill** — remove anything that doesn't earn its place.
- **Clarify** — make labels, copy and hierarchy obvious.

---

## 9. Interface checklist (accessibility + behavior)

**Keyboard & focus**
- Everything works by keyboard. Visible focus ring (`:focus-visible`), never removed without replacement.
- Trap focus in modals; `Esc` closes; focus returns to the trigger.

**Forms**
- Labels on every input (clickable). Correct `type`, `inputmode`, `autocomplete`.
- `Enter` submits. Never block paste. Show errors next to the field, focus the first error.
- Keep submit enabled until a request starts; then show loading and prevent double submit.

**Feedback & state**
- Every action gets feedback (loading, success, error).
- Short loads: show loader only after ~150–300ms delay, and keep it visible at least ~300ms (no flicker).
- **URL = state:** filters, tabs, pagination, open panels live in the URL so refresh/back/share work.
- Empty states, error states and long-content states are designed, not forgotten.
- Use `…` on actions that open more input ("Rename…") and on loading text ("Saving…").

**Accessibility**
- Contrast: 4.5:1 for text, 3:1 for large text and UI. Check on glass too.
- Icon-only buttons have `aria-label`. Don't rely on color alone for meaning.
- Use semantic HTML (`button`, `a`, `nav`, `main`) before ARIA.
- Respect `prefers-reduced-motion` and `prefers-color-scheme`.

**Performance**
- Images have width/height (no layout shift), lazy load below the fold, modern formats.
- Animate on the compositor (transform/opacity). Virtualize long lists.

---

## 10. Definition of done (check before finishing any UI task)

- [ ] One style from Section 2, applied consistently.
- [ ] Colors follow "2 + 1"; accent used sparingly; tokens in CSS variables; dark mode works.
- [ ] Type scale, tabular numbers, balanced headlines.
- [ ] Spacing/radius from the scales; hit targets big enough.
- [ ] Loading = skeletons; actions = optimistic + undo; no double submit.
- [ ] Hover, focus, active, disabled, empty, error states all exist.
- [ ] Keyboard + screen reader basics pass; contrast passes.
- [ ] Works at 360px mobile and on large screens; safe areas respected.
- [ ] Reduced motion respected; animations interruptible.
- [ ] Nothing from the "AI slop" list in Section 8.

---

## 11. Optional tools (if available in the environment)

- **Impeccable** (design skill for AI coding tools) — commands like `/polish`, `/distill`, `/clarify` to detect and fix AI-slop UI. https://github.com/pbakaus/impeccable
- **21st.dev Magic MCP** — pulls ready-made, high-quality UI components (heroes, shaders, marketing blocks) instead of writing from scratch. https://github.com/21st-dev/magic-mcp
- **Vercel Web Interface Guidelines** — the full checklist that Section 9 is based on. https://vercel.com/design/guidelines

---

## Changelog

- **1.0 (2026-10-30)** — First version. Sources: "Glassy Dashboard V2" (@code.xr), "How to actually vibecode a clean UI" (@aimn.dev), color-accent palettes (@niki.aroca), "20 UI tips to send to Claude" (@murphmaxxing).

<!-- Add new inspirations below as new sections or palette rows, then bump the version. -->
