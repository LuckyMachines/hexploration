import { useCallback, useState } from 'react';
import { createWalletClient, custom } from 'viem';
import { getPublicClient } from '../config/clients';
import { useWallet } from '../contexts/WalletContext';
import { getChainById } from '../config/chains';
import { usePlayerSession } from '../contexts/PlayerSessionContext';

export function useContractWrite() {
  const { address, chainId } = useWallet();
  const { recordPendingTransaction, settleTransaction } = usePlayerSession();
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

      let txHash;
      try {
        const chain = getChainById(chainId);
        const walletClient = createWalletClient({
          account: address,
          chain,
          transport: custom(window.ethereum),
        });

        txHash = await walletClient.writeContract(request);
        setHash(txHash);
        recordPendingTransaction({ hash: txHash, chainId, account: address.toLowerCase(), action: request.functionName, status: 'confirming' });
        setIsPending(false);
        setIsConfirming(true);

        const publicClient = getPublicClient(chainId);
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
          confirmations: 2,
          timeout: 120_000,
          onReplaced: ({ transaction: replacement }) => {
            settleTransaction(txHash, 'replaced');
            txHash = replacement.hash;
            setHash(txHash);
            recordPendingTransaction({ hash: txHash, chainId, account: address.toLowerCase(), action: request.functionName, status: 'confirming' });
          },
        });

        if (receipt.status !== 'success') throw new Error('Transaction reverted before confirmation.');

        setIsConfirming(false);
        setIsSuccess(true);
        settleTransaction(txHash, 'confirmed');
        return txHash;
      } catch (err) {
        setIsPending(false);
        setIsConfirming(false);
        setError(err);
        if (txHash) settleTransaction(txHash, 'failed');
        throw err;
      }
    },
    [address, chainId, recordPendingTransaction, settleTransaction],
  );

  return { writeContractAsync, data: hash, isPending, isConfirming, isSuccess, error };
}
