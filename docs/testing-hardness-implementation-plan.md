# Testing Hardness Full Implementation Plan

1. Define testing hardness as a project standard: a bad gameplay, UI, contract, or integration change should fail before it reaches main.
2. Add a doc: `docs/testing-hardness-standard.md`.
3. Define hardness tiers: `smoke`, `focused`, `hard`, `exact`, and `release`.
4. Add a root verification orchestrator script: `scripts/verify-hard.mjs`.
5. Add package scripts: `verify:smoke`, `verify:focused`, `verify:hard`, `verify:exact`, and `verify:release`.
6. Make the orchestrator run commands sequentially with clear step names.
7. Add command timeouts so one stuck test cannot hang the whole run.
8. Add `--continue-on-fail` for diagnostic mode.
9. Add `--json` output for machine-readable reports.
10. Add `--markdown` output for human-readable reports.
11. Write reports to `reports/verification/latest-hard.json`.
12. Mirror a compact report to `app/public/verification/latest-hard.json`.
13. Add reports to `.gitignore`.
14. Track per-step status: pass, fail, skipped, and timed out.
15. Track per-step duration.
16. Track command stdout/stderr tail for failures.
17. Track repo commit hash and dirty/clean state.
18. Track current branch.
19. Track Node/npm versions.
20. Track Foundry/forge version.
21. Track Playwright availability.
22. Track whether Anvil/local stack is already running.
23. Fail early if the repo is dirty only when running `verify:release`.
24. Allow dirty repo for local `verify:hard`.
25. Add a verification summary table.
26. Add next likely fix hints for common failures.
27. Add root `verify:smoke` sequence: git status, local stack doctor tests, scenario tests, UI density, and targeted app Vitest checks.
28. Add root `verify:focused` sequence: smoke, app build, touched-script tests inferred from changed files, and touched-app tests inferred from changed files.
29. Add root `verify:hard` sequence: forge build, forge test, all root Node utility tests, app build, app Vitest suite, UI density report, simulator golden compare, Oracle CI, setup doctor, memory doctor, lab doctor, feel doctor, and bridge doctor.
30. Add root `verify:exact` sequence: hard, start `local:sim`, wait for `local-stack-ready`, run `local:doctor --gate`, run one exact-engine scenario, run Oracle on exact-engine evidence, stop local stack cleanly, and verify port cleanup.
31. Add root `verify:release` sequence: exact, Playwright full e2e, Playwright visual capture, UI density strict mode, evidence freshness checks, and final dirty-repo check.
32. Create a small command registry in `scripts/verify-hard.mjs`.
33. Give each command an id, label, command, working directory, timeout, tier, required/optional flag, and artifact paths.
34. Prefer Node `spawn` over shell-specific command strings.
35. Make Windows command resolution robust for `npm.cmd`.
36. Add graceful process-tree cleanup on timeout.
37. Add Anvil/local-stack cleanup on exact verification exit.
38. Add signal handlers for Ctrl+C cleanup.
39. Add a helper for command output tail capture.
40. Add a helper for writing JSON safely.
41. Add a helper for writing Markdown safely.
42. Add a helper for detecting command availability.
43. Add a helper for resolving app/root working directories.
44. Add a helper for measuring durations.
45. Add a helper for formatting elapsed time.
46. Add a helper for detecting changed files.
47. Add changed-file test mapping for local stack, scenario, oracle, memory, feeling, growth, fun, interface density, actions, board, and pages.
48. If changed-file mapping finds nothing, run smoke.
49. Make focused mode print why each test was selected.
50. Add strict mode for root Node tests.
51. Add a root script that discovers `scripts/*.test.mjs`.
52. Run discovered Node tests in small batches to avoid maxing the machine.
53. Limit concurrency by default.
54. Add `--jobs=N`.
55. Default to `--jobs=1` for heavy commands.
56. Allow parallel light tests only where safe.
57. Add a simulator hardness matrix.
58. Define baseline simulator scenarios: benchmark, solo artifact hunt, escape pressure, cooperation, exhausted survival, and invalid route boundary.
59. Add scenario pack command for the baseline matrix.
60. Add `sim:matrix`.
61. Add `sim:matrix:golden`.
62. Add `sim:matrix:compare`.
63. Store matrix reports under `reports/simulator/matrix`.
64. Mirror latest matrix summary to `app/public/simulator/matrix`.
65. Add pass/fail thresholds for life score, flat-turn rate, invalid attempt rate, meaningful choice density, reveal pace, artifact progress, escape attempts, and cooperation/help rate.
66. Make thresholds scenario-specific.
67. Add threshold definitions to scenario metadata.
68. Add missing threshold warnings.
69. Fail hard mode on threshold regression against baseline.
70. Add baseline freshness date.
71. Warn if baseline is older than a configured window.
72. Fail release mode if baseline is stale.
73. Add an Oracle hard gate.
74. Define minimum Oracle weighted score.
75. Define minimum Oracle confidence.
76. Fail if Oracle verdict is blocked/fail.
77. Warn if Oracle confidence is low.
78. Include Oracle decisive-turn evidence in verification report.
79. Add setup fidelity hard gate.
80. Define minimum setup fidelity for exact scenarios.
81. Fail if critical setup fields were skipped.
82. Warn if noncritical setup fields were approximated.
83. Add exact-engine scenario runner integration.
84. Pick one lightweight exact scenario for hard mode.
85. Pick multiple exact scenarios for release mode.
86. Make exact scenario runner reuse the same local stack health tools.
87. Capture local stack health before exact scenario run.
88. Capture local stack health after exact scenario run.
89. Fail if chain ID, bytecode, seeded game, or open games are missing.
90. Fail if exact scenario cannot produce evidence.
91. Add local-stack startup timeout.
92. Add local-stack ready sentinel parsing.
93. Add local-stack stdout/stderr artifact capture.
94. Add clean shutdown verification.
95. Add port-free verification after shutdown.
96. Add e2e hardness tiers.
97. Smoke e2e: home renders, invalid game ID renders, UI lab route controls render.
98. Hard e2e: smoke e2e, simulator workbench, growth public routes, field manual modal, and active board interaction.
99. Release e2e: hard e2e, visual capture, seeded local-chain gameplay capture, and mobile viewport pass.
100. Add Playwright project tags for desktop, mobile, and capture.
101. Add visual screenshot artifact paths to verification report.
102. Add UI density strict mode.
103. In strict mode, fail on over-budget persistent panel/button/detail counts.
104. Add UI density budgets per screen.
105. Add budget comments explaining why each limit exists.
106. Add density report history.
107. Add density diff against last good report.
108. Add text overflow stress tests.
109. Add pseudo-locale test route or mode.
110. Add long transaction hash/address fixture.
111. Add long scenario title fixture.
112. Add long event message fixture.
113. Verify no key action buttons overflow in stress mode.
114. Add accessibility smoke checks.
115. Use Playwright to check visible button names.
116. Check focus traversal through action tabs and submit controls.
117. Check details disclosures can open via keyboard.
118. Check modal Escape close behavior.
119. Add reduced-motion verification.
120. Ensure reduced-motion class disables board/action animations.
121. Ensure density model still shows required information in reduced motion.
122. Add performance sanity checks.
123. Track app build time.
124. Track test duration.
125. Track local-stack boot duration.
126. Warn on major duration regression.
127. Add flaky-test markers only with explicit reason and expiration date.
128. Fail release mode if flaky marker is expired.
129. Add evidence freshness checks.
130. Check latest simulator report exists.
131. Check latest Oracle report exists.
132. Check latest density report exists.
133. Check latest local-stack health report exists for exact mode.
134. Check reports were generated by current commit when possible.
135. Add verification dashboard data.
136. Mirror verification JSON to app public.
137. Add a small verification panel to simulator/workbench page.
138. Show latest hard gate status.
139. Show failed step and next command to run.
140. Add Markdown report with summary, failed steps, durations, artifacts, and suggested next command.
141. Add a `verify:latest` command to print the latest report.
142. Add `verify:doctor` to check whether verification dependencies are installed.
143. `verify:doctor` checks Node, npm, forge, anvil, playwright browsers, app deps, and root deps.
144. Add helpful install hints for missing dependencies.
145. Add CI config later, but design commands so CI can call them directly.
146. Keep CI and local commands identical.
147. Add release gate docs.
148. Add which-command docs for small UI changes, simulator changes, contract changes, exact-engine changes, before commit, and before release.
149. Add a pre-commit recommendation but do not force heavy tests locally.
150. Add a pre-push recommendation for `verify:hard`.
151. Add artifact cleanup command.
152. Add `verify:clean-artifacts`.
153. Keep generated reports ignored.
154. Keep golden baselines source-controlled only when intentionally updated.
155. Add baseline update command requiring an explicit `--accept` flag.
156. Record why a baseline was accepted.
157. Add baseline acceptance Markdown note.
158. Add simulator seed discipline.
159. Every baseline scenario gets a deterministic seed.
160. Every random batch records all seeds.
161. Failed random seed is replayable by command.
162. Add failure replay command.
163. Add `verify:replay-failure`.
164. Make replay command read latest verification report.
165. Add root README section for verification hardness.
166. Link testing standard from the negative-space standard.
167. Link exact-engine standard from simulator docs.
168. Link Oracle docs from verification report.
169. Add report-card grading for testing hardness.
170. Grade current state after each hard run.
171. Store grade in verification report.
172. Define A-level criteria.
173. Define A+ criteria.
174. Add fuzz/property tests for pure game logic where available.
175. Start with route validation and hex math.
176. Add randomized route validation tests.
177. Add randomized scenario generation tests.
178. Add randomized simulator smoke with fixed seed output.
179. Add contract invariant tests if Foundry suite supports them.
180. Add queue/turn lifecycle invariant tests.
181. Add local-stack multi-player exact scenario.
182. Add bot-assisted multiplayer exact scenario.
183. Add exact scenario for invalid/edge action.
184. Add exact scenario for escape condition.
185. Add exact scenario for low-stat survival.
186. Add exact scenario for cooperation/help.
187. Add exact scenario for artifact/relic loop.
188. Add exact scenario for transaction failure handling.
189. Add UI tests for each exact scenario's resulting visible state.
190. Add simulator-to-exact comparison for at least one scenario.
191. Flag mismatch between simulated and exact outcomes.
192. Store mismatch evidence in bridge report.
193. Add known-gap registry for simulation/exact differences.
194. Require a reason and owner for each known gap.
195. Fail release mode if a known gap is expired.
196. Add docs for interpreting verification failures.
197. Keep final terminal output compact.
198. Make full details available in reports, not only terminal logs.
199. Keep heavy verification respectful of local machine resources.
200. Default hard mode to sequential heavy steps.
201. Add clear estimates before starting exact/release modes.
202. Add skip flags: `--skip-forge`, `--skip-app`, `--skip-e2e`, `--skip-exact`, and `--skip-sim`.
203. Require skipped steps to be listed in report.
204. Mark skipped required steps as release blockers.
205. Add final repo clean check option.
206. Release mode requires clean repo after artifacts are ignored.
207. Commit the first implementation slice.
208. Run `verify:smoke`.
209. Run `verify:hard`.
210. Fix failures.
211. Run `verify:exact`.
212. Fix exact-engine gaps.
213. Run `verify:release`.
214. Iterate until the project can answer "how hard are our tests?" with one current report instead of vibes.

