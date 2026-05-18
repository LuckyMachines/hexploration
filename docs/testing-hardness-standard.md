# Testing Hardness Standard

Testing hardness means a bad gameplay, UI, contract, or integration change should fail before it reaches main. The project should produce one current report that explains what was checked, what failed, what artifacts were written, and which command to run next.

## Tiers

| Tier | Purpose | Expected Cost |
| --- | --- | --- |
| `smoke` | Fast sanity check for everyday edits | Low |
| `focused` | Smoke plus touched-system checks | Low to medium |
| `hard` | Full local confidence gate | Medium to high |
| `exact` | Hard gate plus exact local-chain evidence | High |
| `release` | Exact gate plus e2e, visual, freshness, and clean-repo checks | Highest |

## Rules

1. Every step must have an id, label, command, timeout, and pass/fail/skipped/timed-out status.
2. Heavy steps run sequentially by default.
3. Generated reports are ignored source artifacts.
4. Release mode requires a clean repo.
5. Skipped required steps are release blockers.
6. Exact mode must clean up local-stack processes and verify the Anvil port is free.
7. Reports must include command tails for failures, durations, repo metadata, and suggested next commands.
8. Local and CI commands should be identical.

## Commands

- `npm run verify:smoke`
- `npm run verify:focused`
- `npm run verify:hard`
- `npm run verify:exact`
- `npm run verify:release`
- `npm run verify:doctor`
- `npm run verify:latest`
- `npm run verify:clean-artifacts`

