# Character System Implementation Checklist

## 1. Canonical identity and role model

- [x] Add a versioned character catalog and schema.
- [x] Separate stable character identity from gameplay role while declaring the default pairing.
- [x] Unify return-loop, fun-model, board, dossier, and analytics vocabulary.
- [x] Migrate legacy `warden` and `salvager` role values without losing saved progress.
- [x] Add a fourth distinct crew identity for four-player games.

## 2. Runtime presentation

- [x] Assign unique characters deterministically and honor the current player's selected role.
- [x] Replace board index/modulo texture selection with a data-driven state resolver.
- [x] Add character identity, portrait, role, contribution, and current posture to the player dossier.
- [x] Add portraits, fantasy, verbs, and abilities to role selection and return-loop summaries.
- [x] Define a 2.5D standee contract for scale, pivot, shadow, selection, and camera behavior.

## 3. Character art production

- [x] Add identity blocks, immutable details, signature equipment, and avoid lists for every character.
- [x] Add a prioritized gameplay-state matrix with deterministic neutral fallbacks.
- [x] Generate the fourth neutral character and identity-preserving condition variants.
- [x] Replace the three identity-drifting shipped condition images.
- [x] Produce per-character, crew-lineup, silhouette, and context review sheets.

## 4. Quality gates and automation

- [x] Add relational character-review fields for identity, face, proportions, costume, and equipment.
- [x] Make approved condition art fail validation when its base identity fingerprint is stale.
- [x] Add `character:doctor`, `character:plan`, `character:brief`, `character:review`, `character:contact-sheet`, and `character:report` commands.
- [x] Add tests for catalog integrity, unique four-player assignment, legacy migration, state resolution, and relational reviews.
- [x] Expose roster coverage and quality contracts in the Art Lab.

## 5. Verification and learning

- [x] Run character, art-pipeline, application, and build verification.
- [x] Capture the character system in board and UI contexts.
- [x] Publish an automated-only character report without implying human attachment evidence.
- [x] Re-grade the system under the stricter A bar.
