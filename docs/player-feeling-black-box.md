# Player Feeling Black Box

Player Feeling Black Box turns exact-engine simulator reports into a turn-by-turn felt experience timeline. It asks what each input probably felt like: alive, tense, confusing, flat, hopeful, payoff, panic, recovery, dead-end, friction, surprise, or setup-doubt.

The core design premise is that touching controls should make the controlled character and board state feel alive. Not touching controls is also a state: waiting, idling, being blocked, or having no useful input should be measured too.

## Commands

Analyze the latest simulator report:

```sh
npm run feel:latest
```

Analyze one scenario report:

```sh
npm run feel:scenario -- --id=escape-pressure-4p
```

Analyze an explicit file without writing:

```sh
npm run feel:latest -- --file=reports/simulator/scenarios/escape-pressure-4p/latest-report.json --no-write --markdown
```

Build the project index:

```sh
npm run feel:index
```

Check report health:

```sh
npm run feel:doctor -- --markdown
```

## Outputs

- `reports/simulator/feeling-black-box/latest-report.json`
- `reports/simulator/feeling-black-box/latest-report.md`
- `reports/simulator/feeling-black-box/index.json`
- `reports/simulator/feeling-black-box/<scenario-id>/latest-report.json`
- public UI copies under `app/public/simulator/feeling-black-box/`

The `/simulator` workbench reads the public copies and shows the Player Feeling Black Box panel for the current scenario.

## What It Measures

- first alive turn
- first flat turn
- best moment
- worst moment
- most confusing moment
- strongest agency moment
- strongest friction moment
- recovery moment
- payoff moment
- arc shape
- arc score
- recommended improvement

Use this after a simulator or scenario run when you want to know where the game felt alive and where input stopped producing satisfying feedback.

## Integrations

- Playable Design Memory indexes feeling reports as cited evidence.
- Scenario Time Machine blends feeling arc score into scenario health and can recommend a feeling pass.
- Scenario Lab Notebook records arc score, arc shape, first alive turn, first flat turn, and strongest friction in the latest learning.
- Scenario Self-Driving Tutor can create lessons for flat arcs, late alive moments, panic loops, and input friction spikes.
