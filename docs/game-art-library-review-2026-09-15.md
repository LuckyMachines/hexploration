# Xenovoya Game Art Library Review

Date: 2026-09-15

Evidence: `artifacts/art/contact-sheets/game-library-latest/`

Baseline grade: **B**

Final qualitative grade: **A-**
Automated library grade: **A (100/100)**

The initial library contained strong individual work, especially environments, but read as several neighboring art directions rather than one production system. This pass locked the rendering contract, separated unlike asset types, expanded the ecosystem, added missing gameplay families, integrated runtime assets, and rebuilt the evidence set. The remaining A-to-A+ work is narrow rather than structural: normalize a few inherited character/relic style outliers and continue proving art in live gameplay captures.

## Final snapshot

- 161 contracted assets: 152 approved and 9 reference, with no brief-ready or candidate assets left in the shipping manifest.
- 12 explicit review groups, all at or above coverage target.
- 13 enemy standees across every playable biome, with deterministic runtime selection and at least two encounters per tile family.
- 9 encounter scenes, 24 environments, 13 props, 10 relics, 52 character standees and states, 4 character vignettes, 4 VFX overlays, 3 memory surfaces, and 2 concept scenes.
- 89 lossless runtime derivatives: 41.84 MiB reduced to 25.73 MiB, a 38.5% saving.
- Relic Tender Discovery was reworked from a white catalog field into an identity-preserving violet archive vignette. Two generative revisions were rejected for invented lanterns and oversized pedestal relics; the promoted deterministic composite scored 9.5/10.

## Sheet-by-sheet critique

### Complete master sheet - B

- Labels become too small for meaningful review.
- Unequal panel heights create dead space and distort category importance.
- Environment coverage overwhelms the very small enemy library.
- The sheet shows inventory but not approval state, runtime readiness, missing coverage, scale, or asset type.
- Replace the portrait collage with a landscape overview and full-size detail pages carrying status and coverage metadata.

### Tiles and terrain - B+

- Modeled tile concepts are attractive and materially convincing.
- Camera pitch, wall thickness, elevation, edge construction, and footprint vary.
- Concept plates and flat terrain textures are mixed without explicit material-to-tile mapping.
- Desert reads immediately, while jungle, plains, mountain, and landing rely too heavily on gray stone.
- Flat textures do not prove runtime behavior after projection, seams, lighting, props, and elevation.
- Standardize the tile camera and geometry contract, separate geometry from surfaces, map each biome explicitly, and add runtime adjacency and gameplay-state evidence.

### Characters and states - B-

- Individual silhouettes are appealing and recognizable.
- Field Mender is painterly, Relic Tender trends anime, Routekeeper is illustrative, and Signal Cartographer feels more modern science fiction.
- Narrative vignettes are mixed with board cutouts, making scale and background comparisons misleading.
- Relic Tender Discovery carries a white field while other entries use green or black presentation fields.
- Identity, crop, lighting, ground contact, and negative space vary across states.
- Separate standees from vignettes and enforce transparent canvas, foot anchor, scale, light, and identity contracts for runtime cutouts.

### Enemies and encounters - C+

- Two enemy standees are insufficient for the apparent scope of the world.
- Enemy cutouts and encounter-scene backgrounds are mixed in one row.
- The Emberglass Scuttler is bright and cartoon-like while the Glassroot Grazer is soft and painterly.
- Neither creature has a clear threat tier, habitat, scale, attack silhouette, or state set.
- Build separate enemy and encounter-scene families, establish biome and threat taxonomies, and expand the enemy roster.

### Environments - A-

- This is the strongest and most evocative family.
- Too many locations share cold blue-gray rock, stormy skies, low horizons, and distant glows.
- Several locations become difficult to distinguish at thumbnail scale.
- Memory Ferns, Mossglass Gate, and Rootlight Vale are more graphic than the more realistic slate landscapes.
- Add stronger biome value keys, scale anchors, inhabited and warm spaces, crop-safe zones, and clearer gameplay functions.

### Relics - B

- Materials and luminous cores are generally appealing.
- Too many relics share a gray oval shell around colored glass.
- Atlas Spindle is more cel-shaded than the surrounding library, while Tideglass Heart reads as jewelry.
- Camera, scale, light direction, and edge treatment vary.
- Build stronger function-led silhouette families and normalize camera, scale, lighting, alpha, and state coverage.

### Props and effects - B-

- Props have clear silhouettes and useful biome associations.
- Equal cell sizing hides enormous world-scale differences.
- Perspective and rendering treatment vary.
- Discovery Bloom is nearly invisible on the review field and Redline Pressure cannot be judged outside gameplay.
- Lantern Route Backplate is a memory/UI surface rather than a prop or effect.
- Separate props, landmarks, VFX, and memory surfaces; add scale references and multi-background VFX evidence.

## Stricter A bar

- One written visual DNA governs every new and revised asset.
- Runtime cutouts share alpha, camera, framing, grounding, scale, and light contracts.
- Every review sheet compares like with like and exposes status, asset type, dimensions, and coverage gaps.
- Every major biome has at least two ordinary creatures plus one distinctive high-threat creature.
- Character identity survives every state without face, costume, age, proportion, or medium drift.
- Tile geometry, material, biome, elevation, and gameplay state can be evaluated together.
- Relics remain identifiable by silhouette in grayscale at 64 pixels.
- VFX remain readable over light, dark, terrain, and active-board backgrounds.
- Environment thumbnails are distinguishable by value structure before color.
- Every promoted asset has isolated, thumbnail, and real-game context evidence.

## Sequenced implementation checklist

### 1. Library contract and review system

- [x] Strengthen the canonical style, camera, canvas, lighting, scale, and biome contracts.
- [x] Add explicit review categories and coverage targets.
- [x] Add a reproducible library doctor, report, and contact-sheet generator.
- [x] Separate standees from vignettes, enemies from encounter scenes, tiles from materials, and props from VFX and memory surfaces.

### 2. Enemy ecosystem

- [x] Define a biome and threat taxonomy.
- [x] Expand from two enemy standees to a minimum viable twelve-creature roster.
- [x] Generate, normalize, inspect, and promote the new creature cutouts.
- [x] Add runtime delivery entries and deterministic board mappings.

### 3. Character consistency

- [x] Normalize contact-sheet presentation for every runtime standee.
- [x] Separate four narrative vignettes from the standee state matrix.
- [x] Rework the clearest vignette presentation outlier while preserving exact canonical identity.
- [x] Verify identity and silhouette at board and thumbnail scale.

### 4. Relic language

- [x] Define function-led silhouette families and scale bands.
- [ ] Rework Atlas Spindle's cel-shaded treatment and Tideglass Cradle's jewelry-like scale only when their dependent runtime states can be reviewed together.
- [x] Add dormant, activated, and damaged state planning to the production contract.

### 5. Tiles, terrain, and environments

- [x] Pair each tile family with its production material and biome key.
- [x] Add camera, footprint, wall, elevation, and adjacency review metadata.
- [x] Add environment value-key and gameplay-function metadata.
- [x] Integrate the expanded props, encounters, and state VFX into the runtime board.

### 6. Props, VFX, and memory surfaces

- [x] Separate landmarks, props, VFX, and memory/UI backplates.
- [x] Add world-scale references and grounding requirements.
- [x] Review VFX on light, dark, and biome backgrounds at reduced size.

### 7. Verification and re-grade

- [x] Run art, character, material, runtime-image, library, and board quality gates.
- [x] Inspect every regenerated sheet at original resolution.
- [x] Record the final snapshot and remaining intentional differences.

## Remaining intentional differences

- The four canonical crew standees retain some inherited medium variance. Replacing them casually would damage identity continuity and invalidate dependent state art, so future normalization should be reviewed character-by-character with every state beside its base.
- The original Glassroot Grazer and Emberglass Scuttler are simpler than the eleven new biome creatures. They remain useful low-threat silhouettes rather than being discarded solely for finish variance.
- Tile concept plates vary in wall height and camera pitch. Runtime geometry is code-controlled, so the plates now serve as material and biome references rather than literal mesh specifications.
- Discovery Bloom is deliberately quiet and should be judged in context; Redline Pressure remains the high-urgency overlay.
- Atlas Spindle and Tideglass Cradle are the two clearest relic-language candidates for a later, dependency-aware rework.

## Verification record

- `npm run art:doctor`: pass, including all 89 runtime-image derivatives.
- `npm run art:test`: 21/21 tests pass.
- `npm run art:library:doctor`: pass, A 100/100 report.
- `npm run character:doctor`: pass.
- `npm run material:doctor`: pass.
- Focused board tests: 6/6 pass.
- Development production bundle: pass, 731 modules transformed.
