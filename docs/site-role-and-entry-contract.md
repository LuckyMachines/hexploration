# Xenovoya Site Role and Player Entry Contract

Status: implemented and enforced by automated readiness checks.

## xenovoya.com - explain, prove, persuade

The marketing site owns the narrative: what Xenovoya is, why it is distinct, what play looks like, and why a prospective player should care. It may use richer editorial pacing, feature explanations, gameplay proof, social proof, and search-oriented content.

## play.xenovoya.com - choose, enter, play

The player site is the playable client. Its first job is to let a visitor choose an entry mode with minimal reading:

1. Play solo.
2. Observe a live route.
3. Join or create a crew.
4. Resume an existing expedition when one exists.

Wallet connection is contextual, not a prerequisite for browsing or solo play. The interface explains the signature request when a crew action needs it.

## Anti-duplication rules

The player homepage must not repeat the marketing site's long-form feature essays, scenario galleries, or first-turn explanation. It includes only the context needed to make an entry decision.

The marketing site must not imitate the complete player lobby. Its calls to action hand off to the matching player mode on play.xenovoya.com.

## Release checks

An A release requires:

- a clear role distinction between the two domains;
- solo, observe, and crew entry choices visible in the playable client;
- no wallet-first gate;
- current gameplay proof on the marketing site;
- privacy-safe analytics at the cross-domain handoff;
- canonical metadata, social previews, and public-route crawl coverage;
- responsive screenshots and automated evidence for the entry journey.

Production conversion quality and comprehension remain evidence-bound until real analytics and moderated player sessions are available.
