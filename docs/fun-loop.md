# Fun Loop

The fun loop is:

`preview risk -> commit action -> board reacts -> consequence lands -> character responds -> new tempting choice`

Every public run should create at least one moment worth retelling. The Fun Report checks that with quality gates instead of treating completion alone as success.

## Fun Quality Gates

- first alive turn is turn 1 or 2
- at least one payoff moment
- at least one pressure spike
- at least one recovery or comeback possibility
- longest flat streak is no more than one turn
- a share-worthy moment exists

## Public Features

- action previews for move, dig, rest, help, flee, and inspect
- character barks
- board reaction animations
- artifact personalities
- player roles
- event cards
- comeback valves
- dramatic flee outcomes
- run titles
- badges
- personal bests
- richer replay narration
- Fun Report blocks on play, challenge, replay, and progress routes

## Commands

```sh
npm run fun:report
npm run fun:report -- --markdown
npm run fun:test
```

Generated reports are written under ignored folders:

- `reports/fun/latest-report.json`
- `app/public/fun/latest-report.json`
