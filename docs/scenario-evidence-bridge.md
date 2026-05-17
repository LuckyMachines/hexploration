# Scenario Evidence Bridge

Scenario Evidence Bridge turns simulator-family reports into a public readiness layer for the growth routes. It decides which scenario should be featured, which one should become the challenge, and what evidence or fix is still missing.

## Commands

```bash
npm run bridge:build
npm run bridge:build -- --markdown
npm run bridge:scenario -- --id=solo-artifact-hunt
npm run bridge:doctor
```

`bridge:build` reads existing evidence and writes generated JSON under ignored folders:

- `reports/bridge/latest-report.json`
- `app/public/bridge/latest-report.json`
- `reports/bridge/<scenario-id>/readiness.json`
- `app/public/bridge/<scenario-id>/readiness.json`

## Evidence

The bridge consumes:

- scenario definitions from `simulator.scenarios.json`
- Player Feeling Black Box index
- Scenario Time Machine index
- Scenario Lab Notebook index
- Fun Report
- Growth Report
- Gameplay Oracle summary index when present
- Scenario Setup Forge index and per-scenario setup reports when present

Missing files are treated as missing evidence, not as a crash.

## Verdicts

- `featured-ready`: safe to use as the default public featured scenario.
- `playable-with-caveats`: usable, but the UI should show the caveat.
- `needs-fun-work`: the route is playable but the scenario is not yet fun enough to promote.
- `blocked-by-setup`: setup fidelity blocks a trustworthy public claim.
- `regressing`: the latest evidence moved backward.
- `missing-evidence`: the bridge needs exact-engine evidence before promotion.

## Public Routes

`/play` uses the bridge featured scenario when there is no manual `scenario` query. `/challenge` uses the bridge challenge scenario and seed when available. `/scenarios`, `/progress`, `/devlog`, and `/create-scenario` show readiness badges, evidence notes, and the next useful command.

Manual route query params remain authoritative, so local testing can still force a scenario or seed.
