# Scenario Setup Forge

Scenario Setup Forge turns authored scenario starting conditions into an auditable setup pass before measured simulator turns begin. It uses the same deployed local contracts as the simulator and records exactly which setup claims were applied, skipped, blocked, or only treated as metadata.

## Commands

```bash
npm run setup:validate -- --id=escape-pressure-4p
npm run setup:explain -- --id=escape-pressure-4p
npm run setup:matrix
npm run setup:doctor
npm run setup:forge -- --id=escape-pressure-4p --dry-run
npm run setup:author -- --id=escape-pressure-4p --save "two exhausted players, one artifact holder, split up, high escape pressure"
npm run setup:variant -- --id=escape-pressure-4p --kind=harder
npm run setup:backlog
```

Live application happens through the simulator:

```bash
npm run local:solo
npm run scenario:run -- --id=escape-pressure-4p --setup-mode=best-effort
npm run oracle:scenario -- --id=escape-pressure-4p
```

`scenario:run` enables Setup Forge automatically when the scenario contains a `setupForge` block. Pass `--no-setup-forge` to compare against the old metadata-only behavior.

## Setup Levels

- `exact`: all requested critical setup was applied with exact contract hooks.
- `partial`: at least one requested setup field was applied, but some requested fields are approximate, skipped, or contract-blocked.
- `metadata`: no chain state was changed; setup claims remain design context only.
- `blocked`: validation or writes failed in a way that prevents an honest scenario answer.

Scenarios can declare `requiredSetupLevel` as `metadata`, `partial`, or `exact`. The Gameplay Oracle uses that requirement in its confidence score and regression gate.

## Supported Fields

| Field | Level | Contract path |
|---|---|---|
| Player stats | Exact | `CharacterCard.setStats` |
| Inventory | Exact | `GameToken.mintTo`, then character hand setters |
| Held artifacts | Exact | `GameToken.mintTo`, then `CharacterCard.setArtifact` |
| Revealed zones | Exact | `XenovoyaBoard.enableZone` |
| Terrain | Exact | `XenovoyaBoard.enableZone` with tile enum |
| Campsites | Exact | item token mint plus `transferToZone` |
| Player locations | Partial | `XenovoyaBoard.moveThroughPath` after game start |
| Pressure | Supported | simulator strategy and balance pressure |
| Scripted prelude | Supported | setup turns run before measured turns |
| Landing zone | Contract-blocked | initial play zone is selected during setup |
| Current day | Contract-blocked | day derives from queue history |
| Queue phase | Contract-blocked | no safe public setter |
| Events | Observed only | described as evidence, not synthetically mutated |

## Reports

Setup reports are written next to simulator reports:

- `reports/simulator/setup-forge/latest-report.json`
- `reports/simulator/scenarios/<scenario-id>/latest-setup-report.json`
- `reports/simulator/scenarios/<scenario-id>/setup-history.json`
- `app/public/simulator/setup-forge/latest-report.json`

Simulator reports embed:

- `setupForge`: normalized requested setup.
- `setupApplication`: applied, skipped, failed, warnings, errors, and support evidence.
- `setupLevel`: final level used by the Oracle.
- `setupPreludeTurns`: setup-only turns excluded from measured turn metrics.

The `/simulator` workbench shows the Scenario Setup Forge panel beside the Fun Debugger and Gameplay Oracle, so setup honesty is visible when reading results.

## Authoring Pattern

Add or edit a scenario in `simulator.scenarios.json`:

```json
{
  "requiredSetupLevel": "partial",
  "setupForge": {
    "modeHint": "best-effort",
    "players": [
      {
        "playerIndex": 0,
        "stats": { "movement": 1, "agility": 1, "dexterity": 1 },
        "artifacts": ["Engraved Tablet"],
        "critical": true
      }
    ],
    "board": {
      "revealedZones": ["0,0", "1,0"],
      "terrain": { "1,0": "Jungle" },
      "landingZone": "0,0"
    },
    "scriptedPrelude": {
      "turns": 1,
      "strategies": ["rest"],
      "discardPreludeFromMetrics": true
    }
  }
}
```

Then validate it:

```bash
npm run setup:validate -- --id=your-scenario-id --mode=best-effort
npm run setup:explain -- --id=your-scenario-id --markdown
```

Use `--mode=strict` only when the scenario must not run unless all critical fields have exact support.
