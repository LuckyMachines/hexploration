# Xenovoya Premium Game and Site Improvement Plan

Date: 2026-09-17
Scope: player entry, solo expedition, 3D board presentation, characters, encounters, rewards, marketing, performance, release truth, and production operations.

## Outcome

The reviewed player and marketing releases are now live from Coolify on Hetzner. The former Cloudflare Pages custom-domain bindings were removed, the three public DNS records were migrated, and exact release manifests now prove which commit each surface is serving. The playable solo experience and its marketing entry have a shared visual language, a shorter path to play, more authored encounters, a four-person crew, stronger board composition, and production security headers.

## Stricter A bar

A first-time player can enter solo play, understand the immediate objective, choose a route, witness a memorable world reaction, recover or lose something meaningful, and want another expedition without seeing blockchain vocabulary, reading a manual, or scrolling away from the board. The marketing site proves that experience with current gameplay. Both domains serve the intended reviewed commits from Coolify and pass exact-SHA, security-header, responsive, accessibility, performance, and recovery checks.

## Baseline evidence

- Live player release: `eeee333cac319d9d2642ac9e00ffed516f12550f`.
- Player `main` at start of pass: `5635bd0937b8f9e71ede20b79ae8e1957ded9613` (10 commits ahead).
- Live marketing release: `2a206bfa991ca8b5c5ce7f02a245d42309ca50e6`.
- Marketing `main` at start of pass: `59e132c487b8dbf945539524b3e6a0a5401d1611` (5 commits ahead).
- `play.xenovoya.com` previously pointed to `hexploration-spa.pages.dev`.
- `xenovoya.com` and `www.xenovoya.com` previously pointed to `xenovoya-site.pages.dev`.
- The EU Coolify application inventory initially contained the return service and analytics monitor, but no player or marketing application.
- The prior live marketing origin was missing the complete security-header contract.

## Sequenced implementation checklist

### P0 - Release truth and safety

- [x] Create verified Coolify applications for the player and marketing repositories.
- [x] Configure build-time release identity, production environment, health checks, domains, and automatic deployment from `main`.
- [x] Deploy reviewed commits, cut DNS from legacy Pages targets to Coolify, and verify rollback readiness.
- [x] Require exact player and marketing SHAs in the post-deploy live gate.
- [x] Apply the complete marketing security-header contract.
- [x] Remove blockchain, wallet, chain, transaction, and Sepolia language from every reachable player-facing surface.

### P1 - First expedition and responsive command flow

- [x] Keep the 3D board and primary route action within one desktop viewport.
- [x] Remove the empty desktop column created when the control rail is taller than the board.
- [x] Add a sticky mobile command deck that keeps select, forecast, and commit adjacent to the world.
- [ ] Collapse secondary mobile information behind progressive disclosure.
- [ ] Raise player-facing body and decision copy to a practical readable size; reserve tiny mono type for telemetry only.
- [ ] Add an arrival sequence with ship, beacon, crew entrance, camera settle, and first-route handoff.
- [ ] Make route pressure, supplies, return distance, and discovery likelihood visible on the selected world tile.

### P1 - Game feel, content, and joy

- [x] Add all four character identities to solo crew composition with distinct abilities and reactions.
- [x] Expand bespoke landmark encounters beyond the current two and attach visible board consequences.
- [ ] Add expedition variants that change pressure, objectives, route value, and recovery opportunities.
- [ ] Add premium relic reveal staging, inspection, collection memory, and character response.
- [ ] Add escalating weather, lighting, audio, and camera response as pressure rises.
- [ ] Make emergency extraction create a memorable cost and persistent expedition scar.
- [x] Reduce repeated landmark stamping and improve the opening terrain silhouette mix.
- [x] Generate and integrate the missing encounter artwork needed by these states.

### P1 - Marketing and entry

- [x] Keep the homepage compact: promise, current gameplay proof, three-act loop, world hook, play CTA.
- [x] Make Play Solo the dominant action and preserve intent across the cross-domain handoff.
- [ ] Replace static-only proof with a reduced-motion-safe gameplay sequence.
- [x] Unify the marketing proof image and material language with the playable world.
- [x] Prevent lazy homepage imagery from producing blank capture states.

### P2 - Performance, continuity, and production evidence

- [ ] Load the opening terrain ring first and defer remote encounters, bosses, and collection art until intent.
- [ ] Verify save, resume, offline, refresh, tab restoration, and unresolved-action recovery against production.
- [ ] Deploy the matching return-service migration and API contract before enabling dependent continuity features.
- [ ] Capture production frame, transfer, restoration, and GPU-memory evidence on representative mobile hardware when available.
- [ ] Refresh report cards so runtime approval and release claims match the latest manifests and deployed SHAs.

## Visual acceptance checklist

- [x] The board is the largest visual mass during play.
- [x] The first meaningful choice is visible without page scrolling on desktop and mobile.
- [x] Crew silhouettes remain distinct at the opening camera.
- [ ] Arrival, discovery, danger, relic, return, and extraction have visibly different compositions.
- [x] Secondary explanation never displaces the current decision.
- [x] Marketing and play feel like two surfaces of one world.
- [ ] Screens remain useful with reduced motion, failed remote data, and no prior local state.

## Verification contract

- Focused unit and interaction tests for every changed system.
- Player production build and marketing static export.
- Deterministic desktop and mobile captures for entry, opening, selected route, encounter, relic, danger, extraction, and recovery.
- Accessibility, keyboard, reduced-motion, forced-colors, overflow, target-size, and cross-browser checks.
- Clean-checkout release candidate audit.
- Coolify deployment health followed by exact-SHA live verification for both domains.

## Implemented in this pass

- Rebuilt the solo command rail around one obvious next decision and a sticky mobile commit control.
- Kept the 3D board and decision deck in one desktop viewport with an independently scrollable secondary rail.
- Expanded solo play from 2 to 10 authored landmark encounters and from 2 to 4 distinct crew abilities.
- Added all four crew members to the live board and opened their formation so silhouettes remain legible.
- Reduced repeated environment cutouts from every revealed tile to a curated density cap.
- Repositioned and enlarged the landing skiff so it reads as part of the arrival tableau.
- Generated four new 1536x1024 GPT Image 2 decision scenes through Azure, reviewed them individually, optimized runtime WebP derivatives, and connected them to gameplay.
- Shortened the marketing homepage, removed the redundant mechanic sandbox and exposition section, made Play Solo the dominant cross-domain action, refreshed the live-gameplay proof, and eagerly loaded the three-act images.
- Updated public marketing language and structured data to describe the current solo experience instead of promising public multiplayer behavior.
- Added hardened production web-server configuration for the player SPA, including history fallback, immutable asset caching, release health, CSP, HSTS, permissions, referrer, and framing policies.
- Migrated `xenovoya.com`, `www.xenovoya.com`, and `play.xenovoya.com` from Cloudflare Pages to healthy Coolify applications on Hetzner.
- Detached the obsolete Pages custom-domain bindings, retained the Pages projects as rollback artifacts, and enabled Git-backed deployment through the configured GitHub App.

## Production release evidence

- Marketing: `046f62146e10efe1b638fb2d29866c5e6ccaa300` at `https://xenovoya.com/release.json`.
- Player: `dece1fe9d49965773fffd0f6dc2cea764c23abb2` at `https://play.xenovoya.com/release.json`.
- Coolify reports both applications `running:healthy`.
- `/`, `/guest`, and both release manifests return HTTP 200 through Cloudflare with CSP and anti-framing headers.

## Visual review result

Desktop and 390px mobile captures now show the board first, the route decision immediately after it, all route costs in-place, and no blank lazy-loaded cards. The opening composition is substantially clearer. Remaining art-direction work is deliberately tracked above: bespoke arrival cinematics, full state-specific camera/audio staging, expedition variants, and relic inspection remain open rather than being marked complete without evidence.
