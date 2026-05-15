# Scenario Self-Driving Tutor

Scenario Self-Driving Tutor turns project evidence into an ordered gameplay curriculum. It answers what to work on next, why it matters, which commands to run, and what evidence would prove that the game improved.

## Commands

Build the full project curriculum:

```sh
npm run tutor:build
```

Build one scenario lesson:

```sh
npm run tutor:scenario -- --id=escape-pressure-4p
```

Print the next highest-priority lesson:

```sh
npm run tutor:next -- --markdown
```

Record a human completion decision:

```sh
npm run tutor:complete -- --id=solo-artifact-hunt --lesson=<lesson-id> --status=passed --why="The rerun improved pacing and the notebook belief is clearer."
```

Check tutor health:

```sh
npm run tutor:doctor -- --markdown
```

## What It Reads

- Playable Design Memory
- Scenario Time Machine
- Scenario Lab Notebook
- Player Feeling Black Box
- Scenario definitions
- Existing simulator, Oracle, Setup Forge, Autopilot, and auto-tune evidence through Memory

## What It Writes

- `reports/simulator/tutor/latest-curriculum.json`
- `reports/simulator/tutor/latest-curriculum.md`
- `reports/simulator/tutor/<scenario-id>/latest-lesson.json`
- `reports/simulator/tutor/<scenario-id>/latest-lesson.md`
- `reports/simulator/tutor/<scenario-id>/lesson-history.json`
- public UI copies under `app/public/simulator/tutor/`

## Lesson Flow

Each tutor lesson contains:

- the primary weakness
- why it matters to the player experience
- ordered steps
- exact commands
- measurable success criteria
- blockers
- citations
- graduation status

When a Player Feeling Black Box report exists, lessons can target late first-alive turns, flat arcs, panic loops, and friction spikes. The verification chain includes `npm run feel:scenario` so the lesson can prove that touching controls made the board feel more alive.

The tutor never edits balance or scenario files. It recommends and records learning work; Autopilot, scenario tools, and humans still make changes intentionally.
