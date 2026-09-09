# UX Improvement System

Review date: 2026-09-08

## What It Does

The UX system turns a product question into eight separate forms of evidence instead of treating screenshots or analytics as proof of the whole experience:

1. Journey budgets prove that critical paths are reachable within explicit action, time, backtrack, error, and recovery limits.
2. Input audits exercise keyboard navigation, focus, 200% text reflow, Windows forced colors, and reduced motion.
3. Assistive browser audits verify landmarks, heading order, accessible names, live announcements, modal focus entry, and focus restoration in Chromium, Firefox, and WebKit.
4. Touch browser audits verify tap-only completion, 44 px targets, narrow reflow, modal dismissal, and deliberate destructive actions on Pixel and iPhone profiles.
5. Copy governance rejects vague player-facing failure, progress, confirmation, link, and success language.
6. Privacy-safe telemetry records allowlisted funnel, friction, recovery, performance-bucket, and experiment-exposure events.
7. A friction inbox ranks repeated behavioral problems by severity and affected journeys.
8. Observed-player research remains a hard human evidence gate. Synthetic browser sessions never count as player sessions.

The canonical contract is `ux/quality-contract.json`. Generated reports are local evidence and are excluded from production builds.

## Commands

```bash
npm run ux:test
npm run ux:journeys
npm run ux:input
npm run ux:assistive
npm run ux:touch
npm run ux:copy
npm run ux:report
npm run ux:doctor
npm run ux:refresh
npm run ux:release -- --input=path/to/production-export.json
```

`ux:doctor` fails when journey, copy, or fresh required browser evidence is missing or broken. `ux:refresh` regenerates every automated evidence source and the published report. `ux:release` additionally fails until the required recent player cohorts and a real production telemetry export are present.

## Telemetry Export Contract

Pass a JSON file with this shape to `ux:report`, `ux:friction`, or `ux:release`:

```json
{
  "schemaVersion": 1,
  "source": "production",
  "exportedAt": "2026-09-08T18:00:00.000Z",
  "events": [
    {
      "name": "meaningful_choice",
      "props": {
        "journey_id": "anonymous-journey-id",
        "journey_sequence": 3,
        "choice": "crew_role",
        "role": "scout"
      }
    }
  ]
}
```

Do not add wallet addresses, emails, free-form error messages, URLs, signatures, or transaction identifiers. Runtime analytics accepts only declared events and properties. Timing values are bucketed before transport.

## Experiment Lifecycle

Experiments live in `app/src/config/experiments.js`. A valid experiment has an objective, falsifiable hypothesis, primary metric, guardrails, owner, environment, allocation, and weighted variants. Assignments are stable on one device. Planned, paused, invalid, wrong-environment, and zero-allocation experiments always return control and do not emit exposure events.

Promotion sequence:

1. Record the hypothesis with `npm run improve:experiment`.
2. Add the runtime experiment as `planned` with 0% allocation.
3. Verify both variants through UX and UI quality checks.
4. Change status to `running` and raise allocation deliberately.
5. Import production evidence and inspect the friction inbox and guardrails.
6. Record the decision with `npm run improve:decision` before selecting, shipping, or retiring the variant.

## Friction Inbox

`npm run ux:friction -- --input=path/to/export.json` groups events by anonymous journey, evaluates ordered-event gaps, ranks findings by severity and reach, and identifies one top priority. Current rules detect starter abandonment, choices without visible consequences, unrecovered errors, repeated help, and slow first actions. Rules belong in the UX contract so product decisions and detection logic stay reviewable together.

## Evidence Boundary

The generated grade can reach A- with complete automated evidence. It reaches A only when current production telemetry and the required observed-player cohorts are present. Browser-emulated touch and semantic accessibility evidence improve confidence but do not replace physical-device or screen-reader sessions. No command invents sessions, silently treats an example file as production, or converts a synthetic browser run into human evidence.
