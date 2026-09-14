# Runtime 3D Board Visual Review

Reviewed: 2026-09-14

## Pass 1 - promoted landmarks

References: `app/e2e/__screenshots__/ui-quality/`

Actuals: `artifacts/ui-quality/captures/`

Comparisons: `artifacts/ui-quality/comparisons/`

Inspected scenes:

- `guest-expedition-desktop` at 1440 x 1000
- `guest-expedition-mobile` at 390 x 844
- `board-ready` at 1440 x 1000
- `board-danger-comparison` at 1440 x 1000
- `board-waiting` at 1440 x 1000
- Board contract states `ready`, `selected`, `committed`, and `rescue` at desktop and mobile evidence sizes

### Review findings

1. Composition and hierarchy pass. The board remains the dominant mass, characters remain the focal layer, and the promoted landmarks do not compete with route or action feedback.
2. Depth and grounding pass. The three tile-depth planes, standees, props, and environment retain their reference ordering. The generated relative-depth comparison is `artifacts/ui-quality/depth/pass-runtime-3d/board-ready-depth-comparison.png`, produced with `depth-anything/Depth-Anything-V2-Small-hf`; warm/bright means relatively nearer and cool/dark means relatively farther.
3. Perspective passes the stylized-isometric hypothesis. The current overlay is `artifacts/ui-quality/spatial/runtime-3d-board-perspective.png`; the normalized vanishing point is (-3.1080, 2.7105), the mean line residual is 35.21 px, and the corresponding record preserves all inspected tile-edge segments and the horizon assumption.
4. State behavior passes. LOD2 landmarks appear during calm choice-making. Submitted, danger, resolving, complete, and Help/rescue states use lighter cutout fallbacks so route, danger, resolution, and rescue feedback retain visual priority and the scene stays below 12,000 triangles.
5. Responsive and accessibility checks pass. The five affected UI scenes have no horizontal overflow, small interactive targets, serious accessibility findings, critical accessibility findings, or cumulative layout shift.

### Acceptance checklist

- [x] Reference-left/current-right comparisons inspected at original resolution for all five source-invalidated scenes.
- [x] Large masses, board hierarchy, tile silhouettes, character silhouettes, and live UI geometry remain stable.
- [x] Relative depth preserves foreground tiles, middle-plane characters and props, and the far environment.
- [x] Current tile edges remain coherent under the stylized-isometric perspective hypothesis.
- [x] Landing Beacon and Route Fork remain readable at tactical scale without obscuring selectable tiles.
- [x] Cutout fallback states preserve the intended emotional and interaction hierarchy.
- [x] Desktop and mobile captures contain one canvas and no overflow, layout shift, or serious accessibility defects.
- [x] All board states remain under the unchanged 12,000-triangle scene ceiling.
- [x] Current source hashes are eligible for visual baseline approval.

### Pass 2 - complete governed runtime set

The September 14 follow-up completed the same review path for Campsite Shelter, Atlas Spindle, Tideglass Heart, and Sunstone Lens. All six governed objects now have fingerprinted LOD0, LOD1, and LOD2 delivery models, an original-resolution five-angle contact sheet, an explicit runtime decision, and a promoted registry entry.

- Campsite Shelter replaces the former baked terrain slab with a freestanding shelter, attached packs, readable lantern, and grounded feet.
- Atlas Spindle preserves its open cage, captured crystal, rear construction, and thin orbital rhythm.
- Tideglass Heart uses a receipt-backed material correction to recover its emerald chamber and warm cradle without changing approved geometry.
- Sunstone Lens uses a deterministic authored hard-surface fallback derived from the approved GPT Image 2 four-view sheet. Both failed TRELLIS reconstructions remain preserved as negative evidence rather than being silently discarded.
- The tactical board deterministically selects Sunstone, Tideglass, or Atlas by tile alias. The same identity selects the efficient-mode cutout, so quality changes never swap the represented relic.

The runtime doctor reports six approved assets promoted and zero retained review or rework candidates. Chromium, Firefox, and WebKit board evidence passes after integration.

### Remaining intentional differences

- Live 3D landmarks remain deliberately subtle at tactical camera distance; LOD0 and LOD1 are reserved for close-up and marketing scenes.
- Action-heavy and efficient states retain authored cutouts where they improve hierarchy or protect the scene budget.
- Sunstone's authored runtime surface is cleaner than the weathered concept painting; its gameplay-critical octagonal housing and amber aperture are preserved across all three LODs.
