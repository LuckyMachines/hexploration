import { useNavigate } from 'react-router-dom';

export default function GameCard({ gameId, maxPlayers, registered }) {
  const navigate = useNavigate();

  const isFull = registered >= maxPlayers;

  return (
    <button
      onClick={() => navigate(`/game/${gameId}`)}
      className="w-full text-left border border-exp-border rounded bg-exp-panel
                 hover:border-compass/40 hover:bg-exp-panel/80 transition-colors
                 focus:outline-none focus:ring-1 focus:ring-compass/50"
    >
      <div className="px-5 py-4">
        {/* Top row: ID + Status badge */}
        <div className="flex items-center justify-between mb-3">
          <span className="font-mono text-sm text-compass-bright tracking-wider">
            EXP-{String(gameId).padStart(3, '0')}
          </span>
          <span
            className={`font-mono text-xs tracking-widest uppercase rounded px-2 py-0.5 border
              ${isFull
                ? 'text-compass border-compass/30 bg-compass/5'
                : 'text-oxide-green border-oxide-green/30 bg-oxide-green/5'
              }`}
          >
            {isFull ? 'FULL' : 'OPEN'}
          </span>
        </div>

        {/* Details row */}
        <div className="flex items-center gap-6">
          <div>
            <p className="font-mono text-xs tracking-[0.3em] text-exp-text-dim uppercase mb-0.5">
              Explorers
            </p>
            <p className="font-mono text-xs text-exp-text">
              {registered} / {maxPlayers}
            </p>
          </div>
        </div>
      </div>
    </button>
  );
}
