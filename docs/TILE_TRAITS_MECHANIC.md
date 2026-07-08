# Tile Traits / Tile Events Mechanic

## Objective

Make the board itself participate in Chart & Depart. A player should not only ask whether a tile is reachable; they should understand what that tile tempts them to do and what it changes about the escape plan.

## Design Rule

A route is not just valid or invalid. It should carry a small tactical story: trail, signal, shelter, danger, cache, vein, echo, or vantage.

## Sequential Implementation Checklist

1. Define the feature as Tile Traits / Tile Events.
2. Keep the first pass client-derived and deterministic from existing tile data, zone alias, tile type, game id, and visible board state.
3. Avoid contract changes in this pass.
4. Add a pure helper at `app/src/lib/tileTraits.js`.
5. Define trait IDs: `signal`, `unstable-ground`, `cache`, `shelter`, `high-ground`, `old-trail`, `echo-field`, and `relic-vein`.
6. Define categories: `route`, `risk`, `recovery`, `reveal`, `value`, and `team`.
7. Define triggers: `target`, `enter`, `reveal`, `dig`, `rest`, `help`, and `flee-route`.
8. Give each trait `id`, `label`, `category`, `tone`, `summary`, `effect`, `trigger`, `preferredAction`, `pressureDelta`, `costDelta`, `routeDelta`, `revealDelta`, `valueDelta`, and `teamDelta`.
9. Define Signal as a route trait that can lower pressure or improve stability, strongest near a route home.
10. Define Unstable Ground as a risk trait that warns against digging or ending there.
11. Define Cache as a value trait that can help secure recovered value.
12. Define Shelter as a recovery trait that makes Rest tactically placed.
13. Define High Ground as a reveal trait that previews adjacent fog or improves scouting.
14. Define Old Trail as a route trait that helps movement toward landing.
15. Define Echo Field as a team trait that makes Help feel spatial.
16. Define Relic Vein as a value trait that tempts Dig while increasing pressure risk.
17. Implement deterministic assignment from `gameId`, `zoneAlias`, `tileType`, `landingSite`, `revealedAliases`, `currentLocation`, and pressure.
18. Use a stable hash function so assignments are consistent across renders.
19. Bias traits by tile type.
20. Bias traits by distance from landing.
21. Bias traits by current pressure.
22. Export `TRAIT_DEFINITIONS`, `traitForTile()`, `traitsForBoard()`, `traitPreviewForIntent()`, `traitEffectsForAction()`, and `traitToneClass()`.
23. Add tests for deterministic assignment.
24. Add tests for tile-type bias.
25. Add tests for distance bias.
26. Add tests for pressure bias.
27. Add tests for trait effects by action.
28. Add tests for unknown or fog fallback.
29. Integrate traits into `HexGrid`.
30. Pass required context into `HexGrid`: `gameId`, `landingSite`, `departPressure`, `escapeCostPreview`, `revealedMap`, `activeAction`, and `intentAlias`.
31. Compute traits with `useMemo`.
32. Add a small non-obstructive glyph or badge to `HexTile`.
33. Add accessible label/title for traits.
34. Add a compact `TraitPreviewPanel` component.
35. Show trait label, trigger, preferred action, effect, pressure/cost/route implication, and warning for a poor selected action.
36. Place the panel near board guidance, not in a modal.
37. Keep it compact on mobile.
38. Add route planning notes when selected route includes Old Trail, Unstable Ground, or Signal.
39. Keep benefits as forecast language and do not change route validation unless already supported.
40. Update Depart Pressure derivation to accept optional tile trait effects.
41. Let Signal and Old Trail reduce derived pressure.
42. Let Unstable Ground and Relic Vein increase pressure.
43. Let Shelter and Echo Field reduce crew-risk pressure.
44. Let Cache reduce artifact-risk pressure.
45. Update Escape Cost Preview to accept optional tile trait effects.
46. Add trait-powered mitigations when useful.
47. Keep new mitigations mapped to existing actions.
48. Update Cost Reduction Actions so trait-powered mitigations display naturally.
49. Update guidance to mention trait details when route intent exists.
50. Update ActionPanel with a Trait Effect card.
51. Update MoveControl route notes with trait-based route warnings and benefits.
52. Update SubmitConfirmation with trait warning or benefit before signing.
53. Update ActionSimulator predicted outcome copy with trait effects.
54. Update fun telemetry and barks with trait language.
55. Update growth simulator events with trait fields and matched-action metadata.
56. Reward matched trait action with agency or life-pulse.
57. Penalize ignored trait warning with friction or pressure.
58. Update fun quality gates to count trait surprise moments.
59. Update badges and share text for memorable trait moments.
60. Update field manual with a Tile Traits section.
61. Update How To so route selection includes reading tile traits before submitting.
62. Update action descriptions with trait interactions.
63. Add e2e assertion that the Field Manual contains Tile Traits.
64. Add focused unit tests for tile traits and touched gameplay helpers.
65. Run full tests.
66. Run build.
67. Run SEO validation and generation if metadata changes.
68. Run Playwright home and game specs.
69. Check glyphs do not crowd labels, players, landing markers, or routes.
70. Scan for unfinished implementation markers.
71. Run `git diff --check`.
72. Review copy for overpromising deterministic mechanics.
73. Use forecast language where behavior is client-derived.
74. Keep action blocking tied to existing validation only.
75. Ensure every trait has a reason to care, a preferred action, and a tradeoff.
76. Ensure every terrain type can produce at least two different traits.
77. Ensure high-pressure states bias toward relief traits enough that counterplay feels possible.
78. Ensure low-pressure states bias toward temptation traits enough that greed feels interesting.
79. Acceptance: hovering or targeting a tile immediately shows what that tile tempts the player to do.
80. Acceptance: at least one visible tile per normal turn should feel tactically different from neighbors.
81. Acceptance: route planning has a small story: trail, signal, shelter, danger, cache, vein, echo, or vantage.
82. Acceptance: tile traits move tension onto the board, not only into panels after the fact.

## Completion Snapshot

Implemented in this pass:

- Deterministic client-derived Tile Traits with trait definitions, biasing, action effects, previews, and unit coverage.
- Board integration with tile glyphs, accessible titles, route intent previews, and compact trait panels.
- Depart Pressure and Escape Cost Preview hooks for trait effects and trait-powered reduction actions.
- Action Console, Move, Flee, simulation, and confirmation surfaces that expose trait consequence before submit.
- Guidance and fun telemetry that name trait matches, warnings, barks, cues, and turn moments.
- Growth simulator trait events, scoring impact, share text, titles, quality gates, and badges.
- Field Manual copy and e2e coverage for Tile Traits.

Verification target:

- Focused gameplay tests.
- Full unit suite.
- Production build.
- SEO validation and generation.
- Playwright home and game specs.
- Marker scan and whitespace check.
