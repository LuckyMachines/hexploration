import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Modal from './Modal';

describe('Modal', () => {
  it('focuses close button and traps tab focus', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <Modal isOpen onClose={onClose} ariaLabel="Test Modal">
        <button type="button">Inner Action</button>
      </Modal>,
    );

    const closeButton = screen.getByRole('button', { name: /close/i });
    expect(closeButton).toHaveFocus();

    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: /Inner Action/i })).toHaveFocus();
  });

  it('closes on Escape key', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <Modal isOpen onClose={onClose} ariaLabel="Test Modal">
        <button type="button">Inner Action</button>
      </Modal>,
    );

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('restores focus to the opener after closing', async () => {
    const user = userEvent.setup();

    function ModalHarness() {
      const [isOpen, setIsOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setIsOpen(true)}>Open dialog</button>
          <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} ariaLabel="Test Modal">
            <button type="button">Inner Action</button>
          </Modal>
        </>
      );
    }

    render(<ModalHarness />);
    const opener = screen.getByRole('button', { name: /open dialog/i });
    await user.click(opener);
    expect(screen.getByRole('button', { name: /close/i })).toHaveFocus();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(opener).toHaveFocus());
  });
});
