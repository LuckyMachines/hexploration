# Playable Design Memory

Playable Design Memory is the project-level evidence layer for gameplay tuning. It reads the exact-engine simulator outputs and turns them into durable memory: what scenarios exist, what the Oracle said, which setup assumptions were enforced, what Autopilot tried, what auto-tune accepted or rejected, and what should be investigated next.

It does not run a second game model. It only summarizes local reports already produced by the simulator toolchain.

## Commands

```bash
npm run memory:build
npm run memory:latest
npm run memory:latest -- --markdown
npm run memory:query -- "what do we know about escape pressure?"
npm run memory:query -- "which setup blockers matter most?"
npm run memory:doctor
npm run memory:test
```

`memory:build` writes the latest snapshot for both CLI and UI use.

## Inputs

Memory scans:

- `simulator.scenarios.json`
- `reports/simulator/latest-report.json`
- `reports/simulator/scenarios/**`
- `reports/simulator/oracle/**`
- `reports/simulator/setup-forge/**`
- `reports/simulator/autopilot/**`
- `reports/simulator/experiments/**`
- `reports/simulator/tuning-ledger.json`

Malformed JSON is skipped with a warning. Generated memory reports are written under ignored report/public folders, so implementation commits stay small.

## Outputs

- `reports/simulator/memory/latest-memory.json`
- `reports/simulator/memory/latest-memory.md`
- `reports/simulator/memory/index.json`
- `reports/simulator/memory/history.json`
- `app/public/simulator/memory/latest-memory.json`

The `/simulator` page reads the public JSON and shows the latest build time, source counts, findings, setup limits, recommendations, and query examples.

## What Memory Answers

Memory is useful for questions like:

- What do we know about escape pressure?
- What is blocking setup honesty?
- What accepted changes improved a scenario?
- Which Oracle dimensions recur as weak?
- What should we run next for a scenario?

Answers include citations back to source report paths, so every claim can be traced to simulator, Oracle, setup, Autopilot, or auto-tune evidence.

## Recommended Loop

1. Run or update scenarios with the same-engine simulator.
2. Run Oracle or Autopilot to produce scored evidence.
3. Run `npm run memory:build`.
4. Ask targeted questions with `npm run memory:query`.
5. Use `npm run memory:doctor` before making a larger balance or setup claim.
6. Inspect the Playable Design Memory panel in `/simulator`.
