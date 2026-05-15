# Fun-First Public Run Loop Implementation Plan

The fun goal is that every public run creates at least one moment worth retelling. The full implementation works top to bottom through the public growth loop instead of creating a separate game model.

## Ordered Implementation

1. Define fun quality gates: first alive turn, payoff count, pressure spikes, recovery count, longest flat streak, share-worthy moment, verdict, and recommendations.
2. Add a reusable `app/src/lib/funLoop.js` layer for previews, barks, board reactions, moments, artifacts, roles, event cards, comeback valves, flee outcomes, run titles, badges, personal bests, and fun quality.
3. Add deterministic action previews for move, dig, rest, help, flee, and inspect.
4. Add selected-action preview state to `/play`.
5. Add deterministic character barks for preview, commit, payoff, panic, recovery, flat, escape, loss, and idle states.
6. Add moment camera data for payoff, panic, recovery, escape, collapse, route betrayal, and clean reads.
7. Add board reaction classes and CSS animations for action outcomes.
8. Add deterministic secondary event cards: Storm Front, Old Trail, Hollow Ground, Signal Spark, Broken Strap, Whispering Ruins, Sudden Clearing, and Exhaustion Wave.
9. Add comeback valves for low morale, high danger, late distance pressure, clutch rest, team save, last route, and desperate flee.
10. Add dramatic flee outcomes: clean escape, close escape, near miss, forced retreat, artifact dropped, and teammate left behind.
11. Add artifact personalities: Sun Compass, Bone Lantern, Storm Key, Glass Idol, and Root Crown.
12. Store discovered artifacts as objects and update summaries, replay, and share cards.
13. Add player roles: Scout, Medic, Carrier, and Guard.
14. Apply role effects to action resolution and previews.
15. Add team-tension dilemma tags for save, greed, route push, and blind move pressure.
16. Add press-your-luck dig streak risk and greed badge detection.
17. Add dramatic final-turn anti-flat bias.
18. Add memorable loss categories and epilogue text.
19. Generate run titles from outcome, best moment, artifacts, flee result, and arc shape.
20. Add achievements and badges.
21. Track local personal bests after completed runs.
22. Add rival seed and chaos mode support.
23. Add challenge modifiers: Heavy Fog, Low Morale, Extra Relic, Damaged Route, Calm Start, and Storm Season.
24. Add visible Fun Report blocks to `/play`, `/challenge`, `/replay`, and `/progress`.
25. Add share-card flavor: run title, artifacts, best bark, badges, challenge score, and replay link.
26. Add richer replay narration, selected-turn support, and copy moment links.
27. Add `npm run fun:report`, report utilities, tests, and ignored generated outputs.
28. Add docs for the fun loop and report.
29. Add browser coverage for previews, barks, Fun Report, challenge modifier, replay moments, and creator stability.
30. Verify focused tests, build, Chromium smoke, ignored generated outputs, and commit.
