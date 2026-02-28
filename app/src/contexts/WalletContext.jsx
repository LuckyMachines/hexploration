import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getChainById, SUPPORTED_CHAINS } from '../config/chains';

const WalletContext = createContext(null);

function parseChainId(hex) {
  return typeof hex === 'string' ? parseInt(hex, 16) : Number(hex);
}

export function WalletProvider({ children }) {
  const [address, setAddress] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [isSwitching, setIsSwitching] = useState(false);

  const syncAccounts = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      setAddress(accounts[0] ?? null);
    } catch {
      setAddress(null);
    }
  }, []);

  const syncChain = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      const hex = await window.ethereum.request({ method: 'eth_chainId' });
      setChainId(parseChainId(hex));
    } catch {
      setChainId(null);
    }
  }, []);

  useEffect(() => {
    syncAccounts();
    syncChain();

    if (!window.ethereum) return;

    const onAccountsChanged = (accounts) => setAddress(accounts[0] ?? null);
    const onChainChanged = (hex) => setChainId(parseChainId(hex));

    window.ethereum.on('accountsChanged', onAccountsChanged);
    window.ethereum.on('chainChanged', onChainChanged);
    return () => {
      window.ethereum.removeListener('accountsChanged', onAccountsChanged);
      window.ethereum.removeListener('chainChanged', onChainChanged);
    };
  }, [syncAccounts, syncChain]);

  const connect = useCallback(async () => {
    if (!window.ethereum) throw new Error('No wallet found');
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    setAddress(accounts[0] ?? null);
    await syncChain();
  }, [syncChain]);

  const disconnect = useCallback(() => {
    setAddress(null);
  }, []);

  const switchChain = useCallback(async ({ chainId: targetId }) => {
    if (!window.ethereum) return;
    setIsSwitching(true);
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${targetId.toString(16)}` }],
      });
    } catch (err) {
      if (err.code === 4902) {
        const chain = getChainById(targetId);
        if (chain) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${targetId.toString(16)}`,
              chainName: chain.name,
              nativeCurrency: chain.nativeCurrency,
              rpcUrls: [chain.rpcUrls.default.http[0]],
              blockExplorerUrls: chain.blockExplorers
                ? [chain.blockExplorers.default.url]
                : undefined,
            }],
          });
        }
      } else {
        throw err;
      }
    } finally {
      setIsSwitching(false);
    }
  }, []);

  const chain = useMemo(() => getChainById(chainId) ?? null, [chainId]);
  const isConnected = !!address;

  const value = useMemo(
    () => ({ address, isConnected, chain, chainId, connect, disconnect, switchChain, isSwitching }),
    [address, isConnected, chain, chainId, connect, disconnect, switchChain, isSwitching],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}
