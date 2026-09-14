# Game Tile Kit Visual Review

## Outcome

The tile kit passes the runtime, material, provenance, interaction, accessibility, and production-build gates. Six material families now combine with three deterministic sculpted forms for eighteen reusable runtime variants. Version 1.1 adds six family-specific silhouette profiles, so terrain identity survives grayscale, missing props, and efficient rendering. The live board retains the approved cutout-character diorama language while gaining beveled shoulders, irregular crowns, deterministic landmark composition, and more visible sidewall volume.

## Evidence packet

- Concept contact sheet: `artifacts/tile-kit/tile-concept-contact-sheet.png`
- Existing approved PBR source contact sheet: `artifacts/materials/current-terrain-sources.png`
- Reference/runtime comparison: `artifacts/tile-kit/reference-vs-runtime.png`
- Live ready-state board crop: `artifacts/tile-kit/live-board-ready-crop.png`
- Relative depth comparison: `artifacts/tile-kit/depth/reference-vs-runtime-depth.png`
- Depth model: `depth-anything/Depth-Anything-V2-Small-hf`
- Board state captures: `artifacts/board-system/captures/`
- Material look-development contact sheet: `artifacts/materials/lookdev-material-contact-sheet.png`
- Semantic lighting contact sheet: `artifacts/materials/lookdev-lighting-contact-sheet.png`
- Board verification report: `reports/board-system/latest.json`
- Material verification report: `reports/materials/latest.json`
- Exact prompts and generation provenance: `app/src/art-pipeline/tile-kit.json`

The depth maps show relative inverse depth only: warm/bright is nearer and cool/dark is farther. They are not metric depth measurements.

## Pass 1 - concept direction to live geometry

Reference: `artifacts/tile-kit/tile-concept-contact-sheet.png`

Actual: `artifacts/tile-kit/live-board-ready-crop.png`

Comparison: `artifacts/tile-kit/reference-vs-runtime.png`

### Largest gaps found

1. The first custom mesh emitted one material group per triangle, producing 489 ready-state draw calls. Consequence: the visual idea could not ship inside the board budget. Fix: consolidate faces into contiguous top and side/underside groups while retaining instancing.
2. Initial triangle winding faced inward. Consequence: approved top materials rendered nearly black and side facets caught incorrect highlights. Fix: reverse top, sidewall, and underside winding and verify the recaptured pixels.
3. The look-development scene made the three forms too small behind sphere and slab probes. Consequence: the review surface technically contained the kit but did not make it easy to critique. Fix: place all three forms in the foreground, retain smaller response probes behind them, add visible variant labels, and show the selected GPT Image 2 plate beside the live runtime proof.
4. All six families initially shared one silhouette recipe and relied too heavily on color, height, and props for recognition. Consequence: tactical tiles felt more generic than the generated direction plates. Fix: add family-specific five-ring profiles for engineered, rolling, root-broken, wind-cut, fractured, and terraced forms while retaining the same normalized footprint and instanced batching.

## Pass 2 - final visual judgment

### Composition and hierarchy

The reference plates isolate family silhouettes; the live board combines them with characters, routes, props, fog, and location art. The runtime correctly gives explorers and decisions priority while the tiles supply a grounded support plane. Broad tile centers stay clear enough for standees and route overlays.

### Geometry and perspective

The shelf, fracture, and crown forms share one stable hex footprint. Their differences read through shoulder radius, top inset, corner irregularity, and elevation rather than through hover movement. The live board retains its calibrated 34-degree tactical camera and bounded player-controlled orbit, pan, and zoom.

The concept contact sheet contains six independent three-tile studio compositions rather than one shared scene, so a single cross-sheet vanishing-point fit would not be credible. No new perspective calibration was claimed. The runtime camera did not change; its existing perspective record remains under `artifacts/board-system/visual-review/`.

### Depth and grounding

The relative depth comparison preserves the intended plane order: foreground terrain is nearest, the occupied interaction plane and characters sit in the middle, and the cavern backplate recedes. Tiles contact the board floor through sidewall mass and shadows rather than floating as top-face decals.

### Lighting and material

Six PBR families retain distinct base color, normal, roughness, AO, height, emissive, and compressed packages. Generated concept plates use more hero-detail and taller crowns than the tactical runtime by design. Runtime emission stays localized to information, danger, and relic signals; it is not baked into gameplay-state texture.

### State behavior and accessibility

Ready, hover, selected, invalid, danger, committed, resolving, rescue, recovery, and complete all retain identical base-tile matrices. Reachability, intent, selection, danger, and route history use redundant rings, topology, lighting, effects, and text. Chromium, Firefox, and WebKit pass keyboard parity, camera bounds, context recovery, and forced-colors checks.

### Responsive quality

All ten board states pass at desktop and mobile viewports. The efficient material tier remains intentional and keeps the same gameplay information. Dense-board simplification removes only deterministic decorative repeats; it preserves current location, intent, landing, players, campsites, and at least one landmark per used family.

## Final measured gates

- Chromium board evidence: 28/28 passing.
- Firefox and WebKit targeted evidence: 12/12 passing.
- 100-tile stress scene: 86 draw calls, 10,377 triangles, 64 textures, 2.4 ms render p95, 100 ms headless frame p95, zero asset failures.
- Board system report: Grade A, pass.
- Material and lighting capture: 9/9 passing.
- Art pipeline doctor: pass, 85 managed assets.
- Runtime image delivery: 23 lossless derivatives, 9.52 MiB to 5.68 MiB (40.3% smaller); production route transfer is 25.3% lower on `/` and 24.0% lower on `/guest`.
- Material doctor: pass for all six surface contracts.
- Production Vite build: pass with release-environment validation enabled.

## Acceptance checklist

- [x] Six terrain families have approved direction plates.
- [x] Each family exposes shelf, fracture, and crown runtime forms plus a family-specific grayscale silhouette.
- [x] Base transforms remain stable across transient states.
- [x] The runtime preserves family separation at tactical scale.
- [x] Top and side materials remain distinct and correctly lit.
- [x] Concept references are visible beside runtime proof in Material Lab.
- [x] Dense boards remain within the strict render budget.
- [x] Desktop, mobile, reduced-motion, forced-colors, and cross-browser evidence passes.
- [x] Generated files have exact prompt provenance and durable reviews.

## Intentional differences from concept art

- Runtime crowns are lower than hero concept crowns to preserve picking, routes, and character readability.
- Runtime props remain separate cutouts or geometry so gameplay state and occupancy can control them.
- Runtime surfaces reuse approved seamless PBR packages rather than baking one unique generated image into every tile.
- The integrated board deliberately contains more semantic information than an isolated concept plate, but its brightest accents remain reserved for actionable state.
