import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ShareGameLink from './ShareGameLink';

function setClipboard(value) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value,
  });
}

describe('ShareGameLink', () => {
  afterEach(() => {
    setClipboard(undefined);
    vi.restoreAllMocks();
  });

  it('copies the current URL and confirms success', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    setClipboard({ writeText });
    render(<ShareGameLink />);

    await user.click(screen.getByRole('button', { name: 'Copy game link' }));

    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  it('falls back to a temporary text field when Clipboard API is unavailable', async () => {
    const user = userEvent.setup();
    setClipboard(undefined);
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    });
    render(<ShareGameLink />);

    await user.click(screen.getByRole('button', { name: 'Copy game link' }));

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('shows a recoverable instruction when copying is blocked', async () => {
    const user = userEvent.setup();
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('blocked')) });
    render(<ShareGameLink />);

    await user.click(screen.getByRole('button', { name: 'Copy game link' }));

    expect(screen.getByRole('button', { name: 'Copy failed' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/Select the address from your browser bar/i);
  });
});
