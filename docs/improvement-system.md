# Xenovoya Improvement System

The improvement control plane gives the game one quality language without replacing its specialist tools. The simulator remains authoritative for gameplay, board tests for interface behavior, the art manifests for asset provenance, and the hard verifier for release evidence. This layer connects them into one portfolio.

## The loop

Every meaningful change follows the same contract:

1. State an objective and falsifiable hypothesis.
2. Preserve the baseline and name the metric and target.
3. Let changed files identify the affected quality surfaces.
4. Run the smallest useful verification set, then the full set before promotion.
5. Capture evidence with an owner, grade, and confidence.
6. Record the decision and next experiment.
7. Move through promotion states instead of declaring work finished by intuition.

The stricter A bar is: every meaningful change begins with a falsifiable hypothesis and ends with automatically captured before/after evidence, an explicit decision, a legal promotion state, and one ranked next action.

## Daily commands

From the repository root in Git Bash or PowerShell:

```text
npm run improve:plan
npm run improve
npm run improve:latest -- --markdown
npm run improve:doctor
```

`npm run improve` is the bounded apply loop. It diagnoses the current scope, executes every eligible low-risk repair recipe, verifies each repair, re-grades, and repeats up to three times. `npm run improve:check` performs verification and reporting without entering the repair loop. Preview automatic work without running checks or repairs with:

```text
npm run improve:apply:dry
```

Before selecting or shipping a candidate:

```text
npm run improve:hard
npm run improve:baseline
```

Generated internal evidence lives in `reports/improvement/`. A privacy-safe compact snapshot is copied to `app/public/improvement/latest-portfolio.json` for an eventual internal design-system view.

## Scoped verification

Changed-file detection is the default. A specific review can be requested with:

```text
npm run improve -- --scope=visual-art,ux-onboarding
npm run improve:all
npm run improve:hard -- --scope=technical-reliability,ops-release
```

Available surfaces are `gameplay`, `ux-onboarding`, `visual-art`, `marketing-discovery`, `technical-reliability`, `ops-release`, `player-validation`, and `improvement-system`.

## Automatic repair contract

Automatic repairs are declared in `improvement/improvement-system.json`; the runner never invents a shell command. Every recipe names:

- the surfaces, action types, and exact evidence paths it may address;
- one registered repair command and one or more verification commands;
- its risk level;
- every path it is expected to write.

The apply loop fingerprints Git-visible dirty files before and after a repair. An undeclared write stops the loop as a policy violation. A lock prevents concurrent apply runs, an attempted action is never repeated in the same run, and `--max-repairs` bounds the loop. Only low-risk recipes run by default; a higher ceiling must be explicit.

```text
npm run improve -- --max-repairs=5
npm run improve -- --scope=marketing-discovery --allow-risk=medium
```

Current automatic recipes refresh generated simulation, UI-density, marketing, SEO, and verification evidence. New deterministic codemods can be registered through the same command-and-write-path contract.

The runner will not fabricate a playtest, silently choose a creative direction, make an unsupported marketing claim, delete reports, commit changes, or invoke an unbounded coding agent. Those actions become an assisted or human-required repair packet at `reports/improvement/latest-apply.md`.

## Evidence records

Plan an experiment:

```text
npm run improve:experiment -- --id=board-hover-001 --surface=ux-onboarding --hypothesis="Removing tile lift reduces disorientation" --metric="misclick rate" --target="below 3 percent" --owner=product-design
```

Record an evidence-backed decision:

```text
npm run improve:decision -- --id=board-hover-001-decision --surface=ux-onboarding --decision="Keep stationary hover treatment" --evidence=reports/verification/latest-hard.json --owner=product-design --next-experiment="Test focus and selected states"
```

Record a consent-safe playtest without names, email addresses, wallet addresses, or other personal data:

```text
npm run improve:playtest -- --id=session-001 --scenario=first-expedition --cohort=first-time-player --observations="Player found the first valid move without help" --severity=low --decision="Retain prompt hierarchy" --owner=product-research
```

## Promotion discipline

The state machine is intentionally sequential:

```text
idea -> baseline -> candidate -> verified -> selected -> shipped -> validated
```

Any active state can route through `rework-required` where configured, and obsolete work can become `retired`. The CLI rejects skipped gates.

```text
npm run improve:promote -- --surface=improvement-system --to=verified --evidence=reports/improvement/latest-portfolio.json --decision="Control-plane tests and scoped verification pass"
```

## Reading the portfolio

The portfolio separates grade from confidence. A polished B with stale evidence is not presented as a trustworthy B. Missing required evidence caps a surface at C, stale required evidence caps it at B, and failing verification also caps it at C. These are diagnostic caps, not punishment.

Ranked actions use this order: failing checks, missing required evidence, missing human observations, stale evidence, then the remaining gap to the stricter A bar.

## Report retirement

Specialist reports are registered in `improvement/report-registry.json`. Review overlap and superseded artifacts with:

```text
npm run improve:retire
```

The command never deletes files. A human confirms retirement and updates the registry, preserving historical decisions while avoiding competing sources of truth.
