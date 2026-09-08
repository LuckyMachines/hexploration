# Xenovoya Design System Governance

The internal `/design-system` route is the review surface for the player experience. It is not shipped in the production player bundle.

## Sources of truth

- Runtime values live in `src/index.css` as `--color-*`, `--font-*`, and `--ds-*` variables.
- `tokens.js` names those variables and supplies documentation metadata without copying their resolved values.
- `catalog.js` contains deterministic showcase fixtures and the component coverage registry.
- `uiQualityMatrix.js` defines the canonical rendered scenes, viewports, source inputs, and measurable budgets.
- Production components remain in `src/components`; examples should import them rather than make visual substitutes.

## Executable visual review

- `npm run ui:quality` captures every canonical scene, rejects pixel regressions, checks target size, overflow, layout shift, DOM size, frame pacing, and serious or critical axe findings, then builds a reference-left/current-right contact sheet.
- `npm run ui:quality:cross-browser` checks the public promise and 3D board contract in Chromium, Firefox, WebKit, Pixel 7, and iPhone 13 projects.
- `npm run ui:quality:doctor` fails when a baseline, rendered metric, approval, or declared source hash is missing or stale.
- `npm run ui:quality:approve -- --owner="name" --reason="why"` is the only command allowed to change visual approvals. Approval is an explicit product decision, not an automatic repair.

The ledger at `ui-quality/visual-approvals.json` binds each approved pixel hash to the hashes of its declared source files. A changed source invalidates the approval even when a developer forgets to recapture screenshots.

## Maturity levels

- `Proven`: the implementation source exists and both component-level and browser-level evidence exist.
- `Verified`: the implementation source exists and at least one automated proof exists.
- `Audit`: the implementation exists but needs automated evidence or a current visual review.
- `Prototype`: the pattern is intentionally exploratory and must not be presented as production-ready.

Maturity is derived by `catalog.js`; do not hand-promote a row. `catalog.test.js` verifies source and evidence paths.

## Contribution checklist

1. Reuse semantic tokens and real product components.
2. Include ready, waiting, resolving, failure, and completion states when relevant.
3. Keep all primary controls at least `--ds-target-min` high.
4. Provide a reduced-motion equivalent and do not encode meaning with color alone.
5. Add a component or browser test and attach it to the registry entry.
6. Run `npm run ui:quality`; inspect the generated contact sheet at `artifacts/ui-quality/contact-sheets/latest.png`.
7. If the intentional result is better, approve it with an owner and reason; never update snapshots as an incidental test fix.
8. Run the cross-browser contract and update the design-system report card.

## Review cadence

- Review changed patterns in the pull request that changes them.
- Run the full design-system audit before a player release candidate.
- Revisit `Audit` and `Prototype` rows monthly while active development continues.
- Treat stale evidence older than the latest material component change as invalid.

## Versioning and deprecation

- Patch: copy, token, or state treatment changes that preserve component behavior.
- Minor: a new component family, state contract, or responsive composition.
- Major: a breaking token rename, interaction model change, or removed public component contract.
- Mark deprecated patterns in the registry for one minor version, name the replacement, and provide a migration note before removal.

## Acceptance gates

A pattern cannot be `Proven` unless its source and evidence files exist, it has browser and component proof, serious/critical accessibility findings are zero, and its required responsive states have been inspected. The automated grade cannot substitute for live-production telemetry or observed-player comprehension and delight.
