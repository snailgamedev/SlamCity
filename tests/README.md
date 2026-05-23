# SC Playwright Tests

Persistent home for visual-regression / liveliness tests on SC.
Created 2026-05-23 after the splash-curtain-reveal liveliness patch (Stone 36).
Previously lived in /tmp/sc-playwright/ · would have been lost on reboot.

## The breakage gate (run before/after SC edits)

### smoke.mjs — FAST gate (every iter · ~10s) · `npm run smoke`
15 checks: all 5 screens render, 11 fighters have SVG art, combat responds, ZERO console errors. Exit 1 = core loop broke → roll back from `../.backups/`.

### smoke-deep.mjs — DEEP gate (periodic / before big changes · ~30s) · `npm run smoke:deep`
9 checks via ONE full-fight playthrough: reaches RESULT screen, banner shows VICTORY/KNOCKED OUT, save written to `sc:save:v1`, save persists across reload, dynamic OVR delta applied to the fought fighter.

### `npm run gate` runs both. Setup: `npm run setup` (installs playwright + chromium).

## Tests

### splash-entrance.mjs
4 screenshots across the entrance reveal (50ms · 600ms · 1200ms · 2500ms) + button hover capture.
Verifies the staggered curtain reveal lands cleanly across mobile viewport (412x915).

### splash-stagger-and-reduced-motion.mjs
2-pass test:
- PASS 1: post-fix verification (4 frames · button stagger no longer orphans empty space)
- PASS 2: prefers-reduced-motion · confirms zero animation · final state delivered immediately

## Setup

```bash
cd /tmp/sc-playwright  # OR set up package.json next to these tests
npm install playwright
npx playwright install chromium
```

## Run

```bash
node splash-entrance.mjs
node splash-stagger-and-reduced-motion.mjs
```

Screenshots write to /tmp/sc-playwright/*.png unless OUT var modified.

## Why this exists

Per Stone 36 + the bug-class lesson · CSS that looks correct in source may animate
incorrectly in the browser. Playwright = ground-truth signal for visual work,
same way Eli-catches = ground-truth signal for response quality. The screenshots
caught an orphan-button-bug at t=50ms that code review never would have surfaced.
