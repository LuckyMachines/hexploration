# Observed-Player Research Protocol

Review date: 2026-09-08

## Recruiting Matrix

- Three first-time players who have not seen the interface.
- Two returning players who have completed or watched an earlier run.
- Use a mix of desktop and mobile contexts where possible.
- Do not record names, email addresses, wallet addresses, signatures, or raw transaction identifiers.

## Facilitation

Confirm consent for anonymous notes. Ask the participant to think aloud. Start first-time players from a clean browser profile and returning players from a saved unresolved thread. Do not explain labels, point to controls, or rescue a participant until they are fully blocked. Mark coaching as a task failure.

Ask the participant to:

1. Explain what the game is asking them to do.
2. Make the first meaningful decision.
3. Predict what will change before committing.
4. Recover from a deliberately presented invalid or interrupted state.
5. Name the unresolved question or social reason that would bring them back.

For every task, record pass, struggle, or fail plus observable behavior. Record delight and return intent from 1-5. Do not convert opinions into behavior: quote only short, anonymous phrases when consent permits.

From Git Bash, print the current prompt with `npm run ux:research:protocol`. Record a session with `npm run ux:research:record -- ...`; the command validates cohort coverage, required tasks, rating ranges, and obvious personal identifiers before writing evidence.

## Decision Rule

- Critical: blocks progress, loses trust, or risks an irreversible action. Fix before release.
- High: prevents task completion or hides a consequence. Fix in the current iteration.
- Medium: creates hesitation, avoidable help use, or a recoverable wrong turn. Rank against frequency.
- Low: polish that does not change comprehension or task completion.

After five current sessions, run `npm run ux:research:report`, attach the evidence paths to a decision record, and choose one ranked next experiment. A session count alone is not approval; task evidence and the resulting decision are required.
