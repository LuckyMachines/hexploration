export default function TurnReadinessStrip({
  players = [],
  readinessByPlayerID = {},
  currentPlayerIndex = -1,
  turnState,
}) {
  return (
    <div className="rounded border border-exp-border bg-exp-panel/75 px-3 py-2" data-testid="turn-readiness-strip">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-exp-text-dim">
          Crew readiness
        </span>
        {players.map((player, index) => {
          const pid = player.playerID !== undefined ? Number(player.playerID) : index + 1;
          const submitted = readinessByPlayerID[String(pid)] ?? Boolean(player.action && player.action !== 'Idle');
          const isCurrent = index === currentPlayerIndex;
          return (
            <span
              key={`${pid}-${index}`}
              className={`rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] ${
                submitted
                  ? 'border-oxide-green/35 bg-oxide-green/10 text-oxide-green'
                  : isCurrent
                    ? 'border-compass/45 bg-compass/10 text-compass-bright'
                    : 'border-exp-border bg-exp-dark/35 text-exp-text-dim'
              }`}
            >
              P{pid} {submitted ? 'ready' : isCurrent ? 'you' : 'open'}
            </span>
          );
        })}
        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.22em] text-blueprint">
          {turnState?.phaseLabel || 'Unknown'}
        </span>
      </div>
    </div>
  );
}

