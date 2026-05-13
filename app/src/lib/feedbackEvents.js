export const FEEDBACK_EVENT = 'xv:expedition-feedback';

export function emitFeedbackEvent(detail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(FEEDBACK_EVENT, {
    detail: {
      at: Date.now(),
      ...detail,
    },
  }));
}
