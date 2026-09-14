# Xenovoya Modular Art Pipeline

The art pipeline turns one-off image generation into a versioned production system. Its job is not to make more pictures. Its job is to make recognizable Xenovoya assets that support a specific player feeling, survive reuse, and carry enough evidence to be safely shipped.

## Source of truth

- `app/src/art-pipeline/art-direction.json` defines the visual DNA, palette jobs, materials, emotional beats, reusable part roles, output contracts, and joy gates.
- `app/src/art-pipeline/asset-manifest.json` defines every approved or planned asset, its prompt modules, references, technical destination, provenance, and reusable compositions.
- `scripts/art-pipeline-utils.mjs` owns validation, prompt compilation, scoring, and image inspection.
- `scripts/art-pipeline.mjs` exposes the workflow as commands.
- `/art-lab` is the internal visual review surface when `VITE_ENABLE_INTERNAL_TOOLS=true`.

Do not fork these facts into an untracked prompt document. Change the source contract and increment its semantic version when the visual language or delivery contract changes.

Legacy concept images remain visible as `reference` records. They may guide hierarchy or material decisions, but they are not truthful gameplay proof and cannot be promoted as such. The doctor also rejects image files found in a managed root that have no manifest record.

## The production loop

1. Frame the emotional job.
   Choose one beat: discovery, cooperation, agency, trust, jeopardy, relief, triumph, or remembrance. The asset must produce a player response, not merely fill a rectangle.
2. Choose a reusable part role.
   Backplates provide space and atmosphere. Focals provide the meaningful object. Routes express choice and causality. Signals express state change. Textures provide repeatable material. Proof comes only from the shipped product.
3. Compile the brief.
   Run `npm run art:brief -- <asset-id>`. The compiler joins the stable Xenovoya DNA with the asset-specific subject, emotional cues, output contract, reference roles, continuity locks, and avoid list.
4. Generate or capture.
   For generated raster art, use the built-in image-generation workflow or an explicitly authorized provider adapter, record the real provider and model, load every supported reference first, label its role, and make one call per distinct asset or variant. The FLUX adapter writes the exact compiled prompt beside every successful candidate and preserves it even when a provider request fails after submission. For gameplay proof, use deterministic product capture; never generate a fake interface.
5. Place candidates in the workspace.
   Copy candidates to `artifacts/art/candidates/<asset-id>/`. Never leave a project candidate only in a tool cache. Working candidates are ignored by Git.
6. Normalize and validate the contract.
   Run `npm run art:export -- <asset-id> <source-path> --write` for ordinary outputs. For a FLUX image generated on a flat isolation field, run `npm run art:cutout -- <asset-id> <source-path> --write`; it removes only the border-connected background by default, preserves enclosed highlights, records extraction settings and fingerprints, exports to the delivery contract, and validates the result. For closed silhouettes, add inspected interior flood-fill points with `--seeds "x,y;x,y"`. Use `--all-background` only when global color removal is safe. Width, height, format, real transparency, color space, and byte budget must all pass.
7. Compare, then score.
   Create a contact sheet, inspect at original size and thumbnail size, and complete the review scorecard. Every gate must score at least 3/4 and the weighted joy score must reach 8/10.
8. Promote deliberately.
   Promotion requires an approved review whose candidate fingerprint matches the selected file, explicit `--write`, and explicit `--replace` when a destination already exists. Replaced assets are backed up before promotion. The manifest receives a new fingerprint and durable review path. Promotions are serialized with a manifest lock so concurrent commands cannot discard one another's registry updates.
9. Verify in context.
   Capture the real site or game state at desktop and mobile sizes. Art is not approved merely because the isolated file is attractive.

## Commands

Run these from `hexploration` in PowerShell or Git Bash:

```text
npm run art:doctor
npm run art:list
npm run art:brief -- relic-sunstone-lens-focal
npm run art:generate -- relic-sunstone-lens-focal --variant silhouette-a --direction "broad asymmetric silhouette" --write
npm run art:cutout -- relic-sunstone-lens-focal artifacts/art/candidates/relic-sunstone-lens-focal/relic-sunstone-lens-focal-silhouette-a.png --write
npm run art:cutout -- relic-atlas-spindle-focal artifacts/art/candidates/relic-atlas-spindle-focal/relic-atlas-spindle-focal-board-cutout-a.png --write --seeds "550,300;400,400;650,500;380,600;650,600;400,700"
npm run art:generate -- concept-first-relic-encounter --variant ledge-a --size 1536x1024 --write
npm run art:composition -- discovery-reveal
npm run art:inspect -- relic-sunstone-lens-focal artifacts/art/candidates/relic-sunstone-lens-focal/a.png
npm run art:export -- relic-sunstone-lens-focal artifacts/art/candidates/relic-sunstone-lens-focal/a.png --write
npm run art:review -- relic-sunstone-lens-focal artifacts/art/candidates/relic-sunstone-lens-focal/a.png --write --mode azure-image-generation --tool azure-foundry --model FLUX.2-pro
node scripts/art-pipeline.mjs review-check artifacts/art/reviews/relic-sunstone-lens-focal.json
node scripts/art-pipeline.mjs contact-sheet relic-sunstone-lens-focal artifacts/art/candidates/relic-sunstone-lens-focal/a.png artifacts/art/candidates/relic-sunstone-lens-focal/b.png --write
node scripts/art-pipeline.mjs contact-sheet relic-sunstone-lens-focal artifacts/art/candidates/relic-sunstone-lens-focal/a.png artifacts/art/candidates/relic-sunstone-lens-focal/b.png --write --columns 3 --thumbnail 480x480 --labels variant
node scripts/art-pipeline.mjs contact-sheet prop-landing-beacon artifacts/art/exports/prop-landing-beacon.png artifacts/art/exports/prop-campsite-shelter.png --write --columns 2 --labels asset
npm run art:context-sheet -- relic-sunstone-lens-focal artifacts/art/candidates/relic-sunstone-lens-focal/a.png --write
node scripts/art-pipeline.mjs promote relic-sunstone-lens-focal artifacts/art/candidates/relic-sunstone-lens-focal/a.png --review artifacts/art/reviews/relic-sunstone-lens-focal.json --write
```

The context sheet renders the same candidate at 220 px and 72 px against paper, night, and Emberglass conditions. The final promotion command refuses to overwrite an existing destination. Add `--replace` only after reviewing the in-context before/after capture.

### Six-view image-to-3D pipeline

Objects that need real volume use a separate, resumable source-candidate pipeline rather than attempting to infer a mesh from the shipped front cutout alone. `app/src/art-pipeline/asset-3d-manifest.json` fixes the source identity, six camera angles, image models, seeds, reconstruction settings, and decimation budget for every object.

The image stages have explicit jobs:

1. The approved project cutout is the identity reference.
2. Azure FLUX.2-pro creates an exact 3x2 draft turnaround: front, front-right, back-right, back, back-left, and front-left.
3. Azure GPT Image 2 edits that draft against the approved identity reference, correcting cross-view drift into one canonical six-view sheet.
4. The sheet is split into six 512x512 images. Each asset can use either a connected-border matte for neutral fields or a soft-color matte for saturated isolation fields. Cardinal and orbit stages can select different matte modes so open frames do not retain enclosed cyan panels while pale objects are not erased.
5. GPT Image 2 makes a second strict cardinal sheet with front, right profile, back, and left profile because reconstruction needs semantic camera truth, not merely attractive angles. Normal assets use the approved identity, FLUX draft, and six-view identity sheet together. Rework assets can set `cardinalReferenceMode: identity-only` so a corrected six-view object is not pulled back toward a conflicting legacy silhouette.
6. All six orbit views remain identity and review evidence. TRELLIS.2's native semantic `multiview` path receives the four cardinal images. The local service's experimental six-image token-concatenation path was tested, but it fused the Sunstone Lens views into one elongated object, so it is retained only as rejection evidence and is not the production default.

Run the following from `hexploration` in PowerShell or Git Bash:

```text
npm run art:3d:doctor
npm run art:3d:plan
npm run art:3d:generate -- relic-sunstone-lens-focal --write
npm run art:3d:contact-sheet -- relic-sunstone-lens-focal --write
npm run art:3d:trellis -- relic-sunstone-lens-focal --write
npm run art:3d:trellis-six -- relic-sunstone-lens-focal --write
npm run art:3d:render -- relic-sunstone-lens-focal --write
npm run art:3d:render-six -- relic-sunstone-lens-focal --write
npm run art:3d:all -- prop-landing-beacon --write
```

Omit the asset id to process the full manifest. Existing stages are skipped, so interrupted batches resume without repeating paid generation or GPU work. `art:3d:trellis` uses TRELLIS.2's camera-aware four-cardinal mode; `art:3d:trellis-six` separately sends all six orbit images through the experimental multi-image mode so the two reconstructions can be compared without conflating them. Use `--reprocess` to rebuild normalization, semantic crops, and alpha from preserved provider outputs without making new image calls. Use `--replace-cardinal` to regenerate only a failed cardinal provider stage while preserving the paid FLUX and identity passes. Add `--replace` only to intentionally regenerate every provider stage.

Provider layout is never assumed from the requested format. Inspect the saved cardinal sheet, then encode explicit front/right/back/left crop regions when the model changes layout, swaps cells, or lets a wide object cross a nominal boundary. The pipeline validates every crop against the 1024x1024 provider sheet before reconstruction.

Every extracted transparent view also has a subject-coverage gate. A crop fails before GPU reconstruction when alpha coverage is below 2 percent (usually a wrong or nearly empty crop) or above 85 percent (usually a retained background panel). This prevents tiny, semantically wrong inputs from consuming a TRELLIS job and producing plausible-looking but invalid evidence.

All source candidates live under `artifacts/art/3d/<asset-id>/`. Each folder preserves the raw provider images, normalized sheets, exact prompts, image hashes, six transparent orbit views, four transparent cardinal inputs, local service receipt, performance capture, GLB, and combined pipeline receipt. Review sheets live under `artifacts/art/3d/reviews/`; `art:3d:render` adds deterministic front, side, back, top, and perspective Blender renders plus a contact sheet. These are development candidates, not runtime dependencies: a GLB must still pass visual identity, rear-geometry, scale, orientation, material, pivot, topology, LOD, and in-game performance review before it can move into `app/public/models/`.

The latest per-asset lane selection and review notes are machine-readable in `app/src/art-pipeline/asset-3d-review.json`. A `cleanup-candidate` is suitable as a DCC source but is not permission to ship it directly; `rework-required` means the reconstruction target or source views must change first.

Runtime preparation is a separate, deterministic gate. `npm run art:3d:prepare-runtime -- <asset-id> --write` accepts only a reviewed `cleanup-candidate`, validates generated mesh data, grounds its pivot, creates bounded close-up `lod0`, standard `lod1`, and tactical `lod2` GLBs with quantized geometry and WebP textures, validates every file, and records hashes plus measured byte, triangle, vertex, material, texture, animation, and extension counts. Global budgets remain the default; an asset may declare reviewed per-LOD simplify and budget overrides when a broad soft structure visibly breaks under the hard-surface budget. A manifest-governed `materialOverride` can also correct reconstruction-specific PBR failures with bounded metallic and roughness factors plus an optional luminance-preserving two-color base-map remap; the exact values are written into the receipt. `npm run art:3d:render-runtime -- <asset-id> --write` renders every LOD from five angles into one comparison sheet. Passing these technical gates still does not promote the model: the runtime sheet must prove identity, silhouette, rear construction, ground contact, material response, and acceptable LOD degradation before copying anything into `app/public/models/`.

`npm run art:3d:promote-runtime -- <asset-id> --write` then requires an `approved` runtime review, verifies every reviewed fingerprint and budget again, copies every LOD into the public model library, and updates `runtime-models.json`. `npm run art:3d:runtime-doctor` rejects missing evidence, fingerprint drift, approved-but-unpromoted models, or any rework decision left in the runtime registry. The tactical board deliberately selects the reviewed LOD2 delivery model; LOD0 and LOD1 remain available for close-up and marketing scenes. Authored cutouts remain loading, error, and efficient-mode fallbacks.

Current September 14 review: Landing Beacon, Route Fork Marker, Atlas Spindle, Campsite Shelter, Tideglass Heart, and Sunstone Lens are approved runtime assets. The rebuilt shelter removes the former ground slab and uses an evidence-backed 7,298-triangle far-delivery exception because lower collapse ratios produced visible holes and spikes. Tideglass uses a receipt-backed material correction that restores its emerald chamber and warm cradle across all three LODs. Both image-driven Sunstone reconstructions remain preserved as rejection evidence; its approved runtime lane is a deterministic authored hard-surface fallback derived from the GPT Image 2 four-view identity sheet, preserving the octagonal housing and amber aperture across 3,880, 2,793, and 1,862 triangle LODs.

In the board, balanced quality deterministically selects one approved Sunstone, Tideglass, or Atlas relic model from the tile alias while using the campsite cutout so the captured scene remains within its 12,000-triangle contract. High quality loads the full 3D shelter. Efficient quality uses matching authored relic cutouts. Every path retains deterministic identity selection and loading/error fallbacks.

### Lossless runtime image delivery

Approved transparent PNGs remain the review and identity sources. Runtime delivery uses fingerprinted lossless WebP derivatives so compression never changes the approved pixels or alpha silhouette. `app/src/art-pipeline/runtime-image-delivery.json` maps each source to one `.runtime.webp` file and records dimensions, byte counts, and both fingerprints.

```text
npm run art:runtime-images:generate -- --write
npm run art:runtime-images:test
npm run art:runtime-images
npm run art:runtime-images:audit -- --base-url=http://127.0.0.1:11134 --write
```

The generator invokes ImageMagick without a visible helper window, preserves source dimensions, and updates the receipt manifest. The doctor rejects missing outputs, dimension drift, fingerprint drift, duplicate paths, path traversal, or any derivative larger than 70% of its PNG source. The initial 23-asset package reduces 9.52 MiB of transparent source art to 5.68 MiB, a lossless 40.3% reduction. Character and board runtime selectors use the derivatives while authoring, relational review, and provenance continue to reference the canonical PNGs. The browser audit measures a verified production build, records which optimized assets each route actually loads, and writes the observed-versus-canonical projection to `reports/performance/runtime-image-delivery.json`.

### Azure FLUX.2-pro adapter

The authorized local adapter is `$HOME/.codex/azure-image.sh`, with `$HOME/.codex/flux2-pro-image.sh` retained as a square-image fallback. The `art:generate` command invokes it without exposing credentials, writes the raw candidate under `artifacts/art/candidates/<asset-id>/`, and stores both the exact compiled prompt and an adjacent receipt with the provider, model, requested size, variation direction, source references, prompt fingerprint, candidate fingerprint, observed file contract, and correct next command. Alpha assets point to `art:cutout`; opaque assets point to `art:export`. Omit `--write` for a safe dry run; add `--replace` only when intentionally replacing an existing raw candidate. Never copy credentials into this repository.

FLUX may return opaque JPEG bytes even when the requested filename ends in `.png`. Treat the bytes, not the extension, as truth. Use `art:cutout` for transparent assets generated against a uniform white or hexadecimal-color isolation field; adjust `--fuzz` only after inspecting edges. The default 13 percent removes the connected backdrop without globally deleting enclosed light values. Closed silhouettes such as rings may retain isolated background pockets; inspect the alpha result and repeat with source-pixel `--seeds` for each pocket. Reserve `--all-background` for imagery without light values close to the isolation color. The approved manifest and adjacent prompt/receipt pair preserve reproducible generation provenance.

### Character identity pipeline

`app/src/characters/character-catalog.json` is the canonical roster shared by gameplay, role selection, dossiers, the Three.js standees, the design system, and art QA. Its schema fixes identity anchors, silhouette, palette, signature equipment, immutable details, state coverage, and the 2.5D standee contract. The runtime always resolves an authored state when one exists and otherwise falls back to that character's neutral art; it never substitutes another person.

Use the character wrapper for identity work:

```text
npm run character:doctor
npm run character:plan
npm run character:brief -- field-mender neutral --write
npm run character:generate -- field-mender recovering --write
npm run character:review -- field-mender recovering artifacts/art/exports/character-field-mender-recovering.png --write
npm run character:contact-sheet -- crew --write
npm run character:contact-sheet -- crew --write --mode silhouette
npm run character:context-sheet -- field-mender --write
npm run character:report
npm run character:ci
```

Neutral concepts may begin with FLUX.2-pro, but state art must use GPT Image 2 edit mode with the approved neutral file as its canonical input. A condition cannot pass on generic beauty scores alone: `samePerson`, `face`, `proportions`, `costume`, `equipment`, `visualScale`, and `stateRead` must each reach 3/4. The review records the neutral asset fingerprint, so changing a base identity automatically invalidates every dependent state until it is regenerated or reviewed again.

For a tightly controlled restyle, `art:generate` accepts one content/identity source through `--input` and semicolon-separated style-only sources through `--style-inputs`. This is an experimental review lane, not an automatic promotion lane: multi-image edits can collapse toward a style reference's person or costume. Reject that result even when the rendering is attractive. Every provider output remains a candidate until technical checks, side-by-side identity review, silhouette review, context sheets, and promotion all pass.

## Current memory composition

The Run Relic experience composes two independently reviewed parts in `RelicMemoryArtwork.jsx`: the Glassroot Cavern backplate supplies route depth and quiet text space, while the transparent Choir Seed supplies the focal reward. All run title, outcome, score, crew, cost, route, and challenge data remain live HTML. This keeps the memory truthful and responsive while avoiding the pasted-on character collage identified during exploration.

## Current board composition

The Three.js expedition world composes six approved terrain materials, transparent biome props, two approved state-effect textures, four distinct transparent character standees, and approved runtime models in `ThreeBoard.jsx`. Relic tiles deterministically select the approved Sunstone Lens, Tideglass Heart, or Atlas Spindle, and campsite tiles can load the approved shelter; every model retains a matching lossless WebP cutout for efficient quality and loading failure. Player identity and condition are resolved from the canonical character catalog rather than seat-index texture arrays. Tile geometry, elevation, lighting, routes, reachability, selection, danger, and interaction remain native 3D systems. Generated art adds surface identity and role character without becoming a screenshot-shaped dependency or replacing live game state.

### Surface and lighting pipeline

`app/src/art-pipeline/material-system.json` is the source of truth for board surface channels, semantic lighting rigs, quality tiers, tile-to-material assignments, and runtime budgets. Each surface ships paired top and side bundles with base color, tangent normal, roughness, ambient occlusion, height, and localized emissive maps. WebP files remain inspectable sources; KTX2 packages are the runtime delivery format.

Run the following from `hexploration` in PowerShell or Git Bash:

```text
npm run material:generate
npm run material:contact-sheet
npm run material:capture
npm run material:cross-browser
npm run material:render-sheet
npm run material:review -- --material=glassroot-canopy --reviewer="Name" --decision=approved --scores=tileability:3,depthResponse:3,lightNeutrality:3,materialIdentity:3,stateLegibility:3,accessibility:3
npm run material:doctor
npm run material:ci
```

`material:generate` derives reproducible channel bundles and receipts from each registered terrain source, then packages both horizontal and vertical variants as KTX2. `material:capture` launches the internal look-dev route with the correct feature flag, captures every material under neutral light, captures the reference material under every semantic rig, verifies the integrated board in ready and danger states, and measures draw calls, resident textures, frame pacing, and adaptive pixel ratio. `material:cross-browser` checks KTX2 decode and board integration in Firefox and WebKit. The strict doctor rejects missing, stale, oversized, non-tileable, uncompressed, or unapproved material bundles.

Use `/material-lab` only as the controlled comparison surface. Final approval still requires the real board captures because scale, silhouettes, UI contrast, and semantic state can fail even when an isolated sphere looks convincing. See `docs/MATERIAL_AND_LIGHTING_SYSTEM.md` for ownership and troubleshooting.

## Generation rules

- Generated art may supply atmosphere, material, focal objects, and effects. Product copy, scores, routes, player names, and interface controls remain code-native.
- Every reference image has an explicit role. A reference can anchor material, composition, color, or an edit target; those meanings are not interchangeable.
- Transparent parts require real alpha, clean edges, generous padding, and no background glow that destroys composability.
- Tileable textures require seamless edges, even lighting, and no unique focal feature.
- Emotional color remains localized. Full-frame neon makes discovery, safety, danger, and rarity indistinguishable.
- The smallest useful part wins. Prefer a reusable relic cutout plus a reusable reveal overlay over one flattened illustration that cannot respond to game state.
- No named-artist imitation, franchise mimicry, logos, signatures, watermarks, pseudo-text, or invented product UI.
- Generated candidates that introduce familiar consumer hardware, pseudo-labels, fake maps, or unrequested interface marks are rejected even when otherwise attractive.

## Joy acceptance

Each candidate is scored from 0 to 4 on:

- recognition: the subject and beat read in two seconds;
- agency: the image communicates choice, relationship, consequence, or earned result;
- specificity: it belongs recognizably to Xenovoya;
- restraint: one focal event has enough quiet space;
- continuity: palette, material, geometry, and signal hierarchy remain intact;
- reusability: parts crop, layer, and scale without losing meaning;
- accessibility: meaning survives without color and leaves contrast for UI.

The weighted score must be at least 8/10, and no individual gate may fall below 3/4. A technically valid but emotionally generic image does not ship.

## Versioning and ownership

- Patch: wording, compression, or metadata changes with no visual-language change.
- Minor: a new emotional beat, asset type, part role, or compatible style rule.
- Major: a palette, material, geometry, or composition change that would make old assets visually incompatible.
- Art direction owns visual continuity. Product design owns hierarchy and UI-safe space. Engineering owns formats, performance, provenance, and deterministic integration. Two-person review is preferred for promotion.
