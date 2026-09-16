# Character and Boss Art Expansion

Date: 2026-09-15

## Outcome

This pass turns character activity, the landing site, and apex encounters into production systems instead of isolated images.

- The four canonical explorers now have complete 13-state libraries: neutral, selected, moving, digging, helping, recovering, strained, downed, carrying, escaping, triumph, aftermath, and idle-alert. The contracted library contains 52 of 52 required character standees with no runtime fallbacks.
- The landing site has a dedicated transparent expedition skiff and authored landing-pad tile, both integrated into the Three.js board.
- Emberglass Razorback, Stormneedle Strider, and Violet Reliquary Warden each have a reveal scene, arena tile, creature mapping, encounter label, light color, and live Board Lab fixture.
- The complete art manifest now contains 161 assets: 152 approved and 9 reference. The game art library grades A at 100/100.
- Runtime delivery contains 89 lossless derivatives, reducing 41.84 MiB of masters to 25.73 MiB, a 38.5 percent saving.

## Character state contract

Each explorer resolves the following gameplay meanings without generic fallback:

1. Neutral and idle-alert
2. Selected and moving
3. Digging and helping
4. Recovering and strained
5. Downed and carrying
6. Escaping and triumph
7. Aftermath

The generation script creates identity-locked 2x2 action sheets from canonical character references. The processing script crops, keys, validates, hashes, registers, reviews, and publishes each state as a transparent 1024px board cutout. Character Doctor now fails if any required state lacks an exact path or asset ID.

## Special encounter mapping

- Emberglass Awakening -> Emberglass Razorback -> desert arena -> warm ember light
- Wind Vault / Stormneedle Shelter -> Stormneedle Strider -> mountain arena -> cyan storm light
- Reliquary Bargain -> Violet Reliquary Warden -> relic arena -> violet archive light

Boss presentation is data-driven in `app/src/components/board/bossPresentation.js`. The board uses this map to select the reveal backplate, creature cutout, arena tile, scale, lighting, and player-facing label. Ordinary tile landmarks hide on the active boss tile so the apex silhouette remains readable.

## Reproducible workflow

The prompts and asset definitions are source controlled in the generation scripts. Azure GPT Image 2 is invoked through `C:\Users\James Pollack\.codex\azure-image-edit.sh`.

```text
npm run character:generate-actions
npm run character:process-actions
npm run art:generate-special-encounters
npm run art:process-special-encounters
npm run art:runtime:generate
npm run character:doctor
npm run art:doctor
npm run art:library:doctor
```

## Visual QA

The first live board pass exposed three context problems that isolated source review could not: boss creatures were underscaled, normal landmarks competed with boss silhouettes, and the landing ship was hidden by the crew. The implementation now uses boss-specific scales, larger arena sprites, hides competing landmarks on the encounter tile, and includes a crew-free landing showcase fixture. All four final views were recaptured in the real camera.

Evidence directories:

- `C:\Users\James Pollack\Desktop\REBOOT LUCKYSTUFF\prominent_racerverse\HEXPLORATION_REPOS\hexploration\artifacts\art\characters\reviews`
- `C:\Users\James Pollack\Desktop\REBOOT LUCKYSTUFF\prominent_racerverse\HEXPLORATION_REPOS\hexploration\artifacts\art\contact-sheets\game-library-latest`
- `C:\Users\James Pollack\Desktop\REBOOT LUCKYSTUFF\prominent_racerverse\HEXPLORATION_REPOS\hexploration\artifacts\art\runtime-review-2026-09-15`

## Review conclusion

The new action set preserves each explorer's silhouette, equipment language, and role while making state changes readable at board scale. The three boss packages are clearly distinct in silhouette, palette, arena surface, atmosphere, and threat posture. The landing site now works as a recognizable origin and return landmark. The most valuable next art expansion is animation interpolation and enemy damage states, not more unstructured one-off images.
