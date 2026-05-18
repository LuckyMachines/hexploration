import { useMemo } from 'react';
import { TurnState } from './turnState';

export const InterfaceDensity = {
  QUIET: 'quiet',
  STANDARD: 'standard',
  FOCUSED: 'focused',
  HIGH_ALERT: 'high-alert',
};

const DENSITY_RANK = {
  [InterfaceDensity.QUIET]: 0,
  [InterfaceDensity.STANDARD]: 1,
  [InterfaceDensity.FOCUSED]: 2,
  [InterfaceDensity.HIGH_ALERT]: 3,
};

function strongestDensity(...levels) {
  return levels.reduce((best, level) => (
    DENSITY_RANK[level] > DENSITY_RANK[best] ? level : best
  ), InterfaceDensity.QUIET);
}

function routeHasIntent(movePath = [], previewPath = []) {
  return movePath.length > 0 || previewPath.length > 0;
}

export function deriveInterfaceDensity({
  turnState,
  routeStatus,
  movePath = [],
  previewPath = [],
  boardInput = {},
  funTelemetry = {},
  hasSubmitted = false,
  isSpectator = false,
  isPending = false,
  isConfirming = false,
  error = null,
  preferences = {},
} = {}) {
  const hasRouteIntent = routeHasIntent(movePath, previewPath);
  const inputCadence = boardInput.inputCadence || 'idle';
  const activeInput = inputCadence !== 'idle';
  const invalidRoute = routeStatus?.isValid === false;
  const redlineRisk = funTelemetry?.risk?.level === 'redline';
  const resolving = turnState?.state === TurnState.RESOLVING || turnState?.isResolving;
  const txActive = isPending || isConfirming;
  const txError = Boolean(error);
  const compactHud = Boolean(preferences.compactHud || preferences.compactMode);
  const showExtraDetail = Boolean(preferences.showExtraDetail);

  const level = strongestDensity(
    invalidRoute || redlineRisk || txError ? InterfaceDensity.HIGH_ALERT : InterfaceDensity.QUIET,
    resolving || txActive || hasSubmitted ? InterfaceDensity.FOCUSED : InterfaceDensity.QUIET,
    hasRouteIntent || activeInput ? InterfaceDensity.FOCUSED : InterfaceDensity.QUIET,
    isSpectator ? InterfaceDensity.STANDARD : InterfaceDensity.QUIET,
    !hasRouteIntent && !activeInput && !hasSubmitted && !resolving ? InterfaceDensity.QUIET : InterfaceDensity.STANDARD,
  );

  return {
    level,
    compactHud,
    showExtraDetail,
    hasRouteIntent,
    activeInput,
    invalidRoute,
    redlineRisk,
    resolving,
    txActive,
    txError,
    className: `ui-density-${level}`,
    details: {
      actionContextOpen: showExtraDetail || level === InterfaceDensity.HIGH_ALERT,
      outcomePreviewOpen: showExtraDetail && level !== InterfaceDensity.QUIET,
      turnBriefingOpen: showExtraDetail || level === InterfaceDensity.HIGH_ALERT,
    },
  };
}

export function overlayVisibilityFromDensity({
  density,
  inputMode = 'mouse',
  intentAlias = '',
  currentLocation = '',
  invalidPulse = false,
  isObserving = false,
  hasSubmitted = false,
} = {}) {
  const level = density?.level || InterfaceDensity.QUIET;
  const hasRouteIntent = Boolean(density?.hasRouteIntent);
  const activeInput = Boolean(density?.activeInput);
  const urgentMoment = level === InterfaceDensity.HIGH_ALERT;
  const focusedMoment = level === InterfaceDensity.FOCUSED || urgentMoment;
  const intentDiffers = Boolean(intentAlias && intentAlias !== currentLocation);
  const controllerActive = inputMode === 'pad' && (activeInput || hasRouteIntent);

  return {
    intentCursor: Boolean(
      intentAlias
      && (intentDiffers || hasRouteIntent || controllerActive || invalidPulse || urgentMoment),
    ),
    denseReadouts: Boolean(!isObserving && (hasRouteIntent || focusedMoment)),
    expressiveText: Boolean(!isObserving && (activeInput || hasSubmitted || focusedMoment)),
    inputReadout: Boolean(controllerActive),
    highMotion: Boolean(!isObserving && (activeInput || urgentMoment)),
  };
}

export function useInterfaceDensity(options) {
  return useMemo(() => deriveInterfaceDensity(options), [
    options?.turnState?.state,
    options?.turnState?.isResolving,
    options?.routeStatus?.isValid,
    options?.routeStatus?.label,
    options?.movePath?.length,
    options?.previewPath?.length,
    options?.boardInput?.inputCadence,
    options?.funTelemetry?.risk?.level,
    options?.hasSubmitted,
    options?.isSpectator,
    options?.isPending,
    options?.isConfirming,
    Boolean(options?.error),
    options?.preferences?.compactHud,
    options?.preferences?.compactMode,
    options?.preferences?.showExtraDetail,
  ]);
}

