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
npm run sim:autotune:dry
npm run sim:autotune
npm run scenario:create -- "4-player escape pressure with two exhausted players and one artifact"
npm run scenario:run -- --id=escape-pressure-4p
npm run setup:explain -- --id=escape-pressure-4p
npm run autopilot:dry -- "4-player escape should feel desperate but cooperative"
npm run oracle:latest
npm run oracle:scenario -- --id=escape-pressure-4p
npm run memory:build
npm run memory:query -- "what do we know about escape pressure?"
npm run time-machine:scenario -- --id=escape-pressure-4p
```

Scenario runs use the same active Anvil deployment as `npm run sim:*`; keep `npm run local:solo` running or pass `--rpc=<url>` to target another local engine.

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
- Fun Debugger life scores, turn classifications, causes, systems, confidence, and suggested experiments.
- Run-level best/worst turns, flat streaks, dominant failure modes, dominant fun sources, and top experiments.
- Aggregate repeated flat patterns, high-life patterns, systemic risks, strategy life scores, and smallest experiment queue.
- Baseline comparison for life score, flat-turn rate, and alive-turn rate.
- CLI summary with the top fun issue and top experiment after each simulator run.
- Auto-tune sessions that generate candidate balance patches, run each candidate, reject harmful regressions, and rank winners.
- Auto-tune history in `reports/simulator/experiments/index.json`.
- Scenario Designer definitions in `simulator.scenarios.json`.
- Plain-English scenario creation, validation, duplication, archiving, pack running, import/export, and report verdicts.
- Scenario Setup Forge for applying authored starting stats, items, artifacts, reveals, terrain, campsites, pressure, and prelude turns before measured turns.
- Scenario Autopilot for turning a design intent into a scenario, setup validation, Oracle diagnosis, candidate patch, rerun comparison, and design memo.
- Playable Design Memory for rolling scenario, simulator, setup, Oracle, auto-tune, and Autopilot evidence into queryable project memory.
- Scenario Time Machine for comparing each scenario's evidence over time and finding best, latest, last-good, and regressed versions.
- Scenario Lab Notebook for recording scenario learning, current belief, decisions, unresolved assumptions, readiness, and next experiments.
- Scenario Self-Driving Tutor for ranking the next gameplay lesson, command chain, and success criteria.
- Scenario run history in `reports/simulator/scenarios/<scenario-id>/history.json`.
- Gameplay Oracle verdicts in `reports/simulator/oracle/latest-oracle.json` and `/simulator`.
- Opinionated warnings in `/simulator`.

## Scenario Designer

`simulator.scenarios.json` stores authored design questions. The CLI can create scenarios from plain English and preserve unsupported initial-state requests honestly as assumptions.

Commands:

```bash
npm run scenario:create -- "solo artifact hunt with high stat pressure"
npm run scenario:list
npm run scenario:show -- --id=solo-artifact-hunt
npm run scenario:validate
npm run scenario:run -- --id=solo-artifact-hunt
npm run scenario:run-pack -- --pack=escape
npm run scenario:autotune -- --scenario-id=escape-pressure-4p
```

Utility commands:

```bash
node scripts/scenario-designer.mjs duplicate --id=solo-artifact-hunt --new-id=solo-artifact-hunt-hard
node scripts/scenario-designer.mjs archive --id=solo-artifact-hunt-hard
node scripts/scenario-designer.mjs export --file=scenario-export.json
node scripts/scenario-designer.mjs import --file=scenario-export.json
node scripts/scenario-designer.mjs decide --id=solo-artifact-hunt --decision=keep --notes="human playtest next"
```

Scenario fields:

- `id`, `name`, `description`, `designQuestion`
- `players`, `turns`, `strategies`, `batch`, `seed`
- `tags`, `initialState.assumptions`, `targets`, `failureSignals`
- `notes`, `ladder`, `packs`, `version`, `createdFrom`, `parentScenarioId`

Scenario Setup Forge support:

- `playerStats`, `inventory`, `artifacts`, `revealedZones`, `terrain`, and `campsites` are applied through existing role-gated contract hooks when a live simulator run has a local deployment.
- `playerLocations`, `pressure`, and `scriptedPrelude` are partially supported because they rely on post-start movement or simulator-controlled setup turns.
- `landingZone`, `currentDay`, and `queuePhase` are contract-blocked after game start and are reported honestly as skipped.
- `events` are observed-only design evidence, not synthetic chain mutations.

The report will never claim unsupported assumptions were enforced. For example, a scenario can ask for a specific landing zone, but the setup report will keep that as contract-blocked until the engine exposes a safe pre-start setter.

Scenario reports include:

- `scenarioDefinition`: the full snapshot used for that run.
- `scenarioVerdict`: `answered`, `inconclusive`, or `failed`.
- `setupForge`, `setupApplication`, `setupLevel`, and `setupPreludeTurns`.
- pass/fail target checks and triggered failure signals.
- unsupported assumptions.
- recommended follow-up scenario variant.

Scenario outputs:

- `reports/simulator/scenarios/<scenario-id>/latest-report.json`
- `reports/simulator/scenarios/<scenario-id>/run-<timestamp>.json`
- `reports/simulator/scenarios/<scenario-id>/history.json`
- `reports/simulator/scenarios/<scenario-id>/latest-setup-report.json`
- `reports/simulator/scenarios/<scenario-id>/setup-history.json`
- `app/public/simulator/scenarios/<scenario-id>/latest-report.json`

See [scenario-setup-forge.md](scenario-setup-forge.md) for setup authoring, support levels, and the CLI workflow.

## Scenario Autopilot

Scenario Autopilot coordinates the scenario, setup, simulator, Oracle, and safe balance surfaces:

```bash
npm run autopilot:dry -- "solo artifact hunting should feel risky but rewarding"
npm run autopilot -- --id=solo-artifact-hunt --mode=single-pass
npm run autopilot -- --id=escape-pressure-4p --mode=iterate --iterations=2 --apply
npm run autopilot:latest -- --markdown
```

Dry runs do not execute the simulator. Iteration only edits `simulator.scenarios.json` and `simulator.balance.json`, and rejected candidate changes are rolled back from snapshots.

See [scenario-autopilot.md](scenario-autopilot.md) for the full workflow and safety model.

## Playable Design Memory

Playable Design Memory reads all simulator-family reports and builds a project-level evidence snapshot:

```bash
npm run memory:build
npm run memory:latest -- --markdown
npm run memory:query -- "which setup blockers matter most?"
npm run memory:doctor
```

It writes `reports/simulator/memory/latest-memory.json` and `app/public/simulator/memory/latest-memory.json`, which the `/simulator` workbench displays in the Playable Design Memory panel.

See [playable-design-memory.md](playable-design-memory.md) for schema, outputs, and query examples.

## Scenario Time Machine

Scenario Time Machine turns memory evidence into a per-scenario timeline:

```bash
npm run time-machine:build
npm run time-machine:scenario -- --id=escape-pressure-4p
npm run time-machine:compare -- --id=solo-artifact-hunt --against=best --markdown
npm run time-machine:doctor
```

It writes `reports/simulator/time-machine/<scenario-id>/latest-report.json` and `app/public/simulator/time-machine/<scenario-id>/latest-report.json`, which the `/simulator` workbench displays in the Scenario Time Machine panel.

See [scenario-time-machine.md](scenario-time-machine.md) for trend meanings, compare modes, and output paths.

## Scenario Lab Notebook

Scenario Lab Notebook turns scenario evidence into a persistent design journal:

```bash
npm run lab:entry -- --id=escape-pressure-4p
npm run lab:decision -- --id=solo-artifact-hunt --decision=playtest --why="Artifact payoff is readable enough for a live playtest."
npm run lab:daily
npm run lab:doctor
```

It writes `reports/simulator/lab-notebook/<scenario-id>/latest-entry.json` and `app/public/simulator/lab-notebook/<scenario-id>/latest-entry.json`, which the `/simulator` workbench displays in the Scenario Lab Notebook panel.

See [scenario-lab-notebook.md](scenario-lab-notebook.md) for entry types, decisions, readiness labels, and output paths.

## Scenario Self-Driving Tutor

Scenario Self-Driving Tutor turns evidence into an ordered gameplay curriculum:

```bash
npm run tutor:build
npm run tutor:next -- --markdown
npm run tutor:scenario -- --id=escape-pressure-4p
npm run tutor:complete -- --id=escape-pressure-4p --lesson=<lesson-id> --status=passed --why="Evidence improved."
npm run tutor:doctor
```

It writes `reports/simulator/tutor/latest-curriculum.json` and `app/public/simulator/tutor/latest-curriculum.json`, plus per-scenario lesson reports that the `/simulator` workbench displays in the Scenario Self-Driving Tutor panel.

See [scenario-self-driving-tutor.md](scenario-self-driving-tutor.md) for lesson statuses, success criteria, completion records, and output paths.

## Gameplay Oracle

The Gameplay Oracle turns simulator evidence into a deterministic design readout. It scores agency, readability, tension, surprise, recovery, system integration, replayability, pacing, emotional texture, and outcome legibility, then recommends one smallest next experiment.

```bash
npm run oracle:latest
npm run oracle:scenario -- --id=solo-artifact-hunt
npm run oracle:pack -- --pack=artifacts --continue
npm run oracle:project
npm run oracle:doctor
```

The simulator also embeds an Oracle report when it writes `latest-report.json`, so `/simulator` can show the current verdict immediately after a run.

See [gameplay-oracle.md](gameplay-oracle.md) for the full rubric, outputs, and workflow.

## Balance Surface

`simulator.balance.json` is the safe auto-tune surface. It contains simulator-agent behavior knobs and Fun Debugger scoring weights. It does not claim to mutate deployed Solidity contracts; the simulator still submits actions, validates actions, fulfills randomness, and progresses the same local engine.

Important knobs include:

- `moveBias`, `digBias`, `restBias`, `idleBias`, `fleeBias`: action-selection pressure for simulator agents.
- `recoverAtStat`: the stat threshold where bots prefer recovery.
- `movementFallbackPriority`: whether movement is tried early or late as a fallback.
- `quietTurnLifeBonus`, `noBoardDeltaPenalty`, `invalidAttemptPenalty`, `statCollapsePenalty`: Fun Debugger scoring pressure.
- `discoveryLifeReward`, `movementLifeReward`, `cardLifeReward`, `artifactLifeReward`, `choiceDensityReward`: what the debugger treats as life-giving.
- `gates`: rejection thresholds for harmful candidates.

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
- `funDebugger`: life score, flat/alive rates, top issue, top experiments, repeated patterns, systemic risks, and strategy scores.
- `comparison`: deltas against `reports/simulator/baseline-report.json` or an explicit `--baseline` report.
- `tasks`: prioritized next tuning actions.
- `tuning`: run notes, hypothesis, changed area, target config, and baseline metadata.

## Auto-Tune Workflow

Dry-run candidate generation:

```bash
npm run sim:autotune:dry
```

Full auto-tune run while local Anvil is active:

```bash
npm run local:solo
npm run sim:autotune
```

Apply a passing winner to `simulator.balance.json`:

```bash
npm run sim:autotune -- --apply-winner
```

Auto-tune writes:

- `reports/simulator/experiments/<timestamp>/autotune-report.json`
- `reports/simulator/experiments/<timestamp>/<candidate>/report.json`
- `reports/simulator/experiments/index.json`
- `app/public/simulator/autotune/latest-report.json`

Each candidate includes a hypothesis, changed knobs, expected effect, blast radius, weighted score, rejection reasons, and report paths. Candidates are rejected if they improve life score while harming flat-turn rate, invalid attempts, zero-stat players, artifacts, or warning count beyond configured gates.

## Recommended Benchmark Loop

1. Run `npm run sim:baseline` to capture a known baseline.
2. Open `/simulator`.
3. Note failed targets, generated tasks, warnings, and strategy outliers.
4. Run `npm run sim:autotune:dry` to inspect candidate patches.
5. Run `npm run sim:autotune` to test candidates with the same scenario, batch, strategies, and seed.
6. Inspect `/simulator` Auto-Tune Lab for ranking, winner explanation, rejected reasons, and patch diff.
7. Optionally run `npm run sim:autotune -- --apply-winner`.
8. Run `npm run sim:compare -- --changed="short description"`.
9. Keep or revert the tuning change based on life score, flat-turn rate, artifacts, stat pressure, and target scorecard.
