# Game UI Negative Space Full Implementation Plan

1. Audit every game screen against the new negative-space standard.
2. Create a UI inventory of all persistent HUD elements, panels, badges, meters, buttons, labels, overlays, drawers, and modals.
3. Classify each UI element as one of: primary gameplay, current decision support, safety or transaction feedback, secondary detail, history/debug/telemetry, or decorative chrome.
4. Define a strict active-play hierarchy: board/game world, current player/action state, primary action controls, required feedback/errors, optional details, history/debug/telemetry.
5. Add a reusable game screen shell layout that reserves the largest uninterrupted area for the board or toy.
6. Set minimum board/action-area space rules for desktop, tablet, and mobile.
7. Add responsive layout constraints so sidebars collapse before they shrink the board too far.
8. Move crew, history, telemetry, fun, growth, and debug surfaces into progressive disclosure by default.
9. Keep only the minimum persistent top HUD: day/night, phase, current queue/action status, share/debug only when relevant.
10. Replace duplicate status readouts with one canonical source per state.
11. Add quiet mode rules for idle/planning states.
12. Add high-information mode rules for resolving, invalid action, danger, or transaction states.
13. Gate board overlays by context: always show player marker; show intent cursor only when intent exists; show route meter only while planning; show bark/moment text only during meaningful input or resolution; show dense stat readouts only when they explain a current risk.
14. Add visual density tokens: quiet, standard, focused, high-alert.
15. Use those density tokens across board overlays, action panels, and HUD.
16. Add a `useInterfaceDensity` helper that derives density from turn state, route state, input cadence, risk, and transaction state.
17. Refactor `BoardPresence` to consume the density model instead of local ad hoc visibility checks.
18. Refactor `ActionPanel` to show only active action choice and submit path persistently.
19. Move action explanation, stakes, condition, preview, and simulator into one well-designed details surface.
20. Make that details surface remember open/closed preference per user.
21. Ensure the action tabs fit without wrapping badly on mobile.
22. Replace text-heavy action tabs with compact icon/glyph-first controls plus accessible labels.
23. Add tooltips or detail text for unfamiliar glyphs.
24. Normalize button sizing so hover/focus/disabled states do not shift layout.
25. Add consistent panel spacing tokens for game UI: outer page gap, board gutter, panel padding, compact panel padding, disclosure gap.
26. Apply those spacing tokens to `ExpeditionBench`.
27. Apply them to `ActionPanel`.
28. Apply them to crew/player panels.
29. Apply them to mission/readiness/telemetry panels.
30. Apply them to history/event panels.
31. Add overflow rules for every dynamic text field: addresses, game IDs, queue IDs, player names, action labels, event messages, transaction hashes.
32. Add text wrapping/truncation helpers where needed.
33. Create a `ReadableText` or utility class set for long game strings.
34. Audit all uppercase tracking values and reduce excessive letter spacing in cramped containers.
35. Keep wide tracking only for short labels.
36. Use normal line height for explanatory text.
37. Add empty states for closed/empty crew, history, journal, and telemetry sections.
38. Add loading states that do not resize the board.
39. Add error states that appear near the relevant control without covering the board.
40. Add transaction feedback that is persistent but compact.
41. Move full transaction detail into a drawer.
42. Ensure mobile sticky controls do not cover important board content.
43. Add bottom safe-area padding for sticky mobile controls.
44. Add board viewport tests for minimum visible board size.
45. Add tests for board overlay visibility in idle/planning/risk/resolving states.
46. Add tests for ActionPanel details being collapsed by default.
47. Add tests that core submit controls remain reachable with details collapsed.
48. Add tests for long labels and transaction hashes not overflowing.
49. Add Playwright visual tests for desktop active play.
50. Add Playwright visual tests for mobile active play.
51. Add Playwright visual tests for high-alert/error state.
52. Add Playwright visual tests for resolving/transaction state.
53. Add screenshot comparison thresholds focused on layout breakage.
54. Add a UI density report script that counts visible panels, buttons, badges, and text blocks on key screens.
55. Add a soft budget for visible persistent UI elements.
56. Fail the report only for severe regressions at first.
57. Add the density report to local verification scripts.
58. Add a visual review checklist to the docs.
59. Update `GameUILab` to include negative-space scenarios: idle, planning, invalid route, submitted, resolving, mobile cramped.
60. Use `GameUILab` as the canonical design QA surface.
61. Add a quiet board fixture.
62. Add a busy board fixture.
63. Add a danger route fixture.
64. Add a long text stress fixture.
65. Refactor repeated disclosure headers into a shared component.
66. Refactor repeated stat/status cards into a shared compact component.
67. Refactor repeated panel shells into shared primitives.
68. Keep shared primitives low-chrome and spacing-consistent.
69. Remove nested card-in-card structures where present.
70. Convert page sections into bands or unframed layouts instead of floating card stacks.
71. Keep repeated cards only for lists like crew/player entries.
72. Audit `SimulatorPage` separately as a tool UI, not active gameplay.
73. Preserve density in simulator charts but avoid decorative clutter.
74. Add separate standards for active gameplay vs simulator/workbench UI.
75. Update `PlayerDossier` to show compact state by default.
76. Move deep player details into expand/click focus state.
77. Make focused player state visually clear without adding extra permanent panels.
78. Ensure crew sidebar collapses under the board on narrow screens.
79. Add a crew drawer option for mobile.
80. Keep the board first on mobile.
81. Move event history below action controls or into a drawer by default.
82. Keep recent resolution feedback concise and near the board/action area.
83. Add last important event summary instead of full log during active play.
84. Move full log into expedition history.
85. Reduce decorative borders in stacked panels.
86. Use subtle backgrounds instead of heavy outlines for secondary surfaces.
87. Keep border radii consistent and restrained.
88. Audit color usage so alerts are not always competing.
89. Reserve red for blocking/danger/error.
90. Reserve bright gold/compass for current actionable focus.
91. Reserve blue/green for supportive or confirmed state.
92. Reduce simultaneous animated elements on the board.
93. Gate animation intensity by density state and reduced-motion preference.
94. Make idle animation calm and readable.
95. Make urgent animation local to the problem area.
96. Ensure animations do not move text enough to harm readability.
97. Audit SVG board text sizes.
98. Remove or gate tiny text that cannot be read at normal board scale.
99. Prefer shape/color/position cues over micro-labels on the board.
100. Add accessible names for icon/glyph-first controls.
101. Add keyboard focus states that are visible but not noisy.
102. Add controller focus states that are clear on the board and action console.
103. Keep controller hints hidden unless controller input is detected.
104. Make controller hints compact and dismissible or contextual.
105. Add user preference for show extra detail by default.
106. Add user preference for large board mode.
107. Add user preference for compact HUD.
108. Persist those preferences.
109. Connect preferences to the density model.
110. Ensure compact HUD never hides required safety/transaction feedback.
111. Add a one-page implementation guide for future contributors.
112. Add examples of acceptable vs unacceptable active-play density.
113. Add a short PR checklist item referencing the standard.
114. Add lint/test coverage for obvious overflow risks where practical.
115. Add CSS utility classes for no-overflow text, mono labels, compact badges, quiet panels, and detail drawers.
116. Replace one-off class strings gradually with these utilities.
117. Audit modals for padding, max width, and mobile overflow.
118. Audit drawers for scroll containment.
119. Audit all `details/summary` controls for keyboard behavior and clear affordance.
120. Ensure disclosures do not create layout jumps that move the board unexpectedly.
121. Prefer below-board disclosures over above-board disclosures during active play.
122. Add a visual current objective line near the board.
123. Keep that objective line short and state-driven.
124. Remove redundant explanatory text from persistent headers.
125. Move tutorials/manual content out of the active-play screen.
126. Show first-turn guidance only when it is actually needed.
127. Collapse first-turn guidance once the player has acted.
128. Add post-action recap surfaces for richer information after the decision.
129. Move rich narrative/event detail to recap, journal, or history.
130. Keep active action controls short and direct.
131. Review all mobile breakpoints manually.
132. Review desktop wide layouts manually.
133. Review laptop-height constrained layouts manually.
134. Review browser zoom and user font scaling.
135. Review pseudo-locale/long string mode.
136. Review reduced-motion mode.
137. Review dark contrast for all quiet panels.
138. Review focus contrast for all interactive elements.
139. Add screenshots to the report artifacts.
140. Add a final report-card pass against board priority, control clarity, density, text containment, responsive behavior, and visual polish.
141. Fix every B/C grade item until the active gameplay screen reaches A-level readability.

