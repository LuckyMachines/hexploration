# Turn Aftermath Moments

## Objective

Make each resolved turn land as a memorable consequence, not a pile of accounting rows. After resolution, a player should understand what the turn changed, why it matters to departure, and what pressure it creates for the next turn.

## Weakest Current Beat

The resolution surface is factual but emotionally flat. It shows actions, cards, chain steps, stat changes, and inventory changes, but it does not clearly answer: did that turn help us depart, cost us, tempt us, save us, or make the next turn urgent?

## Design Rule

Every resolved turn needs one primary sentence the player can remember and one next-turn prompt that points back into Chart & Depart.

## Sequential Implementation Checklist

1. Define the feature as Turn Aftermath Moments.
2. Keep the first pass client-derived and deterministic from visible action, card, stat, inventory, pressure, cost, trait, and replay data.
3. Avoid contract changes in this pass.
4. Add a pure helper at `app/src/lib/turnAftermath.js`.
5. Define moment categories: `escape-progress`, `pressure-spike`, `route-save`, `trait-payoff`, `trait-warning`, `artifact-payoff`, `crew-save`, `bad-luck`, `clean-turn`, `desperate-turn`, and `setup-turn`.
6. Define a moment object with `id`, `title`, `category`, `tone`, `summary`, `whyItMatters`, `nextPrompt`, `score`, `players`, `actions`, `statDelta`, `inventoryDelta`, `pressureDelta`, `routeDelta`, `trait`, `card`, and `receipts`.
7. Implement `deriveTurnAftermath()`.
8. Return `null` when there is no meaningful turn data.
9. Score each possible moment by emotional strength.
10. Weight escape progress when movement heads toward landing or the crew becomes flee-ready.
11. Weight pressure spike when pressure or escape cost worsens.
12. Weight route-save when pressure falls, route stability improves, or movement points home.
13. Weight trait-payoff when a tile trait matched the chosen action.
14. Weight trait-warning when a dangerous trait was triggered or ignored.
15. Weight artifact-payoff when inventory gains recovered value.
16. Weight crew-save when Rest or Help improves weak stats or protects a player.
17. Weight bad-luck when a card hurts stats, inventory, route stability, or pressure.
18. Weight clean-turn when multiple small positives happen without a penalty.
19. Weight desperate-turn when the crew survives but pressure remains high.
20. Pick one primary aftermath moment.
21. Pick up to three secondary receipts that explain why the primary moment won.
22. Add focused tests for empty input.
23. Add focused tests for stat losses.
24. Add focused tests for artifact payoff.
25. Add focused tests for pressure spikes.
26. Add focused tests for pressure reduction.
27. Add focused tests for trait payoff.
28. Add focused tests for trait warning.
29. Add focused tests for highest-score selection.
30. Add `app/src/components/resolution/AftermathMoment.jsx`.
31. Render the component at the top of `TurnResolution`.
32. Give the panel a strong hierarchy: title, summary, why it matters, next prompt, and receipts.
33. Use existing tone language and visual classes.
34. Keep it compact on mobile.
35. Avoid generic success copy.
36. Show a next-turn pressure line when pressure or escape cost exists.
37. Show a what-changed line for stat and inventory deltas.
38. Show a why-you-care line tied to depart readiness.
39. Thread `departPressure`, `escapeCostPreview`, and `traitPreview` into `TurnResolution`.
40. Keep `TurnResolution` hidden when no turn data exists.
41. Update `ActionResult` so each result has a consequence label.
42. Add action aftermath copy for Move, Dig, Rest, Help, Flee, and Camp.
43. Update `CardDraw` so card results read as consequences.
44. Add tone classification for card outcomes.
45. Update `StatChange` to group gains and losses into clearer reads.
46. Keep `InventoryChange` readable for artifact and value payoff.
47. Update `turnReplay` summaries only where player-facing labels already exist.
48. Add aftermath fields to `funTelemetry`.
49. Add aftermath-aware barks and named moments.
50. Update `growthLoop` events to store aftermath-like moment metadata.
51. Update growth summaries to count aftermath moments.
52. Update share text support for the best aftermath beat.
53. Add badges for Route Save, Pressure Spike, Clean Turn, Clutch Help, Shelter Recovery, Costly Dig, and Artifact Lift.
54. Update Field Manual with a Turn Aftermath section.
55. Update guided first-turn copy to ask players to read aftermath before choosing the next action.
56. Update e2e tests to assert Turn Aftermath appears in the manual.
57. Add visual e2e coverage for aftermath panel layout where feasible.
58. Ensure the aftermath panel does not push the board too far down on desktop.
59. Ensure the aftermath panel is not buried on mobile resolution views.
60. Ensure the panel does not duplicate action outcome cards.
61. Keep chain replay available but secondary.
62. Use forecast language for client-derived pressure, cost, and trait effects.
63. Keep action blocking and validation unchanged.
64. Run focused tests.
65. Run full unit suite.
66. Run production build.
67. Run SEO validation and generation if public copy changes.
68. Run Playwright home and game specs.
69. Run visual spec for resolution layout.
70. Scan for unfinished implementation markers.
71. Run `git diff --check`.
72. Acceptance: after resolution, a player can summarize the turn in one sentence.
73. Acceptance: the highlighted aftermath makes the next action feel motivated.
74. Acceptance: card, stat, and inventory changes feel like story consequences.
75. Acceptance: pressure, cost, and trait systems remain visible after resolution.
76. Acceptance: the player asks whether they can survive one more turn.

## Completion Snapshot

Implemented in this pass:

- Pure Turn Aftermath classifier with categories, scoring, receipts, action copy, card tone, and focused tests.
- Top-of-resolution Aftermath Moment panel with title, consequence, why it matters, next-turn prompt, receipts, and pressure read.
- Resolution rows that present action, card, stat, and inventory changes as consequences.
- Expedition wiring for pressure, escape cost, and trait context.
- Growth simulator aftermath metadata, summary counts, share text support, fun quality gates, and badges.
- Fun telemetry support for aftermath-aware previews, named moments, and barks.
- Field Manual and guided first-turn copy explaining how to read aftermath before the next action.
- E2E manual assertion for Turn Aftermath.

Verification completed:

- Focused aftermath, growth, fun, and resolution tests.
- Full unit suite.
- Production build.
- SEO validation and generation.
- Playwright home and game specs.
- Visual Playwright spec.
- Marker scan.
- Whitespace check.
