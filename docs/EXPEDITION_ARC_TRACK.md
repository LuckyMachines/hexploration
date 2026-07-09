# Expedition Arc Track

## Objective

Make the expedition read as a complete run with a beginning, middle, and end. The Arc Track names the current chapter of Chart & Depart so the player knows whether this is a survey turn, a greed decision, a departure opportunity, a redline save, or the final call.

## Design Rule

The Arc Track is the run-level read. It should not replace action guidance, aftermath, or board traits; it should explain what kind of decision the player is making now.

## Sequential Implementation Checklist

1. Define the feature as Expedition Arc Track.
2. Keep the first pass deterministic and client-derived.
3. Avoid contract changes.
4. Add `app/src/lib/expeditionArc.js`.
5. Define arc IDs: `survey`, `greed-window`, `departure-window`, `redline`, and `final-call`.
6. Define arc object shape: `id`, `label`, `tone`, `priority`, `summary`, `playerQuestion`, `directive`, `thresholds`, `progress`, `nextThreshold`, and `reasons`.
7. Export `EXPEDITION_ARC_IDS`.
8. Export `ARC_DEFINITIONS`.
9. Export `deriveExpeditionArc(context)`.
10. Export `arcToneClass(arc)`.
11. Use priority order: Final Call, Redline, Departure Window, Greed Window, Survey.
12. Compute shared context: pressure, route stability, recovered value, distance to landing, flee readiness, cost type, trait category, critical crew count, revealed count, and visible opportunity.
13. Define Survey as the fallback chapter.
14. Survey threshold: low revealed count or no recovered value, pressure below 35, and flee unavailable.
15. Greed Window threshold: pressure 35-54, visible opportunity, or value/reveal trait while flee is not available unless value is missing.
16. Departure Window threshold: recovered value, near landing or stable route, pressure below 70, and clean/close/artifact-risk/not-ready cost.
17. Redline threshold: pressure 70 or higher, route stability below 35, crew-risk or route-collapse cost, or critical crew.
18. Final Call threshold: can flee with risk cost, pressure 85 or higher, at landing with recovered value, or next delay warning names a concrete loss.
19. Track reasons for every selected chapter.
20. Add progress fields: pressure, value, route, crew, and chart.
21. Clamp progress values to 0-100.
22. Add human-readable next threshold copy for each chapter.
23. Add `app/src/lib/expeditionArc.test.js`.
24. Test Survey fallback.
25. Test Greed Window from pressure.
26. Test Greed Window from trait opportunity.
27. Test Departure Window from value plus near landing.
28. Test Redline from pressure.
29. Test Redline from crew-risk.
30. Test Final Call from landing with value.
31. Test Final Call priority over Greed Window.
32. Test Redline priority over Departure Window.
33. Test progress clamping.
34. Test reasons include the expected trigger.
35. Add `app/src/components/expedition/ExpeditionArcTrack.jsx`.
36. Render current chapter, summary, directive, player question, and next threshold.
37. Add chapter pips in order: Survey, Greed, Depart, Redline, Final.
38. Highlight the current chapter.
39. Show previous chapters as muted filled pips.
40. Show future chapters as empty pips.
41. Add compact progress meters: Chart, Value, Route, Crew.
42. Keep copy short.
43. Add accessible labels.
44. Add `ExpeditionArcTrack.test.jsx`.
45. Test chapter label renders.
46. Test next threshold renders.
47. Test pips render in order.
48. Wire `deriveExpeditionArc` into `ExpeditionBench`.
49. Compute revealed count from revealed map.
50. Compute crew critical count from enriched players.
51. Compute visible opportunity from recovered value, visible tile traits, and value/reveal categories.
52. Render `ExpeditionArcTrack` directly under `MissionStatus`.
53. Keep `ChartDepartStrip` below it.
54. Pass `expeditionArc` into `GuidedFirstTurn`.
55. Pass `expeditionArc` into `TurnResolution`.
56. Update `AftermathMoment` to show current run chapter.
57. Pass `expeditionArc` into `ActionPanel`.
58. Add a compact Run Chapter card inside action context.
59. Update `getTurnGuidance` to accept `expeditionArc`.
60. Let Final Call guidance lead unless route is invalid.
61. Let Redline guidance mention cost reduction.
62. Let Departure Window guidance ask whether current value is enough.
63. Let Greed Window guidance frame payoff against route home.
64. Let Survey guidance push reveal and route readability.
65. Update `funTelemetry` to include arc-aware barks and named moments.
66. Update `growthLoop` to derive an arc for simulated turns.
67. Store `expeditionArc` on each growth event.
68. Add arc counts to run summaries.
69. Add run title support for Greed Window, Redline, Final Call, and clean departure arcs.
70. Add badge support for Surveyor, Greed Window, Departure Read, Redline Survivor, and Final Call.
71. Add share text support for the strongest arc reached.
72. Update `GameOver` to show final arc reached.
73. Show strongest chapter transition in GameOver.
74. Show whether the crew departed before or after Final Call.
75. Update `MissionStatus` copy to avoid duplicating chapter language.
76. Update Field Manual with an Expedition Arc section.
77. Explain each chapter in one sentence.
78. Update How To steps to read the current chapter and follow its directive.
79. Add e2e assertion that Field Manual contains Expedition Arc.
80. Run focused unit tests.
81. Run component tests.
82. Run full unit suite.
83. Run production build.
84. Run SEO validation and generation if public copy changed.
85. Run Playwright home and game specs.
86. Run visual Playwright spec.
87. Scan for unfinished implementation markers.
88. Run `git diff --check`.
89. Review briefing stack order: MissionStatus, ExpeditionArcTrack, ChartDepartStrip, GuidedFirstTurn, EscapeCostPreview, TraitPreview, CostReductionActions.
90. Review mobile layout for wrapping and height.
91. Ensure Arc Track does not block the action console.
92. Ensure Arc Track does not hide the board's first viewport.
93. Ensure copy does not overpromise deterministic outcomes.
94. Ensure arc changes are explainable from visible data.
95. Ensure Final Call cannot be masked by Greed Window.
96. Ensure Redline cannot be masked by Departure Window.
97. Ensure Survey appears early enough to teach the run.
98. Ensure Departure Window appears before players are already doomed.
99. Ensure GameOver can tell whether the run ended clean, late, or too greedy.
100. Acceptance: a player can identify the current chapter in under two seconds.
101. Acceptance: the current chapter tells the player what kind of decision this is.
102. Acceptance: the chapter changes when pressure, value, route, crew, or cost crosses a meaningful threshold.
103. Acceptance: the whole expedition reads as a beginning, middle, and end, not only a sequence of good turns.

## Completion Snapshot

Implemented in this pass:

- Pure Expedition Arc helper with Survey, Greed Window, Departure Window, Redline, and Final Call thresholds.
- Focused arc tests for fallback, priority, progress clamping, and trigger reasons.
- Expedition Arc Track UI with chapter pips, directive, decision question, next threshold, and progress meters.
- ExpeditionBench wiring under MissionStatus and above ChartDepartStrip.
- Arc-aware Guided First Turn, Turn Resolution aftermath, Action Console context, and turn guidance.
- Arc-aware fun telemetry barks, growth event metadata, growth summaries, run titles, badges, and share text.
- GameOver final arc, chapter path, and before/after Final Call timing.
- Field Manual and How To copy for Expedition Arc.
- E2E manual assertion for Expedition Arc.

Verification completed:

- Focused arc, aftermath, fun, growth, and action tests.
- Full unit suite.
- Production build.
- SEO validation and generation.
- Playwright home and game specs.
- Visual Playwright spec.
- Marker scan.
- Whitespace check.
