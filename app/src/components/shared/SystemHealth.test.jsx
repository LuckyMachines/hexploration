import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SystemHealth from './SystemHealth';

vi.mock('../../contexts/WalletContext', () => ({
  useWallet: () => ({
    chain: null,
    chainId: null,
    isConnected: false,
    switchChain: vi.fn(),
    isSwitching: false,
  }),
}));

vi.mock('../../lib/runtimeMode', () => ({
  getRuntimeMode: () => ({
    key: 'testnet',
    label: 'Testnet',
    chain: { id: 11155111, name: 'Sepolia' },
    rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
  }),
}));

describe('SystemHealth', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports the network separately from wallet connection', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ jsonrpc: '2.0', id: 1, result: '0xaa36a7' }),
    });

    render(<SystemHealth />);

    expect(await screen.findByText('Network online')).toBeInTheDocument();
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
    expect(screen.getByText('Sepolia')).toBeInTheDocument();
  });

  it('shows a useful failure and allows a retry', async () => {
    const user = userEvent.setup();
    fetch.mockRejectedValue(new Error('RPC unavailable'));

    render(<SystemHealth />);

    expect(await screen.findByText('Network offline')).toBeInTheDocument();
    expect(screen.getByText(/RPC unavailable/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Retry network/i }));
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
