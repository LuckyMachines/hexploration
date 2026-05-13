import { describe, expect, it } from 'vitest';
import { ProcessingPhase } from './constants';
import { buildReachableTiles, validateMovePath, validateMoveStep } from './moveValidation';
import { deriveTurnState, TurnState } from './turnState';

describe('integration primitives', () => {
  it('derives explicit turn states from queue and action state', () => {
    expect(deriveTurnState({
      isSpectator: false,
      currentAction: '',
      queueTelemetry: { phase: ProcessingPhase.SUBMISSION },
    }).state).toBe(TurnState.PLANNING);

    expect(deriveTurnState({
      isSpectator: false,
      currentAction: 'Move',
      queueTelemetry: { phase: ProcessingPhase.SUBMISSION, submittedCount: 1, totalPlayers: 2 },
    }).state).toBe(TurnState.WAITING_CREW);

    expect(deriveTurnState({
      isSpectator: false,
      currentAction: 'Move',
      queueTelemetry: { phase: ProcessingPhase.PROCESSING },
    }).state).toBe(TurnState.RESOLVING);
  });

  it('validates move steps and full paths from shared rules', () => {
    const reachableTiles = buildReachableTiles({
      currentLocation: '1,1',
      movement: 2,
      rows: 3,
      columns: 3,
      revealedZones: ['0,0', '0,1', '0,2', '1,0', '1,1', '1,2', '2,0', '2,1', '2,2'],
    });

    expect(validateMoveStep({
      alias: '2,1',
      currentLocation: '1,1',
      selectedPath: [],
      movement: 2,
      reachableTiles,
    }).ok).toBe(true);

    expect(validateMovePath({
      currentLocation: '1,1',
      path: ['2,1', '2,2'],
      movement: 2,
    }).ok).toBe(true);

    expect(validateMovePath({
      currentLocation: '1,1',
      path: ['2,1', '0,0'],
      movement: 2,
    }).ok).toBe(false);
  });
});
