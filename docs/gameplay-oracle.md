# Gameplay Oracle

The Gameplay Oracle evaluates simulator reports as design evidence. It answers whether the intended player experience happened, why it did or did not happen, and what the smallest useful next experiment should be.

The Oracle is deterministic and local. It does not use an LLM or a parallel game rules model.

## Commands

```bash
npm run oracle:latest
npm run oracle:scenario -- --id=solo-artifact-hunt
npm run oracle:pack -- --pack=artifacts --continue
npm run oracle:project
npm run oracle:doctor
npm run oracle:ci
```

Run the simulator and Oracle in one command:

```bash
npm run oracle:run -- --scenario=benchmark --batch=3
```

Run a scenario through the same engine first:

```bash
npm run oracle:scenario -- --id=escape-pressure-4p --run
```

When a scenario has a `setupForge` block, `--run` applies the supported setup fields before measured turns begin and embeds setup evidence in the Oracle report.

Scenario Autopilot uses the Oracle as its acceptance judge. It reads the weakest dimension, setup level, confidence, gate failures, and smallest next experiment, then converts those into a candidate scenario or balance patch.

Useful options:

- `--gate`: exits non-zero if Oracle regression gates fail, including unmet required setup levels.
- `--baseline=<path>`: compares against a prior Oracle JSON report.
- `--markdown`: prints Markdown to stdout.
- `--next-only`: prints only the smallest next experiment.
- `--write-tasks`: writes `reports/simulator/oracle/latest-tasks.json`.
- `--max-scenarios=N`: limits pack/project breadth.
- `--timeout-ms=N`: limits simulator subprocess runs.
- `--continue`: keeps pack evaluation going after a scenario failure.

## Outputs

- `reports/simulator/oracle/latest-oracle.json`
- `reports/simulator/oracle/latest-oracle.md`
- `reports/simulator/oracle/history.json`
- `reports/simulator/oracle/summary-index.json`
- `reports/simulator/scenarios/<scenario-id>/latest-oracle.json`
- `reports/simulator/scenarios/<scenario-id>/latest-oracle.md`
- `app/public/simulator/oracle/latest-oracle.json`

Oracle reports include a `setup` object with the applied level, required level, applied/skipped/failed counts, and critical skipped fields.

## Scores

The Oracle scores ten experience dimensions from `0-100`:

- `agency`: meaningful choices, low idle pressure, action variety.
- `readability`: low invalid attempts, few skipped or no-delta turns.
- `tension`: pressure spikes, flee pressure, danger without collapse.
- `surprise`: card/event variety, reveals, artifacts, outcome swings.
- `recovery`: rest/help value, stat comeback, avoiding zero-stat collapse.
- `systemIntegration`: board, stats, actions, cards, artifacts, terrain, and scenario tags interacting.
- `replayability`: strategy variation, batch variation, outcome spread.
- `pacing`: first meaningful event, flat streaks, climax timing, life curve.
- `emotionalTexture`: curious, pressured, dangerous, recovery, triumphant, quiet, flat, and confused turn labels.
- `outcomeLegibility`: decisive turns and traceable causes for the final state.

## Verdicts

- `strong-pass`: high score with enough confidence.
- `pass`: healthy score.
- `mixed`: useful evidence with clear weaknesses.
- `weak`: playable evidence, but the experience is not reliable yet.
- `fail`: the design question is not working.
- `blocked`: missing telemetry or unsupported setup prevents an honest answer.

## Daily Workflow

1. Start the local stack when running live scenarios: `npm run local:solo`.
2. Run a scenario: `npm run scenario:run -- --id=solo-artifact-hunt`.
3. Evaluate it: `npm run oracle:scenario -- --id=solo-artifact-hunt`.
4. Inspect `/simulator`.
5. Apply only the smallest recommended experiment.
6. Rerun the same scenario and compare the Oracle trend.

## Limitations

The Oracle is a design assistant, not perfect truth. Its confidence drops when batch size is low, only one strategy was run, scenario setup assumptions are not engine-enforced, or telemetry is missing. Unsupported assumptions are reported explicitly rather than treated as proven facts.

Setup confidence is intentionally conservative: exact Setup Forge application can raise confidence, while skipped critical fields or an unmet required setup level lower confidence and can turn an otherwise useful readout into a blocked verdict.

For an end-to-end loop, use:

```bash
npm run autopilot:dry -- "4-player escape should feel desperate but cooperative"
npm run autopilot -- --id=escape-pressure-4p --mode=single-pass
```

See [scenario-autopilot.md](scenario-autopilot.md) for patch safety, rerun comparison, and memo outputs.
