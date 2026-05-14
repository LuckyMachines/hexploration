# Gameplay Simulator

The simulator is a local tuning harness that uses the same Solidity engine as the playable app. It does not clone the rules in JavaScript.

## Run

Start a local chain and app:

```bash
npm run local:solo
```

In another terminal, run a simulation:

```bash
npm run sim:balanced
```

Open:

```text
http://localhost:5502/simulator
```

The simulator writes:

- `reports/simulator/latest-report.json`
- `app/public/simulator/latest-report.json`

## Strategies

```bash
npm run sim -- --turns=12 --players=1 --strategy=balanced
npm run sim -- --turns=12 --players=1 --strategy=risky
npm run sim -- --turns=12 --players=1 --strategy=dig
npm run sim -- --turns=12 --players=1 --strategy=move
npm run sim -- --turns=12 --players=1 --strategy=rest
npm run sim -- --turns=12 --players=1 --strategy=idle
```

## Engine Path

Each run:

1. Creates or selects a local game.
2. Registers Anvil dev accounts as players.
3. Reads state from `GameSummary` and `PlayerSummary`.
4. Uses `XenovoyaController.actionIsValid` to pick a valid action.
5. Submits through `XenovoyaController.submitAction`.
6. Fulfills mock VRF on `GameSetup` and `XenovoyaQueue`.
7. Progresses `GameSetup`, `XenovoyaController`, and `XenovoyaGameplay` loops.
8. Captures before/after snapshots and aggregate outcomes.

That means tuning reports reflect the real deployed local contracts, contract validation, queue phases, randomness path, and turn processing.
