# Playable Design Memory Implementation Plan

Playable Design Memory gives the project one persistent design brain: every scenario, simulator run, setup result, Oracle verdict, auto-tune outcome, and Autopilot memo becomes searchable evidence for what makes the game feel alive.

## Sequential Implementation List

1. Define a stable memory schema with source events, scenario rollups, theme rollups, findings, experiment history, setup limits, open questions, recommendations, and citations.
2. Collect all local simulator evidence from scenario definitions, latest simulator reports, per-scenario reports, Oracle reports, Setup Forge reports, Autopilot reports, auto-tune experiment reports, and the tuning ledger.
3. Normalize each source into a compact event with timestamp, source type, scenario id, summary, metrics, tags, systems, evidence, source path, and authority.
4. Deduplicate repeated latest/stamped reports so the same fact does not dominate rollups.
5. Extract scenario-level state from the newest simulator, Oracle, setup, and Autopilot events.
6. Extract theme-level memory for cooperation, escape, artifact, agency, readability, pacing, tension, recovery, survival, exploration, and surprise.
7. Detect recurring weak dimensions and failure patterns across scenarios.
8. Detect accepted, rejected, planned, and inconclusive experiments from Autopilot and auto-tune records.
9. Rank setup limitations by frequency, criticality, and scenario importance.
10. Generate open questions for missing runs, missing Oracle verdicts, stale evidence, low-confidence results, blocked setup, failed gates, and dry-run-only plans.
11. Generate concrete next recommendations that prefer evidence repair before balance tuning.
12. Add a query parser for scenario ids, themes, metrics, blockers, accepted changes, rejected changes, and free-text keywords.
13. Rank matching events with scenario, theme, metric, keyword, authority, and recency scores.
14. Compose query answers with what is known, what changed, what remains uncertain, recommended next action, and citations.
15. Write latest memory JSON, Markdown, history, index, and public UI copies.
16. Add a memory doctor that reports missing, stale, blocked, and low-evidence areas without mutating game data.
17. Add a CLI with `build`, `query`, `latest`, and `doctor` commands.
18. Add package scripts for the memory workflow and tests.
19. Add focused unit tests for normalization, rollups, themes, findings, queries, Markdown, and doctor output.
20. Add a `/simulator` Playable Design Memory panel that reads the same public JSON as the CLI writes.
21. Update simulator, Oracle, Autopilot, and README documentation so the workflow is discoverable.
22. Verify that generated memory reports stay in ignored report/public output folders and that only implementation/docs are committed.
23. Run focused tests and checks.
24. Commit the feature with a clean working tree.
