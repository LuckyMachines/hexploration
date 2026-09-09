import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

function getFocusable(root) {
  if (!root) return [];
  return Array.from(root.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  )).filter((node) => !node.hasAttribute('disabled'));
}

export default function Modal({
  isOpen,
  onClose,
  children,
  returnFocusRef,
  ariaLabel = 'Dialog',
}) {
  const panelRef = useRef(null);
  const closeButtonRef = useRef(null);
  const previousFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCloseRef.current();
      return;
    }

    if (e.key !== 'Tab') return;
    const focusable = getFocusable(panelRef.current);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;

    previousFocusRef.current = document.activeElement;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      const previousFocus = returnFocusRef?.current || previousFocusRef.current;
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
      window.requestAnimationFrame(() => {
        if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
      });
    };
  }, [isOpen, handleKeyDown, returnFocusRef]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-exp-dark/80 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className="relative max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto
                   bg-exp-surface border border-exp-border rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          ref={closeButtonRef}
          onClick={onClose}
          className="absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center
                     text-exp-text-dim hover:text-exp-text transition-colors"
          aria-label="Close"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="4" x2="12" y2="12" />
            <line x1="12" y1="4" x2="4" y2="12" />
          </svg>
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
