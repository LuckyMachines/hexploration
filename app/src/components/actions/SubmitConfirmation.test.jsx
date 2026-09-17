import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SubmitConfirmation from './SubmitConfirmation';

const submission = { label: 'Move', options: ['2,2'], drama: null };

describe('SubmitConfirmation action preflight', () => {
  it('prevents commitment while the authoritative simulation is running', () => {
    render(<SubmitConfirmation submission={submission} isOpen simulation={{ status: 'checking' }} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByTestId('action-preflight')).toHaveTextContent(/Checking this exact action/i);
    expect(screen.getByRole('button', { name: /Checking/i })).toBeDisabled();
  });

  it('enables commitment only after the exact action check succeeds', () => {
    render(<SubmitConfirmation submission={submission} isOpen simulation={{ status: 'ready', estimatedGas: 123456n }} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByTestId('action-preflight')).toHaveTextContent(/game accepted this exact action/i);
    expect(screen.getByRole('button', { name: /Commit Action/i })).toBeEnabled();
  });

  it('shows a recoverable rules rejection without exposing infrastructure', () => {
    render(<SubmitConfirmation submission={submission} isOpen simulation={{ status: 'blocked', error: { message: 'The route is no longer connected.' } }} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText(/route is no longer connected/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Action Blocked/i })).toBeDisabled();
  });
});
