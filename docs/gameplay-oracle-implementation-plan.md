# Gameplay Oracle Implementation Plan

The Gameplay Oracle is the project-level design partner for the simulator. Its job is:

> Given a scenario run, determine whether the intended player experience happened, explain why, and recommend the smallest useful next change.

## Sequential Implementation Checklist

1. Define the Oracle's job in one sentence.
2. Add `docs/gameplay-oracle.md`.
3. Define the core Oracle questions: design intent, agency, readability, tension, earned outcomes, system interaction, and smallest next change.
4. Create `scripts/gameplay-oracle.mjs`.
5. Add npm scripts: `oracle:run`, `oracle:scenario`, `oracle:pack`, `oracle:project`, `oracle:latest`, `oracle:doctor`, `oracle:ci`, and `oracle:test`.
6. Create `scripts/gameplay-oracle-utils.mjs`.
7. Define an Oracle report schema with source path, scenario id, design question, verdict, confidence, experience scores, evidence, diagnosis, recommendations, smallest experiment, risks, gates, trend, and telemetry gaps.
8. Add verdict levels: `strong-pass`, `pass`, `mixed`, `weak`, `fail`, and `blocked`.
9. Add experience dimensions: agency, readability, tension, surprise, recovery, system integration, replayability, pacing, emotional texture, and outcome legibility.
10. Define deterministic `0-100` rubrics for every score.
11. Start deterministic and local, without an LLM dependency.
12. Score agency from meaningful choice density, valid action variety, repeated actions, idle/rest share, and turns with multiple plausible actions.
13. Score readability from invalid attempts, skipped turns, no-delta turns, action/result mismatch signals, and explanation coverage.
14. Score tension from stat pressure, zero-stat risk, flee pressure, spike turns, late-run danger, and recovery opportunities.
15. Score surprise from card draws, terrain reveals, artifact events, event variety, and outcome swings.
16. Score recovery from rest/help actions, stat comeback events, post-danger survival, and regained options.
17. Score system integration from movement, cards, inventory, stats, artifacts, terrain, multiplayer, and scenario tag evidence.
18. Score replayability from strategy variation, batch variation, alternate viable paths, and non-identical discoveries.
19. Score pacing from first meaningful event, flat streaks, climax timing, ending state, and life curve.
20. Score emotional texture by classifying turns as quiet, curious, pressured, dangerous, triumphant, confused, or flat.
21. Score outcome legibility from clear final causes, decisive turns, and traceable escape/collapse/artifact outcomes.
22. Add `oracleWeights` to `simulator.tuning.json`.
23. Allow scenarios to override Oracle goals.
24. Add default Oracle goals to scenario normalization.
25. Implement `evaluateOracle(report, scenario, config)`.
26. Produce all experience scores with traceable evidence.
27. Add `findDecisiveTurns(report)`.
28. Add decisive turn types: first meaningful choice, first danger spike, first discovery, first recovery, first artifact, escape attempt, collapse point, and flat streak start.
29. Add `classifyTurnExperience(turn)`.
30. Add `classifyRunArc(run)`.
31. Compare scenario intent with observed experience.
32. Add deterministic diagnosis templates.
33. Add `recommendSmallestExperiment`.
34. Recommend one primary change, with optional supporting alternatives.
35. Rank experiments by impact, cost, risk, and directness.
36. Add recommendation fields: title, why, change type, target files, expected metric movement, risk, and verification command.
37. Add regression risks.
38. Add `oracle:latest` to evaluate `reports/simulator/latest-report.json`.
39. Add `oracle:scenario -- --id=<scenario>`.
40. Add `oracle:pack -- --pack=<pack>`.
41. Add `oracle:run` to run the simulator and then evaluate.
42. Write Oracle outputs to `reports/simulator/oracle/` and `app/public/simulator/oracle/`.
43. Write scenario Oracle outputs to `reports/simulator/scenarios/<id>/latest-oracle.json`.
44. Add Oracle history entries.
45. Add trend comparison against prior Oracle runs.
46. Add regression gates.
47. Add CLI options: `--gate`, `--baseline`, `--json`, `--markdown`, `--next-only`, `--write-tasks`, `--no-run`, `--run`, `--max-scenarios`, `--timeout-ms`, and `--continue`.
48. Add Markdown report output.
49. Add `OraclePanel` to `/simulator`.
50. Add score bars, decisive turns, run arc, recommendation, risks, confidence, and empty states.
51. Add Oracle history UI.
52. Enrich Scenario Designer cards with Oracle verdicts when available.
53. Add UI loading and error handling.
54. Add E2E assertions for Oracle empty and loaded states.
55. Add `scripts/gameplay-oracle-utils.test.mjs`.
56. Add minimized Oracle fixtures.
57. Add tests for scoring, turn classification, run arc classification, decisive turns, recommendation ranking, gates, and scenario-specific goals.
58. Add `normalizeReportForOracle` for older reports.
59. Add confidence scoring and telemetry gaps.
60. Add `blocked` verdict for unsupported or missing evidence.
61. Merge Oracle recommendations into simulator tasks.
62. Add `scenario.importance`.
63. Add pack and project-level summaries.
64. Detect common failure patterns across scenarios.
65. Add `projectLevelRecommendation`.
66. Document daily tuning workflows, interpretation, examples, and limitations.
67. Run bounded verification: Oracle tests, scenario tests, scenario validation, build, app tests, and focused E2E.
68. Try one live scenario if local stack deploy completes.
69. Commit as `Add gameplay oracle evaluation loop`.
70. Confirm a clean repo.
