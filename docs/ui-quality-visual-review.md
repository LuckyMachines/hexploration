# UI Quality Visual Review

Review date: 2026-09-08

## Scope and Evidence

The reference-left/current-right sheet covers the public promise on desktop and mobile, the ready 3D board, ready-versus-danger comparison, mobile recovery, and responsive composition. The generated sheet is `artifacts/ui-quality/contact-sheets/latest.png`; exact per-scene diffs are recorded in `artifacts/ui-quality/diffs/latest.json`.

The approved and current captures are exact matches at this checkpoint. This is expected for the initial baseline and proves repeatable capture rather than improvement by itself.

## Visual Critique

- The public landing hierarchy is decisive: fantasy, cooperative promise, and entry paths read in that order. Mobile preserves the headline and both entry choices without horizontal overflow.
- The 3D board is the dominant object in the gameplay composition. It reads as a layered diorama with cutout explorers, elevated tiles, vegetation, foreground tile faces, and a recessed environment rather than a flat diagram.
- Ready and danger comparison states preserve geometry while changing copy, pressure, and consequence, protecting the player's spatial memory.
- Recovery is compact and actionable on mobile, although it is intentionally austere. Every failure names the problem and offers one next step.
- The responsive composition keeps mission status and action simulation readable without flattening the hierarchy into an undifferentiated card grid.

## Spatial Evidence

The cropped board-world depth comparison is `artifacts/ui-quality/spatial/board-world-depth-comparison.png`. Near foreground tile faces resolve warm, mid-board characters and foliage form a distinct middle layer, and the cavern recedes into cool values. The perspective overlay is `artifacts/ui-quality/spatial/board-world-perspective.png`; same-family isometric tile edges place their estimated vanishing point far outside the frame, which is consistent with the intended stable isometric presentation.

## Acceptance Result

- PASS: visual hierarchy and responsive reflow
- PASS: 3D depth and stable isometric perspective
- PASS: visual determinism and exact initial diff
- PASS: serious/critical accessibility and 44 px effective targets
- PASS: frame pacing in deterministic local capture
- OPEN: observed-player comprehension, joy, and return intent

## September 14 tile-kit and relic integration pass

The complete 11-scene reference-left/current-right sheet is `artifacts/ui-quality/contact-sheets/latest.png`. Five scenes were source-invalidated by the modular tile geometry and governed relic integration: `guest-expedition-desktop`, `guest-expedition-mobile`, `board-ready`, `board-danger-comparison`, and `board-waiting`.

Original-resolution inspection found one stable 2% pixel difference in `board-danger-comparison`. The change is intentional: deeper family-specific tile silhouettes and the approved Tideglass relic replace the earlier generic terrain/relic presentation. Page composition, typography, action hierarchy, controls, camera, copy, and responsive geometry remain aligned. The current comparison is `artifacts/ui-quality/comparisons/board-danger-comparison-current.png`.

The refreshed relative-depth comparison is `artifacts/ui-quality/depth/tile-kit-pass/board-danger-depth-comparison.png`, generated with `depth-anything/Depth-Anything-V2-Small-hf`. It preserves the same foreground terrain, middle interaction/character plane, and receding cavern order; warm/bright indicates relatively nearer regions and is not a metric distance measurement. The camera did not change, so the existing perspective calibration remains authoritative at `artifacts/ui-quality/spatial/runtime-3d-board-perspective.png`: normalized vanishing point (-3.1080, 2.7105), stylized-isometric horizon assumption, 35.21 px mean line residual.

Acceptance checklist:

- [x] All 11 reference/current pairs inspected at original resolution.
- [x] Desktop and mobile compositions preserve hierarchy and reflow.
- [x] Board base transforms and camera remain stable across transient states.
- [x] Refreshed relative-depth evidence preserves grounding and plane order.
- [x] The existing perspective hypothesis remains valid because camera geometry did not change.
- [x] Zero horizontal overflow, small interactive targets, layout shift, serious accessibility findings, or critical accessibility findings.
- [x] Chromium capture passes 11/11 after explicit approval.
- [x] Chromium, Firefox, WebKit, Pixel 7, and iPhone 13 contracts pass 10/10.

Current automated UI result: Grade A, 11/11 approved scenes current. Human comprehension, joy, and return intent remain a separate observation gate and were not simulated.

## September 14 renderer-readiness and material-source pass

The current source fingerprint invalidated five board-bearing approvals after the non-mirrored terrain-source upgrade and renderer-readiness hardening: `guest-expedition-desktop`, `guest-expedition-mobile`, `board-ready`, `board-danger-comparison`, and `board-waiting`. Each reference/current pair was inspected individually at original resolution in `artifacts/ui-quality/comparisons/`, in addition to the complete sheet at `artifacts/ui-quality/contact-sheets/latest.png`.

The current render intentionally presents broader, cleaner basalt planes and clearer family silhouettes. Guest Expedition gains a quieter mist field behind the board; board-ready, danger, and waiting retain the same camera, route topology, action hierarchy, semantic colors, typography, control positions, and stable tile matrices. The result makes characters, standees, route rings, and action state more legible without flattening the diorama.

No camera or geometry change was introduced by the readiness fix, so the September 14 tile-kit depth and perspective evidence remains authoritative. Shader compilation is now observable and bounded: Safari/WebKit uses the synchronous path, while Chromium and Firefox retain an eight-second async warm-up budget. This changes failure behavior, not the approved composition.

Acceptance checklist:

- [x] All five invalidated reference/current pairs inspected individually at original resolution.
- [x] Complete 11-scene contact sheet inspected at original resolution.
- [x] Board hierarchy, camera, route topology, controls, copy, and responsive reflow remain stable.
- [x] Material changes preserve foreground, interaction, and background plane order.
- [x] Ready, danger, and waiting remain distinguishable without moving the base board.
- [x] Chromium UI capture passes 11/11.
- [x] Firefox and WebKit board compatibility passes 12/12 without retry.
- [x] Human comprehension and delight remain explicitly unclaimed pending observed sessions.
