# Player Feeling Black Box Implementation Plan

Player Feeling Black Box turns simulator and playtest evidence into a per-turn felt experience timeline. It explains what each turn probably felt like to a player, why, and where the game became exciting, confusing, tense, dead, unfair, hopeful, or memorable.

## Sequential Implementation List

1. Define the core promise: turn simulator and playtest evidence into a per-turn felt experience timeline.
2. Name the system `Player Feeling Black Box`.
3. Add plan doc: `docs/player-feeling-black-box-implementation-plan.md`.
4. Add user docs: `docs/player-feeling-black-box.md`.
5. Treat it as a read-only analysis layer above the exact-engine simulator.
6. Reuse simulator reports as primary turn data.
7. Reuse Gameplay Oracle scores for validation.
8. Reuse Playable Design Memory so feeling evidence becomes queryable.
9. Reuse Scenario Time Machine so emotional arcs can be compared.
10. Reuse Scenario Lab Notebook so beliefs include felt evidence.
11. Reuse Scenario Self-Driving Tutor so lessons target feeling failures.
12. Define feeling labels: `alive`, `tense`, `confusing`, `flat`, `hopeful`, `payoff`, `panic`, `recovery`, `dead-end`, `friction`, `surprise`, and `setup-doubt`.
13. Define feeling polarities: `positive`, `negative`, `mixed`, and `neutral`.
14. Define feeling intensities: `low`, `medium`, and `high`.
15. Define per-turn feeling event schema.
16. Define run-level emotional arc schema.
17. Define arc shapes: `rising`, `falling`, `spiky`, `flatline`, `recovery`, `payoff-then-drift`, `panic-loop`, and `uncertain`.
18. Define output folders under `reports/simulator/feeling-black-box/` and `app/public/simulator/feeling-black-box/`.
19. Write project index JSON and public index JSON.
20. Write latest run JSON and public latest run JSON.
21. Write per-scenario JSON and public per-scenario JSON.
22. Write Markdown summaries beside JSON reports.
23. Add utility module `scripts/player-feeling-black-box-utils.mjs`.
24. Add CLI `scripts/player-feeling-black-box.mjs`.
25. Add tests `scripts/player-feeling-black-box-utils.test.mjs`.
26. Add package scripts: `feel`, `feel:latest`, `feel:scenario`, `feel:index`, `feel:doctor`, and `feel:test`.
27. Implement source report loading from latest, scenario latest, and explicit file paths.
28. Implement turn evidence normalization for single-run and batch reports.
29. Implement before/after state diffing.
30. Implement deterministic feeling classification.
31. Implement confidence scoring.
32. Implement control feel notes, including idle and waiting states.
33. Implement agency, friction, and life-pulse scoring.
34. Implement timeline construction.
35. Implement label, polarity, and intensity mix summaries.
36. Implement best, worst, confusing, agency, friction, recovery, and payoff moment detection.
37. Implement arc shape detection.
38. Implement arc score computation.
39. Implement feeling improvement recommendations.
40. Implement full report building.
41. Implement project index building.
42. Implement JSON and Markdown writers.
43. Implement doctor checks.
44. Integrate feeling reports into Playable Design Memory.
45. Integrate feeling arc score into Scenario Time Machine.
46. Integrate latest feeling evidence into Scenario Lab Notebook.
47. Integrate feeling lessons into Scenario Self-Driving Tutor.
48. Add `/simulator` Player Feeling Black Box panel.
49. Add Playwright coverage.
50. Update README and system docs.
51. Run focused tests and CLI smoke.
52. Generate ignored UI outputs.
53. Run app build and focused Playwright.
54. Scan changed files for unfinished markers.
55. Run whitespace checks.
56. Stage only source and docs.
57. Commit as `Add player feeling black box`.
58. Confirm tracked repo is clean.
