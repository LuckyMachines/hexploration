# Marketing Site Report Card

## Snapshot 2026-05-18

Scope: homepage, public navigation, scenario discovery funnel, marketing readiness automation.

| Category | Grade | Evidence | A Bar |
| --- | --- | --- | --- |
| First impression clarity | B | Homepage now states the game category, core promise, and first actions before wallet-specific cockpit surfaces. | A requires real gameplay media captures or richer animated state from live runs in the first viewport. |
| Gameplay proof | B | Homepage includes board preview, one-turn before/after, action verbs, featured scenarios, and simulator proof. | A requires generated screenshots or video-like captures tied to latest playable scenarios. |
| Conversion path | B+ | Header and homepage route users to Play, Scenarios, Challenge, Devlog, and Simulator before live wallet flows. | A requires analytics-backed funnel reporting from CTA click through run completion and share. |
| Crawl/discovery readiness | B+ | SEO pipeline exists, route index is generated, and marketing readiness can be checked locally. | A requires per-scenario share image variants and homepage static summary artifacts generated from the marketing content model. |
| Visual hierarchy | B | Marketing sections preserve negative space and live app/status modules are lower on the page. | A requires Playwright visual snapshots across desktop and mobile with automated overlap checks. |

## Remaining Gaps

- Replace illustrative board preview with generated or captured gameplay media.
- Add per-scenario Open Graph image generation.
- Add homepage CTA analytics wired into the growth event capture path.
- Add dedicated Playwright visual tests for homepage desktop and mobile.

## Snapshot 2026-09-14 - Distinct marketing and player-entry roles

The earlier gaps are complete. The two public domains now have explicit, non-overlapping jobs:

- xenovoya.com explains, proves, and markets Xenovoya with editorial depth and current gameplay evidence.
- play.xenovoya.com identifies itself as the playable client and immediately presents solo, observe, and crew entry choices.
- The player homepage no longer duplicates long-form marketing sections or routes people through an artificial preview funnel.
- Wallet language is contextual: browsing and solo play come first, while crew actions explain when a signature is needed.

| Surface | Grade | Evidence |
| --- | --- | --- |
| Site-role clarity | A | Automated presence and absence checks prevent the two domain roles from collapsing together. |
| Gameplay proof | A | The marketing quality system requires current in-engine visual and interaction evidence. |
| Conversion handoff | A | Calls to action preserve choose, solo, observe, and join intent. |
| Crawl and social | A | Canonicals, metadata, public-route coverage, and preview assets are automated release checks. |
| Responsive evidence | A | Desktop and mobile entry states are captured and reviewed. |

### A bar, stricter

An A requires clear domain roles, current gameplay proof, privacy-safe analytics, crawlable metadata, exact cross-domain handoffs, and responsive browser evidence. Production conversion performance and comprehension remain evidence-bound until aggregate analytics and moderated player sessions are available.
