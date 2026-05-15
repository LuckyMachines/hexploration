# Scenario Autopilot Implementation Plan

1. Define the feature as Scenario Autopilot: a safe orchestration layer that turns plain-English gameplay intent into scenario setup, simulator evidence, Oracle diagnosis, candidate changes, rerun comparison, and a design memo.
2. Add `scripts/scenario-autopilot-utils.mjs` for pure logic: intent normalization, scenario resolution, setup validation, diagnosis, candidate generation, patch application, comparison, verdicts, report paths, report writing, and Markdown memo generation.
3. Add `scripts/scenario-autopilot.mjs` for CLI workflows: dry-run, single-pass, iterate, existing-scenario runs, latest report, and Markdown output.
4. Add package scripts: `autopilot`, `autopilot:dry`, `autopilot:scenario`, `autopilot:latest`, and `autopilot:test`.
5. Use existing systems instead of duplicating rules: Scenario Designer for scenario authoring, Setup Forge for setup honesty, Gameplay Simulator for exact-engine runs, Gameplay Oracle for verdicts, and `simulator.balance.json` for safe balance patches.
6. Define safety limits: bounded iterations, bounded simulator timeout, allowed patch surfaces only, JSON rollback, no Solidity edits, and no automatic commits.
7. Add candidate generation for setup blockers, agency, readability, tension, recovery, surprise, pacing, system integration, and scenario target gaps.
8. Support scenario-only patches, setup prelude patches, and small balance knob patches.
9. Keep `--apply` explicit; without it, Autopilot recommends and reports but does not mutate tuning files.
10. When `--apply` is used, snapshot changed files, apply the smallest candidate, rerun, compare, accept improvements, and rollback rejected changes.
11. Write reports to `reports/simulator/autopilot`, scenario-specific Autopilot folders, and `app/public/simulator/autopilot`.
12. Generate Markdown design memos containing intent, setup exactness, baseline verdict, selected change, rerun comparison, final verdict, and next command.
13. Add unit tests for intent planning, candidate generation, comparison, patch application, rollback, and report writing.
14. Add `/simulator` UI support for latest Autopilot report with empty, dry-run, and comparison states.
15. Update README and simulator/oracle docs with Autopilot workflows and safety model.
16. Add Playwright coverage for the Scenario Autopilot panel.
17. Validate with syntax checks, Autopilot tests, existing scenario/setup/oracle tests, scenario validation, app build, and a focused simulator UI smoke check.
18. Commit as `Add scenario autopilot` once the repo is clean.
