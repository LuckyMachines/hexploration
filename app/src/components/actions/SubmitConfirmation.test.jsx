import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SubmitConfirmation from './SubmitConfirmation';

const submission = { label: 'Move', options: ['2,2'], drama: null };

describe('SubmitConfirmation chain preflight', () => {
  it('prevents signing while the authoritative simulation is running', () => {
    render(<SubmitConfirmation submission={submission} isOpen simulation={{ status: 'checking' }} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByTestId('chain-preflight')).toHaveTextContent(/No signature is being requested/i);
    expect(screen.getByRole('button', { name: /Checking Chain/i })).toBeDisabled();
  });

  it('enables signing only after the exact contract call succeeds', () => {
    render(<SubmitConfirmation submission={submission} isOpen simulation={{ status: 'ready', estimatedGas: 123456n }} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByTestId('chain-preflight')).toHaveTextContent(/contract accepted/i);
    expect(screen.getByRole('button', { name: /Sign Action/i })).toBeEnabled();
  });

  it('shows a recoverable chain rejection without opening the wallet', () => {
    render(<SubmitConfirmation submission={submission} isOpen simulation={{ status: 'blocked', error: { message: 'The route is no longer connected.' } }} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText(/route is no longer connected/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Action Blocked/i })).toBeDisabled();
  });
});
