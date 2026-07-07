# Chart & Depart Play Client Implementation Plan

## Objective

Align the live Xenovoya play client with the public Chart & Depart positioning:

> Xenovoya is a cooperative Chart & Depart expedition game: chart as much of the alien grid as you can, then get the crew back alive before the route collapses.

The first-play promise is:

> Your job is to reveal useful map, recover value, keep a route home, and escape before pressure closes in.

## Sequential Implementation Checklist

1. Define the canonical play-client pitch and reuse it across player-facing surfaces.
2. Define the first-play promise around revealing useful map, recovering value, preserving the route home, and escaping before pressure closes.
3. Update the play-client homepage hero eyebrow from generic board-game language to Chart & Depart positioning.
4. Update the homepage hero body so the first read is charting, recovering value, and departing alive.
5. Update the primary homepage CTA from scenario browsing language to expedition-start language.
6. Update the secondary homepage CTA to feel like choosing an expedition route rather than browsing database entries.
7. Rewrite the hero supporting note so public scenarios teach Chart & Depart before wallet-backed live surveys.
8. Rename the homepage "What you do" section around the Chart & Depart loop.
9. Rewrite the "One turn should already feel alive" section around pushing farther versus leaving alive.
10. Update the homepage action loop copy for Move, Dig, Rest, Help, and Flee.
11. Update the "Start here" section to present scenarios as short expeditions.
12. Rewrite featured scenario support copy around charting fast, recovering value, and escaping.
13. Update the "Why it is different" section around the moment players decide to leave.
14. Rewrite internal design/tuning language into player-facing expedition tension.
15. Replace the four homepage explanatory cards with Map pressure, Escape timing, Crew recovery, and Replayable expeditions.
16. Update the live game access section to take the Chart & Depart loop on-chain.
17. Rewrite live access body copy around public scenarios teaching the rhythm and live surveys recording it.
18. Update the homepage SurveyTabletFrame subtitle.
19. Update the playable-now sidebar copy around learning when to chart and when to get out.
20. Update homepage FAQ copy for walletless play and on-chain play.
21. Update FirstExpeditionGuide title.
22. Update FirstExpeditionGuide intro.
23. Update FirstExpeditionGuide step labels.
24. Update FirstExpeditionGuide step details.
25. Update FirstExpeditionGuide primary action labels.
26. Update GameBrowser title.
27. Update GameBrowser empty states.
28. Update GameBrowser loading copy.
29. Update GamePage tablet subtitle.
30. Update disconnected GamePage title and detail.
31. Update MissionStatus default objective.
32. Update MissionStatus route-planned objective.
33. Update UXStatusPanel heading.
34. Update uxGuidance default planning guidance.
35. Update uxGuidance move suggestion.
36. Update uxGuidance flee explanation.
37. Update ActionPanel header helper.
38. Update ActionPanel Flee copy.
39. Consider player-facing Depart naming while keeping internal FLEE mechanics stable.
40. Update SectionHowTo steps around entering, charting, digging, recovering, watching pressure, returning, and escaping.
41. Update SectionHowTo strategy tips.
42. Update SectionActions descriptions for Move, Dig, Rest, Help, and Flee.
43. Make GuidedFirstTurn visible by default for new players.
44. Update GuidedFirstTurn step 2 copy.
45. Update GuidedFirstTurn step 3 copy.
46. Update GuidedFirstTurn step 4 title.
47. Update GuidedFirstTurn step 4 body.
48. Add a compact Chart / Risk / Depart status strip to active game UI.
49. Expose escape readiness earlier in the active-game UI.
50. Audit whether survey or expedition should dominate; use expedition for session/journey and survey for in-world tablet flavor.
51. Rename visible new-survey button copy where it appears.
52. Rename visible available-surveys label copy where it appears.
53. Update GameLobby copy around crew, expedition, charting, and departure.
54. Update GameCard copy around Join Expedition and Expedition numbering.
55. Update public route metadata.
56. Update SEO config.
57. Update app public llms.txt.
58. Regenerate generated SEO artifacts if the repo provides a script.
59. Run targeted text search for old phrasing.
60. Run app build.
61. Run focused tests.
62. Update copy-based tests if they intentionally assert old labels.
63. Manually inspect homepage locally if a dev server is needed.
64. Manually inspect a scenario route.
65. Manually inspect a live game route when local chain state is available.
66. Keep Flee as the concrete action unless a broader action rename is intentionally scoped.
67. Add a concise Chart & Depart glossary/manual entry if a field manual overview exists.
68. Commit the implementation as a focused play-client positioning change.
69. Push and verify deployment.
70. After deployment, verify that the live client communicates Chart & Depart within 10 seconds.

## Acceptance Bar

- A new player can understand the loop before wallet interaction.
- The homepage, first expedition guide, active game UI, manual, metadata, and LLM text all agree on Chart & Depart.
- The active game UI makes both halves legible: charting useful ground and deciding when to depart.
- No placeholder markers or unfinished implementation notes are introduced.
- Existing internal contract/action names remain stable unless a safe display-label-only change is available.
