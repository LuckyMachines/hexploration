# Scenario Lab Notebook Implementation Plan

Scenario Lab Notebook is the project superpower for turning simulator evidence into a durable design journal. It records what was run, what changed, what we believe now, which decisions were made, which assumptions are still unproven, and the next experiment that should make the game better.

## Sequential Implementation List

1. Define the core promise: every scenario cycle should leave behind a readable design notebook entry.
2. Save this implementation plan in `docs/scenario-lab-notebook-implementation-plan.md`.
3. Add user documentation in `docs/scenario-lab-notebook.md`.
4. Define notebook entry types: `auto-summary`, `user-decision`, `daily-brief`, `playtest-gate`, `assumption-review`, `regression-note`.
5. Define decision types: `keep`, `revise`, `reject`, `playtest`, `promote`, `block`, `revisit`.
6. Define readiness statuses: `ready`, `ready-with-caveats`, `needs-engine-evidence`, `blocked-by-setup`, `regressed`, `insufficient-history`.
7. Store generated notebook data under `reports/simulator/lab-notebook/`.
8. Store public UI copies under `app/public/simulator/lab-notebook/`.
9. Keep generated notebook output ignored through the existing ignored reports and public simulator folders.
10. Add `scripts/scenario-lab-notebook-utils.mjs`.
11. Add `scripts/scenario-lab-notebook.mjs`.
12. Add `scripts/scenario-lab-notebook-utils.test.mjs`.
13. Add package scripts for `lab`, `lab:entry`, `lab:daily`, `lab:decision`, `lab:latest`, `lab:doctor`, and `lab:test`.
14. Reuse Playable Design Memory as the project evidence source.
15. Reuse Scenario Time Machine as the per-scenario trend source.
16. Load raw memory events when the latest memory snapshot does not include raw evidence.
17. Build a notebook entry for one scenario from memory, time-machine, scenario metadata, prior entries, and prior decisions.
18. Include schema version, notebook version, entry id, timestamp, scenario id, scenario name, entry type, source, title, and design question.
19. Include evidence summary: timeline count, trend, latest health, best health, last-good health, setup fidelity, Oracle score, confidence, weak dimension, recommendation, and citation count.
20. Include a plain-language latest learning.
21. Include belief before and belief after.
22. Use the prior notebook belief as belief before when one exists.
23. Generate belief after from current evidence.
24. Make improving timelines read as improving with the latest health score.
25. Make regressing timelines read as regressing and point to comparison evidence.
26. Make blocked setup timelines read as blocked by setup fidelity.
27. Make missing simulator or Oracle evidence read as needing engine evidence.
28. Make ready scenarios read as ready only when evidence is strong enough.
29. Generate unresolved assumptions from scenario initial-state assumptions.
30. Generate unresolved assumptions from blocked setup fields.
31. Generate unresolved assumptions from low-confidence Oracle evidence.
32. Generate unresolved assumptions from memory open questions.
33. Generate unresolved assumptions from missing simulator and Oracle evidence.
34. Deduplicate unresolved assumptions by key and title.
35. Generate a next action from Time Machine recommendations first.
36. Fall back to memory recommendations when Time Machine has no command.
37. Fall back to scenario and Oracle evidence capture when no sharper action exists.
38. Attach citations from Time Machine timeline, recommendations, memory query results, and scenario evidence.
39. Keep citations short enough for UI and Markdown consumption.
40. Compute playtest readiness from history depth, trend, setup fidelity, simulator evidence, Oracle evidence, Oracle verdict, confidence, and unresolved assumptions.
41. Mark regressing timelines as `regressed`.
42. Mark setup-blocked timelines as `blocked-by-setup`.
43. Mark missing simulator or Oracle evidence as `needs-engine-evidence`.
44. Mark shallow timelines as `insufficient-history`.
45. Mark high-health, passing, high-confidence timelines as `ready`.
46. Mark medium-health passing timelines as `ready-with-caveats`.
47. Write latest JSON for each scenario.
48. Write latest Markdown for each scenario.
49. Append every generated entry to `entries.json`.
50. Deduplicate entries by id.
51. Maintain newest-first ordering for entries and decisions.
52. Write public latest-entry JSON for the simulator workbench.
53. Write a project notebook index.
54. Include scenario id, name, latest entry summary, latest belief, readiness, latest decision, unresolved count, and next command in the index.
55. Add a daily brief builder.
56. Daily briefs should summarize entries touched that day.
57. Daily briefs should summarize decisions touched that day.
58. Daily briefs should summarize readiness mix.
59. Daily briefs should list highest-leverage next commands.
60. Daily briefs should write JSON and Markdown.
61. Add a decision command.
62. Decision command should require scenario id, decision type, and reason.
63. Decision command should support `--dry-run`.
64. Decision command should create a structured decision record.
65. Decision command should also append a `user-decision` notebook entry.
66. Decision records should include reversibility, follow-up command, confidence, citations, and timestamp.
67. Add a latest command.
68. Latest command should print the latest entry for a scenario.
69. Latest command should support Markdown.
70. Latest command should build a fresh entry when `--build` is passed.
71. Add a doctor command.
72. Doctor should report missing memory, missing notebook entries, missing decisions, stale entries, setup-blocked scenarios, regressed scenarios, and missing next commands.
73. Doctor should support Markdown and a gate mode.
74. Add `--no-write` to entry and daily commands.
75. Add `--refresh-memory` to commands that consume memory.
76. Add Markdown rendering for entries.
77. Add Markdown rendering for daily briefs.
78. Add tests for belief generation.
79. Add tests for latest learning generation.
80. Add tests for unresolved assumptions.
81. Add tests for playtest readiness.
82. Add tests for auto-summary entry shape.
83. Add tests for decision validation and creation.
84. Add tests for Markdown rendering.
85. Add tests for daily brief aggregation.
86. Add tests for doctor output.
87. Add tests for project index generation.
88. Add a Scenario Lab Notebook panel to `/simulator`.
89. Fetch `/simulator/lab-notebook/index.json`.
90. Fetch `/simulator/lab-notebook/<scenario-id>/latest-entry.json`.
91. Show an empty state command when no entry exists.
92. Show latest learning, current belief, readiness, latest decision, unresolved assumptions, next experiment, citations, and commands when an entry exists.
93. Add Playwright coverage for panel rendering without a report.
94. Update README and simulator documentation.
95. Run focused tests, app build, focused Playwright, changed-file text scans, `git diff --check`, then commit as `Add scenario lab notebook`.
