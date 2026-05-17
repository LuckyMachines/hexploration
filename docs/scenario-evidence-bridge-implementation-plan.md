# Scenario Evidence Bridge Implementation Plan

The superpower is a bridge between the simulator-family evidence and the public routes. The game should feature, challenge, and explain scenarios only when the same-engine evidence says they are ready enough for players.

1. Define the public promise: `/play`, `/challenge`, `/scenarios`, `/progress`, `/devlog`, and `/create-scenario` are driven by scenario evidence instead of hardcoded confidence.
2. Add a stable bridge report schema with `scenarioId`, `name`, `generatedAt`, `eligible`, `readinessScore`, `gateVerdict`, `reasons`, `blockers`, `warnings`, `evidence`, `publicRoute`, `challengeRoute`, and `nextFix`.
3. Use these verdicts: `featured-ready`, `playable-with-caveats`, `needs-fun-work`, `blocked-by-setup`, `regressing`, and `missing-evidence`.
4. Read scenario definitions from `simulator.scenarios.json`.
5. Read Player Feeling Black Box evidence from `reports/simulator/feeling-black-box/index.json`.
6. Read Scenario Time Machine evidence from `reports/simulator/time-machine/index.json`.
7. Read Scenario Lab Notebook evidence from `reports/simulator/lab-notebook/index.json`.
8. Read Fun Report evidence from `reports/fun/latest-report.json`.
9. Read Growth Report evidence from `reports/growth/latest-report.json`.
10. Read Gameplay Oracle summary evidence from `reports/simulator/oracle/summary-index.json` when present.
11. Read Scenario Setup Forge evidence from `reports/simulator/setup-forge/index.json` and per-scenario setup reports when present.
12. Normalize missing files to null or empty arrays so the bridge can run in a fresh checkout.
13. Add hard blockers for missing scenario definition, missing evidence, setup blocked, regressing trend, blocked lab readiness, late or missing first-alive evidence for featuring, flat streaks, and lack of share-worthy moments.
14. Add soft warnings for partial setup, low arc score, no public completions, no share events, stale evidence, low Oracle confidence, unresolved assumptions, insufficient history, and fun evidence that is not share-worthy.
15. Score readiness from feeling evidence, arc target, early first-alive turn, payoff evidence, recovery/comeback evidence, stable or improving history, lab readiness, completions, shares, blockers, and warnings.
16. Choose one featured scenario from the highest eligible score.
17. Choose one challenge scenario from eligible escape/cooperation/survival evidence, falling back to the best available scenario.
18. Write full bridge reports to `reports/bridge/latest-report.json`.
19. Write public bridge reports to `app/public/bridge/latest-report.json`.
20. Write per-scenario readiness reports under both report roots.
21. Add markdown output for humans.
22. Add bridge CLI commands: `build`, `latest`, `scenario`, and `doctor`.
23. Add package scripts: `bridge`, `bridge:build`, `bridge:latest`, `bridge:scenario`, `bridge:doctor`, and `bridge:test`.
24. Ignore generated bridge reports in Git.
25. Document the bridge in `docs/scenario-evidence-bridge.md`, `docs/gameplay-simulator.md`, and `README.md`.
26. Add app `bridgeData` helpers that fetch bridge JSON safely and never throw during route render.
27. Wire `/play` to use the featured bridge scenario when no manual `scenario` query is present.
28. Wire `/challenge` to use the bridge challenge scenario and deterministic seed when available.
29. Add readiness badges, evidence citations, and next-fix commands to public route surfaces.
30. Sort and filter `/scenarios` by bridge readiness while preserving playable fallbacks.
31. Merge bridge readiness into `/progress`.
32. Turn bridge readiness into readable `/devlog` entries.
33. Add evidence requirements and bridge commands to `/create-scenario`.
34. Add focused bridge utility tests.
35. Add app helper tests.
36. Add focused Playwright assertions for the public bridge surfaces.
37. Run bounded verification with one worker where browser tests are involved.
38. Generate ignored bridge JSON after verification so the local app has fresh data.
39. Commit tracked source and documentation changes only.
