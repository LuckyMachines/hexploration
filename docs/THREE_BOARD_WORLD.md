# Three.js Board World

The expedition board is rendered as a responsive Three.js diorama while retaining the existing SVG board as a progressive fallback.

## Runtime architecture

- `app/src/components/board/boardViewModel.js` is the versioned projection boundary between exact or live game state and every board renderer. `HexGrid.jsx` produces this model; `ThreeBoard.jsx` only renders it.
- `app/src/components/board/boardSceneState.js` determines which independently reconciled scene layers changed. Terrain and landmarks persist while affordance, intent, route, party, and assistance layers rebuild only when their signatures change.
- `app/src/components/board/boardBeatDirector.js` turns phase and action state into lighting, sound, motion, announcements, and optional camera suggestions. It never moves the camera automatically.
- `app/src/components/board/boardInteraction.js` owns picking, drag thresholds, camera bounds, and preset targets.
- `app/src/components/board/boardAssetRegistry.js` records every expected, loaded, failed, and transferred board asset.
- `app/src/components/board/ThreeBoard.jsx` owns WebGL setup and lifecycle. Repeated terrain uses instanced meshes and transient marker geometry is pooled.
- `app/src/components/board/boardWorld.js` owns deterministic grid-to-world placement, terrain elevation tokens, camera fitting, and stable procedural seeds.
- Three.js is dynamically imported only when a board mounts. It is not part of the initial marketing-site bundle.
- The design-system route mounts at most one live Three.js board. Comparison, journey, and responsive specimens use lightweight state summaries so the review tool does not multiply render loops and WebGL contexts.
- The SVG board remains mounted until WebGL reports ready. If WebGL is unavailable or initialization fails, the accessible SVG experience stays active.
- Shader compilation is a bounded warm-up, not an indefinite readiness dependency. Chromium and Firefox receive an eight-second asynchronous budget; Safari/WebKit uses the reliable synchronous compile path because its asynchronous completion signal can stall. The selected path is recorded in `data-shader-warmup` for diagnostics.

## Visual language

- Every tile is an extruded hex prism with terrain-specific elevation, color, material response, and landmarks.
- The modular tile kit combines six material families with deterministic `shelf`, `fracture`, and `crown` forms for eighteen reusable runtime variants. Variant identity is derived from tile alias and type, so it is stable across reloads and interaction states.
- Mountain, jungle, plains, desert, landing, relic, campsite, fog, player, route, reachable, selected, committed, and danger states are represented in world space.
- The approved Glassroot Cavern environment is the scene backplate. Five generated material studies give jungle, plains, desert, mountain, and relic tiles their own surface language without baking gameplay state into the art.
- The Routekeeper, Signal Cartographer, and Relic Tender use transparent generated standees mounted on procedural 3D bases. The bases preserve grounding and selection feedback; the art provides role, personality, and silhouette.
- Jungle, plains, desert, mountain, and relic terrain each receive a transparent illustrated prop. A dark silhouette backing and contact shadow make each prop read as a physical cut-paper piece rather than a floating billboard.
- Landing sites and campsites use the same cutout language through a survey beacon and a low expedition shelter.
- Relic tiles select the approved Sunstone Lens, Tideglass Heart, or Atlas Spindle runtime model from the same deterministic alias seed used by the 2D discovery fallback. Each identity owns its scale, emissive tint, local light, and matching cutout. Balanced and high quality receive the reviewed tactical LOD; efficient mode retains the illustrated cutout.
- Prop scale, horizontal mirroring, and placement vary deterministically by tile. Props hide whenever an explorer occupies their tile so the player silhouette and route remain primary.
- Approved discovery-bloom and redline-pressure textures are projected into world space for ready and danger emphasis. UI labels, routes, coordinates, and interaction state remain code-native.
- Hover, focus, preview, selection, invalid intent, and committed state use overlays, rings, routes, labels, and light. They never move or scale base tiles, swap the environment backplate, or nudge the camera. Reachability adds cyan survey light. Routes rise over the terrain with luminous waypoints. Danger changes the world fog and fill light rather than relying on copy alone.
- Reduced-motion preferences stop floating pawns and ambient movement while preserving state clarity. The camera never drifts automatically, regardless of motion preference.

## Interaction and accessibility

- Pointer picking raycasts against tile meshes and feeds the existing input controller.
- The world camera deliberately supports left-drag orbit, right-drag or modified-drag pan, wheel zoom, one-finger touch orbit, and two-finger touch pan/zoom. Polar angle, zoom distance, and pan target are bounded so players cannot flip under the board or lose the map.
- A compact Camera button reveals 44-pixel keyboard-accessible rotate, pan, zoom, and reset controls. The pad stays collapsed during normal play so it does not obscure terrain.
- Camera movement is independent from tile hover. Drag distance suppresses accidental tile activation after an orbit or pan gesture, and resizing preserves the player's view until Reset is chosen.
- Keyboard and controller behavior remains owned by `HexGrid`, so the 3D presentation does not fork game rules.
- Screen-reader tile controls mirror the rendered cells when interaction is available.
- The board viewport retains its application label and visible focus treatment.

## Asset extension points

Terrain materials, state effects, character standees, and biome props are deliberately modular. Each generated image is registered in the art manifest, reviewed in isolation, and then evaluated on the same-composition board surface. The `transparent-prop` asset contract preserves a reusable 1024-pixel alpha source for later cards, memories, or alternate 3D presentations. New assets should preserve each tile's readable silhouette, keep routes unobstructed, and use shared materials or instancing before increasing draw-call count.

## Verification

- The Board Lab at `/board-lab` exposes ten deterministic board states, exact-engine replay frames, camera presets, quality controls, beat metadata, and a renderer remount control while mounting only one live canvas.
- The Material Lab at `/material-lab` presents all three runtime forms under one selected PBR family and places the matching GPT Image 2 direction plate beside the live renderer for direct critique.
- Unit tests cover the contract, exact replay projection, view-model normalization, layer signatures, instanced picking, camera bounds, immutable transforms, asset failure retention, board quality, departure policy, and fallback behavior.
- Playwright captures every required state at desktop and mobile sizes. It verifies accessibility, pointer and keyboard parity, stable terrain and camera state, context restoration, bounded camera controls, renderer remount disposal, asset completion, draw calls, triangles, frame timing, render timing, forced colors, exact-engine replay rendering, and a 100-tile late-game density case.
- Large boards preserve all gameplay-significant landmarks while deterministically capping decorative cutouts and omitting their secondary backing, contact-shadow, and point-light passes. Terrain remains fully instanced; the 100-tile evidence scene stays inside the same 90-draw-call contract as the normal board.
- Playwright waits for `data-renderer-state="ready"` after generated textures are loaded before visual comparison captures; optional shader warm-up is bounded and its result is exposed through `data-shader-warmup`.
- `npm run board:refresh` regenerates exact replays, captures Chromium evidence, and rebuilds the report. `npm run board:cross-browser` checks critical behavior in Firefox and WebKit. `npm run board:baseline` promotes only passing metrics, and `npm run board:compare` reports regressions against that approved baseline.
- Use `npm run board:refresh -- --update-snapshots` only after visually reviewing an intentional board change.
- The canonical evidence and critique live under `artifacts/board-system`, `reports/board-system`, and `docs/game-board-visual-review.md`.
