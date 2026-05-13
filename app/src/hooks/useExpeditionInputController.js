import { useCallback, useEffect, useRef, useState } from 'react';
import { parseAlias, toAlias } from '../lib/hexmath';

function inputCadenceFromInterval(intervalMs) {
  if (intervalMs < 180) return 'urgent';
  if (intervalMs < 420) return 'steady';
  return 'deliberate';
}

export function useExpeditionInputController({
  columns = 0,
  rows = 0,
  allHexes = [],
  currentLocation = '',
  intentAlias = '',
  selectedPath = [],
  canChooseTile,
  onIntentMove,
  onCommit,
  onBacktrack,
  onPing,
  onInvalid,
  emitFeedback,
}) {
  const boardRef = useRef(null);
  const lastInputAtRef = useRef(Date.now());
  const [inputMode, setInputMode] = useState('mouse');
  const [analogPressure, setAnalogPressure] = useState(0);
  const [inputCadence, setInputCadence] = useState('idle');
  const [lastInputKind, setLastInputKind] = useState('idle');
  const [backtrackCount, setBacktrackCount] = useState(0);
  const [invalidCount, setInvalidCount] = useState(0);
  const [commitCount, setCommitCount] = useState(0);
  const [lanternPing, setLanternPing] = useState(0);
  const [invalidPulse, setInvalidPulse] = useState(false);
  const [isObserving, setIsObserving] = useState(false);

  const markInput = useCallback((mode, kind = 'intent', pressure = 0) => {
    const now = Date.now();
    setInputCadence(inputCadenceFromInterval(now - lastInputAtRef.current));
    lastInputAtRef.current = now;
    setIsObserving(false);
    setInputMode(mode);
    setLastInputKind(kind);
    setAnalogPressure((prev) => Math.max(pressure, prev * 0.55));
  }, []);

  const pulseInvalid = useCallback(() => {
    setInvalidCount((count) => Math.min(count + 1, 9));
    setInvalidPulse(true);
    window.setTimeout(() => setInvalidPulse(false), 260);
    onInvalid?.();
  }, [onInvalid]);

  const triggerFeedback = useCallback((kind) => {
    emitFeedback?.(kind, inputMode);
  }, [emitFeedback, inputMode]);

  const moveIntentBy = useCallback((deltaCol, deltaRow, mode = 'keyboard', pressure = 0.45) => {
    markInput(mode, 'move', pressure);
    const current = parseAlias(intentAlias || currentLocation || allHexes[0]?.alias);
    if (!current) return;

    const nextCol = Math.max(0, Math.min(columns - 1, current.col + deltaCol));
    const nextRow = Math.max(0, Math.min(rows - 1, current.row + deltaRow));
    const nextAlias = toAlias(nextCol, nextRow);
    onIntentMove?.(nextAlias);
    triggerFeedback(pressure > 0.75 ? 'rush' : 'move');
  }, [allHexes, columns, currentLocation, intentAlias, markInput, onIntentMove, rows, triggerFeedback]);

  const commitIntent = useCallback((alias = intentAlias, mode = 'keyboard', pressure = 0.8) => {
    if (!alias) return;
    markInput(mode, 'commit', pressure);
    if (!canChooseTile?.(alias)) {
      pulseInvalid();
      triggerFeedback('invalid');
      return;
    }
    triggerFeedback('commit');
    setCommitCount((count) => Math.min(count + 1, 9));
    onCommit?.(alias);
  }, [canChooseTile, intentAlias, markInput, onCommit, pulseInvalid, triggerFeedback]);

  const backtrackIntent = useCallback((mode = 'keyboard') => {
    markInput(mode, 'backtrack', 0.55);
    if (selectedPath.length === 0) {
      pulseInvalid();
      triggerFeedback('invalid');
      return;
    }
    triggerFeedback('move');
    setBacktrackCount((count) => Math.min(count + 1, 9));
    onBacktrack?.();
  }, [markInput, onBacktrack, pulseInvalid, selectedPath.length, triggerFeedback]);

  const toyPing = useCallback((mode = 'keyboard') => {
    markInput(mode, 'ping', 0.5);
    setLanternPing((ping) => ping + 1);
    triggerFeedback('commit');
    onPing?.();
  }, [markInput, onPing, triggerFeedback]);

  const handleKeyDown = useCallback((event) => {
    const key = event.key.toLowerCase();
    const keyMoves = {
      arrowup: [0, -1],
      w: [0, -1],
      arrowdown: [0, 1],
      s: [0, 1],
      arrowleft: [-1, 0],
      a: [-1, 0],
      arrowright: [1, 0],
      d: [1, 0],
    };

    if (keyMoves[key]) {
      event.preventDefault();
      moveIntentBy(keyMoves[key][0], keyMoves[key][1], 'keys');
      return;
    }

    if (key === 'enter' || key === ' ') {
      event.preventDefault();
      commitIntent(intentAlias, 'keys');
      return;
    }

    if (key === 'escape' || key === 'backspace') {
      event.preventDefault();
      backtrackIntent('keys');
      return;
    }

    if (key === 'f' || key === 'l') {
      event.preventDefault();
      toyPing('keys');
    }
  }, [backtrackIntent, commitIntent, intentAlias, moveIntentBy, toyPing]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIsObserving(Date.now() - lastInputAtRef.current > 2400);
    }, 400);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let frame = 0;
    let lastStepAt = 0;
    let lastCommitAt = 0;

    const pollGamepad = () => {
      const pads = navigator.getGamepads?.() || [];
      const pad = Array.from(pads).find(Boolean);
      const now = performance.now();

      if (pad) {
        const horizontal = Math.abs(pad.axes[0] || 0) > 0.45 ? Math.sign(pad.axes[0]) : 0;
        const vertical = Math.abs(pad.axes[1] || 0) > 0.45 ? Math.sign(pad.axes[1]) : 0;
        const pressure = Math.min(1, Math.hypot(pad.axes[0] || 0, pad.axes[1] || 0));

        if ((horizontal || vertical) && now - lastStepAt > 170) {
          moveIntentBy(horizontal, vertical, 'pad', pressure);
          lastStepAt = now;
        }

        if (pad.buttons[0]?.pressed && now - lastCommitAt > 260) {
          commitIntent(intentAlias, 'pad', Math.max(0.8, pressure));
          lastCommitAt = now;
        }

        if (pad.buttons[1]?.pressed && now - lastCommitAt > 260) {
          backtrackIntent('pad');
          lastCommitAt = now;
        }

        if (pad.buttons[2]?.pressed && now - lastCommitAt > 260) {
          toyPing('pad');
          lastCommitAt = now;
        }
      }

      frame = window.requestAnimationFrame(pollGamepad);
    };

    frame = window.requestAnimationFrame(pollGamepad);
    return () => window.cancelAnimationFrame(frame);
  }, [backtrackIntent, commitIntent, intentAlias, moveIntentBy, toyPing]);

  return {
    boardRef,
    inputMode,
    analogPressure,
    inputCadence,
    lastInputKind,
    backtrackCount,
    invalidCount,
    commitCount,
    lanternPing,
    invalidPulse,
    isObserving,
    markInput,
    pulseInvalid,
    triggerFeedback,
    commitIntent,
    handleKeyDown,
  };
}
