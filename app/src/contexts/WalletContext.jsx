import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getChainById } from '../config/chains';
import { getRuntimeMode } from '../lib/runtimeMode';
import { ensureGameSession } from '../lib/gameAuthority';

// Compatibility facade for chain-backed read hooks. Player identity and signing are
// owned by the game authority; no browser wallet or network interaction is required.
const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [address, setAddress] = useState(null);
  const [isSwitching, setIsSwitching] = useState(true);
  const chainId = getRuntimeMode().chainId;
  const chain = useMemo(() => getChainById(chainId) ?? null, [chainId]);

  const connect = useCallback(async () => {
    setIsSwitching(true);
    try {
      const session = await ensureGameSession();
      setAddress(session.playerIdentity);
      return session.playerIdentity;
    } finally {
      setIsSwitching(false);
    }
  }, []);

  useEffect(() => { connect().catch(() => setIsSwitching(false)); }, [connect]);

  const value = useMemo(() => ({
    address,
    isConnected: Boolean(address),
    chain,
    chainId,
    walletChainId: chainId,
    readChain: chain,
    readChainId: chainId,
    connect,
    disconnect: () => {},
    switchChain: async () => {},
    isSwitching,
    managedIdentity: true,
  }), [address, chain, chainId, connect, isSwitching]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}
