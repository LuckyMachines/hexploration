# Gameplay Improvement System Report Card

## Snapshot 1 - Baseline (2026-09-08)

Overall: **B-**

| Category | Grade | Evidence | Stricter A bar |
| --- | --- | --- | --- |
| Evidence truth | C+ | Oracle could report strong-pass from one run per strategy, partial setup, and no terminal run. Aggregate averages counted as an outcome. | Setup, terminal-outcome, trace, replicate, and seed gates constrain every verdict. |
| Experiment integrity | C | Agent behavior and evaluator weights shared one mutable file; autotune could improve its scorer. | Evaluator is immutable during an experiment; candidates use 10+ same-seed pairs and report variance/effect size. |
| Scenario coverage | C | Two core scenarios covered only one- and four-player artifact/escape play. | 1P, 2P, and 4P scenarios cover exploration, reward/risk, help/recovery, extraction, failure recovery, and return continuity. |
| Metric quality | B- | `validChoiceCount > 1` stood in for meaningful choice. | Choice breadth/entropy is combined with visible consequence evidence. |
| Evidence hygiene | C+ | Generated `autopilot-test-*` fixtures could become production fun blockers. | Only active, production-eligible scenarios affect release scoring. |
| Orchestration/freshness | C | Fresh simulator/Oracle evidence coexisted with months-old feeling, lab, tutor, bridge, and fun outputs. | One dependency-aware command refreshes the graph and hashes every source/output. |
| Human calibration | C | No representative observed player sessions are recorded. | Five or more sessions calibrate automated recommendations against comprehension and delight. |
| Learning effectiveness | C+ | Decisions existed, but experiment resolution, false positives, regressions caught, and time-to-learning were not reported together. | The system publishes resolution and calibration metrics after every refresh. |

## Snapshot 2 - Implemented system (2026-09-08)

Overall: **B current evidence / A- architecture**

Implemented:

- Oracle truth gates for setup fidelity, terminal outcomes, independent runs, and distinct seeds.
- Separated synthetic-player policy from the immutable evaluation rubric.
- Ten-replicate paired experiment comparison with confidence intervals, effect size, and regression guardrails.
- Expanded canonical scenario matrix across 1P, 2P, and 4P loop families.
- Consequence-aware choice breadth and entropy metrics.
- Production evidence filtering for generated fixtures.
- Dependency-aware `gameplay:refresh`, source hashes, freshness checks, and a strict doctor.
- Effectiveness and human-calibration reporting without inventing player evidence.

## A bar, stricter

An A requires all automated checks to stay current and five recent representative sessions to show at least 60% agreement between automated recommendations and observed player problems. A strong gameplay claim additionally requires terminal outcomes and 10 independent same-seed comparisons per strategy. No generated fixture may affect a production release verdict.

For a human-calibrated evaluation mode, the honest ceiling remains A- until real-player calibration exists.

The pre-hardening evidence grade remained B until the new 10-replicate exact-engine matrix could be run. Existing runs were correctly relabeled underpowered, and the unfinished escape run was blocked rather than presented as a strong pass.

## Snapshot 3 - Automated-only hardening (2026-09-09)

Overall: **B+ evidence readiness / A architecture** after the full exact matrix.

- The quality contract now explicitly grades automated evidence only; human sessions are deferred, not fabricated.
- The self-managed exact runner launches a hidden local stack, selects a safe port, checkpoints work, resumes valid runs, classifies failures, and always cleans up.
- Canonical coverage now spans 1P, 2P, 3P, and 4P play plus all required loop families.
- Boundary regression fixtures cover timeout, inventory limit, and nightfall chokepoints.
- Outcomes are explicit and report terminal rate, timeout rate, distributions, confidence intervals, and deterministic trace hashes.
- Fun judgments use scenario-specific payoff, pressure, and recovery gates with better-calibrated arc scores.
- Auto-tuning can change only synthetic-player action policy; the evaluation rubric remains fixed.
- The simulator dashboard exposes grades, evidence status, freshness, and the next executable action.
- All six canonical scenarios completed their 10-run-per-strategy exact-engine matrices. Four multiplayer scenarios still reached only the turn limit, so Oracle correctly keeps their terminal truth gates blocked.
- All three boundary fixtures passed on their isolated exact regression path without replacing the canonical report.
- The derived feeling-analysis overflow exposed by the larger reports was fixed with a bounded 30 MB orchestration buffer.
- Measured exact-run durations informed a 60-minute default per-scenario ceiling; successful scenario checkpoints prevent unnecessary reruns.

The automated A bar is: all six canonical scenarios have fresh 10-replicate exact-engine evidence, every Oracle truth gate passes, every derived stage is fresh, and the experiment/evidence-integrity checks remain green.

## Snapshot 4 - Current exact evidence (2026-09-14)

Overall: **A automated evidence / A architecture**.

- All six canonical scenarios have current exact-engine evidence with ten distinct seeds per strategy.
- Every Oracle truth gate passes; the strict gameplay doctor reports A with no blockers or source drift.
- The three-player regroup scenario improved from a 76.7% to an 80% terminal rate and remains strong-pass eligible.
- Artifact extraction has a 90% terminal rate and passes every global target, but its experience verdict is honestly retained as mixed because one pattern produced a four-turn flat extraction window. Recovery and pacing remain the next focused experiment; no evaluator threshold was weakened to hide this result.
- Long exact runs can opt into bounded Anvil state-history retention. This removed an infrastructure memory failure without changing contracts, seeds, policies, receipts, or evaluation gates.
- HTTP/RPC and Anvil memory failures are now classified as retryable infrastructure rather than gameplay defects.
