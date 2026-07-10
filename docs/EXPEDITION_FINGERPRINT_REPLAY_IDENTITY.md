# Expedition Fingerprint Replay Identity

## Goal

Make replayability visible during the first expedition, ideally by turn 1 or 2. A new player should understand that their current seed has a named route problem they can replay, beat, and share.

## Sequential Implementation Plan

1. Define Expedition Fingerprint as the run's first memorable identity.
2. Generate it after the first meaningful reveal or artifact pickup.
3. Fall back to an early route-pressure fingerprint by turn 2 if no artifact has appeared.
4. Keep generation deterministic from seed and current run state.
5. Include title, subtitle, trigger, route shape, temptation, danger, replay hook, beat target, and tone.
6. Add unit tests for deterministic output, seed/state variation, early fallback, artifact-oriented output, and pressure-oriented output.
7. Attach the first fingerprint to the growth run and timeline event.
8. Keep the first fingerprint as the primary identity for the run.
9. Include the fingerprint in run summaries.
10. Include the fingerprint in completed expedition memories.
11. Include the fingerprint in share text and replay links.
12. Show the fingerprint during the run as soon as it appears.
13. Keep it visible afterward as the run identity.
14. Add a compact Expedition Fingerprint card for play, completion, memory, relic, and replay surfaces.
15. Update first-run homepage copy so Reveal, Read, Fingerprint, Choose teaches replay by turn 2.
16. Update completion bridge copy to reference the named fingerprint.
17. Update replay pages to open with the named route problem.
18. Add e2e coverage for first-run fingerprint appearance, completion bridge reference, and replay display.
19. Scan rendered player-facing text for internal product language.
20. Run unit tests, focused browser tests, production build, whitespace checks, and marker scans.

## Acceptance Criteria

- By turn 2, a public run displays a named fingerprint.
- The fingerprint explains why the seed is replayable.
- Finished memories preserve the fingerprint title and replay hook.
- Share text includes the fingerprint identity.
- The completion bridge invites the player to beat the named opening.
- Replay pages show the fingerprint before the timeline.
- Homepage copy teaches the fingerprint as part of the first-turn loop.
- No internal implementation language appears in the public funnel.

## Completion Record

Implemented across the growth loop, expedition memory, relic card generation, public play page, completion bridge, replay page, first-expedition guide, and homepage first-turn copy.

Verification completed:

1. `npm run build`
2. `npm test -- --run`
3. `$env:E2E_APP_PORT='43140'; npx playwright test e2e/growth.spec.js --project=pixel-7`
4. `$env:E2E_APP_PORT='43141'; npx playwright test e2e/home.spec.js e2e/growth.spec.js`
5. Placeholder-marker scan across `app/src`, `app/e2e`, and `docs`
6. `git diff --check`

Result: the implementation meets the acceptance criteria. The final whitespace check only reported Git line-ending normalization warnings on Windows.
