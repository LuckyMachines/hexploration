# Xenovoya Material and Lighting System

This system makes board surfaces reproducible, reviewable, performant, and state-aware. The contract is centralized in `app/src/art-pipeline/material-system.json`; runtime code and generated assets consume that contract rather than maintaining independent color or lighting tables.

## Runtime architecture

- `surfaceCatalog.js` maps tile types to surface profiles, loads quality-tier channel bundles, applies deterministic UV rotation and jitter, and creates the top and side materials.
- `lightingRigs.js` owns neutral, discovery, danger, recovery, and relic lighting. Game state selects a rig; transitions interpolate exposure, fog, hemisphere, key, fill, rim, and environment intensity.
- `boardQuality.js` selects high, balanced, or efficient rendering from explicit preference and device capability. Sustained over-budget frame time reduces pixel ratio, while severely late frames fall directly to the safe minimum.
- `ThreeBoard.jsx` composes tapered tile geometry, textured sidewalls, environment lighting, shadows, 2.5D character standees, camera-relative rim light, and live renderer metrics.
- `MaterialPreviewScene.jsx` and `/material-lab` provide one stable look-dev scene for material, channel, rig, and quality comparisons.

## Asset contract

Every registered terrain has a 512 x 512 top bundle and a 512 x 512 side bundle:

- `baseColor`: unlit color identity in sRGB.
- `normal`: tangent-space micro-form in linear color space.
- `roughness`: surface response in linear color space; white is rough.
- `ao`: small-scale occlusion in linear color space.
- `height`: source for bump or future displacement.
- `emissive`: a localized signal mask, never broad scene illumination.

Each WebP must remain below 180,000 bytes and within a maximum edge-difference score of 4. Every channel also has a KTX2 runtime package. A receipt records source and output hashes; a review records the matching source and candidate hashes, six relational scores, reviewer, decision, and notes.

## Promotion loop

1. Edit the source image or material profile.
2. Run `npm run material:generate -- --material=<id>`.
3. Run `npm run material:contact-sheet -- --material=<id>` and inspect all channels.
4. Run `npm run material:capture` and then `npm run material:render-sheet`.
5. Compare the neutral material lineup, semantic lighting lineup, integrated ready board, and integrated danger board.
6. Record a review with `npm run material:review -- --material=<id> ...`.
7. Run `npm run material:doctor` and `npm run material:ci`.

Generation intentionally invalidates an older visual approval by changing candidate hashes. Do not work around that failure: recapture, inspect, and review the new candidate.

## Acceptance bar

A promoted surface must meet all of these conditions:

- It tiles without a visible seam or a single dominant landmark.
- Height and normal response clarify form without making the board noisy.
- Base color remains readable under neutral light and does not contain baked directional illumination.
- Its biome identity survives at board scale and in grayscale.
- Ready, danger, recovery, and relic rigs communicate state without recoloring the whole world.
- Pawns, routes, reachable tiles, selected tiles, and decisive props remain higher in the hierarchy than terrain detail.
- Draw calls stay at or below 180 and resident textures stay at or below 96 in the reference board.
- Frame p95 stays at or below 24 ms on target hardware, or adaptive resolution reaches its safe minimum under a synthetic constrained renderer.
- High, balanced, and efficient tiers remain deliberate rather than silently dropping arbitrary features.

## Troubleshooting

- If the doctor reports stale fingerprints, rerun the capture and human review after the last generation pass.
- If KTX2 loading fails, verify `app/public/basis/basis_transcoder.js` and `basis_transcoder.wasm` exist, then run the integrated board browser test.
- If a board test never records frame timing, scroll the board into the viewport and make sure reduced motion is not enabled. Offscreen and reduced-motion boards render on demand by design.
- If terrain dominates characters or routes, lower normal scale, emissive intensity, or side brightness before increasing global illumination.
- If semantic rigs look like filters, reduce the colored fill and preserve the neutral key; state lighting should be local and additive.

## Commands

```text
npm run material:generate
npm run material:test
npm run material:capture
npm run material:cross-browser
npm run material:render-sheet
npm run material:doctor
npm run material:ci
npm run improve:check -- --scope=visual-art
```

Generated review evidence is written under `artifacts/materials/`. Machine-readable technical evidence is written to `reports/materials/latest.json`.
