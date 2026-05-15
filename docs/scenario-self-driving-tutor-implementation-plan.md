# Scenario Self-Driving Tutor Implementation Plan

Scenario Self-Driving Tutor tells us what gameplay learning task to do next, in what order, why it matters, what command to run, and what evidence would prove improvement.

## Sequential Implementation List

1. Define the core promise: the tutor tells us what gameplay learning task to do next, in what order, why it matters, what command to run, and what evidence would prove improvement.
2. Name the system `Scenario Self-Driving Tutor`.
3. Add plan doc: `docs/scenario-self-driving-tutor-implementation-plan.md`.
4. Add user docs: `docs/scenario-self-driving-tutor.md`.
5. Define the tutor as a layer above the existing systems, not a replacement for them.
6. Reuse Playable Design Memory, Scenario Time Machine, Scenario Lab Notebook, Gameplay Oracle, Scenario Setup Forge, Scenario Autopilot, exact-engine simulator reports, and scenario definitions.
7. Define the primary question the tutor answers: what should we work on next to make the game more fun, and how will we know it worked?
8. Define core output types: project curriculum, scenario lesson, lesson step, success criterion, evidence gap, intervention recommendation, rerun command, and graduation decision.
9. Define lesson statuses: `ready`, `blocked`, `needs-evidence`, `in-progress`, `passed`, `failed`, `regressed`, and `graduated`.
10. Define lesson priorities: `critical`, `high`, `medium`, and `low`.
11. Define lesson categories: setup fidelity, missing engine evidence, weak player agency, weak readability, weak tension, weak recovery, weak pacing, weak replayability, weak outcome legibility, multiplayer cooperation, artifact payoff, escape pressure, regression recovery, and playtest readiness.
12. Add `scripts/scenario-self-driving-tutor-utils.mjs`.
13. Add `scripts/scenario-self-driving-tutor.mjs`.
14. Add `scripts/scenario-self-driving-tutor-utils.test.mjs`.
15. Add package scripts: `tutor`, `tutor:build`, `tutor:scenario`, `tutor:next`, `tutor:complete`, `tutor:doctor`, and `tutor:test`.
16. Define generated report root: `reports/simulator/tutor/`.
17. Define public UI root: `app/public/simulator/tutor/`.
18. Write project report to `reports/simulator/tutor/latest-curriculum.json`.
19. Write project Markdown to `reports/simulator/tutor/latest-curriculum.md`.
20. Write public project report to `app/public/simulator/tutor/latest-curriculum.json`.
21. Write per-scenario tutor reports to `reports/simulator/tutor/<scenario-id>/latest-lesson.json`.
22. Write per-scenario public reports to `app/public/simulator/tutor/<scenario-id>/latest-lesson.json`.
23. Add a stable tutor schema version.
24. Add a stable tutor engine version.
25. Implement `loadTutorEvidence()`.
26. `loadTutorEvidence()` should load or build Playable Design Memory with raw events.
27. It should load Scenario Time Machine reports or build them in process.
28. It should load Scenario Lab Notebook index and entries.
29. It should load scenario definitions from `simulator.scenarios.json`.
30. It should tolerate missing generated reports and produce evidence-gap lessons instead of failing.
31. Implement `buildScenarioTutorLesson({ scenarioId })`.
32. The scenario lesson should include scenario id, name, design question, current belief, latest learning, current weakness, blockers, recommended lesson steps, success criteria, commands, citations, and graduation status.
33. Implement `buildProjectCurriculum()`.
34. The project curriculum should include generated timestamp, scenario count, highest priority lesson, ordered scenario lessons, project-wide blockers, next three commands, graduation candidates, and regression alerts.
35. Implement `rankScenarioLessons()`.
36. Ranking should prioritize blocked foundations first: setup fidelity blockers, missing simulator evidence, missing Oracle evidence, latest regressions, and low-confidence claims.
37. Ranking should then prioritize core gameplay scenarios.
38. Ranking should then prioritize highest design impact.
39. Ranking should then prioritize easiest next experiment.
40. Ranking should avoid recommending expensive work before missing evidence is captured.
41. Implement `detectPrimaryWeakness()`.
42. It should inspect Oracle weakest metric first.
43. It should inspect Time Machine regression trend second.
44. It should inspect Lab Notebook unresolved assumptions third.
45. It should inspect Memory recommendations fourth.
46. It should inspect simulator life/fun metrics fifth.
47. It should return one primary weakness plus supporting secondary weaknesses.
48. Implement `lessonForSetupBlocker()`.
49. If setup fidelity is too low, the first lesson should be setup repair.
50. Setup lesson command should usually be `npm run setup:doctor`.
51. If a scenario has setup assumptions, include the blocked fields.
52. If setup is observed-only, say what cannot be trusted yet.
53. Implement `lessonForMissingEvidence()`.
54. If simulator evidence is missing, recommend `npm run scenario:run -- --id=<scenario-id>`.
55. If Oracle evidence is missing, recommend `npm run oracle:scenario -- --id=<scenario-id>`.
56. If both are missing, recommend both in sequence.
57. Implement `lessonForRegression()`.
58. If latest evidence regressed, recommend `npm run time-machine:compare -- --id=<scenario-id> --against=last-good --markdown`.
59. Regression lessons should include latest health, last good health, likely cause, and rollback or revisit command.
60. Implement `lessonForWeakMetric()`.
61. Map Oracle weak metrics to lesson types for agency, readability, tension, recovery, pacing, replayability, outcome legibility, system integration, emotional texture, and surprise.
62. Each weak-metric lesson should include one smallest experiment.
63. Prefer existing Autopilot when a weak metric is clear.
64. Implement `successCriteriaForLesson()`.
65. Success criteria should be measurable.
66. Success criteria examples: Oracle score rises by 5, weakest metric rises above 60, setup fidelity reaches partial or exact, flat-turn rate falls, life score rises, target pass rate improves, Lab Notebook readiness improves, or Time Machine trend becomes stable or improving.
67. Implement `commandsForLesson()`.
68. Each lesson should include primary command, verification command, and notebook command.
69. Example command chain: scenario run, Oracle scenario, Time Machine scenario, Lab Notebook entry, and Tutor scenario.
70. Implement `buildLessonSteps()`.
71. Each lesson should have 3-7 explicit steps.
72. Step 1 should describe the learning objective.
73. Step 2 should gather missing evidence.
74. Step 3 should apply or recommend the intervention.
75. Step 4 should rerun simulator and Oracle.
76. Step 5 should compare before and after.
77. Step 6 should record Lab Notebook belief.
78. Step 7 should mark the lesson passed, failed, or still blocked.
79. Implement `lessonGraduationCheck()`.
80. A lesson graduates only when success criteria are met.
81. Graduation should require citations.
82. Graduation should not rely on a single weak signal unless the scenario is explicitly early-stage.
83. Implement `completeLesson()`.
84. This should allow a human to mark passed, failed, blocked, revisit, or graduated.
85. `completeLesson()` should write to `reports/simulator/tutor/<scenario-id>/lesson-history.json`.
86. It should never edit source tuning files directly.
87. It should record decision, reason, timestamp, lesson id, follow-up command, and citations.
88. Add CLI command `npm run tutor:complete -- --id=<scenario-id> --lesson=<lesson-id> --status=passed --why="..."`.
89. Implement `markdownForScenarioLesson()`.
90. Markdown should show current weakness, why it matters, ordered steps, commands, success criteria, blockers, and citations.
91. Implement `markdownForProjectCurriculum()`.
92. Markdown should show top priority, top five lessons, blocked lessons, graduation candidates, next commands, and project risks.
93. Implement `tutorDoctor()`.
94. Doctor should check missing memory, missing Time Machine reports, missing Lab Notebook entries, scenarios without tutor lessons, lessons with no success criteria, lessons with no verification command, stale lesson outputs, and impossible graduation claims.
95. `tutorDoctor()` should be warning-based, not brittle.
96. Add unit tests for primary weakness detection.
97. Add unit tests for setup-blocker lessons.
98. Add unit tests for missing-evidence lessons.
99. Add unit tests for regression lessons.
100. Add unit tests for weak-metric lessons.
101. Add unit tests for success criteria generation.
102. Add unit tests for command generation.
103. Add unit tests for lesson ranking.
104. Add unit tests for project curriculum generation.
105. Add unit tests for Markdown output.
106. Add unit tests for completion records.
107. Add unit tests for doctor output.
108. Add CLI test smoke commands.
109. Add `/simulator` panel: `ScenarioSelfDrivingTutorPanel`.
110. Fetch project curriculum from `/simulator/tutor/latest-curriculum.json`.
111. Fetch scenario lesson from `/simulator/tutor/<scenario-id>/latest-lesson.json`.
112. Add empty state with command `npm run tutor:scenario -- --id=<scenario-id>`.
113. UI should show top project priority, current scenario lesson, lesson status, primary weakness, why it matters, ordered steps, primary command, success criteria, blockers, and citations.
114. UI should not become a marketing page.
115. Keep it consistent with existing simulator workbench panels.
116. Add Playwright assertion for `Scenario Self-Driving Tutor`.
117. Update README.
118. Update `docs/gameplay-simulator.md`.
119. Update `docs/playable-design-memory.md`.
120. Update `docs/scenario-time-machine.md`.
121. Update `docs/scenario-lab-notebook.md`.
122. Ensure all generated files remain ignored.
123. Run focused subsystem tests.
124. Run CLI smoke checks.
125. Run app build.
126. Run focused Playwright.
127. Run changed-file scan for unfinished-marker strings.
128. Run whitespace check.
129. Stage only source and docs.
130. Do not stage generated reports, public simulator output, build output, coverage, logs, or environment files.
131. Commit as `Add scenario self-driving tutor`.
132. Confirm tracked repo is clean.
