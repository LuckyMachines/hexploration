import { useCallback, useEffect, useMemo, useState } from 'react';
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
  const [rpcCheck, setRpcCheck] = useState({ status: 'checking', chainId: null, error: '' });
  const wrongChain = isConnected && chainId !== targetChain.id;

  const checkRpc = useCallback(async () => {
    if (!targetRpc) {
      setRpcCheck({ status: 'offline', chainId: null, error: 'No read-only network endpoint is configured.' });
      return;
    }

    setRpcCheck({ status: 'checking', chainId: null, error: '' });
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(targetRpc, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Network check returned ${response.status}.`);
      const payload = await response.json();
      if (!payload.result) throw new Error(payload.error?.message || 'Network check returned no chain id.');
      const checkedChainId = Number.parseInt(payload.result, 16);
      if (checkedChainId !== targetChain.id) {
        throw new Error(`Read-only endpoint returned chain ${checkedChainId}; expected ${targetChain.id}.`);
      }
      setRpcCheck({ status: 'online', chainId: checkedChainId, error: '' });
    } catch (error) {
      setRpcCheck({
        status: 'offline',
        chainId: null,
        error: error?.message || 'The read-only network endpoint could not be reached.',
      });
    } finally {
      window.clearTimeout(timeout);
    }
  }, [targetChain.id, targetRpc]);

  useEffect(() => {
    void checkRpc();
  }, [checkRpc]);

  const networkReady = rpcCheck.status === 'online' && rpcCheck.chainId === targetChain.id;
  const ready = missing.length === 0 && networkReady && !wrongChain;
  const statusLabel = missing.length > 0
    ? 'Config incomplete'
    : rpcCheck.status === 'checking'
      ? 'Checking network'
      : !networkReady
        ? 'Network offline'
        : wrongChain
          ? 'Switch network'
          : isConnected
            ? 'Ready to play'
            : 'Network online';

  return (
    <div className="border border-exp-border rounded bg-exp-panel p-4 mb-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-mono text-xs tracking-[0.3em] text-exp-text-dim uppercase">
          System Health
        </h2>
        <span role="status" aria-live="polite" className={`font-mono text-xs uppercase tracking-wider ${ready || (networkReady && !isConnected) ? 'text-oxide-green' : rpcCheck.status === 'checking' ? 'text-compass' : 'text-signal-red'}`}>
          {statusLabel}
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
          <div className="text-exp-text-dim uppercase">Network</div>
          <div className={networkReady ? 'text-oxide-green' : rpcCheck.status === 'checking' ? 'text-compass' : 'text-signal-red'}>
            {rpcCheck.status === 'checking' ? 'Checking' : networkReady ? targetChain.name : 'Offline'}
          </div>
        </div>
        <div className="border border-exp-border/60 rounded bg-exp-dark/40 px-2 py-1.5">
          <div className="text-exp-text-dim uppercase">Mode</div>
          <div className="text-compass">{runtime.label}</div>
        </div>
        <div className="border border-exp-border/60 rounded bg-exp-dark/40 px-2 py-1.5">
          <div className="text-exp-text-dim uppercase">Contracts</div>
          <div className={missing.length === 0 ? 'text-oxide-green' : 'text-signal-red'}>
            {missing.length === 0 ? 'Configured' : `${missing.length} missing`}
          </div>
        </div>
      </div>

      {missing.length > 0 && (
        <p className="mt-2 font-mono text-xs text-signal-red">
          Missing contract env vars: {missing.join(', ')}
        </p>
      )}
      {rpcCheck.status === 'offline' && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded border border-signal-red/30 bg-signal-red/5 px-3 py-2">
          <p className="font-mono text-xs text-signal-red">
            Live expedition data is unavailable. {rpcCheck.error}
          </p>
          <button
            type="button"
            onClick={() => void checkRpc()}
            className="min-h-11 rounded border border-signal-red/40 px-3 py-2 font-display text-xs uppercase tracking-widest text-signal-red transition-colors hover:bg-signal-red/10"
          >
            Retry network
          </button>
        </div>
      )}
      {wrongChain && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded border border-signal-red/30 bg-signal-red/5 px-3 py-2">
          <p className="font-mono text-xs text-signal-red">
            Wallet is on {chain?.name || 'an unsupported chain'}; this client is configured for {targetChain.name}.
          </p>
          <button
            onClick={() => switchChain({ chainId: targetChain.id })}
            disabled={isSwitching}
            className="min-h-11 rounded border border-signal-red/40 px-3 py-2 font-display text-xs uppercase tracking-widest text-signal-red transition-colors hover:bg-signal-red/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSwitching ? 'Switching' : 'Switch Chain'}
          </button>
        </div>
      )}
    </div>
  );
}
