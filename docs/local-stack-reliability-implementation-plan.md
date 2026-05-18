# Local Stack Reliability Implementation Plan

Superpower: a trustworthy local exact-engine loop that can boot the chain, seed playable scenarios, run simulations against the same contracts the app uses, capture evidence, and explain failures with enough detail to improve the game quickly.

1. Define one canonical local-stack contract for what "ready" means.
2. Add a machine-readable health report for every local-stack boot.
3. Add a human-readable health summary for terminal output.
4. Add a doctor command that can inspect a running local stack.
5. Add a doctor command mode that can fail CI-style when required checks fail.
6. Add pure doctor utilities with unit coverage.
7. Validate required app contract addresses before launching the frontend.
8. Validate that every required contract address has bytecode.
9. Validate the chain ID returned by the RPC endpoint.
10. Validate the block number can be read.
11. Validate the latest seeded game ID can be read.
12. Validate open-game discovery through the summary contract.
13. Validate that the generated app environment file matches the deployed addresses.
14. Validate that the runner can write health evidence into reports.
15. Mirror health evidence into the app public directory for UI inspection.
16. Add an explicit ready sentinel in terminal output.
17. Print the ready sentinel only after all readiness gates pass.
18. Add boot-step timing for each stack phase.
19. Add boot-step success and failure status tracking.
20. Add timeout handling around long-running boot commands.
21. Add timeout handling around forge deployment.
22. Add timeout handling around deck population commands.
23. Add timeout handling around bot registration.
24. Add timeout handling around readiness checks.
25. Record child process names in the health report.
26. Record requested mode and player count in the health report.
27. Record whether the worker was started.
28. Record whether the frontend was started.
29. Record whether auto-bots were started.
30. Add a headless local-stack mode for exact-engine scenario work.
31. Add a package script for headless local simulator boot.
32. Add a flag to skip Vite during simulator work.
33. Add a flag to skip the automation worker during boot diagnosis.
34. Keep the existing local scripts backward-compatible.
35. Make boot failure cleanup deterministic.
36. Improve deploy failure messages with the failing phase name.
37. Add a local-stack reports directory.
38. Add a stable latest health report path.
39. Add a stable latest health markdown path.
40. Add a public latest health path for app-side visibility.
41. Include app environment path metadata in the health report.
42. Include broadcast path metadata in the health report.
43. Include RPC URL metadata in the health report.
44. Include generated timestamp metadata in the health report.
45. Include schema version metadata in the health report.
46. Parse app `.env.local` with comments and blank lines.
47. Normalize address maps consistently.
48. Flag missing required address keys clearly.
49. Flag malformed address values clearly.
50. Flag zero bytecode clearly.
51. Flag RPC reachability failures clearly.
52. Flag contract read failures clearly.
53. Separate failures from warnings.
54. Count passed and failed checks.
55. Count warning checks.
56. Make the doctor output readable without opening JSON.
57. Make the doctor JSON stable for tooling.
58. Unit-test env parsing.
59. Unit-test address normalization.
60. Unit-test bytecode classification.
61. Unit-test health scoring.
62. Unit-test markdown rendering.
63. Unit-test report construction.
64. Add package script coverage for doctor tests.
65. Keep doctor utilities independent from the runner where practical.
66. Reuse the same doctor utilities from the runner.
67. Avoid duplicating readiness rules between CLI and runner.
68. Capture the latest game ID as evidence.
69. Capture open-game counts as evidence.
70. Capture bytecode sizes as evidence.
71. Capture chain and block evidence.
72. Preserve enough failure detail to diagnose without rerunning immediately.
73. Keep private keys out of health reports except well-known local test keys printed by the runner.
74. Keep large command logs out of health JSON.
75. Provide concise command failure summaries.
76. Add a deploy timeout environment override.
77. Add a boot timeout environment override.
78. Add a readiness timeout environment override.
79. Add simulator-friendly defaults that do not start unnecessary UI processes.
80. Keep solo mode as the primary quick-play path.
81. Keep multiplayer mode compatible with bot registration.
82. Ensure bot registration still happens after the app env file exists.
83. Ensure readiness gating happens before the ready banner.
84. Ensure readiness gating can run before Vite starts.
85. Ensure readiness gating can run with or without the worker.
86. Ensure readiness gating can run with or without auto-bots.
87. Ensure readiness gating can run with or without Vite.
88. Add clear console status for skipped worker startup.
89. Add clear console status for skipped Vite startup.
90. Add clear console status for skipped bot startup.
91. Make the banner reflect actual started services.
92. Make the banner identify headless mode.
93. Make the banner identify the health report path.
94. Make the banner identify the ready sentinel.
95. Confirm the local-stack command exits nonzero on readiness failure.
96. Confirm the doctor gate exits nonzero on readiness failure.
97. Confirm the doctor can produce a report without an active stack.
98. Confirm the doctor markdown output is useful when RPC is down.
99. Keep the local-stack runner readable after integration.
100. Avoid broad refactors outside the local-stack path.
101. Add exact-engine scenario boot evidence as the next layer.
102. Add scenario seed metadata to local-stack health.
103. Add scenario fixture metadata to local-stack health.
104. Add scenario run metadata to local-stack health.
105. Add scenario outcome summaries to local-stack health.
106. Add scenario failure summaries to local-stack health.
107. Connect scenario lab notebooks to local-stack evidence.
108. Connect evidence bridge outputs to local-stack evidence.
109. Connect oracle checks to local-stack evidence.
110. Connect player-feeling reports to local-stack evidence.
111. Connect fun reports to local-stack evidence.
112. Connect growth reports to local-stack evidence.
113. Add a one-command rerun for the latest exact scenario.
114. Add a one-command rerun for the latest failed exact scenario.
115. Add deterministic seed capture for reruns.
116. Add scenario pack capture for reruns.
117. Add outcome-diff capture for reruns.
118. Add tuning recommendation capture for reruns.
119. Add a local-stack evidence index.
120. Add an app route or panel for local-stack evidence.
121. Add a compact status panel for latest local-stack health.
122. Add a detailed diagnostics panel for latest local-stack health.
123. Add checks for unresolved placeholder markers in new implementation files.
124. Add local-stack evidence to the project memory index.
125. Add local-stack evidence to the tutor recommendations.
126. Add local-stack evidence to the time-machine comparisons.
127. Add local-stack evidence to the autopilot decision trail.
128. Add a report-card grading pass for local-stack reliability.
129. Raise the reliability grade target after the first stable boot.
130. Add lightweight documentation for day-to-day local-stack use.
131. Add lightweight documentation for failure diagnosis.
132. Add lightweight documentation for exact-engine scenario reruns.
133. Add screenshot or transcript evidence for a successful headless boot.
134. Add screenshot or transcript evidence for a successful playable boot.
135. Keep each reliability layer commit-sized and verifiable.
136. Run focused unit tests after each layer.
137. Run stack boot verification when the layer affects boot behavior.
138. Commit only after the working tree is coherent.
139. Leave the repository clean after each completed slice.
140. Record any blocked external dependency honestly.
141. Continue top to bottom until the exact-engine loop is boring, repeatable, and useful.

