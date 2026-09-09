# Material and Lighting Implementation Checklist

## Contract and pipeline

- [x] One versioned manifest owns materials, channels, lighting rigs, quality tiers, and budgets.
- [x] Every revealed tile type maps to a named material profile.
- [x] Every material has top and side channel bundles.
- [x] Generation records deterministic source and candidate fingerprints.
- [x] Runtime bundles are packaged as KTX2 with WebP review sources.
- [x] Strict validation rejects missing, stale, oversized, visibly seamed, or unapproved outputs.
- [x] Review scores cover tileability, depth response, light neutrality, identity, state legibility, and accessibility.

## Runtime

- [x] Board materials use base color, normal, roughness, AO, height fallback, and localized emissive data.
- [x] Tile UV variation is deterministic and does not clone textures per tile.
- [x] Tile sidewalls are biome-specific, darker than caps, and use dedicated strata maps.
- [x] Environment lighting uses PMREM when the selected quality tier allows it.
- [x] Named rigs respond to neutral, discovery, danger, recovery, and relic states.
- [x] Danger is localized and does not apply a global red wash.
- [x] Shadows have tuned bias, normal bias, radius, and bounded frusta.
- [x] High, balanced, and efficient modes have explicit feature budgets.
- [x] Dynamic resolution reacts to sustained frame pressure.
- [x] Runtime exposes material version, quality, rig, draw calls, triangles, textures, frame p95, and pixel ratio.
- [x] Textures, materials, geometry, controls, and environment resources are disposed.

## Review and regression

- [x] Look-dev provides sphere, hex, and vertical slab geometry.
- [x] Every PBR channel can be inspected independently.
- [x] Every material is captured under the same neutral rig.
- [x] Neutral, danger, recovery, and relic rigs are captured with one reference material.
- [x] Ready and danger boards are captured in the real design-system composition.
- [x] Browser gates enforce draw-call and texture budgets.
- [x] Browser gates verify semantic rig selection.
- [x] Browser gates verify frame-budget compliance or minimum-resolution fallback.
- [x] Firefox and WebKit smoke gates verify compressed-texture decoding and board integration.
- [x] Material checks are part of focused, hard, exact, release, and improvement-system verification.

## Deliberate future headroom

- [ ] Replace mirrored source tiling with artist-authored seamless source textures when final environment production begins.
- [ ] Validate frame pacing on the final supported low-end hardware matrix; headless software rendering is only a fallback-behavior check.
- [ ] Add a mobile GPU memory trace when representative target devices are available.
