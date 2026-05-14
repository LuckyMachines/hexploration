export default function TurnReadinessStrip({
  players = [],
  readinessByPlayerID = {},
  currentPlayerIndex = -1,
  turnState,
}) {
  const submittedCount = players.filter((player, index) => {
    const pid = player.playerID !== undefined ? Number(player.playerID) : index + 1;
    return readinessByPlayerID[String(pid)] ?? Boolean(player.action && player.action !== 'Idle');
  }).length;

  return (
    <div className="rounded border border-exp-border bg-exp-panel/75 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]" data-testid="turn-readiness-strip">
      <div className="grid gap-2 lg:grid-cols-[auto_1fr_auto] lg:items-center">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-exp-text-dim">
            Crew readiness
          </p>
          <p className="mt-1 font-mono text-xs text-compass-bright">
            {submittedCount}/{players.length || 0} locked
          </p>
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-1 sm:grid-cols-4">
        {players.map((player, index) => {
          const pid = player.playerID !== undefined ? Number(player.playerID) : index + 1;
          const submitted = readinessByPlayerID[String(pid)] ?? Boolean(player.action && player.action !== 'Idle');
          const isCurrent = index === currentPlayerIndex;
          return (
            <span
              key={`${pid}-${index}`}
              className={`relative overflow-hidden rounded border px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] ${
                submitted
                  ? 'border-oxide-green/35 bg-oxide-green/10 text-oxide-green'
                  : isCurrent
                    ? 'border-compass/45 bg-compass/10 text-compass-bright'
                    : 'border-exp-border bg-exp-dark/35 text-exp-text-dim'
              }`}
            >
              <span className={`mr-1 inline-block h-2 w-2 rounded-full ${submitted ? 'bg-oxide-green' : isCurrent ? 'bg-compass' : 'bg-exp-border'}`} />
              P{pid} {submitted ? 'ready' : isCurrent ? 'you' : 'open'}
            </span>
          );
        })}
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-blueprint lg:text-right">
          {turnState?.phaseLabel || 'Unknown'}
        </span>
      </div>
    </div>
  );
}
