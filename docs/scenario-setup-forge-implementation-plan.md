# Scenario Setup Forge Implementation Plan

The Scenario Setup Forge turns authored scenario assumptions into exact same-engine starting-state requests wherever the current engine safely supports them, and reports every partial or blocked field honestly.

## Sequential Implementation Checklist

1. Define the superpower: turn authored scenario assumptions into same-engine starting states.
2. Add `docs/scenario-setup-forge.md`.
3. Document the current limitation: assumptions can be stored and judged, but many are not engine-enforced yet.
4. Define setup categories: player stats, inventory, artifacts, revealed zones, terrain layout, landing zone, campsites, day, queue phase, player locations, pressure clocks, and scripted prior events.
5. Add setup support statuses: `supported`, `partiallySupported`, `observedOnly`, `contractBlocked`, and `notYetSupported`.
6. Add `setupForge` blocks to scenarios.
7. Create `scripts/setup-forge-utils.mjs`.
8. Create `scripts/scenario-setup-forge.mjs`.
9. Add npm scripts: `setup:forge`, `setup:validate`, `setup:doctor`, `setup:test`, `setup:matrix`, `setup:explain`, `setup:author`, `setup:variant`, and `setup:backlog`.
10. Define a versioned setup forge schema.
11. Add normalization and validation.
12. Validate player indexes, stat bounds, artifacts, coordinate aliases, landing zones, campsites, revealed zones, day, phase, queue phase, and unsupported fields.
13. Inspect contracts and deployment scripts for available setup hooks.
14. Identify what can be seeded through public gameplay functions.
15. Identify what is contract-blocked.
16. Do not claim unsupported exact setup works.
17. Add setup modes: `strict`, `best-effort`, and `metadata-only`.
18. Strict mode fails on unsupported critical fields.
19. Best-effort mode applies supported fields and reports blocked fields.
20. Metadata-only mode stores and reports requested setup without touching chain.
21. Add setup application phase to simulator before the first measured snapshot.
22. Attach `setupForge`, `setupApplication`, setup level, setup ID, and setup diff to simulator reports.
23. Add setup evidence to Oracle.
24. Increase Oracle confidence when setup is applied; decrease it when critical setup is skipped.
25. Update Scenario Designer validation to compare assumptions and setup fields.
26. Parse setup hints from plain English: exhausted players, artifacts, landing revealed, day, campsites, separated players, low movement, and escape pressure.
27. Keep original assumptions even when `setupForge` exists.
28. Add setup dry-run and Markdown reports.
29. Add setup histories under `reports/simulator/setup-forge/` and per-scenario setup history.
30. Add public latest setup report for the simulator UI.
31. Add fixtures for solo artifact, escape pressure, unsupported exact setup, and metadata-only setup.
32. Add tests for normalization, validation, parser extraction, strict failure, best-effort skipped fields, metadata-only behavior, simulator attachment, and Oracle confidence effects.
33. Add `/simulator` Setup Forge panel.
34. Show mode, applied fields, skipped fields, failed fields, warnings, support status, setup diff, setup level, and coverage.
35. Add setup badges to scenario cards.
36. Add E2E assertion that the Setup Forge panel renders.
37. Update README, simulator docs, and Oracle docs.
38. Add setup support backlog generation ranked by core scenario impact.
39. Add scripted prelude support as a partial setup path.
40. Store prelude traces separately and optionally exclude them from measured metrics.
41. Compare requested setup to actual initial snapshot where observable.
42. Add critical setup flags and coverage metrics.
43. Add setup-aware Oracle project summary fields.
44. Run bounded verification.
45. Try live setup only if local stack deploy completes.
46. Commit as `Add scenario setup forge`.
47. Confirm a clean repo.
