# Representative Playtest Protocol

This protocol closes the quality gap automation cannot: whether a person understands the game, feels tension and joy, coordinates naturally, and wants to return.

## Study question

Can a representative first-time player reach a meaningful choice without coaching, explain its stakes, complete the starter loop, enter or understand the live path, and name a reason to return?

Success for the first five-session round means at least four of five participants:

- reach a valid first decision without facilitator intervention;
- correctly describe reward, danger, and route-home tradeoffs;
- notice the consequence after committing;
- understand the local 3D expedition, live observer access, and wallet-signed shared action distinction;
- express a concrete return motive tied to crew, clue, discovery, role, or mastery.

At least two sessions should include a return visit after the first-play session. Include desktop and mobile-sized experiences across the set.

## Session script

1. Ask for consent to take anonymous product notes. Do not record names, email addresses, wallet addresses, or demographic identifiers.
2. Begin at the public homepage. Say: "Please explore this as if you found it on your own. Think aloud when comfortable."
3. Do not explain controls unless the participant is blocked for 60 seconds. Record the intervention and exact blocker.
4. Ask after the first committed choice: "What did you choose, what changed, and what do you expect next?"
5. Complete the local 3D expedition or a representative live expedition segment.
6. Ask: "What felt good? What felt confusing? What would bring you back?"
7. For return sessions, start with no reminder and observe whether the remembered thread is legible.

## Evidence to record

Use `npm run improve:playtest` once per session. Keep notes behavioral and consent-safe.

- scenario and cohort;
- time to first meaningful action;
- interventions and misclicks;
- the participant's explanation of stakes;
- delight, tension, confusion, cooperation, and return-intent observations;
- severity: low, medium, high, or critical;
- the decision taken from the observation;
- a next experiment.

Example:

```text
npm run improve:playtest -- --id=session-001 --scenario=first-expedition --cohort=first-time-player --observations="Reached a valid reveal without help; missed route-home pressure until the consequence panel appeared" --severity=medium --decision="Keep consequence panel; strengthen pre-commit route-home cue" --owner=product-research --next-experiment="Compare a route-home pulse against the current cue"

For gameplay-system calibration, also record the player's 0-100 fun score, the automated score available before review, and whether the automated recommendation matched the observed priority:

`--fun-score=72 --automated-fun-score=68 --recommendation-agreement=agree --unassisted-first-action=yes --return-intent=yes`
```

## Severity rubric

- Critical: prevents play, causes unsafe action, or invalidates the result.
- High: blocks the core loop or creates a materially wrong mental model.
- Medium: causes hesitation, missed meaning, or reduced delight but permits recovery.
- Low: polish or wording issue with no meaningful behavioral cost.

Do not average away a critical or high problem. Route it to `rework-required`, preserve the evidence, and test the fix before promotion.
