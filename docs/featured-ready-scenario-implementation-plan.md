# Featured-Ready Scenario Implementation Plan

Goal: make at least one public scenario reach `featured-ready` in `npm run bridge:doctor`, then verify the public routes render that readiness correctly.

1. Confirm the target outcome: at least one scenario reaches `featured-ready` in `npm run bridge:doctor`.
2. Pick the first flagship candidate: `escape-pressure-4p`.
3. Generate fresh exact-engine scenario evidence with `npm run scenario:run -- --id=escape-pressure-4p`.
4. Generate felt-control evidence with `npm run feel:scenario -- --id=escape-pressure-4p`.
5. Generate trend evidence with `npm run time-machine:scenario -- --id=escape-pressure-4p`.
6. Generate design-journal readiness evidence with `npm run lab:entry -- --id=escape-pressure-4p`.
7. Regenerate fun gates with `npm run fun:report`.
8. Regenerate growth gates with `npm run growth:capture -- --scenario=escape-pressure-4p --seed=featured-ready-escape`, then `npm run growth:report -- --events=reports/growth/local-events.json`.
9. Regenerate the bridge for the scenario with `npm run bridge:scenario -- --id=escape-pressure-4p --markdown`.
10. Inspect the bridge verdict and branch on the result.
11. Run bridge doctor with `npm run bridge:doctor -- --markdown`.
12. If setup is blocked, diagnose setup with `npm run setup:explain -- --id=escape-pressure-4p`.
13. Fix the highest-severity setup blocker first.
14. Re-run scenario evidence and bridge readiness after setup fixes.
15. If the scenario is regressing, compare evidence with `npm run time-machine:compare -- --id=escape-pressure-4p --against=last-good --markdown`.
16. Identify whether any regression comes from low health score, flat turns, failed Oracle gate, setup fidelity, missing payoff, late first-alive turn, or weak recovery/comeback evidence.
17. Apply the smallest relevant gameplay or scenario adjustment.
18. Re-run the exact same scenario evidence chain.
19. If the bridge says `needs-fun-work`, inspect the first `nextFix`.
20. Implement that `nextFix` fully.
21. Re-run felt-control, fun, and bridge evidence.
22. Confirm featured gates: first alive turn <= 2, no early flat turn, share-worthy moment exists, arc score meets target, no hard setup blocker, no regression, and Lab readiness is `ready` or `ready-with-caveats`.
23. If public completions are missing, complete or replay a local public run through `/play?scenario=escape-pressure-4p&seed=featured-ready-escape`, then capture run, completion, share, and replay events with `npm run growth:capture -- --scenario=escape-pressure-4p --seed=featured-ready-escape`.
24. Regenerate growth evidence with `npm run growth:report -- --events=reports/growth/local-events.json`.
25. Rebuild all bridge outputs with `npm run bridge:build -- --markdown`.
26. Verify public bridge JSON with `npm run bridge:latest -- --markdown`.
27. Confirm `app/public/bridge/latest-report.json` exists locally and remains ignored by Git.
28. Open `/play` and confirm it selects the featured bridge scenario when no manual query is present.
29. Open `/challenge` and confirm it selects the bridge challenge scenario.
30. Open `/scenarios` and confirm the featured scenario sorts to the top.
31. Open `/progress` and confirm bridge readiness appears in progress cards.
32. Open `/devlog` and confirm bridge entries explain current readiness.
33. Open `/create-scenario` and confirm evidence requirements are visible.
34. Run focused verification: `npm run bridge:test`, app bridge helper tests, app build, and focused Chromium Playwright growth routes.
35. Run final checks with `git diff --check` and `git status --short`.
36. Commit tracked source, docs, and tests if code changed during fixes.
37. Leave generated bridge reports ignored.
38. Final success condition: `npm run bridge:doctor -- --markdown` reports at least one `featured-ready` scenario and public routes render that readiness correctly.
