# Three.js Board World

The expedition board is rendered as a responsive Three.js diorama while retaining the existing SVG board as a progressive fallback.

## Runtime architecture

- `app/src/components/board/HexGrid.jsx` remains the source of gameplay truth. It derives the same cells, routes, reachable zones, players, landing site, and intent state used by both renderers.
- `app/src/components/board/ThreeBoard.jsx` owns WebGL setup, scene lifecycle, terrain meshes, lighting, picking, route geometry, state effects, player standees, and biome cutouts.
- `app/src/components/board/boardWorld.js` owns deterministic grid-to-world placement, terrain elevation tokens, camera fitting, and stable procedural seeds.
- Three.js is dynamically imported only when a board mounts. It is not part of the initial marketing-site bundle.
- The design-system route mounts at most one live Three.js board. Comparison, journey, and responsive specimens use lightweight state summaries so the review tool does not multiply render loops and WebGL contexts.
- The SVG board remains mounted until WebGL reports ready. If WebGL is unavailable or initialization fails, the accessible SVG experience stays active.

## Visual language

- Every tile is an extruded hex prism with terrain-specific elevation, color, material response, and landmarks.
- Mountain, jungle, plains, desert, landing, relic, campsite, fog, player, route, reachable, selected, committed, and danger states are represented in world space.
- The approved Glassroot Cavern environment is the scene backplate. Five generated material studies give jungle, plains, desert, mountain, and relic tiles their own surface language without baking gameplay state into the art.
- The Routekeeper, Signal Cartographer, and Relic Tender use transparent generated standees mounted on procedural 3D bases. The bases preserve grounding and selection feedback; the art provides role, personality, and silhouette.
- Jungle, plains, desert, mountain, and relic terrain each receive a transparent illustrated prop. A dark silhouette backing and contact shadow make each prop read as a physical cut-paper piece rather than a floating billboard.
- Landing sites and campsites use the same cutout language through a survey beacon and a low expedition shelter.
- Prop scale, horizontal mirroring, and placement vary deterministically by tile. Props hide whenever an explorer occupies their tile so the player silhouette and route remain primary.
- Approved discovery-bloom and redline-pressure textures are projected into world space for ready and danger emphasis. UI labels, routes, coordinates, and interaction state remain code-native.
- Confirmed route selection may lift tiles and adds gold rings. Hover and intent previews use light and ring feedback only: they never move or scale the base tiles, swap the environment backplate, or nudge the camera. Reachability adds cyan survey light. Routes rise over the terrain with luminous waypoints. Danger changes the world fog and fill light rather than relying on copy alone.
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

- Unit tests cover centered world geometry, terrain elevation, camera fitting, and the SVG fallback. Playwright verifies that hover leaves the camera pose unchanged and that rotate, pan, zoom, and reset produce bounded camera state changes.
- Playwright waits for `data-renderer-state="ready"` after generated textures are loaded before visual comparison captures.
- The design-system gameplay view is the canonical same-composition review surface for ready, waiting, resolving, danger, and complete states.
