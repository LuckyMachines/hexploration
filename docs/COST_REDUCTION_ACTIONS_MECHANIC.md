# Cost Reduction Actions Mechanic

## Objective

Every Escape Cost Preview warning should show the player what they can do about it this turn. The forecast names the risk; Cost Reduction Actions name the counterplay.

## Design Rule

Every cost forecast must answer three questions: what is at risk, why it is at risk, and what the player can do about it this turn.

## Sequential Implementation Checklist

1. Define the feature as Cost Reduction Actions.
2. Extend the existing `escapeCostPreview` object with a `mitigations` array.
3. Structure each mitigation with `id`, `label`, `action`, `priority`, `available`, `reason`, `effect`, `requirement`, and `tone`.
4. Define mitigation IDs: `depart-now`, `return-to-landing`, `recover-value`, `secure-artifact`, `help-weakest`, `rest-crew`, `regroup`, `stabilize-route`, `stop-digging`, and `keep-charting-carefully`.
5. Map `clean` to `depart-now` and `keep-charting-carefully`.
6. Map `close` to `depart-now`, `return-to-landing`, and `stop-digging`.
7. Map `artifact-risk` to `depart-now`, `secure-artifact`, and `return-to-landing`.
8. Map `crew-risk` to `depart-now`, `help-weakest`, `rest-crew`, and `regroup`.
9. Map `route-collapse` to `return-to-landing`, `stabilize-route`, and `depart-now` only when escape is ready.
10. Map `not-ready` to `recover-value` when at landing without value, `return-to-landing` when away from landing, and `regroup` when crew is weak.
11. Treat real actions as Flee, Move, Dig, Rest, and Help.
12. Treat guidance-only mitigations as stop digging, return to landing, regroup, secure artifact, stabilize route, and keep charting carefully.
13. Map guidance-only mitigations back to concrete actions where possible.
14. Keep this pass client-derived, matching Depart Pressure and Escape Cost Preview.
15. Add helper functions in `escapeCostPreview.js`: `mitigationsForPreview()`, `rankMitigations()`, and `bestMitigationForPreview()`.
16. Add optional context for mitigation availability: `movement`, `activeTab`, `movePath`, `routeStatus`, `stats`, `players`, `activeInventory`, and `departPressure`.
17. Mark `depart-now` available when `preview.canEscape`.
18. Mark `return-to-landing` available when distance to landing is greater than zero and movement is greater than zero.
19. Mark `recover-value` available when the crew is at landing and has no recovered value.
20. Mark `secure-artifact` available when recovered value exists and escape is ready.
21. Mark `help-weakest` available when a weak or inactive player exists and there is more than one player.
22. Mark `rest-crew` available when current player stats are low.
23. Mark `regroup` available when crew weakness exists or pressure is severe.
24. Mark `stabilize-route` available when route is invalid, pressure is high, movement is available, or route stability is low.
25. Mark `stop-digging` available when active risk is artifact, crew, or collapse and the selected action is Dig or a Dig would worsen the forecast.
26. Add human-readable effects for each mitigation.
27. Add unit tests for mitigation mapping by preview level.
28. Add unit tests for availability by state.
29. Add a fallback mitigation when no direct mitigation is available.
30. Add tests proving `bestMitigationForPreview()` is deterministic.
31. Update `deriveEscapeCostPreview()` to include mitigations.
32. Keep existing preview fields stable.
33. Update `getBestActionSuggestion()` to prefer the top available mitigation when cost is severe.
34. Map mitigation actions to real tabs only when they represent Flee, Move, Rest, Help, or Dig.
35. Update suggestion reason to include mitigation effect.
36. Update `getTurnGuidance()` to mention the top mitigation when pressure is high.
37. Update `getActionExplanation()` so Flee, Move, Rest, Help, and Dig display their cost effect.
38. Create a reusable `CostReductionActions.jsx` component.
39. Make the component accept `preview`, `onAction`, `compact`, and `activeAction`.
40. Render up to three mitigations.
41. Show mitigation label, mapped action, effect, and availability.
42. Include a small action button only when mitigation maps to a real action.
43. Show requirement instead of a button when unavailable.
44. Use existing UI tone classes.
45. Keep compact mode suitable for the turn briefing.
46. Add full mode inside the ActionPanel Flee tab.
47. Add compact mode under Escape Cost Preview in the turn briefing.
48. Wire `onAction` in `ExpeditionBench` to `setActiveTab`.
49. For Move mitigation, set active tab to Move.
50. For Flee mitigation, set active tab to Flee.
51. For Rest mitigation, set active tab to Rest.
52. For Help mitigation, set active tab to Help.
53. For Dig mitigation, set active tab to Dig.
54. Update ActionPanel to pass `onTabChange` into the reduction component.
55. Update Flee tab to show Reduce this cost.
56. Update action context details to show Best reduction.
57. Update MissionStatus to include top mitigation in severe pressure copy.
58. Update UXStatusPanel so the suggestion button uses mitigation labels when applicable.
59. Update GuidedFirstTurn to tell players to pick the reduction action or depart.
60. Update Field Manual Overview with a Cost Reduction Actions section.
61. Explain that every forecast has counterplay: leave, move home, recover value, rest, help, or stop digging.
62. Update Field Manual How To with a step about choosing the listed reduction action unless intentionally gambling.
63. Update Field Manual Actions so each action states how it can reduce or worsen cost.
64. Update e2e field manual assertion to include Cost Reduction Actions.
65. Update growth simulator event text when pressure is high.
66. Add mitigation metadata to simulator events.
67. Give matched mitigation a small agency or life-pulse bonus.
68. Add pressure or friction when severe mitigation is ignored and the player digs anyway.
69. Update fun quality to count mitigation moments as agency moments.
70. Update badges with Cost Cut, Route Stabilized, Crew Secured, and Value Secured.
71. Update run titles for memorable mitigation turnarounds.
72. Update share text when mitigation was decisive.
73. Update challenge scoring to reward matched mitigation before escape and penalize ignoring severe mitigation into collapse.
74. Keep simulator mitigation derived from the same mapping logic where possible.
75. Keep shared helpers environment-safe.
76. Update SEO route copy if needed to mention visible counterplay.
77. Regenerate SEO artifacts.
78. Add or adjust unit tests for escape cost preview, growth loop, fun loop, and ActionPanel.
79. Run focused tests for the touched modules.
80. Run the full app test suite.
81. Run the production build.
82. Run SEO validation.
83. Run SEO generation.
84. Run Playwright home and game specs.
85. Scan for unfinished implementation markers across app source, e2e, and docs.
86. Run `git diff --check`.
87. Inspect diff for deterministic-overpromise language.
88. Ensure mitigation language says `can reduce`, `helps reduce`, or `at risk`, not guaranteed prevention.
89. Ensure severe costs still allow player agency and do not disable valid actions.
90. Ensure suggestions do not fight the selected tab unless a severe cost exists.
91. Ensure every forecast category has at least one mitigation.
92. Ensure every mitigation maps to a real current action or clear non-action guidance.
93. Acceptance: when Escape Cost Preview says `Glass Idol at risk`, the client immediately shows the best counterplay, such as `Depart now` or `Stop digging and return to landing`.
94. Acceptance: when Escape Cost Preview says `P3 at risk`, the client immediately shows `Help weakest`, `Rest`, or `Regroup`.
95. Acceptance: when Escape Cost Preview says `Route collapse`, the client immediately shows `Return to landing` or `Stabilize route`.
96. Acceptance: a first-time player should read the warning and know the next action that reduces the cost without opening the manual.
