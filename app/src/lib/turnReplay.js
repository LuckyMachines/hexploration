export function buildTurnReplay(events = []) {
  const steps = events.map((event, index) => ({
    id: event.key || `${event.name}-${index}`,
    index,
    name: event.name,
    blockNumber: event.blockNumber,
    transactionHash: event.transactionHash,
    args: event.args || {},
    actor: event.args?.playerID !== undefined ? `P${event.args.playerID}` : 'System',
    summary: summarizeReplayEvent(event),
  }));
  const grouped = steps.reduce((acc, step) => {
    const key = step.actor || 'System';
    acc[key] ||= [];
    acc[key].push(step);
    return acc;
  }, {});

  return {
    steps,
    grouped,
    latest: steps[steps.length - 1] || null,
    proof: steps
      .filter((step) => step.transactionHash)
      .slice(-3)
      .map((step) => ({
        label: step.name,
        tx: step.transactionHash,
        blockNumber: step.blockNumber,
      })),
  };
}

export function summarizeReplayEvent(event) {
  const gameID = event.args?.gameID !== undefined ? `G${event.args.gameID}` : '';
  const queueID = event.args?.queueID !== undefined ? `Q${event.args.queueID}` : '';
  const playerID = event.args?.playerID !== undefined ? `P${event.args.playerID}` : '';
  const parts = [event.name, playerID, gameID, queueID].filter(Boolean);
  return parts.join(' ');
}
