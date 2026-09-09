# UX Evidence Hardening Pass

Review date: 2026-09-08

## Outcome

The local UX automation bar is A-. Journey, copy, keyboard, reflow, forced-color, reduced-motion, semantic accessibility, focus continuity, and touch contracts all pass. The grade remains A- because A requires evidence that cannot be manufactured locally: five recent observed-player sessions and a current production telemetry export.

## Product Fixes

- Role selection now announces the selected contribution and the exact next action through a polite live region.
- The first recommendation and its primary action now use one consistent phrase: "Create your first expedition thread."
- Return-loop actions use 44 px minimum touch targets.
- Modal close controls use a 44 px target.
- Modal focus restoration now uses an explicit opener reference for the global Field Manual, with a generic previous-focus fallback for other dialogs.
- Modal keyboard listeners no longer reset when a parent supplies a new callback identity.

## System Fixes

- Required browser evidence is declared in `ux/quality-contract.json` with a 14-day freshness limit.
- `npm run ux:input`, `npm run ux:assistive`, and `npm run ux:touch` produce machine-readable evidence in `reports/ux/browser/`.
- `npm run ux:doctor` now rejects missing, stale, failed, or incomplete browser-project evidence.
- `npm run ux:refresh` regenerates journeys, all browser evidence, and the published UX report.
- The in-product UX status panel reports browser-evidence status and profile count separately from observed-player and production evidence.

## Verified Browser Evidence

- Input: Chromium desktop - keyboard-only starter path, 200% reflow, forced colors, and reduced motion.
- Assistive semantic proxy: Chromium, Firefox, and WebKit desktop - structure, names, live announcements, modal focus entry, Escape dismissal, and focus restoration.
- Touch proxy: Pixel 7 and iPhone 13 - tap-only completion, target sizing, narrow reflow, modal close sizing, and destructive confirmation.

## Remaining A Gates

- Observe three first-time players.
- Observe two returning players.
- Complete physical keyboard, touch, pointer, trackpad, screen-reader, and 400% zoom checks from `docs/ux-input-audit.md`.
- Export current allowlisted production UX events and run `npm run ux:release -- --input=path/to/production-export.json`.

These gates remain deliberately open. Browser emulation and semantic inspection are useful proxies, but they are not human observation, physical hardware, an operating-system screen reader, or production behavior.
