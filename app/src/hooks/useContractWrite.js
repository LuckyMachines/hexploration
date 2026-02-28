import { useCallback, useState } from 'react';
import { createWalletClient, custom } from 'viem';
import { getPublicClient } from '../config/clients';
import { useWallet } from '../contexts/WalletContext';
import { getChainById } from '../config/chains';

export function useContractWrite() {
  const { address, chainId } = useWallet();
  const [hash, setHash] = useState(undefined);
  const [isPending, setIsPending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState(null);

  const writeContractAsync = useCallback(
    async (request) => {
      setError(null);
      setIsSuccess(false);
      setHash(undefined);
      setIsPending(true);

      try {
        const chain = getChainById(chainId);
        const walletClient = createWalletClient({
          account: address,
          chain,
          transport: custom(window.ethereum),
        });

        const txHash = await walletClient.writeContract(request);
        setHash(txHash);
        setIsPending(false);
        setIsConfirming(true);

        const publicClient = getPublicClient(chainId);
        await publicClient.waitForTransactionReceipt({ hash: txHash });

        setIsConfirming(false);
        setIsSuccess(true);
        return txHash;
      } catch (err) {
        setIsPending(false);
        setIsConfirming(false);
        setError(err);
        throw err;
      }
    },
    [address, chainId],
  );

  return { writeContractAsync, data: hash, isPending, isConfirming, isSuccess, error };
}
