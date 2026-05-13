import { useMemo } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { getRuntimeMode } from '../../lib/runtimeMode';
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
  const { chain, chainId, isConnected, switchChain, isSwitching } = useWallet();
  const missing = useMemo(
    () => REQUIRED.filter(([, value]) => !value).map(([name]) => name),
    [],
  );

  const runtime = useMemo(() => getRuntimeMode(), []);
  const targetChain = runtime.chain;
  const targetRpc = runtime.rpcUrl;
  const wrongChain = isConnected && chainId !== targetChain.id;
  const ready = missing.length === 0 && !wrongChain;

  return (
    <div className="border border-exp-border rounded bg-exp-panel p-4 mb-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-mono text-xs tracking-[0.3em] text-exp-text-dim uppercase">
          System Health
        </h2>
        <span className={`font-mono text-xs uppercase tracking-wider ${ready ? 'text-oxide-green' : 'text-signal-red'}`}>
          {ready ? 'Ready' : 'Needs Attention'}
        </span>
      </div>
      <div className="grid sm:grid-cols-4 gap-2 text-xs font-mono">
        <div className="border border-exp-border/60 rounded bg-exp-dark/40 px-2 py-1.5">
          <div className="text-exp-text-dim uppercase">Wallet</div>
          <div className={isConnected ? 'text-oxide-green' : 'text-signal-red'}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
        <div className="border border-exp-border/60 rounded bg-exp-dark/40 px-2 py-1.5">
          <div className="text-exp-text-dim uppercase">Chain</div>
          <div className={wrongChain ? 'text-signal-red' : 'text-compass'}>
            {chain?.name || 'Unknown'}
          </div>
        </div>
        <div className="border border-exp-border/60 rounded bg-exp-dark/40 px-2 py-1.5">
          <div className="text-exp-text-dim uppercase">Mode</div>
          <div className="text-compass">{runtime.label}</div>
        </div>
        <div className="border border-exp-border/60 rounded bg-exp-dark/40 px-2 py-1.5">
          <div className="text-exp-text-dim uppercase">RPC</div>
          <div className="text-compass break-all">{targetRpc || 'Missing'}</div>
        </div>
      </div>

      {missing.length > 0 && (
        <p className="mt-2 font-mono text-xs text-signal-red">
          Missing contract env vars: {missing.join(', ')}
        </p>
      )}
      {wrongChain && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded border border-signal-red/30 bg-signal-red/5 px-3 py-2">
          <p className="font-mono text-xs text-signal-red">
            Wallet is on {chain?.name || 'an unsupported chain'}; this client is configured for {targetChain.name}.
          </p>
          <button
            onClick={() => switchChain({ chainId: targetChain.id })}
            disabled={isSwitching}
            className="rounded border border-signal-red/40 px-3 py-1.5 font-display text-xs uppercase tracking-widest text-signal-red transition-colors hover:bg-signal-red/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSwitching ? 'Switching' : 'Switch Chain'}
          </button>
        </div>
      )}
    </div>
  );
}
