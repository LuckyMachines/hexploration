import { useEffect, useRef } from 'react';
import { truncateAddress } from '../../lib/formatting';
import { PROCESSING_LABELS } from '../../lib/constants';

const EVENT_COLORS = {
  GameRegistration: 'text-oxide-green',
  GameStart: 'text-compass',
  ActionSubmit: 'text-exp-text-dim',
  GamePhaseChange: 'text-blueprint',
  LandingSiteSet: 'text-landing',
  ProcessingPhaseChange: 'text-compass',
  TurnProcessingStart: 'text-blueprint',
  TurnProcessingFail: 'text-signal-red',
  PlayerIdleKick: 'text-signal-red-dim',
  EndGameStarted: 'text-compass-bright',
  GameOver: 'text-compass-bright',
};

const EVENT_ICONS = {
  GameRegistration: '+',
  GameStart: '\u25B6',
  ActionSubmit: '\u2022',
  GamePhaseChange: '\u2500',
  LandingSiteSet: '\u2302',
  ProcessingPhaseChange: '\u25C6',
  TurnProcessingStart: '\u25B7',
  TurnProcessingFail: '\u2716',
  PlayerIdleKick: '\u26A1',
  EndGameStarted: '\u2605',
  GameOver: '\u2605',
};

function formatEventDescription(event) {
  const { name, args } = event;

  switch (name) {
    case 'GameRegistration':
      return `${truncateAddress(args?.playerAddress)} joined (P${args?.playerID?.toString()})`;
    case 'GameStart':
      return 'Expedition has begun';
    case 'ActionSubmit':
      return `P${args?.playerID?.toString()} submitted action ${args?.actionID?.toString()}`;
    case 'GamePhaseChange':
      return `Phase changed to ${args?.newPhase}`;
    case 'LandingSiteSet':
      return `Landing site: ${args?.landingSite}`;
    case 'ProcessingPhaseChange':
      return `Processing phase: ${PROCESSING_LABELS[Number(args?.newPhase ?? 0)] || args?.newPhase?.toString?.()}`;
    case 'TurnProcessingStart':
      return 'Turn processing started';
    case 'TurnProcessingFail':
      return `Processing failed (queue ${args?.queueID?.toString()})`;
    case 'PlayerIdleKick':
      return `P${args?.playerID?.toString()} kicked for inactivity`;
    case 'EndGameStarted':
      return `Endgame: ${args?.scenario}`;
    case 'GameOver':
      return 'Expedition complete!';
    default:
      return name;
  }
}

function formatTimestamp(ts) {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export default function EventLog({ events = [] }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length]);

  return (
    <div className="bg-exp-dark border border-exp-border rounded">
      <div className="px-3 py-2 border-b border-exp-border">
        <h3 className="font-display tracking-widest text-xs text-exp-text-dim uppercase">
          Expedition Log
        </h3>
      </div>

      <div
        ref={scrollRef}
        className="max-h-64 overflow-y-auto px-3 py-2 space-y-1"
      >
        {events.length === 0 && (
          <p className="font-mono text-xs text-exp-text-dim italic">
            No events recorded yet.
          </p>
        )}

        {events.map((event, i) => {
          const colorClass = EVENT_COLORS[event.name] || 'text-exp-text-dim';
          const icon = EVENT_ICONS[event.name] || '\u2022';

          return (
            <div
              key={event.key || `${event.transactionHash}-${event.name}-${i}`}
              className="flex items-start gap-2 font-mono text-xs leading-relaxed"
            >
              <span className="text-exp-text-dim shrink-0 tabular-nums">
                {formatTimestamp(event.timestamp)}
              </span>
              <span className={`${colorClass} shrink-0 w-3 text-center`}>
                {icon}
              </span>
              <span className={colorClass}>
                {formatEventDescription(event)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
