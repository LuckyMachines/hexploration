# UI Quality System Checklist

## Implemented

- [x] Canonical desktop, mobile, board, danger, waiting, recovery, return-loop, aftermath, and responsive scenes
- [x] Deterministic fonts, images, motion, color scheme, and 3D readiness
- [x] Screenshot regression with bounded pixel tolerance
- [x] Explicit owner/reason approval ledger
- [x] Source-hash and baseline-hash freshness checks
- [x] Rendered overflow, effective target, CLS, DOM, transfer, navigation, and frame metrics
- [x] Serious and critical axe gates on every canonical scene
- [x] Chromium, Firefox, WebKit, Pixel 7, and iPhone 13 contracts
- [x] Reference-left/current-right comparisons, exact diff records, and contact sheet
- [x] Board-world depth map and isometric perspective evidence
- [x] In-product quality status on the design-system standards view
- [x] Improvement-control-plane evidence, diagnosis, and bounded report refresh
- [x] Static density heuristics paired with rendered evidence
- [x] First-play and return-play action, timing, backtrack, error, and recovery budgets
- [x] Keyboard, 200% reflow, forced-colors, and reduced-motion browser audits
- [x] Privacy-safe Web Vitals, friction, recovery, help, and experiment telemetry
- [x] Ranked friction inbox generated from anonymous journey exports
- [x] Deterministic experiment assignment with control-safe rollout defaults
- [x] Enforced player-facing copy rules and shared game-language glossary
- [x] Consent-safe research protocol, record validator, cohort gate, and summary

## Required Per Material UI Change

- [ ] Run `npm run ui:quality`
- [ ] Inspect `artifacts/ui-quality/contact-sheets/latest.png` at full resolution
- [ ] Inspect the relevant states, not only the happy path
- [ ] If intentional and better, run `npm run ui:quality:approve -- --owner="..." --reason="..."`
- [ ] Run `npm run ui:quality:cross-browser`
- [ ] Record any human-facing hypothesis and follow-up observation

## Honest A+ Gaps

- [ ] Five recent representative first-play observations
- [ ] At least two return-play observations
- [ ] Production real-user performance telemetry
- [ ] A decision record connecting player evidence to the next shipped iteration
