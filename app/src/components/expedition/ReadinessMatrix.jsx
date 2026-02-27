export default function ReadinessMatrix({
  players = [],
  readinessByPlayerID = {},
  queueActive = false,
}) {
  if (!queueActive) {
    return (
      <div className="border border-exp-border rounded bg-exp-panel p-3">
        <h3 className="font-mono text-[10px] tracking-[0.3em] text-exp-text-dim uppercase mb-2">
          Submission Readiness
        </h3>
        <p className="font-mono text-xs text-exp-text-dim italic">
          Waiting for queue creation.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-exp-border rounded bg-exp-panel p-3">
      <h3 className="font-mono text-[10px] tracking-[0.3em] text-exp-text-dim uppercase mb-2">
        Submission Readiness
      </h3>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {players.map((player, index) => {
          const pid = player.playerID !== undefined ? Number(player.playerID) : index + 1;
          const submitted = readinessByPlayerID[String(pid)] ?? false;

          return (
            <div
              key={`${pid}-${index}`}
              className="border border-exp-border/60 rounded bg-exp-dark/40 px-2 py-1.5"
            >
              <div className="font-mono text-[10px] uppercase text-exp-text-dim">P{pid}</div>
              <div className={`font-mono text-xs ${submitted ? 'text-oxide-green' : 'text-compass'}`}>
                {submitted ? 'Submitted' : 'Pending'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
