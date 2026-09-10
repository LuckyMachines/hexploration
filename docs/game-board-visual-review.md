# Game Board Visual Review

## Review frame

The approved cutout-character board is the art-direction reference. The current Board Lab capture is the implementation under review. This review checks composition, hierarchy, depth, perspective, state communication, and interaction stability rather than asking for pixel identity.

Evidence:

- `artifacts/board-system/visual-review/reference-vs-actual.png`
- `artifacts/board-system/visual-review/reference-board-crop.png`
- `artifacts/board-system/visual-review/actual-board-crop.png`
- `artifacts/board-system/visual-review/depth/reference-board-crop-depth-color.png`
- `artifacts/board-system/visual-review/depth/actual-board-crop-depth-color.png`
- `artifacts/board-system/visual-review/perspective-overlay.png`
- `artifacts/board-system/visual-review/perspective-record.json`
- `artifacts/board-system/board-state-contact-sheet.png`
- `artifacts/board-system/captures/stress-100-tile-desktop.png`

Depth model: `depth-anything/Depth-Anything-V2-Small-hf`. The preserved grayscale and color maps were generated with `python scripts/art-depth-map.py --input <crop> --output-dir artifacts/board-system/visual-review/depth` for each unchanged comparison crop.

## Findings

### Composition and hierarchy

The implementation preserves the reference's strongest idea: illustrated cutout explorers inhabit a materially dimensional board instead of floating over a flat interface. The center party remains the primary focal mass, the foreground tiles establish an entry plane, and the scene chrome stays peripheral. Compared with the reference, the live board gives terrain variation and navigable space more visual weight. That trade is appropriate for play, although hero characters can still grow modestly in story-forward moments.

### Depth and material separation

The live board has a clear near-to-far stack: warm raised foreground tiles, a readable middle interaction plane, and a cooler recessed party and environment plane. Side-wall thickness, cast shadows, distinct biome tops, props, and atmosphere keep the board from reading as a barely 2D tile sheet. The model-derived depth images support this qualitative reading. They are relative depth estimates, not metric measurements.

### Perspective and camera

Two inspected top-plane hex edges converge consistently under the restrained 34-degree camera. The calculated vanishing point is far outside the image, which is expected for the deliberately low-distortion tactical view. The result favors spatial stability and tile readability while retaining dimensionality. Orbit, right-drag pan, wheel zoom, presets, and reset preserve user control; no automatic camera move overrides the player.

### State language

Ready, hover, selected, committed, resolving, complete, danger, rescue, recovery, and invalid states share the same terrain geometry. State is communicated with overlays, routes, lighting, actors, copy, and restrained effects rather than moving the base tiles. This eliminates the disorienting hover behavior identified in the earlier board.

### Dense-board behavior

The 100-tile stress fixture keeps all gameplay-significant landmarks and a deterministic sample of decorative silhouettes. Decorative cutouts use a simplified large-board treatment while the complete terrain remains visible and instanced. This preserves biome recognition and authored character moments without letting per-tile sprites, shadows, or local lights exceed the 90-draw-call budget.

### Remaining art-direction opportunities

- Increase character scale only for narrative or outcome beats, not the default tactical view.
- Continue adding authored prop silhouettes so biomes can be recognized before their labels are read.
- Reserve the brightest emissive accents for consequence, rescue, and completion beats.
- Keep environment contrast behind characters slightly quieter than the foreground interaction plane.

## Acceptance checklist

- [x] One live WebGL canvas per Board Lab state.
- [x] Stable base-tile transforms across transient interaction states.
- [x] Characters remain visually integrated with cast shadows and scene lighting.
- [x] Terrain reads as volume through top, side, rim, and occlusion cues.
- [x] Perspective lines are internally consistent for the chosen tactical camera.
- [x] Critical board states are captured at desktop and mobile sizes.
- [x] Reduced-motion and forced-colors behavior are exercised by browser tests.
- [x] Asset failures, draw calls, triangles, and timing are captured as evidence.
- [x] A 100-tile late-game board passes the same strict rendering budget without lowering pixel ratio.
