# Scenario Time Machine

Scenario Time Machine turns the simulator evidence history into a per-scenario evolution report. It answers whether a scenario is improving, regressing, stable, blocked, or still missing enough evidence.

It is read-only. It does not run the simulator, edit balance, edit scenarios, or commit changes.

## Commands

```bash
npm run time-machine:build
npm run time-machine:scenario -- --id=escape-pressure-4p
npm run time-machine:compare -- --id=solo-artifact-hunt --against=best
npm run time-machine:latest -- --id=solo-artifact-hunt --markdown
npm run time-machine:doctor
npm run time-machine:test
```

Use `--refresh-memory` when you want Time Machine to rebuild Playable Design Memory before analyzing timelines.

## Inputs

Time Machine primarily consumes Playable Design Memory raw events. When the latest memory snapshot lacks raw events, it builds a fresh in-process memory snapshot from local reports.

Evidence comes from:

- Scenario definitions
- Simulator reports
- Gameplay Oracle reports
- Scenario Setup Forge reports
- Scenario Autopilot reports
- Player Feeling Black Box reports
- Auto-tune reports
- Tuning ledger entries when present

## Outputs

- `reports/simulator/time-machine/index.json`
- `reports/simulator/time-machine/<scenario-id>/latest-report.json`
- `reports/simulator/time-machine/<scenario-id>/latest-report.md`
- `app/public/simulator/time-machine/index.json`
- `app/public/simulator/time-machine/<scenario-id>/latest-report.json`

Generated outputs are ignored by Git.

## How To Read It

- **Trend** says whether latest evidence is improving, regressing, stable, noisy, blocked, or insufficient.
- **Health score** is explainable and combines Oracle score, confidence, setup fidelity, simulator life score, Player Feeling Black Box arc score, and penalties for flat turns, invalid actions, zero-stat collapse, failed gates, and rejected changes.
- **Best known version** is the strongest historical point with acceptable confidence and setup fidelity.
- **Last good version** is the newest point with a healthy verdict, passing gate, or accepted improvement.
- **Inferred causes** are nearby evidence events that likely explain a major change. They are explicitly labeled as inferred.

## Recommended Loop

1. Run scenario, Oracle, setup, Autopilot, or memory workflows as usual.
2. Run `npm run memory:build`.
3. Run `npm run time-machine:scenario -- --id=<scenario-id>`.
4. Run `npm run feel:scenario -- --id=<scenario-id>` when you want the timeline to include felt-control arcs.
5. Run `npm run lab:entry -- --id=<scenario-id>` to record the design learning.
6. Run `npm run tutor:scenario -- --id=<scenario-id>` to convert the evidence into an ordered lesson.
7. Inspect the Scenario Time Machine, Scenario Lab Notebook, Player Feeling Black Box, and Scenario Self-Driving Tutor panels in `/simulator`.
8. Use the top recommendation as the next smallest experiment.
