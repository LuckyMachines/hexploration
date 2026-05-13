import { useEffect, useRef } from 'react';
import { FEEDBACK_EVENT } from '../lib/feedbackEvents';

const FEEDBACK_PROFILE = {
  invalid: { frequency: 120, type: 'square', gain: 0.024, vibrate: 34 },
  commit: { frequency: 420, type: 'triangle', gain: 0.014, vibrate: 18 },
  rush: { frequency: 330, type: 'triangle', gain: 0.016, vibrate: 12 },
  move: { frequency: 260, type: 'triangle', gain: 0.012, vibrate: 8 },
  'tx-pending': { frequency: 180, type: 'sine', gain: 0.01, vibrate: 6 },
  'tx-success': { frequency: 520, type: 'triangle', gain: 0.016, vibrate: 18 },
  'tx-error': { frequency: 100, type: 'square', gain: 0.02, vibrate: 30 },
};

export function useFeedbackEffects() {
  const audioContextRef = useRef(null);

  useEffect(() => {
    const onFeedback = (event) => {
      const profile = FEEDBACK_PROFILE[event.detail?.kind] || FEEDBACK_PROFILE.move;

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(profile.vibrate);
      }

      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) return;

      try {
        audioContextRef.current ||= new AudioContextCtor();
        const ctx = audioContextRef.current;
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        const now = ctx.currentTime;

        oscillator.type = profile.type;
        oscillator.frequency.setValueAtTime(profile.frequency, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(profile.gain, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
        oscillator.connect(gain).connect(ctx.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.09);
      } catch {
        // Browser audio policies may block this until user interaction.
      }
    };

    window.addEventListener(FEEDBACK_EVENT, onFeedback);
    return () => window.removeEventListener(FEEDBACK_EVENT, onFeedback);
  }, []);
}
