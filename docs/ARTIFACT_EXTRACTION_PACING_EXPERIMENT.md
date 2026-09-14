# Artifact Extraction Pacing Experiment

## Decision

Reject the six-turn terminal-intent candidate. Keep the current four-turn synthetic-player policy.

This is a simulator-policy calibration result, not evidence about human comprehension and not a deployed gameplay-rule change.

## Pre-registration

- Experiment: `artifact-extraction-earlier-intent`
- Scenario: `artifact-extraction-2p`
- Baseline: `terminalIntentWindowTurns = 4`
- Candidate: `terminalIntentWindowTurns = 6`
- Primary metric: paired flat-turn rate, decrease
- Minimum effect: 0.05
- Sample: 10 matched seeds for each of `risky`, `balanced`, and `move` (30 paired runs)
- Evaluator: unchanged `simulator.evaluation.json`

## Result

| Measure | Baseline | Candidate | Change |
| --- | ---: | ---: | ---: |
| Flat-turn rate | 1.48% | 4.72% | +3.24 points |
| Terminal rate | 93.33% | 100.00% | +6.67 points |
| Artifact frequency | 1.00 | 0.67 | -0.33 |
| Meaningful choice density | - | - | -0.49 points |
| Invalid attempts | - | - | -0.13 per run |

The paired flat-turn delta was `+0.0324`, with a 95% confidence interval of `[-0.0356, 0.1004]`. Because the candidate moved the primary metric in the wrong direction, the pre-registered decision is `rejected`. The increase in terminal completion does not justify the loss in artifact retention or the worse pacing signal.

## Evidence integrity

- 30/30 seed pairs matched.
- Baseline and candidate evaluator hashes matched.
- Policy hashes differed as intended.
- Both exact-engine runs passed on fresh hidden local chains.
- No evaluator weights changed.

Durable machine-readable evidence lives in `reports/simulator/experiments/artifact-extraction-earlier-intent/`.

## Product interpretation

Earlier forced extraction is not the right automated-policy adjustment. The stronger next hypothesis is a readable recovery or return-route affordance that preserves the artifact decision instead of making synthetic players flee sooner. That needs its own pre-registration before implementation or measurement.
