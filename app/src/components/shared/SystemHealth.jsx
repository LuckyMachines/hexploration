import { useMemo } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import {
  BOARD_ADDRESS,
  CONTROLLER_ADDRESS,
  GAME_SUMMARY_ADDRESS,
  PLAYER_SUMMARY_ADDRESS,
  GAME_EVENTS_ADDRESS,
  GAME_QUEUE_ADDRESS,
  GAME_SETUP_ADDRESS,
  GAME_REGISTRY_ADDRESS,
} from '../../config/contracts';

const REQUIRED = [
  ['BOARD', BOARD_ADDRESS],
  ['CONTROLLER', CONTROLLER_ADDRESS],
  ['GAME_SUMMARY', GAME_SUMMARY_ADDRESS],
  ['PLAYER_SUMMARY', PLAYER_SUMMARY_ADDRESS],
  ['GAME_EVENTS', GAME_EVENTS_ADDRESS],
  ['GAME_QUEUE', GAME_QUEUE_ADDRESS],
  ['GAME_SETUP', GAME_SETUP_ADDRESS],
  ['GAME_REGISTRY', GAME_REGISTRY_ADDRESS],
];

export default function SystemHealth() {
  const { chain, isConnected } = useWallet();
  const missing = useMemo(
    () => REQUIRED.filter(([, value]) => !value).map(([name]) => name),
    [],
  );

  const localRpc =
    import.meta.env.VITE_FOUNDRY_RPC_URL
    || import.meta.env.VITE_LOCAL_RPC_URL
    || 'http://127.0.0.1:9955';

  return (
    <div className="border border-exp-border rounded bg-exp-panel p-4 mb-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-mono text-xs tracking-[0.3em] text-exp-text-dim uppercase">
          System Health
        </h2>
        <span className={`font-mono text-xs uppercase tracking-wider ${missing.length === 0 ? 'text-oxide-green' : 'text-signal-red'}`}>
          {missing.length === 0 ? 'Ready' : 'Config Issue'}
        </span>
      </div>
      <div className="grid sm:grid-cols-3 gap-2 text-xs font-mono">
        <div className="border border-exp-border/60 rounded bg-exp-dark/40 px-2 py-1.5">
          <div className="text-exp-text-dim uppercase">Wallet</div>
          <div className={isConnected ? 'text-oxide-green' : 'text-signal-red'}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
        <div className="border border-exp-border/60 rounded bg-exp-dark/40 px-2 py-1.5">
          <div className="text-exp-text-dim uppercase">Chain</div>
          <div className="text-compass">{chain?.name || 'Unknown'}</div>
        </div>
        <div className="border border-exp-border/60 rounded bg-exp-dark/40 px-2 py-1.5">
          <div className="text-exp-text-dim uppercase">Local RPC</div>
          <div className="text-compass break-all">{localRpc}</div>
        </div>
      </div>

      {missing.length > 0 && (
        <p className="mt-2 font-mono text-xs text-signal-red">
          Missing contract env vars: {missing.join(', ')}
        </p>
      )}
    </div>
  );
}
