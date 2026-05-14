# Gameplay Simulator

The simulator is a local tuning harness that uses the same Solidity engine as the playable app. It does not clone the rules in JavaScript.

## Run

Start a local chain and app:

```bash
npm run local:solo
```

In another terminal, run a simulation:

```bash
npm run sim:balanced
```

Open:

```text
http://localhost:5502/simulator
```

The simulator writes:

- `reports/simulator/latest-report.json`
- `app/public/simulator/latest-report.json`

## Strategies

```bash
npm run sim -- --turns=12 --players=1 --strategy=balanced
npm run sim -- --turns=12 --players=1 --strategy=risky
npm run sim -- --turns=12 --players=1 --strategy=dig
npm run sim -- --turns=12 --players=1 --strategy=move
npm run sim -- --turns=12 --players=1 --strategy=rest
npm run sim -- --turns=12 --players=1 --strategy=idle
npm run sim -- --scenario=benchmark --batch=3
npm run sim:golden
npm run sim:baseline
npm run sim:compare -- --changed="movement tuning"
```

## Engine Path

Each run:

1. Creates or selects a local game.
2. Registers Anvil dev accounts as players.
3. Reads state from `GameSummary` and `PlayerSummary`.
4. Uses `XenovoyaController.actionIsValid` to pick a valid action.
5. Submits through `XenovoyaController.submitAction`.
6. Fulfills mock VRF on `GameSetup` and `XenovoyaQueue`.
7. Progresses `GameSetup`, `XenovoyaController`, and `XenovoyaGameplay` loops.
8. Captures before/after snapshots and aggregate outcomes.

That means tuning reports reflect the real deployed local contracts, contract validation, queue phases, randomness path, and turn processing.

## Learning Features

The simulator now emits raw run traces plus aggregate learning data:

- Scenario presets: `solo-balanced`, `solo-risky`, `solo-dig-rush`, `solo-escape-rush`, `4p-cautious`, `4p-chaos`, `benchmark`.
- Batch runs via `--batch=N`.
- Strategy comparison via `--strategies=balanced,risky,dig,move,rest,idle`.
- Deterministic strategy seed labels via `--seed=NAME`.
- Before/after snapshots for every turn.
- Action distribution, invalid-attempt counts, and meaningful-choice density.
- Boring-turn detection when nothing meaningfully changes.
- Spike-turn detection for stat drops, artifacts, card draws, zero stats, reveal jumps, and submission errors.
- Exploration metrics from revealed zone counts.
- Player health metrics from stat totals and zero-stat frequency.
- Card outcome counts from last day-phase events.
- Target scorecards from `simulator.tuning.json`.
- Scenario goal checks for each scenario preset.
- Baseline comparison deltas for before/after tuning runs.
- Prioritized tuning tasks generated from failed targets, scenario goals, and warnings.
- A rolling tuning ledger in `reports/simulator/tuning-ledger.json`.
- Per-turn micro-recaps for stats, reveals, artifacts, cards, validity, and movement.
- Annotated tension reasons so a spike explains what caused it.
- Strategy and scenario design questions in the `/simulator` workbench.
- Action validity logs on each submitted turn.
- Opinionated warnings in `/simulator`.

## Tuning Targets

`simulator.tuning.json` owns the default pass/fail thresholds, scenario-specific goals, and task hints. A run copies those thresholds into the report so later reports remain explainable even after targets change.

Useful flags:

```bash
npm run sim:golden -- --note="first balance pass"
npm run sim:golden -- --hypothesis="more movement should reveal faster"
npm run sim:golden -- --changed="lowered movement friction"
npm run sim:golden -- --save-baseline
npm run sim:golden -- --baseline
npm run sim:golden -- --baseline=reports/simulator/run-OLDER.json
```

The latest report includes:

- `targetEvaluation`: global tuning scorecard.
- `scenarioGoalEvaluation`: scenario-specific scorecard.
- `comparison`: deltas against `reports/simulator/baseline-report.json` or an explicit `--baseline` report.
- `tasks`: prioritized next tuning actions.
- `tuning`: run notes, hypothesis, changed area, target config, and baseline metadata.

## Recommended Benchmark Loop

1. Run `npm run sim:baseline` to capture a known baseline.
2. Open `/simulator`.
3. Note failed targets, generated tasks, warnings, and strategy outliers.
4. Make one gameplay/card/rules tuning change.
5. Run `npm run sim:compare -- --changed="short description"`.
6. Compare artifacts, reveal pace, stat pressure, boring turns, spike turns, action mix, and target pass rate.
7. Keep or revert the tuning change based on the target scorecard and baseline deltas.
