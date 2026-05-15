# Scenario Autopilot

Scenario Autopilot is the orchestration layer for the simulator toolchain. It turns a plain-English gameplay intent into a saved scenario, Setup Forge validation, exact-engine simulator evidence, Gameplay Oracle diagnosis, a candidate change, an optional rerun comparison, and a Markdown design memo.

It does not replace the engine. It uses the existing Scenario Designer, Scenario Setup Forge, Gameplay Simulator, Gameplay Oracle, and safe simulator balance knobs.

## Commands

Plan without running the simulator:

```bash
npm run autopilot:dry -- "solo artifact hunting should feel risky but rewarding"
npm run autopilot:dry -- "4-player escape should feel desperate but cooperative, not random or hopeless"
```

Run one exact-engine pass:

```bash
npm run local:solo
npm run autopilot -- "4-player escape should feel desperate but cooperative"
npm run autopilot:scenario -- --id=escape-pressure-4p --mode=single-pass
```

Iterate with an explicit patch:

```bash
npm run autopilot -- --id=escape-pressure-4p --mode=iterate --iterations=2 --apply
```

Read the latest memo:

```bash
npm run autopilot:latest -- --markdown
```

## Modes

- `dry-run`: creates the plan, setup validation, candidate list, and design memo without simulator execution.
- `single-pass`: saves or resolves the scenario, runs it once, evaluates the Oracle, and recommends the smallest grounded change.
- `iterate`: runs a baseline, applies one candidate only when `--apply` is present, reruns, compares, accepts improvements, and rolls back rejected regressions.
- `latest`: prints the most recent Autopilot report or memo.

## Safety Model

Autopilot can edit only:

- `simulator.scenarios.json`
- `simulator.balance.json`

Autopilot does not edit Solidity contracts, frontend gameplay code, deploy scripts, or generated reports as patch surfaces. Candidate changes are JSON-structured and reversible. When an applied candidate regresses Oracle score, confidence, flat-turn rate, invalid attempts, or zero-stat collapse, Autopilot restores the original JSON snapshots.

Autopilot never commits changes.

Playable Design Memory treats Autopilot reports as experiment history. Accepted comparisons become evidence for what worked; rejected comparisons become warnings against repeating a harmful change.

## Reports

Autopilot writes:

- `reports/simulator/autopilot/latest-report.json`
- `reports/simulator/autopilot/latest-report.md`
- `reports/simulator/autopilot/history.json`
- `reports/simulator/scenarios/<scenario-id>/autopilot/latest-report.json`
- `app/public/simulator/autopilot/latest-report.json`

The `/simulator` workbench shows the latest Scenario Autopilot report, including intent, baseline score, final score, selected change, comparison deltas, and memo excerpts.

## Candidate Types

- `scenario-setup`: removes or reduces dependence on blocked setup fields before tuning balance.
- `scenario-design`: changes strategy mix, batch count, turn count, or Setup Forge prelude.
- `balance-knob`: applies small simulator behavior or Fun Debugger scoring deltas in `simulator.balance.json`.
- `run`: requests a missing baseline before making a design claim.

## Recommended Loop

1. Start with `npm run autopilot:dry -- "<intent>"`.
2. Inspect the setup warnings and candidate changes.
3. Start the local stack with `npm run local:solo`.
4. Run `npm run autopilot -- --id=<scenario-id> --mode=single-pass`.
5. If the recommendation is low-risk, run `npm run autopilot -- --id=<scenario-id> --mode=iterate --apply`.
6. Inspect `/simulator` and `reports/simulator/autopilot/latest-report.md`.
7. Keep accepted JSON changes or manually revise from the memo.
8. Run `npm run memory:build` so the accepted or rejected experiment is available to future queries.

Useful memory queries:

```bash
npm run memory:query -- "what Autopilot changes improved cooperation?"
npm run memory:query -- "which rejected changes hurt escape pressure?"
```
