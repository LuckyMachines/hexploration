# Scenario Time Machine Implementation Plan

Scenario Time Machine shows how each authored scenario changes over time: what improved, what regressed, what stayed blocked, which change likely caused the movement, and what the next useful experiment should be.

## Sequential Implementation List

1. Define the core promise: for any scenario, show how gameplay evidence changed over time and what likely caused the change.
2. Save this implementation plan in `docs/scenario-time-machine-implementation-plan.md`.
3. Add user documentation in `docs/scenario-time-machine.md`.
4. Define the Time Machine data model: scenario id, generated timestamp, source evidence, report path, simulator metrics, Oracle metrics, setup metrics, Autopilot metrics, auto-tune metrics, memory findings, trend state, comparisons, recommendations, and citations.
5. Add `scripts/scenario-time-machine-utils.mjs`.
6. Add `scripts/scenario-time-machine.mjs`.
7. Add `scripts/scenario-time-machine-utils.test.mjs`.
8. Add package scripts: `time-machine`, `time-machine:build`, `time-machine:scenario`, `time-machine:compare`, `time-machine:latest`, `time-machine:doctor`, and `time-machine:test`.
9. Reuse Playable Design Memory as the primary evidence index.
10. Fall back to building memory with raw events when the latest snapshot does not include raw evidence.
11. Convert memory events into timeline points.
12. Extract simulator metrics: life score, flat turn rate, alive turn rate, invalid attempts, artifacts, revealed zones, zero-stat players, target pass rate, and top fun issue.
13. Extract Oracle metrics: weighted score, confidence, verdict, weakest dimension, strongest dimension, gate pass/fail, and smallest next experiment.
14. Extract setup metrics: setup level, applied count, skipped count, failed count, blocked fields, and setup fidelity score.
15. Extract Autopilot metrics: selected change, mode, final verdict, baseline score, final score, score delta, accepted/rejected, and rejected reasons.
16. Extract auto-tune metrics: winner, candidate count, rejected count, winner score, and recommendation.
17. Compute an explainable composite health score per point.
18. Penalize low confidence, weak setup fidelity, flat turns, invalid attempts, zero-stat collapse, failed gates, and rejected regressions.
19. Sort and deduplicate timeline points.
20. Compute adjacent deltas.
21. Compute latest vs previous, first, best, and last-good comparisons.
22. Detect best known version.
23. Detect last good version.
24. Detect biggest improvement.
25. Detect biggest regression.
26. Infer likely causes from nearby Autopilot, auto-tune, setup, and Oracle events.
27. Label causes as inferred.
28. Generate "what changed", "what got better", "what got worse", and "what remains blocked" summaries.
29. Generate next best experiment recommendations.
30. Prefer setup repair when setup fidelity blocks confidence.
31. Prefer evidence capture when simulator or Oracle data is missing.
32. Prefer Autopilot when enough evidence exists and a weak dimension is clear.
33. Prefer compare reruns when latest evidence is stale or noisy.
34. Prefer rollback/revisit when latest regresses from last good.
35. Add compare modes: previous, first, best, last-good, and explicit point ids.
36. Write scenario reports to `reports/simulator/time-machine/<scenario-id>/latest-report.json`.
37. Write scenario Markdown to `reports/simulator/time-machine/<scenario-id>/latest-report.md`.
38. Write a project index to `reports/simulator/time-machine/index.json`.
39. Write public UI copies under `app/public/simulator/time-machine/`.
40. Keep all generated outputs ignored.
41. Add Markdown report generation.
42. Add doctor checks for missing memory, missing simulator evidence, missing Oracle evidence, duplicate timestamps, stale latest evidence, setup fidelity below requirement, dry-run-only Autopilot plans, accepted changes without later verification, best version older than latest, and latest regression without a follow-up recommendation.
43. Add unit tests for normalization, timeline sorting, dedupe, metric extraction, setup fidelity, trend detection, best/last-good detection, regression detection, cause inference, compare modes, recommendations, Markdown, and doctor output.
44. Add a `/simulator` Scenario Time Machine panel.
45. Fetch `/simulator/time-machine/index.json` and `/simulator/time-machine/<scenario-id>/latest-report.json`.
46. Show an empty state with `npm run time-machine:scenario -- --id=<scenario-id>`.
47. Show trend badge, current score, confidence, setup fidelity, weakest dimension, best known version, last good version, biggest regression, inferred cause, top next action, and citations.
48. Add Playwright coverage for panel rendering without a report.
49. Update README, gameplay simulator docs, Playable Design Memory docs, and Scenario Autopilot docs.
50. Keep Time Machine read-only.
51. Run focused tests and checks.
52. Commit as `Add scenario time machine`.
