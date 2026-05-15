# Growth Loop Implementation Plan

The growth superpower is a public loop: a player can open a scenario, finish a short run, get a memorable shareable result, replay the run, and invite another player to try the same seed.

## Sequential Build Order

1. Define the north-star metric as shared completed runs per week.
2. Add supporting metrics for starts, completions, share-card generation, replay opens, scenario creation, and feedback.
3. Pick `escape-pressure-4p` as the flagship challenge and `solo-artifact-hunt` as the fast solo entry.
4. Add a public growth engine that can create deterministic seeded runs.
5. Add deterministic action resolution for move, dig, rest, help, flee, and inspect.
6. Make every action produce a visible event, stat delta, feeling label, pulse, agency, and friction value.
7. Add result summarization with outcome, best moment, worst moment, arc shape, arc score, artifacts, saved players, and turns used.
8. Add URL-safe replay serialization.
9. Add share summary text generation.
10. Add challenge scoring and leaderboard ranking.
11. Add public scenario cards with player count, duration, tags, difficulty, and hook.
12. Add a public `/play` route that opens directly into a playable run.
13. Add scenario and seed query params for `/play`.
14. Add a result screen with copyable share text and replay URL.
15. Add a share-card HTML preview that can later be exported as PNG.
16. Add a `/challenge` route for the weekly fixed-seed challenge.
17. Add a local leaderboard using completed local runs.
18. Add a `/scenarios` route for the scenario gallery.
19. Add a `/replay/:runId` route for deterministic run playback.
20. Add a `/progress` route that translates evidence into public scenario progress.
21. Add a `/devlog` route that turns evidence into readable tuning notes.
22. Add a `/create-scenario` route for a local creator preview and play link.
23. Add local analytics events without collecting personal data.
24. Add docs for the growth loop, routes, metrics, and release checklist.
25. Add a CLI growth report that summarizes starts, completions, shares, top scenarios, friction, and next growth experiment.
26. Add unit tests for run creation, action resolution, summaries, challenge scoring, replay serialization, and report generation.
27. Add browser tests for `/play`, `/challenge`, `/scenarios`, `/replay`, `/progress`, `/devlog`, and `/create-scenario`.
28. Wire routes into the existing app navigation.
29. Keep generated report outputs ignored.
30. Verify build, unit tests, e2e smoke, and clean tracked repo.

## First Fully Implemented Slice

This implementation covers the whole public loop locally: public play, deterministic seeds, challenge, share summary, replay links, scenario gallery, creator preview, progress/devlog surfaces, local analytics, growth report CLI, tests, and documentation.
