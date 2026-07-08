# Escape Cost Preview Mechanic

## Objective

Turn Depart Pressure from an abstract meter into a visible wager. A player choosing between one more chart, one more dig, or departure should see what delay puts at risk: a clean escape, recovered value, crew safety, or the route itself.

## Sequential Implementation Checklist

1. Define the mechanic as Escape Cost Preview: a derived forecast that translates Depart Pressure into the likely cost of leaving late.
2. Add a helper at `app/src/lib/escapeCostPreview.js`.
3. Make the helper accept existing pressure context: `departPressure`, `players`, `activeInventory`, `location`, `landingSite`, `routeStatus`, `movePath`, `stats`, and `turnState`.
4. Return a structured object, not copy-only text: `level`, `label`, `costType`, `atRiskPlayer`, `atRiskItem`, `canEscape`, `headline`, `body`, `nextDelayWarning`, and `tone`.
5. Define cost levels: `clean`, `close`, `artifact-risk`, `crew-risk`, `route-collapse`, and `not-ready`.
6. Map Stable Route plus escape ready to `clean`.
7. Map Stretching Route plus escape ready to `close`.
8. Map Closing Route plus recovered value to `artifact-risk`.
9. Map Collapse Risk plus crew weakness to `crew-risk`.
10. Map Collapse Risk plus not at landing to `route-collapse`.
11. Pick `atRiskItem` from active artifact, relic, or hand items.
12. Pick `atRiskPlayer` from inactive, weakest, or lowest-stat crew where data exists.
13. Fall back cleanly when no item or player data exists: `The next delay risks the run itself.`
14. Add unit tests for every preview level.
15. Add tests for missing landing site, empty inventory, no players, and unknown stats.
16. Add tests proving the preview is deterministic.
17. Integrate `deriveEscapeCostPreview()` into `ExpeditionBench`.
18. Compute it immediately after `departPressure`.
19. Pass it into `MissionStatus`.
20. Pass it into `ChartDepartStrip`.
21. Pass it into `GuidedFirstTurn`.
22. Pass it into `UXStatusPanel` or extend guidance copy with it.
23. Pass it into `ActionPanel`.
24. Pass it into `GameOver`.
25. Update `ChartDepartStrip` so the Depart card shows the forecast consequence, not only readiness.
26. Let the Depart card show values such as `Artifact at risk` or `P3 at risk`.
27. Let the Depart card body explain the cost, such as `Leaving now is close. Waiting may put the Sun Compass on the line.`
28. Make the Depart card visually escalate by preview tone.
29. Keep Chart and Depart Pressure cards stable in size so labels do not shift layout.
30. Update `MissionStatus` body priority: if escape cost is severe, show the cost forecast before generic turn-state copy.
31. Use high-pressure objective copy such as `Collapse Risk 82. Depart now or P3 may be lost on escape.`
32. Update `UXStatusPanel` suggestion reason so high pressure names the exact cost.
33. Use suggestion copy such as `Depart now: Glass Idol at risk if the crew delays.`
34. Update `getBestActionSuggestion()` to consider escape cost.
35. If `costType === 'crew-risk'` and `canEscape`, suggest Flee.
36. If `costType === 'artifact-risk'` and `canEscape`, suggest Flee.
37. If `costType === 'route-collapse'` and not at landing, suggest Move.
38. If `costType === 'not-ready'` and at landing with no value, suggest Dig.
39. Update `getTurnGuidance()` to include cost preview in high-pressure states.
40. Update `getActionExplanation(Action.FLEE)` to use the cost preview.
41. Update the `ActionPanel` top stats row.
42. Replace or augment the current Pressure tile with Escape Cost.
43. Keep the pressure number visible, but make the cost label the human-facing headline.
44. Add a dedicated warning panel inside the Flee tab.
45. Flee tab should show Escape readiness, Projected cost, and What waiting risks.
46. Do not block Flee solely because the preview is severe.
47. Treat severe preview as costly, not disabled.
48. Keep actual action blocking limited to existing chain and action state.
49. Add an `EscapeCostPreview` micro-component if the UI repeats in multiple places.
50. Put it under `app/src/components/expedition/EscapeCostPreview.jsx` if reused by briefing and action console.
51. Make it accept `{ preview, compact = false }`.
52. Use compact mode for strip cards.
53. Use full mode for Flee/action panel.
54. Use existing border, tone, and font patterns.
55. Avoid a new visual style.
56. Add the full preview to `GameOver`.
57. Game-over report should say whether the final departure was Clean, Close, Costly, or Collapsed.
58. Include final cost target such as `No cost projected`, `Sun Compass was at risk`, `P3 was at risk`, or `Route collapse risk reached 100`.
59. Add share/report copy if applicable.
60. Update `growthLoop` to include escape cost in simulator summaries.
61. Add `escapeCost` or `escapeCostPreview` into event objects when action is Flee or pressure crosses threshold.
62. Use Depart Pressure plus artifacts and player counts to classify cost.
63. Update `fleeOutcomeFor()` to align with the same categories.
64. Avoid two separate vocabularies for cost in live client versus simulator.
65. Update `funLoop` titles and badges: Clean Departure, Artifact on the Line, Crew on the Line, Route Collapse.
66. Update `shareTextForRun()` to include cost for dramatic runs.
67. Use share copy such as `escaped with Glass Idol at risk` or `lost the route with 2 artifacts aboard`.
68. Update `scoreChallengeRun()` if needed.
69. Penalize collapse and high projected cost.
70. Reward clean escape with recovered value.
71. Add scenario tuning.
72. Confirm `escape-pressure-4p` starts in a state where the preview quickly becomes meaningful.
73. Confirm `solo-artifact-hunt` teaches artifact risk rather than crew risk.
74. Confirm `low-stat-recovery` teaches crew risk.
75. Update scenario hooks and premises if needed to mention the visible wager.
76. Update `publicRoutes.js` descriptions where pressure is now visible escape cost.
77. Update `seoConfig.js` only if the default pitch benefits from this.
78. Run `npm run seo:generate`.
79. Update Field Manual Overview.
80. Add a short section: Escape Cost Preview.
81. Explain that it is a forecast, not a guaranteed outcome.
82. Explain the categories: clean, close, artifact risk, crew risk, route collapse.
83. Update How To.
84. Replace vague watch-pressure copy with `Watch what the next delay puts at risk.`
85. Update Actions.
86. In Dig, mention that digging may move the forecast from artifact risk to crew risk.
87. In Flee, mention that Flee locks in the current forecast.
88. Add e2e assertion that the Field Manual contains `Escape Cost Preview`.
89. Add component test if a reusable component is created.
90. Add `escapeCostPreview.test.js`.
91. Add guidance tests if `uxGuidance` has test coverage or create one.
92. Add growth and fun tests for cost categories.
93. Run focused tests for `escapeCostPreview`, `departPressure`, `growthLoop`, and `funLoop`.
94. Run the full app tests.
95. Run the production build.
96. Run the SEO test.
97. Run SEO generation.
98. Run Playwright home and game specs.
99. Verify mobile layout does not overflow in ActionPanel and briefing cards.
100. Check copy length in the Depart card for long artifact names.
101. Check no new text overlap in desktop and mobile screenshots.
102. Scan for unfinished implementation markers across `app/src`, `app/e2e`, and `docs`.
103. Run `git diff --check`.
104. Review final diff for duplicate language.
105. Make sure Depart Pressure and Escape Cost Preview are distinct: Depart Pressure is the meter; Escape Cost Preview is the consequence.
106. Make sure the mechanic does not overpromise deterministic outcomes if the chain result still has randomness.
107. Use language like `at risk`, `likely`, `projected`, and `forecast`.
108. Avoid saying `will lose P3` unless the actual contract guarantees it.
109. Ensure the player always sees what pressure is, what it risks, and what action reduces or locks that risk.
110. Final acceptance bar: a first-time player who reaches Closing Route should immediately understand, without reading docs, exactly what waiting one more turn may cost.

## Acceptance Bar

The live client should make the cost of delay impossible to miss. Depart Pressure remains the meter, and Escape Cost Preview becomes the consequence layer that turns that meter into a concrete decision.
