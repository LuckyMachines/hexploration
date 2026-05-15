# Scenario Lab Notebook

Scenario Lab Notebook turns simulator evidence into a design journal. It writes one readable entry per scenario cycle: what changed, what the evidence says, what we currently believe, which assumptions remain unproven, and what command should run next.

## Commands

Build or refresh an entry for a scenario:

```sh
npm run lab:entry -- --id=escape-pressure-4p
```

Preview an entry without writing files:

```sh
npm run lab:entry -- --id=escape-pressure-4p --no-write --markdown
```

Record a human decision:

```sh
npm run lab:decision -- --id=solo-artifact-hunt --decision=playtest --why="Artifact payoff is readable enough for a live playtest."
```

Build the daily project brief:

```sh
npm run lab:daily
```

Read the latest scenario entry:

```sh
npm run lab:latest -- --id=escape-pressure-4p --markdown
```

Check notebook health:

```sh
npm run lab:doctor -- --markdown
```

## What It Reads

- Scenario definitions from `simulator.scenarios.json`
- Playable Design Memory evidence from simulator, Oracle, Setup Forge, Autopilot, and auto-tune reports
- Scenario Time Machine trend reports
- Prior notebook entries and decisions

## What It Writes

- `reports/simulator/lab-notebook/<scenario-id>/latest-entry.json`
- `reports/simulator/lab-notebook/<scenario-id>/latest-entry.md`
- `reports/simulator/lab-notebook/<scenario-id>/entries.json`
- `reports/simulator/lab-notebook/<scenario-id>/decisions.json`
- `reports/simulator/lab-notebook/index.json`
- `reports/simulator/lab-notebook/daily/latest-brief.json`
- public UI copies under `app/public/simulator/lab-notebook/`

The `/simulator` workbench reads the public copies and shows the latest notebook entry for the current scenario.

## Scenario Self-Driving Tutor

The tutor reads Lab Notebook beliefs and unresolved assumptions, then turns them into ordered gameplay lessons:

```sh
npm run tutor:scenario -- --id=escape-pressure-4p
npm run tutor:next -- --markdown
```

Use the tutor after a notebook entry when you want the next command chain and measurable success criteria.

## Readiness Labels

- `ready`: enough history, strong health, passing evidence, and no severe blockers.
- `ready-with-caveats`: likely playable, but some assumptions or medium confidence remain.
- `needs-engine-evidence`: simulator or Oracle evidence is missing.
- `blocked-by-setup`: setup fidelity or setup fields make conclusions unreliable.
- `regressed`: the latest evidence moved backward.
- `insufficient-history`: the scenario has too little timeline evidence.
