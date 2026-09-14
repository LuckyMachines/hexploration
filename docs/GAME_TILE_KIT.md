# Xenovoya Modular Game Tile Kit

## Purpose

The board should read as a place assembled from authored terrain, not as colored counters. This kit turns every gameplay tile into a stable, reusable 3D world unit while preserving tactical clarity, deterministic state, and the existing performance budget.

## Art-direction contract

- The visual model is a crafted expedition diorama: tactile stone, mineral soil, living growth, restrained science-fantasy inlays, and illustrated cutout landmarks.
- Terrain owns material identity. Lighting owns atmosphere. Overlays own interaction state. Gameplay state is never baked into a base-color texture.
- Every tile keeps the same hex footprint in every state. Hover, focus, reachability, selection, danger, and visited state may add light, rings, routes, decals, or effects; they must never translate or scale the base tile.
- Bright emission is reserved for landing guidance, relic memory, danger, rescue, and completion.
- The tile top remains readable beneath landmarks and routes at tactical camera distance.

## Six terrain families

| Family | Surface identity | Silhouette | Modular gameplay parts |
| --- | --- | --- | --- |
| Landing | Survey metal, weathered enamel, cyan inlay | Engineered platform | Beacon socket, route origin, campsite socket |
| Plains | Mineral loam, lantern moss, warm spores | Low rolling shelf | Grass clusters, route stones, campsite socket |
| Jungle | Basalt, root lattice, pale living deposits | Root-broken crown | Frond clusters, root arch, encounter socket |
| Desert | Iron dust, cooled glass ripples, ember seams | Wind-cut shelf | Shard cluster, hazard seam, route cairn |
| Mountain | Blue-black slate, pressure fractures, mica edges | High fractured crown | Spire cluster, pass marker, hazard socket |
| Relic | Dark memory stone, violet glass filament | Ceremonial stepped crown | Reliquary socket, orbit rings, discovery signal |

Each family ships with three deterministic macro variants:

1. `shelf` - broad top, quiet edge rhythm, strongest tactical readability.
2. `fracture` - asymmetric corners and more visible sidewall strata.
3. `crown` - deeper bevel and a more pronounced authored silhouette.

The variant is derived from the immutable tile alias and tile type. Reloads, state transitions, and camera movement therefore cannot reshuffle the world.

## Geometry system

- Five sculpted vertical rings form each low-poly hex prism: recessed base, tapered wall, authored family ledge, outer shoulder, and inset top bevel.
- Six family silhouette profiles vary taper, ledge width, corner rhythm, and crown inset independently of color. Landing stays engineered and regular; plains broad and quiet; jungle root-broken; desert wind-cut; mountain sharply tapered; relic deliberately terraced.
- Family elevation stays in `boardWorld.js`; geometry remains normalized and is instanced at runtime.
- Eighteen geometry/material batches are the maximum: six families multiplied by three variants. Hidden tiles retain one shared fog batch.
- Top and side faces use separate PBR material channels. UV rotation, scale, and jitter are deterministic.
- Landmarks attach to a tile-local anchor and never alter the raycast or tile transform.

## PBR surface package

Every promoted family has top and side packages with:

- base color
- tangent-space normal
- roughness
- ambient occlusion
- height/bump
- localized emissive mask
- KTX2 compressed equivalents

The material pipeline derives and verifies these packages from approved GPT Image 2 terrain studies. The neutral-light source contains no intentional directional shadow. Existing seam, clipping, byte-size, provenance, and relational-review gates remain mandatory.

## Modular landmark recipes

Each macro variant selects a landmark composition recipe rather than a unique baked tile image. A recipe controls landmark yaw, offset, scale, density, route clearance, and optional socket type. The system can combine:

- illustrated cutout biome silhouettes
- procedural rocks, roots, grass, shards, spires, rings, and crystals
- landing beacons and campsite shelters
- encounter, hazard, route, and relic sockets
- authored hero relic geometry or reviewed GLB replacements

Gameplay-significant sockets are always retained. Dense boards may simplify decorative backing, shadows, lights, or minor clusters, but never remove gameplay information.

## State layers

| State | Visual channel | Base transform |
| --- | --- | --- |
| Hidden | Shared fog material and low elevation | Stable |
| Reachable | Low cyan inset halo | Stable |
| Hover/focus | Intent ring and optional discovery projection | Stable |
| Selected | Gold route ring and waypoint connection | Stable |
| Dangerous | Red intent ring, localized projection, danger lighting rig | Stable |
| Visited/current | Party presence, route history, landmark response | Stable |
| Committed/resolving | Route, beat lighting, restrained animation | Stable |

Color is never the only signal: ring shape, route topology, silhouette, motion, and text provide redundant meaning. Reduced-motion mode freezes ambient motion but retains state contrast.

## Image-generation workflow

1. Use Azure GPT Image 2 to create one orthographic three-variant concept plate for each terrain family. The plate is a reference, not final game-state UI.
2. Review all six plates together for family separation, hex footprint, landmark clearance, value range, and compatibility with the cutout-character aesthetic.
3. Promote neutral surface studies through `material-system.json`; do not crop lighting or gameplay state into PBR source maps.
4. Generate PBR maps with `npm run material:generate`, then inspect channel and rendered contact sheets.
5. Implement form and modular parts as reusable Three.js geometry. Use generated imagery to guide material and silhouette, not to replace reliable interaction geometry.
6. Capture default, quarter, and close views in neutral, danger, recovery, and relic lighting at high and efficient quality.

## Acceptance gates

- [x] Six distinct families and eighteen deterministic macro variants are represented in the runtime kit.
- [x] No hover, focus, selection, danger, or visited transition mutates a base-tile matrix.
- [x] Picking aliases remain correct for every instanced variant batch.
- [x] Tile geometry, materials, props, textures, and listeners dispose cleanly on remount.
- [x] A 100-tile board stays within the existing draw-call, texture, triangle, and p95 frame-time budgets.
- [x] High, balanced, and efficient quality tiers retain the same gameplay information.
- [x] Family identity remains legible in grayscale and at thumbnail scale.
- [x] Generated concept plates and their exact prompts are stored with provenance and a review contact sheet.
- [x] Unit tests, board tests, material doctor, art doctor, and production build pass.

Verification evidence and intentional reference/runtime differences are recorded in `docs/GAME_TILE_KIT_VISUAL_REVIEW.md`.

## Implemented package

- Runtime geometry and deterministic recipes: `app/src/components/board/tileKit.js`
- Board integration and state-safe instancing: `app/src/components/board/ThreeBoard.jsx`
- Interactive family/variant review: `/material-lab`
- Six approved direction plates: `app/public/images/art/tile-concepts/`
- Exact prompts and provenance: `app/src/art-pipeline/tile-kit.json`
- Automated geometry contract: `app/src/components/board/tileKit.test.js`
- Current visual evidence: `artifacts/materials/lookdev-material-contact-sheet.png` and `artifacts/board-system/captures/`

Version 1.1 is the shipping baseline: 6 families x 3 macro forms = 18 deterministic tile variants, with five-ring family silhouettes, coherent quad normals, separate top/side PBR surfaces, modular landmarks, stable interaction overlays, adaptive quality, and measured browser evidence.

## Iteration rule

Improve a family at the smallest responsible layer: tune a recipe before adding an asset, tune a material before adding geometry, and add geometry before adding a unique draw call. New variants must remain deterministic, modular, reviewable in isolation, and comparable in the integrated board.
