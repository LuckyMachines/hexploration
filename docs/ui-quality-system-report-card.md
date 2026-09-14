# UI Quality System Report Card

Review date: 2026-09-14

## Outcome

The UI and UX improvement system is A for automated enforcement. Product evidence remains A- until representative observed-player sessions and imported production telemetry validate comprehension, delight, recovery, and real-world performance.

| Dimension | Before | Now | Evidence |
| --- | --- | --- | --- |
| Visual regression | B | A | Eleven deterministic, approved screenshot contracts with exact pixel diff evidence |
| Accessibility | B+ | A | Every canonical scene rejects serious and critical axe findings; effective targets must be at least 44 px |
| Responsive behavior | B | A | Desktop/mobile scene matrix plus ten passing contracts across five browser/device projects |
| Performance stability | B | A- | CLS, transfer, navigation, DOM, frame pacing, and privacy-safe Web Vitals instrumentation; production export still needed |
| Governance | B | A | Source hashes and baseline hashes are bound to an owner, reason, and approval time |
| Journey efficiency | C | A | First and return paths enforce action, time, backtrack, error, recovery, and event-sequence budgets |
| Input resilience | B | A | Keyboard, 200% text reflow, forced colors, reduced motion, and axe contracts pass |
| Copy governance | C | A | Player-facing source rejects vague error, progress, confirmation, link, and success language |
| Improvement automation | B+ | A | Control plane regenerates journey and visual evidence, ranks friction, and cannot silently approve pixels or human evidence |
| Human validation | C | C | Deliberately unchanged; genuine player observation is still required |

## Stricter A Bar

An A UI system must detect an impacted surface, render the relevant state and viewport, reject geometry and accessibility regressions, compare pixels against an explicit decision, expose stale evidence in the product review surface, and provide a bounded repair path. An A+ product additionally requires recent observed-player evidence for comprehension, delight, and return intent.

## Findings Converted Into Repairs

The first enforced run found and fixed a keyboard-inaccessible horizontal region, undersized controls, incorrectly measured labeled checkbox targets, and multiple low-contrast states. This UX pass additionally caught vague crash copy, missing behavioral telemetry, and a Windows High Contrast failure. Baselines were approved only after all nine scenes passed.

The September 14 refresh expanded the contract to eleven scenes, including desktop and mobile guest expeditions. It also removed serial fail-fast behavior and persists metrics per scene and run, so a pixel mismatch or Playwright worker restart can no longer suppress later evidence or erase earlier accessibility and performance results. All eleven approved scenes now report zero horizontal overflow, zero undersized controls, zero serious or critical accessibility findings, and 16.7-16.8 ms frame p95 in the deterministic capture rig. Chromium, Firefox, WebKit, Pixel 7, and iPhone 13 contracts pass.

The runtime-image delivery pass keeps approved PNGs as canonical art while serving 23 fingerprinted lossless WebP derivatives. The governed package falls from 9.52 MiB to 5.68 MiB. Measured production first-load transfer falls from 2.89 MiB to 2.17 MiB on the playable home route and from 7.57 MiB to 5.76 MiB on the guest expedition. All eleven screenshot contracts remained pixel-stable and the five-profile browser/device matrix continued to pass. Production real-user telemetry remains necessary before raising the performance dimension beyond A-.

## Highest-Leverage Next Action

Run three consent-safe first-time sessions and two returning-player sessions, import a production telemetry export, then attach the resulting decision to the improvement control plane. Do not raise the automated thresholds or approval grade to stand in for that evidence.
