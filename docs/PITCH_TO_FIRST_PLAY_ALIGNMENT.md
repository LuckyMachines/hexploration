# Xenovoya Pitch-To-First-Play Alignment

## Goal

Make the public Xenovoya experience match the promise a new player hears in the pitch: launch a crew, chart an alien grid, decide when to stop pushing, and escape with a memorable record.

## Sequential Implementation Plan

1. Make the homepage first 60 seconds single-purpose: the dominant action should be starting an expedition, with gameplay browsing secondary.
2. Keep internal tools out of the player funnel: no simulator, design system, devlog, generated-image, tuning, or local-build language on the homepage.
3. Reframe every homepage section as player action: chart, decide, depart, remember, replay.
4. Replace proof-heavy language with consequence language first, then explain verification only where it helps the player understand why a run matters.
5. Make the first scenario feel like the canonical onboarding expedition, not one option among many.
6. Add a "What happens on your first turn" strip near the first CTA: reveal tile, read risk, choose whether to push or return.
7. Make the no-wallet path explicit: trying a short expedition should feel like the intended first step, not a lesser demo.
8. Keep wallet/on-chain explanation to one plain-English promise: actions and outcomes become inspectable records.
9. Keep live expedition access lower than the no-wallet first-run path unless the player is already connected.
10. Make scenario cards describe player feeling before systems data: danger, payoff, rescue, extraction.
11. Treat generated images as finished in-world expedition art, not options or production notes.
12. Add a first-run completion bridge: after a public scenario, point to replay memory, challenge, then live expedition.
13. Ensure nav mirrors the user journey: Home, Play, Scenarios, Challenge, Progress.
14. Keep internal routes accessible directly, but not promoted from the public shell.
15. Add e2e coverage that fails if homepage rendered text includes internal meta terms.

## Acceptance Criteria

- A new visitor can identify the intended first action in under 10 seconds.
- The homepage rendered text does not include internal development or tuning language.
- The first scenario is presented as the best first expedition.
- The first turn is explained as a concrete player sequence, not a system overview.
- No-wallet play is framed as a real expedition path.
- Live wallet play is framed as the next step after learning the loop.
- Finished public runs create a clear next action: view/share memory, take the challenge, or go live.
- Tests, build, and focused browser checks pass with no placeholder markers introduced.
