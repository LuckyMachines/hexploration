# Depart Pressure Mechanic Implementation Plan

## Objective

Make the weakest part of the Chart & Depart loop mechanically real: the moment players decide whether one more reveal is worth making the route home harder.

## Mechanic Definition

Depart Pressure measures how close the expedition is to losing its route home. It rises as the crew spends turns, digs, overextends, carries value, or weakens. It falls through route-conscious movement, recovery, help, and stabilizing events.

Player-facing explanation:

> The deeper you chart, the more the route home degrades. Leave too early and the run is thin. Leave too late and the crew may not get out.

## Sequential Implementation Checklist

1. Define the mechanic internally as `Depart Pressure`.
2. Define the player-facing version around route degradation, recovered value, and leaving alive.
3. Define the design goal: every turn should ask whether one more reveal is worth making escape harder.
4. Keep first implementation derived and client-side where possible, avoiding contract churn.
5. Track conceptual values: `departPressure`, `routeStability`, `distanceToLanding`, `recoveredValue`, `escapeReadiness`, and `overextension`.
6. Use a simple 0-100 pressure scale.
7. Define pressure bands: Stable Route, Stretching Route, Closing Route, Collapse Risk.
8. Make pressure affect flee quality, movement/route guidance, event severity, failure risk, and UI warnings.
9. Raise pressure through turns, digging, moving deeper, low stats, danger, recovered value, and failed flee attempts.
10. Lower pressure through rest, help, moving home, camps, and stabilizing route events.
11. Make Flee outcomes pressure-sensitive.
12. Define Flee outcomes: clean escape, close escape, escape with loss, failed departure, route collapse.
13. Define outcome bands: low pressure is clean, middle pressure is close, high pressure risks loss, extreme pressure risks collapse.
14. Define recovered value as artifact, relic, survey progress, and surviving crew.
15. Add a run score concept that distinguishes thin escape, valuable escape, greedy collapse, and clean crew extraction.
16. Make leaving early mechanically valid but low value.
17. Make leaving late dramatically dangerous.
18. Add pressure to simulator and growth-loop state.
19. Update scenario starts with initial pressure and route stability.
20. Update growth action application with pressure deltas.
21. Make Move context-sensitive: deeper movement raises pressure; homeward movement lowers pressure.
22. Add action variants or strategy intents for moving deeper versus moving home in simulations.
23. Add strategies: greedy chart, early depart, balanced depart, panic flee, artifact greed.
24. Add scenario failure signals for missing depart decisions, irrelevant pressure, and degenerate strategies.
25. Add scenario success targets for route pressure and meaningful depart decisions.
26. Add fun-quality gates for depart decision, route pressure, escape payoff, and greed outcome.
27. Add recommendations when depart pressure is missing or untuned.
28. Update public run summaries with final pressure, escape quality, recovered value, and route-home status.
29. Update share text to mention pressure and escape quality.
30. Add unit tests for pressure math.
31. Add scenario tests for greedy, cautious, balanced, recovery-first, and flee-rush strategies.
32. Tune outcomes so greedy has higher value and higher loss, early depart has higher survival and lower score, balanced has best expected score, and recovery improves survival.
33. Add active UI field for Depart Pressure.
34. Add route-home indicator.
35. Add escape readiness indicator.
36. Add pressure tone colors.
37. Update ActionPanel Flee tab with readiness, pressure band, expected outcome, and missing requirements.
38. Keep internal `FLEE` stable and avoid renaming contract/action enums.
39. Add "why not flee yet?" copy.
40. Add "why leave now?" copy.
41. Update GuidedFirstTurn with the pressure idea.
42. Update Field Manual with a Depart Pressure section.
43. Update SectionActions for pressure effects.
44. Update MissionStatus with chart/recover/head-home/flee guidance.
45. Add pressure-sensitive heuristics to `uxGuidance`.
46. Add pressure to fun telemetry.
47. Add barks and event cards tied to route closing and departure windows.
48. Update share-card/run summary stats where local share data exists.
49. Update growth report scoring with depart timing, greed, escape drama, and route pressure.
50. Update marketing readiness checks if they assert first-play mechanics.
51. Derive pressure first from existing state: day/phase, stats, location, landing site, inventory, route, events.
52. Add tests for derived pressure.
53. Integrate derived pressure into ExpeditionBench.
54. Integrate pressure into ActionPanel and suggestions.
55. Integrate pressure into GameOver.
56. Annotate replay where available.
57. Tune Solo Artifact Hunt as the tutorial.
58. Tune Escape Pressure 4P as the multiplayer proof.
59. Tune Low Stat Recovery as the recovery counterpoint.
60. Add scenario acceptance thresholds.
61. Run simulation batches and compare strategies.
62. Fix degenerate outcomes: always dig, always flee, rest/help never worth it, pressure irrelevant.
63. Add Playwright coverage for pressure visibility.
64. Add unit tests for pressure-sensitive guidance.
65. Run old-copy and placeholder scans.
66. Regenerate SEO artifacts.
67. Run build, unit tests, SEO tests, and focused Playwright specs.
68. Manual playtest first run, greedy run, cautious run, and recovery run.
69. Write final implementation report.
70. Commit in logical chunks if the change is large.
71. Deploy and verify live first-play behavior.

## Acceptance Bar

A new player should be able to say:

> I pushed one tile too far, barely got back, and now I understand the game.

The implementation is not complete unless the first run exposes the depart decision as a real mechanic, not just copy.
