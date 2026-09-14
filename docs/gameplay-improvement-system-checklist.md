# Gameplay Improvement System Checklist

- [x] Block Oracle confidence inflation from incomplete setup and unfinished runs.
- [x] Require independent per-strategy replication before strong-pass.
- [x] Separate synthetic-player policy from evaluation weights and gates.
- [x] Make autotune policy-only and default comparisons to 10 paired seeds.
- [x] Add paired effect size, variance, confidence interval, and guardrail reporting.
- [x] Expand canonical scenario coverage across 1P, 2P, 4P, exploration, reward/risk, rescue, extraction, failure/recovery, and return continuity.
- [x] Replace raw valid-option counting with choice breadth, entropy, and visible consequence signals.
- [x] Exclude generated and archived scenarios from production fun scoring.
- [x] Add a dependency-aware gameplay evidence refresh and strict doctor.
- [x] Record source hashes, dependency freshness, coverage, experiment resolution, and regression catches.
- [x] Wire the gameplay loop into the cross-product improvement control plane.
- [x] Make the exact runner self-managing, hidden, checkpointed, resumable, and port-safe.
- [x] Add 3P canonical coverage and timeout, inventory-limit, and nightfall regression fixtures.
- [x] Publish terminal outcome taxonomy, outcome distribution, timeout rate, and deterministic trace hashes.
- [x] Make fun gates scenario-specific and expose pressure/recovery arcs without score saturation.
- [x] Pre-register experiment direction and minimum effect, then emit accepted/rejected/inconclusive decisions.
- [x] Keep previews, fixtures, generated scenarios, and archived evidence out of canonical memory and release scoring.
- [x] Publish architecture/evidence grades, scenario status, freshness, blockers, and executable next actions in `/simulator`.
- [x] Enforce strict project-level Oracle failure for missing, weak, blocked, or truth-gated evidence.
- [x] Scope the current grade to automated evidence; do not invent or require real-player observations.
- [x] Run the exact-engine 10-replicate matrix on a fresh local chain.
- [x] Run the timeout, inventory-limit, and nightfall boundary fixtures on their own exact regression path.
- [x] Make terminal outcomes reachable in every multiplayer canonical scenario, then clear all Oracle truth gates.
- [x] Refresh all six canonical exact matrices after controller source changes and clear source drift.
- [x] Bound Anvil state-history memory for long exact runs and classify chain-memory failures as infrastructure.
- [x] Pre-register and compare an artifact-extraction recovery/pacing experiment without changing evaluator weights. The six-turn terminal-intent candidate was rejected: it increased flat-turn rate and reduced artifact retention despite raising terminal completion.

## Deferred outside the current automated-only scope

- [ ] Record representative player sessions and calibrate automated judgments if real-player research is enabled later.
