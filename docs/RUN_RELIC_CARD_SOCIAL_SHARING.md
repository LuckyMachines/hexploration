# Run Relic Card Social Sharing

## Product Question

Now that replay motivation exists, what part of Xenovoya still feels least socially contagious, and what would make a completed expedition something players actively want to show other people?

## Answer

The weakest surface is the completed expedition artifact. Memory and replay give the player a reason to continue, but a finished expedition still needs an instantly legible trophy: a visual card that makes the run look like a dangerous little legend before anyone clicks the replay.

## Sequential Implementation Checklist

1. Define the target artifact as a Run Relic Card: a collectible visual summary of one completed expedition.
2. Keep the card data derived from Expedition Memory so public runs and live Game Over share the same social format.
3. Include title, scenario, outcome, score, arc chapter, pressure, escape cost, recovered value, crew result, best quote, badges, and Beat This challenge.
4. Add a pure relic-card helper that converts a memory plus challenge into a normalized card object.
5. Add a pure SVG renderer so the card can be downloaded or copied without adding a rendering dependency.
6. Escape all text injected into SVG output.
7. Pick a restrained multi-color palette that separates clean escape, warning, redline, value, and proof.
8. Add deterministic accent data from memory id so cards from different runs do not all look identical.
9. Add a share-text helper that pairs the image with the replay/report link and benchmark challenge.
10. Add unit tests for card normalization, SVG output, escaping, challenge inclusion, and share text.
11. Add a RunRelicCard component that renders the card visually in the app.
12. Add a RunRelicSharePanel component with Copy Share Text, Copy Image, Download Relic SVG, and Open Record actions.
13. Implement image-copy support through a generated PNG canvas when the browser supports ClipboardItem.
14. Keep a graceful fallback when image clipboard is not supported.
15. Add the Run Relic Share Panel to public run completion directly under the memory/challenge result.
16. Add the Run Relic Share Panel to live Game Over directly after Memory Created.
17. Add the Run Relic preview to public replay pages so a replay link has an immediate social artifact.
18. Replace the older plain share-card completion reveal with the richer relic card where appropriate.
19. Keep the older text metrics available if useful, but make the visual relic the share hero.
20. Update public-play e2e checks to verify Run Relic, Copy Share Text, Download Relic SVG, and Beat This Challenge are visible.
21. Update replay-route e2e checks to verify the relic card appears on replay landing.
22. Update Field Manual Overview with Run Relic Cards as the social artifact.
23. Update Field Manual How To with the post-run sharing step.
24. Update SEO artifacts because public copy and replay surface language changed.
25. Run focused helper tests.
26. Run growth and memory helper tests together.
27. Run the app test suite.
28. Run the production build.
29. Run SEO verification and regeneration.
30. Run home and growth Playwright specs.
31. Run a forbidden-marker scan over changed files.
32. Run whitespace validation.
33. Update this document with the completed snapshot and final grade.

## Acceptance Criteria

- Every completed public run can display a Run Relic Card.
- Every completed live Game Over can display a Run Relic Card.
- Replay pages show the relic immediately, before the turn log.
- The relic has enough information to understand why the run mattered without reading the whole report.
- Players can copy share text, copy an image when the browser allows it, download the SVG, and open the replay/report.
- The exported SVG is self-contained and does not depend on external assets.
- Unit and e2e coverage protects the card model and main sharing surfaces.

## Completion Snapshot

Status: Complete.

Implemented:

- Run Relic Card data model derived from Expedition Memory and Beat This Challenge data.
- Self-contained SVG renderer for downloadable share artifacts.
- Safe text escaping for SVG output.
- Deterministic route glyphs and palette selection based on outcome, pressure, value, and escape cost.
- Run Relic Card visual component for in-app display.
- Run Relic Share Panel with Copy Share Text, Copy Image, Download Relic SVG, and Open Record actions.
- Public run completion relic panel.
- Live Game Over relic panel.
- Replay-page relic panel before the turn log.
- Field Manual Overview and How To guidance for Run Relic Cards.
- Unit and browser coverage for relic model, completion sharing, replay landing, and manual copy.

Verification:

- `npm test -- --run src/lib/expeditionRelicCard.test.js src/lib/expeditionMemory.test.js src/lib/expeditionChallenges.test.js`
- `npm test -- --run src/lib/expeditionRelicCard.test.js src/lib/expeditionMemory.test.js src/lib/expeditionChallenges.test.js src/lib/growthLoop.test.js`
- `npm run build` from `app`
- `npm test -- --run` from `app`
- `npm run seo:test`
- `npm run seo:generate`
- `npx playwright test e2e/home.spec.js` with `E2E_APP_PORT=43147`
- `npx playwright test e2e/growth.spec.js` with `E2E_APP_PORT=43149`

Final grade under the stricter social-contagion bar: A-. Completed expeditions now produce a visual trophy, benchmark caption, image export path, replay link, and public replay preview. The remaining step toward a full A is server-side hosted image generation for rich link previews on external social platforms, which requires deployment-side infrastructure beyond this local-client pass.
