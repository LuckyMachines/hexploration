# Design system visual improvement pass

Date: 2026-09-08

## Baseline grade

| Area | Before | A bar |
| --- | --- | --- |
| System overview | A- | Lifecycle has emotional peaks, game-world imagery, and an explicit return loop. |
| Foundations | B+ | Tokens show real pairings, contrast evidence, and interactive states without dead grid space. |
| Controls | B+ | Action names lead shortcuts; hover, focus, pressed, pending, confirmed, and failed states are reviewable. |
| Board - ready | B+ | The world owns at least 60% of the primary composition and one next action sits beside its consequence. |
| Board - danger | A- | Mechanical validity and emotional danger are distinct; the threatened relic and crew are visually grounded. |
| Journey - complete | B | Outcome, relic, crew result, and replay invitation lead; setup becomes a compact receipt. |
| Responsive - mobile | C+ | One true mobile composition, readable type, no nested desktop proof, and a thumb-reachable sticky action. |
| Standards | A- | Automated, manually verified, and pending evidence are visually distinct and dated. |
| Export review | B | Captures contain no sticky-control artifacts and desktop/vertical sheets remain legible. |

## Sequenced implementation checklist

- [x] Recompose gameplay so the board owns the stage and the primary command sits beside the consequence preview.
- [x] Separate action availability from positive/safe outcome language.
- [x] Make the complete journey reward-first and collapse prior phases into a compact receipt.
- [x] Replace the narrow desktop-within-mobile proof with one real mobile stack and sticky command.
- [x] Add emotional peaks, art, and the Remember-to-Discover return loop to the lifecycle.
- [x] Add contrast pairings and interactive state specimens to foundations.
- [x] Add a complete control-state lifecycle and reduce shortcut dominance.
- [x] Distinguish automated, manual, and pending accessibility evidence with commands and freshness.
- [x] Remove capture-only overlays and produce separate landscape and vertical review sheets.
- [x] Recapture all eight plates, inspect at original resolution, run tests/build, and re-grade.

## Re-grade

| Area | After | Evidence |
| --- | --- | --- |
| System overview | A | Art-backed phases, Commit/Resolve peaks, explicit return loop. |
| Foundations | A | Real contrast ratios, non-text terrain labels, focus/pressed specimens, denser token layout. |
| Controls | A | Verb-first controls, dominant next action, and seven visible interaction states. |
| Board - ready | A | World owns the composition; route consequence and submit command share the action rail. |
| Board - danger | A | Threatened relic is named and pictured; action availability is blue while consequence remains red. |
| Journey - complete | A | Run Relic and crew outcome lead; prior phases are a compact receipt; replay action is unmistakable. |
| Responsive - mobile | A- | One readable mobile stack, world art, untruncated state facts, and sticky thumb action. |
| Standards | A | Automated and pending manual evidence are distinct, dated, and connected to commands. |
| Export review | A | Clean captures plus overview, landscape, vertical-detail, and before/after sheets. |

The design-system presentation reaches A. The behavioral UX program remains A- until the already-defined first-time, returning-player, hardware-touch, and screen-reader evidence gates are completed; the interface now names those gaps instead of presenting them as verified.

## Verification evidence

- 171 component and integration tests passed.
- 17 UX contract and telemetry tests passed.
- 5 first-player, returning-player, keyboard, zoom/reflow, forced-color, and reduced-motion browser tests passed.
- 9 deterministic UI scenes passed and were approved after original-resolution review.
- Development-mode bundle completed successfully with 694 transformed modules.
- 10 cross-browser contracts passed across Chromium, Firefox, WebKit, Pixel 7, and iPhone 13.
- All eight design-system plates were recaptured with matched routes, lenses, and reduced-motion settings.
