import boardSystem from '../../board-system/board-system.json';
import { Action } from '../../lib/constants';

const MECHANIC_BY_ACTION = new Map(boardSystem.mechanics.map((mechanic) => [mechanic.actionIndex, mechanic]));

const PHASE_BEATS = Object.freeze({
  complete: { id: 'expedition-complete', lightingRig: 'neutral', soundCue: 'board.complete', motionCue: 'settle', announcement: 'Expedition complete. The world is settled.' },
  resolving: { id: 'world-answering', lightingRig: 'discovery', soundCue: 'board.resolve', motionCue: 'resolve-wave', announcement: 'The world is answering the committed route.' },
  danger: { id: 'redline-choice', lightingRig: 'danger', soundCue: 'board.danger', motionCue: 'redline-sweep', announcement: 'Redline choice. Review the cost before committing.' },
  recovery: { id: 'recovery-window', lightingRig: 'recovery', soundCue: 'board.recovery', motionCue: 'soft-breathe', announcement: 'A recovery opportunity is available.' },
  committed: { id: 'route-committed', lightingRig: 'neutral', soundCue: 'board.commit', motionCue: 'route-lock', announcement: 'Route committed. Waiting for resolution.' },
  planning: { id: 'planning-open', lightingRig: 'neutral', soundCue: 'board.ready', motionCue: 'none', announcement: 'Planning is open.' },
});

const ENCOUNTER_BEAT = Object.freeze({
  id: 'landmark-decision',
  lightingRig: 'discovery',
  soundCue: 'board.discovery',
  motionCue: 'encounter-reveal',
  announcement: 'A landmark encounter is waiting for the crew decision.',
});

export function resolveBoardBeat(viewModel = {}) {
  const phaseBeat = viewModel.encounterId ? ENCOUNTER_BEAT : PHASE_BEATS[viewModel.phase] || PHASE_BEATS.planning;
  const mechanic = MECHANIC_BY_ACTION.get(viewModel.activeAction);
  const previewing = Boolean(viewModel.signals?.isPreviewing);
  const id = previewing && mechanic ? `${mechanic.id}-preview` : phaseBeat.id;
  return Object.freeze({
    ...phaseBeat,
    id,
    mechanicId: mechanic?.id || (viewModel.activeAction === Action.IDLE ? 'idle' : 'unknown'),
    soundCue: previewing && mechanic ? mechanic.soundCue : phaseBeat.soundCue,
    motionCue: previewing && mechanic ? mechanic.motionCue : phaseBeat.motionCue,
    reducedMotion: mechanic?.reducedMotion || 'static semantic lighting',
    camera: Object.freeze({
      automatic: false,
      suggestion: viewModel.phase === 'complete'
        ? 'overview'
        : viewModel.intentAlias
          ? 'intent'
          : 'party',
    }),
  });
}

export default resolveBoardBeat;
