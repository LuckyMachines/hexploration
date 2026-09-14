# Material and Lighting System Report Card

Date: 2026-09-09

## Outcome

The board moved from a flat, ad hoc texture treatment to a versioned PBR surface and semantic-lighting system. The automated implementation is now an A production foundation: it is coherent, measurable, reviewable, integrated into the live board, and no longer relies on whole-field mirrored texture construction. Final A+ release confidence still depends on representative physical-device profiling.

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

- All six surface families now preserve their authored center and use a localized opposing-edge blend over only the outer 9.375%. The new GPT Image 2 Verdant Signal master establishes the governed source-authoring recipe; maximum measured channel seams remain below the 4.0 contract without whole-field bilateral mirroring.
- The standardized sphere is intentionally unforgiving and exposes strong highlights. Board-scale slabs and hexes remain suitably rough, but final production art should validate the most reflective reliquary and signal materials on target GPUs.
- Headless Chromium can be timer-throttled or software-rendered. The automated test therefore requires either the 24 ms target or proof that adaptive resolution reached its minimum; physical-device profiling remains a separate release gate.

## Next highest-leverage iteration

Validate the six updated surfaces on the final supported low-end GPU and capture a representative mobile GPU memory trace. Automated Chromium, Firefox, and WebKit evidence is current; physical hardware evidence remains intentionally separate.

## v1.1.0 - Authored seamless-source pass

- Added an Azure GPT Image 2 Verdant Signal source with exact prompt and fingerprint provenance.
- Replaced whole-field mirroring across all six surfaces with a bounded opposing-edge blend.
- Regenerated top/side WebP and KTX2 bundles, then re-reviewed every changed fingerprint.
- Chromium material capture passes 9/9; Firefox/WebKit integration passes 4/4.
- Strict doctor passes all six materials. Maximum measured seam is 2.960 against the 4.000 limit; Verdant Signal is 1.921.
