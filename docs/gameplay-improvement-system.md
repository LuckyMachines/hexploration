# Gameplay Improvement System

This system turns gameplay changes into a falsifiable evidence loop. It does not treat a simulator score as proof of fun, and it does not let a candidate change its own scoring rubric.

## Commands

```bash
npm run gameplay:plan
npm run gameplay:refresh
npm run gameplay:refresh:exact -- --port=11134 --resume --continue-on-fail
npm run gameplay:regression -- --port=11134
npm run gameplay:doctor
```

`gameplay:refresh` rebuilds the derived dependency graph from the evidence already on disk:

`scenario/setup -> Oracle -> feeling -> memory -> time machine -> lab -> tutor -> bridge -> fun -> gameplay report`

For exact evidence, use the self-managed path:

```bash
npm run gameplay:refresh:exact -- --port=11134 --resume --continue-on-fail
```

The exact runner launches the local Anvil/deployment stack without a visible window, waits for readiness, executes each canonical scenario, checkpoints successful scenarios, stops the process tree, and then refreshes all derived evidence. Omit `--port` to select an available local port automatically. Use `--no-resume` for a clean rerun. The default per-scenario ceiling is 60 minutes because measured 3P/4P exact runs exceed 30 minutes. Run `npm run gameplay:regression` for timeout, inventory-limit, and nightfall boundary fixtures.

To limit a verification pass while developing a scenario:

```bash
node scripts/gameplay-improvement.mjs refresh --with-engine --scenario=cooperative-rescue-2p --batch=10 --port=11134
```

The strict doctor intentionally exits nonzero when same-engine evidence is stale, canonical scenarios are missing, or truth gates fail. The current `automated-only` quality contract deliberately excludes observed-player calibration from the grade.

## Experiment Contract

- `simulator.agent-policies.json` controls synthetic-player action selection.
- `simulator.evaluation.json` controls scoring and rejection gates and is immutable within a comparison.
- `gameplay.quality-contract.json` defines the scenario matrix, replicate requirement, and human-calibration bar.
- `gameplay.experiments.json` records concrete gameplay-mechanic hypotheses rather than disguising bot-policy changes as shipped balance changes.
- `gameplay:experiment` compares baseline and candidate reports by strategy/run index, requires identical seeds and evaluator hashes, and reports paired effect size, variance, 95% confidence intervals, and guardrail failures.
- A manual experiment closure may only be `inconclusive`, must include a reason, and makes no causal claim. Accepted or rejected decisions still require paired reports.

## Terminal-outcome policy

Canonical scenarios that require a terminal outcome switch into a bounded evacuation policy during their final configured turns. Active survivors route toward the actual landing tile using revealed adjacency first and the bounded board graph as a fallback, spend their full movement allowance, and submit `Flee` when they arrive. The Solidity engine validates every route edge, accepts `Flee` only at a landing tile, marks that player inactive, and ends the game when no active survivor remains. Empty-handed departure is valid; recovered value determines the outcome rather than permission to leave.

## Verdict Integrity

Oracle strong-pass requires every configured strategy to meet the independent-run and distinct-seed minimum. Missing terminal outcomes or insufficient critical setup blocks the verdict. Aggregate averages do not count as a terminal result.

## Current Evaluation Scope

The current quality contract is `automated-only`, as requested. Automated evidence can therefore earn an A when canonical exact runs, truth gates, freshness, coverage, regression guards, and experiment integrity all pass. Real-player calibration remains a valuable future expansion but is neither required nor silently simulated.

If that scope changes later, enable `humanCalibration` in `gameplay.quality-contract.json` and add calibration fields to the consent-safe playtest command:

```bash
npm run improve:playtest -- --id=session-001 --scenario=first-discovery-solo --cohort=first-time-player --observations="..." --severity=medium --decision="..." --owner=product-research --fun-score=72 --automated-fun-score=68 --recommendation-agreement=agree
```

Synthetic sessions never satisfy a human-calibration gate.
