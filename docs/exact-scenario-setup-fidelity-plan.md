# Exact Scenario Setup Fidelity Plan

Goal: remove the remaining caveats from `escape-pressure-4p` by making scenario setup fields reproducible, validated, and visible to the simulator, Oracle, Lab Notebook, Time Machine, and bridge.

1. Read the current setup pipeline end to end: `scripts/scenario-setup-forge.mjs`, `scripts/setup-forge-utils.mjs`, `scripts/gameplay-simulator.mjs`, scenario definitions, and generated setup reports.
2. Identify every setup field currently marked unsupported or observed-only for `escape-pressure-4p`: player stats, player locations, held artifacts, revealed landing zone, current day, phase, queue phase, campsites, and inventory.
3. Map each desired setup field to the actual contract or simulator engine call that can enforce it.
4. Split setup fields into three buckets: exact now, needs contract helper, impossible without gameplay change.
5. Add a typed Setup Forge capability registry where each field declares supported, exact, observed-only, partial, contract-blocked, or unsupported.
6. Replace stringly setup status checks with capability lookups.
7. Add exact player stat setup support.
8. Add validation for player stat setup: movement, agility, and dexterity must be finite non-negative integers.
9. Add simulator application logic that sets or verifies player stats before turn 1.
10. Add setup report evidence showing expected stats, actual stats, and pass or fail per player.
11. Add tests for successful player stat setup.
12. Add tests for invalid player stat setup.
13. Add exact player location setup support.
14. Add coordinate normalization for setup locations.
15. Add validation that requested locations exist or can be created/revealed.
16. Add simulator application logic that places players at requested starting zones.
17. Add setup report evidence showing expected and actual locations.
18. Add tests for single-player location setup.
19. Add tests for 4-player separated-location setup.
20. Add exact revealed-zone setup support.
21. Add validation that revealed zones are valid board coordinates.
22. Add application logic that reveals requested zones before gameplay starts.
23. Add setup report evidence showing requested revealed zones and actual revealed zones.
24. Add tests for landing-zone reveal setup.
25. Add exact landing-zone setup support when a safe pre-start engine hook exists.
26. Validate that `landingZone` is included in revealed zones.
27. Ensure escape scenarios can mark the landing zone as strategically relevant.
28. Add setup report evidence showing landing zone presence.
29. Add tests for escape setup with revealed landing zone.
30. Add exact current day setup support if the engine exposes a setter or deterministic prelude.
31. If no setter exists, implement deterministic prelude turns as the exact fallback.
32. Make prelude turns explicitly excluded from scenario scoring when they are only setup scaffolding.
33. Add setup report evidence showing requested day, actual day, and whether prelude was used.
34. Add tests for day setup.
35. Add exact phase setup support.
36. Support at least `Day` and `Night`.
37. Add setup report evidence for requested phase and actual phase.
38. Add tests for phase setup.
39. Add queue phase setup or queue phase verification.
40. If queue phase cannot be directly set, add a deterministic engine advance helper that reaches the requested queue phase.
41. Add timeout protection to queue phase setup so impossible states fail clearly.
42. Add tests for queue phase setup.
43. Add exact starting artifact support.
44. Identify whether artifacts are represented by `CharacterCard`, `TokenInventory`, `RelicManagement`, or another source of truth.
45. Add setup validation for artifact names or ids.
46. Add setup application logic that grants or attaches starting artifacts.
47. Add setup report evidence showing requested and actual held artifacts.
48. Add tests for starting artifact setup.
49. Add exact inventory setup support if inventory is separate from artifacts.
50. Validate inventory token ids and quantities.
51. Add setup application logic for inventory grants.
52. Add setup report evidence for inventory.
53. Add tests for inventory setup.
54. Add campsite setup support if campsites affect escape or recovery scenarios.
55. Validate campsite coordinates.
56. Add application logic that marks requested zones as campsites.
57. Add setup report evidence for campsites.
58. Add tests for campsite setup.
59. Update `SETUP_SUPPORT` in scenario utilities so fields move from unsupported or observed-only to exact only after tests pass.
60. Update scenario assumption coverage logic so exact setup fields resolve matching assumptions.
61. Add a setup fidelity score: exact fields passed, observed fields passed, skipped fields, and failed fields.
62. Make setup reports expose `setupLevel: exact` only when every required field is exact and passed.
63. Make setup reports expose `setupLevel: partial` when only non-critical fields are skipped.
64. Make setup reports expose `setupLevel: blocked` when critical fields fail.
65. Update Lab Notebook readiness logic to trust exact setup reports.
66. Update Lab Notebook so it stops saying needs engine evidence when paired simulator and setup evidence exists.
67. Update Oracle evidence loading so the scenario-specific latest Oracle result is preferred over global latest.
68. Update Time Machine evidence loading the same way if needed.
69. Re-run `escape-pressure-4p` with exact setup.
70. Inspect the setup report and confirm all critical setup fields pass.
71. Re-run Oracle for `escape-pressure-4p`.
72. If Oracle confidence is still low, inspect weakest Oracle dimension.
73. Fix the highest-impact confidence issue first.
74. Re-run simulator plus Oracle after each fix.
75. Stop when Oracle confidence is at or above the bridge confidence target.
76. Re-run Player Feeling Black Box for `escape-pressure-4p`.
77. Confirm first alive turn remains `<= 2`.
78. Confirm no hard early flat turn appears.
79. Confirm arc score still meets target.
80. Re-run Time Machine for `escape-pressure-4p`.
81. Confirm trend is stable or improving.
82. Re-run Lab Notebook for `escape-pressure-4p`.
83. Confirm readiness becomes ready or ready-with-caveats.
84. Re-run growth capture for `escape-pressure-4p`.
85. Re-run growth report using `reports/growth/local-events.json`.
86. Re-run fun report with the same events file.
87. Rebuild bridge.
88. Confirm `escape-pressure-4p` remains featured-ready.
89. Confirm setup warnings are removed or reduced.
90. Confirm low Oracle confidence warning is removed.
91. Confirm unresolved lab assumptions are reduced.
92. Add regression tests for bridge scoring with exact setup evidence.
93. Add regression tests for bridge scoring with partial setup evidence.
94. Add regression tests for bridge scoring with blocked setup evidence.
95. Add docs explaining exact setup support.
96. Update the featured-ready plan with the exact setup workflow.
97. Run full script-level verification: `scenario:test`, `setup:test`, `oracle:test`, `feel:test`, `time-machine:test`, `lab:test`, `bridge:test`, `growth:test`.
98. Run focused app bridge tests.
99. Run app build.
100. Run focused Playwright growth and public route tests.
101. Check `git diff --check`.
102. Check changed files for unresolved placeholder markers.
103. Commit the exact setup fidelity work.
104. Then move to `solo-artifact-hunt`.
105. Reproduce the current weakness: dig advances the engine but produces no visible clue, progress, artifact, or payoff.
106. Add dig clue and progress telemetry before changing reward math.
107. Make each failed dig produce at least one visible result: clue, partial progress, danger, durability change, terrain hint, or artifact odds change.
108. Add simulator metrics for dig progress.
109. Add feeling labels that recognize clue and progress payoff.
110. Re-run `solo-artifact-hunt`.
111. Confirm flat dig turns drop.
112. Confirm artifact or clue payoff appears before turn 3.
113. Re-run bridge.
114. Decide whether `solo-artifact-hunt` should become featured-ready or remain a secondary playable scenario.
115. Commit the artifact loop improvement separately.
