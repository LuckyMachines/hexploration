# Xenovoya Asset and Runtime Integration Audit

Date: 2026-09-16
Scope: 52 character standees, landing package, three boss packages, promoted relic and prop models, and live Board Lab states.

## Outcome

The art direction is strong, but several assets were integrated as complete miniature scenes instead of components of the 3D board. The highest-value correction is to make the board own all ground, shadow, and tile geometry. Characters, relics, props, and encounter art should contribute only their subject silhouettes or true 3D volume.

## P0 - Runtime composition defects

1. Character pixels intersect the hard pawn cylinder. The cylinder occupies world Y 0.00-0.12 while the sprites begin inside it.
2. A single foot anchor is reused for every pose even though crouching, running, downed, and standing silhouettes have different visible bounds.
3. Landing and boss tile paintings are mounted as camera-facing sprites over existing hexes. They duplicate the floor, change apparent perspective as the camera rotates, and do not share the board's exact footprint.
4. The Tideglass Heart runtime GLB contains a large cyan rectangular floor plane in every LOD.
5. The Campsite Shelter runtime GLB contains a rectangular floor plane in every LOD.
6. Several 2D props include baked terrain islands that conflict with their host hex: campsite shelter, emberglass shards, glassroot fronds, lantern moss, and slate spires.

## P0 - Broken source frames

- Relic Tender: aftermath, carrying, escaping, helping, and idle-alert are clipped, incomplete, or partially transparent.
- Full-width opaque bands exist in Field Mender strained, Relic Tender moving, Relic Tender strained, and Signal Cartographer strained.

## P1 - Character readability

- Signal Cartographer: helping needs a clearer helping verb; selected and idle-alert are too similar; triumph is too neutral.
- Field Mender: aftermath, idle-alert, and triumph need more distinct silhouettes.
- Relic Tender: the state set needs identity-locked repair and is the least consistent family.
- Routekeeper: the family is strong; aftermath and triumph can read more decisively.
- Low poses need wider, softer contact shadows; moving poses need directional shadows; no pose should require a hard pedestal.

## P1 - Prop and relic quality

- Sunstone Lens is floor-free but too smooth and black/orange compared with its weathered source identity.
- Atlas Spindle is floor-free but too white and loses its purple crystalline read.
- Landing Beacon is structurally sound but its glass reads too white.
- Route Fork is structurally sound but its tips become too thin at board scale.
- Landing skiff has clean alpha but needs brighter cyan windows and edge highlights at gameplay scale.

## P1 - Special encounters

- Boss reveal scenes are useful cinematic backplates and should remain.
- Boss tile paintings should remain concept/reference art, not runtime geometry.
- Emberglass has a thick duplicate hex, Stormneedle approaches a rectangle, and Violet reads as an octagon. All three should use exact code-native pointy-top hex overlays driven by the same board coordinate system.

## Implementation contract

1. Remove hard character pedestals from authored standees.
2. Resolve grounding from character plus state, including transparent bottom padding and shadow shape.
3. Replace landing and boss tile billboards with exact horizontal hex surface overlays.
4. Prevent runtime promotion of models whose review decision is not approved.
5. Quarantine Tideglass Heart and Campsite Shelter models until their floor planes are removed.
6. Regenerate the five broken Relic Tender states as individual, identity-locked assets.
7. Repair opaque edge bands and add an automated alpha-edge integrity gate.
8. Regenerate object-only versions of the five terrain-baked props.
9. Rebuild runtime WebP derivatives, run art and character doctors, recapture the board, and compare before/after evidence.

## Acceptance criteria

- No visible character pixel intersects a pedestal or hard base.
- Every character state touches the same believable world ground line.
- No special encounter floor rotates to face the camera.
- Landing and boss surface treatments fit the same pointy-top hex footprint as terrain.
- No approved runtime model includes a visible rectangular floor slab.
- No character PNG has an opaque full-width top or bottom band.
- No repaired character is missing a head, hand, boot, or identity-defining prop.
- Cutout props contain no unrelated floor tile, horizon, frame, label, or checkerboard.
- Board interaction, camera controls, and stable-hover behavior continue to pass their tests.

## Implemented in this pass

- Replaced the shared hard pawn pedestal with state-aware soft contact shadows.
- Added per-character, per-state bottom-padding compensation so visible feet share a stable world ground line.
- Replaced landing and boss tile sprites with exact horizontal six-sided surface meshes and code-native markings.
- Removed terrain-backed prop cutouts from live board selection and restored clean procedural 3D landmarks in their place.
- Rejected and unpromoted the Tideglass Heart and Campsite Shelter GLBs after integrated review exposed their floor planes.
- Added approval-gated runtime model lookup so rejected models cannot silently return.
- Added warm/cool material identity tuning for the approved Sunstone Lens, Atlas Spindle, Landing Beacon, and Route Fork models.
- Removed the four opaque edge bands and fixed the cleanup operation that had been writing opaque alpha instead of transparent alpha.
- Added an automated alpha-edge integrity check to the normal art doctor.
- Generated and promoted five complete individual Relic Tender repairs: aftermath, carrying, escaping, helping, and idle-alert.
- Added resumable generation and processing commands for identity-locked character repairs and object-only prop replacements.
- Added a reusable runtime capture command that records the WebGL asset and performance diagnostics next to each screenshot.

## Evidence

- `artifacts/art/runtime-review-2026-09-16/after/board-ready.png`
- `artifacts/art/runtime-review-2026-09-16/after/board-landing-site.png`
- `artifacts/art/runtime-review-2026-09-16/after/board-boss-emberglass.png`
- `artifacts/art/runtime-review-2026-09-16/after/relic-tender-repairs-contact.png`

The generated PNG evidence is intentionally excluded from Git; the production source images, delivery derivatives, manifests, reviews, tests, and workflows are tracked.
