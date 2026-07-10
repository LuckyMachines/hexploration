# Expedition Memory System

## Product Question

Now that Xenovoya has a full run arc, what is the weakest reason for a player to start a second expedition, and what persistent reward, challenge, or memory system would make replaying feel necessary rather than optional?

## Answer

The weakest reason to start a second expedition is that a finished run can still feel like a closed report instead of a new benchmark. The fix is an Expedition Memory system: every completed run becomes a named memory with badges, bests, a replay link, and one generated "Beat This" challenge that asks the player to improve a concrete consequence next time.

## Implementation Checklist

1. Define the persistent memory goal: completed expeditions should become records players want to beat, not just summaries they can share.
2. Use local storage for the first implementation so public runs and live Game Over can persist memory without new backend requirements.
3. Add a schema version and storage key so the memory format can evolve safely.
4. Add pure helpers for memory load, save, validation, pruning, ranking, and aggregate stats.
5. Add a canonical memory entry shape with id, title, source, scenario, seed, outcome, score, arc, pressure, escape cost, artifacts, crew result, badges, best moment, replay path, and timestamp.
6. Add safe corrupted-storage handling that returns an empty memory state instead of breaking the client.
7. Add deterministic ids so re-rendering Game Over does not duplicate the same completed expedition.
8. Add a scoring model that rewards clean escape, recovered value, crew survival, arc score, mitigation, memorable aftermath, and pressure control.
9. Add memory badges that include escaped, clean departure, redline survival, final call, cost cut, route save, crew secured, artifact lift, and stayed too long.
10. Add aggregate stats for total memories, escapes, best score, best clean score, highest pressure escape, most artifacts, badges, latest memory, and best memory.
11. Add memory insights that explain what the last run proved and what the next run should improve.
12. Add pruning so the local record stays bounded while preserving top memories and latest memories.
13. Add challenge helpers that turn the latest memory and aggregate stats into one concrete next-run target.
14. Support first-run challenge copy when no memory exists yet.
15. Support "beat your score" after a solid clean escape.
16. Support "bring more value home" when a run escaped with low recovered value.
17. Support "lower the departure cost" when a run escaped close, costly, or at redline.
18. Support "get someone home" after crew loss or collapse.
19. Support "prove the warning wrong" after route collapse or stayed-too-long outcomes.
20. Support "rival seed" for public runs so a replay can lead immediately into a comparable attempt.
21. Add unit tests for storage load/save, corruption recovery, dedupe, pruning, ranking, badges, stats, and challenge generation.
22. Integrate public growth-run summaries into memory creation without duplicating summary logic.
23. Record a public run memory exactly once when a public run completes.
24. Show a Memory Created block on public run completion with title, score, badges, insight, and next challenge.
25. Update public share text so "Can you beat this run?" points at the actual generated benchmark.
26. Add a reusable MemoryCard component for latest and best memories.
27. Add a reusable BadgeShelf component for persistent badge progress.
28. Add a reusable BeatThisChallenge component for generated challenges.
29. Add a reusable ExpeditionMemoryPanel component that loads local memory and renders latest, best, badges, stats, and challenge.
30. Add the memory panel to the home page so returning players immediately see what to beat.
31. Add the memory panel near live expedition access so local history sits beside the next start action.
32. Add memory evidence to the progress page so scenario progress reflects persistent run records.
33. Add live Game Over memory creation from final pressure, escape cost, arc, crew state, recovered value, replay proof count, and report URL.
34. Show live Game Over memory before the long crew report so the next-run reason appears while the outcome is emotionally fresh.
35. Use the existing report link as the live replay/report path when available.
36. Keep stored live proof privacy-light by storing proof counts and report path, not raw transaction lists.
37. Add a start-new-expedition or rematch CTA beside generated challenges.
38. Keep all UI responsive with stable grids and compact labels that fit on mobile.
39. Update Field Manual Overview with Expedition Memory.
40. Update Field Manual How To with memory and challenge steps.
41. Update home e2e assertions to cover Expedition Memory in the manual or home page.
42. Run focused unit tests for the new helpers and existing growth/fun helpers.
43. Run the app test suite.
44. Run the production build.
45. Run SEO tests and regenerate metadata because public copy changed.
46. Run Playwright coverage for home and public play if the local stack permits it.
47. Scan for forbidden fix markers before finishing.
48. Update this document with a completion snapshot and final grade.

## Acceptance Criteria

- A completed public run creates a persistent named memory.
- A completed live expedition creates a persistent named memory.
- The home page reminds returning players what they last did and what to beat next.
- The completed-run screen makes the next challenge impossible to miss.
- Badges and bests accumulate across runs.
- Corrupted or absent local storage never breaks rendering.
- Tests cover the memory model and challenge derivation.
- Documentation teaches the system without hidden implementation notes.

## Completion Snapshot

Status: Complete.

Implemented:

- Persistent local Expedition Memory storage with schema versioning, corrupted-storage recovery, deterministic dedupe, pruning, ranking, stats, insights, and badges.
- Beat This challenge derivation for first memory, failed value runs, costly escapes, clean empty escapes, stable greed benchmarks, and best-score pursuits.
- Live Game Over memory creation from final pressure, escape cost, arc, crew outcome, recovered value, proof count, and report path.
- Public play memory creation from completed growth-run summaries, with Memory Created and Beat This Challenge surfaced at completion.
- Home and Progress page memory panels for returning-player replay motivation.
- Field Manual Overview and How To guidance for Expedition Memory and Beat This challenges.
- Updated share copy so the replay ask names a concrete benchmark.
- Unit and e2e coverage for the new memory model and updated public surfaces.

Verification:

- `npm test -- --run src/lib/expeditionMemory.test.js src/lib/expeditionChallenges.test.js`
- `npm test -- --run src/lib/expeditionMemory.test.js src/lib/expeditionChallenges.test.js src/lib/growthLoop.test.js src/lib/funLoop.test.js`
- `npm run build` from `app`
- `npm test -- --run` from `app`
- `npm run seo:test`
- `npm run seo:generate`
- `npx playwright test e2e/home.spec.js` with `E2E_APP_PORT=43144`
- `npx playwright test e2e/growth.spec.js` with `E2E_APP_PORT=43146`
- Forbidden-marker scan over changed files
- `git diff --check`

Final grade under the stricter replay bar: A-. The second-run reason is now present on completion, home, and progress surfaces with persistent badges and benchmark challenges. The remaining step toward a full A is cloud-backed cross-device memory, which is outside the current local-client implementation.
