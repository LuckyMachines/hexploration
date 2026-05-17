# Growth Loop

The growth loop is:

`open public scenario -> finish seeded run -> share result -> replay moment -> try or create another scenario`

The north-star metric is shared completed runs per week. Supporting signals are run starts, completions, replay opens, share summary generation, challenge attempts, creator previews, and feedback.

## Public Routes

- `/play`: starts a seeded public run.
- `/play?scenario=escape-pressure-4p&seed=weekly-escape-001`: opens a specific scenario and seed.
- `/challenge`: opens the current weekly challenge and local leaderboard.
- `/scenarios`: shows playable public scenarios.
- `/replay/<run-id>`: replays a serialized run.
- `/progress`: shows public scenario progress from local growth and tuning evidence.
- `/devlog`: shows readable design diary entries.
- `/create-scenario`: creates a local scenario preview and play link.

## Commands

```sh
npm run growth:report
npm run growth:capture -- --scenario=escape-pressure-4p --seed=featured-ready-escape
npm run growth:report -- --markdown
npm run growth:test
npm run growth:capture:test
```

The report reads generated tuning artifacts when present and can also analyze an explicit analytics file:

```sh
npm run growth:report -- --events=reports/growth/events.json --markdown
npm run growth:report -- --events=reports/growth/local-events.json --markdown
```

## Release Checklist

1. Run the flagship scenario or challenge.
2. Generate or refresh Player Feeling Black Box evidence.
3. Confirm `/play` completes a run.
4. Confirm result share text and replay link render.
5. Confirm `/challenge`, `/scenarios`, `/progress`, `/devlog`, and `/create-scenario` render.
6. Capture the local public event stream with `npm run growth:capture -- --scenario=escape-pressure-4p --seed=featured-ready-escape`.
7. Run `npm run growth:report -- --events=reports/growth/local-events.json`.
8. Run unit and browser smoke tests.

## Privacy

The local growth loop records only anonymous product events in browser local storage. It does not log wallet addresses, email addresses, or personal data.
