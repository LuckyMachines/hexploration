# Material and Lighting System Report Card

Date: 2026-09-09

## Outcome

The board moved from a flat, ad hoc texture treatment to a versioned PBR surface and semantic-lighting system. The implementation is now an A- production foundation: it is coherent, measurable, reviewable, and integrated into the live board. Final A/A+ status still depends on artist-authored seamless source maps and representative device profiling.

| Dimension | Before | Now | Evidence |
| --- | --- | --- | --- |
| Surface identity | C+ | A- | Six named biome materials with top and side bundles |
| Depth and form | C | A | Tapered geometry, collars, normal/AO response, side strata, tuned shadows |
| Lighting semantics | C+ | A- | Five centralized rigs with localized state color and smooth transitions |
| Runtime efficiency | C | A- | KTX2 delivery, explicit quality tiers, shared textures, adaptive pixel ratio |
| Reviewability | D | A | Material lab, channel views, rig matrix, board captures, fingerprinted reviews |
| Regression safety | C | A | Unit, schema, technical doctor, browser budgets, hard-suite integration |

## Evidence-backed critique

What now works:

- Tile caps read as distinct surfaces instead of flat color plates.
- Darker sidewalls and horizontal strata make elevation legible without hover motion.
- Characters, route markings, and important props remain above the terrain in the visual hierarchy.
- Danger lighting communicates pressure through a localized warm field while preserving material color and text contrast.
- Neutral comparisons reveal meaningful differences among root stone, moss, ember mineral, slate, survey base, and reliquary stone.
- The runtime has measurable draw-call, texture, and frame-response budgets instead of undocumented assumptions.

Remaining limits:

- Mirrored source construction guarantees seams but creates some bilateral motifs at close range. Deterministic UV rotation and jitter reduce repetition on the board; artist-authored seamless masters are the right final replacement.
- The standardized sphere is intentionally unforgiving and exposes strong highlights. Board-scale slabs and hexes remain suitably rough, but final production art should validate the most reflective reliquary and signal materials on target GPUs.
- Headless Chromium can be timer-throttled or software-rendered. The automated test therefore requires either the 24 ms target or proof that adaptive resolution reached its minimum; physical-device profiling remains a separate release gate.

## Next highest-leverage iteration

Create one hand-authored seamless master for `verdant-signal-base`, because it has the lowest current identity and depth scores. Use it to establish the final source-authoring recipe before replacing the other five mirrored masters.
