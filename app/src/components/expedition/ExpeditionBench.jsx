import { useEffect, useMemo, useState } from 'react';
import { useExpedition } from '../../contexts/ExpeditionContext';
import { Action } from '../../lib/constants';
import { useLandingSite } from '../../hooks/useLandingSite';
import DayNightBadge from './DayNightBadge';
import DayCounter from './DayCounter';
import PhaseIndicator from './PhaseIndicator';
import TurnTimeline from './TurnTimeline';
import ReadinessMatrix from './ReadinessMatrix';
import MatchReplay from './MatchReplay';
import SpectatorBanner from './SpectatorBanner';
import MissionStatus from './MissionStatus';
import TurnReadinessStrip from './TurnReadinessStrip';
import UXStatusPanel from './UXStatusPanel';
import GuidedFirstTurn from './GuidedFirstTurn';
import FunStatusPanel from './FunStatusPanel';
import DiscoveryJournal from './DiscoveryJournal';
import EscapeCostPreview from './EscapeCostPreview';
import CostReductionActions from './CostReductionActions';
import TraitPreviewPanel from './TraitPreviewPanel';
import ExpeditionArcTrack from './ExpeditionArcTrack';
import HexGrid from '../board/HexGrid';
import PlayerDossier from '../player/PlayerDossier';
import ActionPanel from '../actions/ActionPanel';
import TurnResolution from '../resolution/TurnResolution';
import EventLog from '../shared/EventLog';
import ExpeditionDebugOverlay from './ExpeditionDebugOverlay';
import ErrorBoundary from '../shared/ErrorBoundary';
import UserPreferencesPanel from '../shared/UserPreferencesPanel';
import ShareGameLink from '../shared/ShareGameLink';
import { buildRouteStatus } from '../../lib/routeStatus';
import { getAdjacent, parseAlias } from '../../lib/hexmath';
import { getBestActionSuggestion, getTurnGuidance } from '../../lib/uxGuidance';
import { deriveDepartPressure, pressureToneClass } from '../../lib/departPressure';
import { deriveEscapeCostPreview, escapeCostToneClass } from '../../lib/escapeCostPreview';
import { deriveExpeditionArc } from '../../lib/expeditionArc';
import { buildFunTelemetry } from '../../lib/funTelemetry';
import { useInterfaceDensity } from '../../lib/interfaceDensity';
import { emitMusicDirectorState, trackForExpeditionState } from '../../lib/musicDirector';
import { useUserPreferences } from '../../hooks/useUserPreferences';

function ChartDepartStrip({ movement, movePath, routeStatus, turnGuidance, departPressure, escapeCostPreview }) {
  const plannedSteps = movePath.length;
  const distanceHome = departPressure?.currentDistanceToLanding;
  const departLabel = departPressure?.readiness?.label || (
    distanceHome === null ? 'Find landing' : `${distanceHome} from landing`
  );
  const riskLabel = routeStatus?.isValid === false
    ? 'Route blocked'
    : movement <= 0
      ? 'No movement'
      : plannedSteps > 0
        ? `${Math.max(0, movement - plannedSteps)} movement left`
        : turnGuidance?.title || 'Choose action';
  const pressureTone = pressureToneClass(departPressure?.band);
  const escapeCostTone = escapeCostToneClass(escapeCostPreview);

  const items = [
    {
      label: 'Chart',
      value: plannedSteps > 0 ? `${plannedSteps} step route` : 'Plan reveal',
      body: 'Reveal useful ground without losing the route.',
      tone: 'border-blueprint/35 bg-blueprint/5 text-blueprint',
    },
    {
      label: 'Depart Pressure',
      value: departPressure ? `${departPressure.pressure} / ${departPressure.band.label}` : riskLabel,
      body: departPressure?.band?.copy || 'Pressure rises when the crew overextends.',
      tone: routeStatus?.isValid === false || movement <= 0
        ? 'border-signal-red/35 bg-signal-red/5 text-signal-red'
        : pressureTone,
    },
    {
      label: 'Depart',
      value: escapeCostPreview?.headline || departLabel,
      body: escapeCostPreview?.nextDelayWarning || departPressure?.readiness?.body || 'Recover value before the run counts.',
      tone: escapeCostPreview ? escapeCostTone : departPressure?.readiness?.canFlee
        ? 'border-oxide-green/35 bg-oxide-green/5 text-oxide-green'
        : 'border-exp-border bg-exp-dark/35 text-exp-text-dim',
    },
  ];

  return (
    <div className="grid gap-2 md:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className={`rounded border px-3 py-2 ${item.tone}`}>
          <p className="font-mono text-[10px] uppercase tracking-[0.26em] opacity-75">
            {item.label}
          </p>
          <p className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-exp-text">
            {item.value}
          </p>
          <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">
            {item.body}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function ExpeditionBench() {
  const view = useExpedition();
  const [focusedPlayerID, setFocusedPlayerID] = useState(null);
  const [showDebug, setShowDebug] = useState(false);
  const [boardInput, setBoardInput] = useState({ inputMode: 'mouse', inputCadence: 'idle', lastInputKind: 'idle' });
  const [traitPreview, setTraitPreview] = useState(null);
  const { preferences } = useUserPreferences();
  const { zoneAlias: landingSite } = useLandingSite(view.gameId);
  const debugEnabled = import.meta.env.DEV
    || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug'));

  const {
    address,
    phase,
    playerID,
    enrichedPlayers,
    readinessByPlayerID,
    isSpectator,
    currentPlayerIndex,
    stats,
    location,
    action,
    movement,
    activeInventory,
    events,
    loadFullHistory,
    isLoadingFullHistory,
    queueTelemetry,
    activeTab,
    setActiveTab,
    movePath,
    applyMoveStep,
    clearMovePath,
    backtrackMovePath,
    moveValidation,
    turnState,
  } = view;

  const queueLabel = queueTelemetry.hasActiveQueue
    ? `Queue #${queueTelemetry.queueID ?? 0} active`
    : 'Queue idle';
  const queueDetail = queueTelemetry.hasActiveQueue
    ? 'Submissions resolve through the live queue.'
    : 'Waiting for the expedition to create a queue.';

  const focusedPlayer = useMemo(
    () => enrichedPlayers.find((player) => player.playerID === focusedPlayerID),
    [enrichedPlayers, focusedPlayerID],
  );
  const intentAlias = movePath[movePath.length - 1] || location;
  const intentNeighbors = useMemo(() => {
    const coord = parseAlias(intentAlias);
    return new Set(coord ? getAdjacent(coord.col, coord.row) : []);
  }, [intentAlias]);
  const companionLocations = useMemo(
    () => enrichedPlayers
      .map((player, index) => ({ player, index }))
      .filter(({ player, index }) => index !== currentPlayerIndex && player.currentZone)
      .map(({ player, index }) => ({
        zone: player.currentZone,
        index,
        isNearIntent: player.currentZone === intentAlias || intentNeighbors.has(player.currentZone),
      })),
    [currentPlayerIndex, enrichedPlayers, intentAlias, intentNeighbors],
  );
  const routeStatus = useMemo(
    () => buildRouteStatus({
      currentLocation: location,
      path: movePath,
      movement,
      validation: moveValidation,
      activeInventory,
      companionLocations,
    }),
    [activeInventory, companionLocations, location, movePath, moveValidation, movement],
  );
  const departPressure = useMemo(
    () => deriveDepartPressure({
      phase,
      stats,
      location,
      landingSite,
      activeInventory,
      routeStatus,
      movePath,
      turnState,
      events,
      crew: enrichedPlayers,
      tileTraitEffects: traitPreview?.effect,
    }),
    [activeInventory, enrichedPlayers, events, landingSite, location, movePath, phase, routeStatus, stats, traitPreview, turnState],
  );
  const escapeCostPreview = useMemo(
    () => deriveEscapeCostPreview({
      departPressure,
      players: enrichedPlayers,
      activeInventory,
      location,
      landingSite,
      routeStatus,
      movePath,
      stats,
      turnState,
      movement,
      activeTab,
      tileTraitEffects: traitPreview?.effect,
      tileTrait: traitPreview?.trait,
    }),
    [activeInventory, activeTab, departPressure, enrichedPlayers, landingSite, location, movePath, movement, routeStatus, stats, traitPreview, turnState],
  );
  const revealedCount = useMemo(() => {
    const aliases = new Set();
    events.forEach((event) => {
      const zone = event.args?.zoneAlias || event.args?.currentZone || event.args?.zone;
      if (zone) aliases.add(String(zone));
    });
    if (location) aliases.add(location);
    if (landingSite) aliases.add(landingSite);
    movePath.forEach((alias) => aliases.add(alias));
    return aliases.size;
  }, [events, landingSite, location, movePath]);
  const expeditionArc = useMemo(
    () => deriveExpeditionArc({
      departPressure,
      escapeCostPreview,
      traitPreview,
      revealedCount,
      crew: enrichedPlayers,
      visibleOpportunity: Boolean(traitPreview?.trait && ['value', 'reveal'].includes(traitPreview.trait.category)),
    }),
    [departPressure, enrichedPlayers, escapeCostPreview, revealedCount, traitPreview],
  );
  const hasSubmitted = action && action !== '' && action !== 'Idle';
  const turnGuidance = useMemo(
    () => getTurnGuidance({
      isConnected: Boolean(address),
      isSpectator,
      hasSubmitted,
      turnState,
      routeStatus,
      movePath,
      readinessByPlayerID,
      playerID,
      departPressure,
      escapeCostPreview,
      expeditionArc,
    }),
    [address, departPressure, escapeCostPreview, expeditionArc, hasSubmitted, isSpectator, movePath, playerID, readinessByPlayerID, routeStatus, turnState],
  );
  const suggestion = useMemo(
    () => getBestActionSuggestion({
      activeTab,
      isSpectator,
      hasSubmitted,
      movement,
      movePath,
      routeStatus,
      activeInventory,
      turnState,
      departPressure,
      escapeCostPreview,
      expeditionArc,
    }),
    [activeInventory, activeTab, departPressure, escapeCostPreview, expeditionArc, hasSubmitted, isSpectator, movePath, movement, routeStatus, turnState],
  );
  const funTelemetry = useMemo(
    () => buildFunTelemetry({
      activeTab,
      hasSubmitted,
      isSpectator,
      movement,
      movePath,
      routeStatus,
      stats,
      activeInventory,
      turnState,
      boardInput,
      events,
      location,
      phase,
      queueTelemetry,
      readinessByPlayerID,
      playerID,
      traitPreview,
      expeditionArc,
    }),
    [
      activeInventory,
      activeTab,
      boardInput,
      events,
      hasSubmitted,
      isSpectator,
      location,
      movePath,
      movement,
      phase,
      playerID,
      queueTelemetry,
      readinessByPlayerID,
      routeStatus,
      stats,
      turnState,
      traitPreview,
      expeditionArc,
    ],
  );
  const interfaceDensity = useInterfaceDensity({
    turnState,
    routeStatus,
    movePath,
    boardInput,
    funTelemetry,
    hasSubmitted,
    isSpectator,
    preferences,
  });
  const musicDirectorState = useMemo(
    () => trackForExpeditionState({
      activeTab,
      funTelemetry,
      hasSubmitted,
      isSpectator,
      movePath,
      routeStatus,
      turnState,
    }),
    [activeTab, funTelemetry, hasSubmitted, isSpectator, movePath, routeStatus, turnState],
  );

  useEffect(() => {
    emitMusicDirectorState(musicDirectorState);
  }, [musicDirectorState]);

  return (
    <div className={`space-y-5 ${interfaceDensity.className}`} data-density={interfaceDensity.level}>
      <div className="rounded border border-exp-border bg-exp-panel/70 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <DayNightBadge phase={phase} />
          <PhaseIndicator currentPhase={queueTelemetry.phase} />
          <DayCounter gameId={view.gameId} />
          <span className="rounded border border-exp-border/60 bg-exp-dark/30 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-exp-text-dim">
            {queueLabel}
          </span>
          <span className="rounded border border-exp-border/60 bg-exp-dark/30 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-exp-text-dim">
            {enrichedPlayers.length} aboard
          </span>
          {debugEnabled && (
            <button
              type="button"
              onClick={() => setShowDebug((value) => !value)}
              className="rounded border border-exp-border/70 bg-exp-dark/35 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-exp-text-dim transition-colors hover:border-compass/50 hover:text-compass"
            >
              Debug
            </button>
          )}
          <ShareGameLink />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.55fr)] 2xl:grid-cols-[minmax(0,980px)_minmax(320px,0.42fr)]">
        <div className="min-w-0 border border-exp-border rounded bg-exp-panel p-2 sm:p-4 min-h-[420px] sm:min-h-[620px] overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3 border-b border-exp-border/50 pb-2">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-exp-text-dim">
                Chart board
              </p>
              <p className="mt-1 max-w-xl font-mono text-xs leading-relaxed text-exp-text-dim">
                {turnGuidance.body || queueDetail}
              </p>
            </div>
            {location && (
              <div className="flex flex-wrap items-center gap-2 rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-exp-text-dim">
                    Current location
                  </p>
                  <p className="mt-1 font-mono text-xs uppercase tracking-widest text-compass-bright">
                    {location}
                  </p>
                </div>
                {movePath.length > 0 && (
                  <button
                    type="button"
                    onClick={backtrackMovePath}
                    className="alive-cancel-button rounded border border-blueprint/35 bg-blueprint/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-blueprint hover:border-blueprint/60"
                  >
                    Undo
                  </button>
                )}
              </div>
            )}
          </div>
          <ErrorBoundary>
            <HexGrid
              gameId={view.gameId}
              selectedPath={movePath}
              onTileClick={activeTab === Action.MOVE ? applyMoveStep : undefined}
              onBacktrack={backtrackMovePath}
              currentPlayerIndex={currentPlayerIndex}
              currentLocation={location}
              movement={movement}
              isMovePlanning={activeTab === Action.MOVE && !isSpectator}
              activeAction={activeTab}
              currentAction={action}
              queuePhase={queueTelemetry.phase}
              isSpectator={isSpectator}
              stats={stats}
              activeInventory={activeInventory}
              turnState={turnState}
              funTelemetry={funTelemetry}
              interfaceDensity={interfaceDensity}
              focusedPlayerID={focusedPlayerID}
              onPlayerFocus={setFocusedPlayerID}
              onInputSnapshot={setBoardInput}
              departPressure={departPressure}
              onTraitPreview={setTraitPreview}
            />
          </ErrorBoundary>
        </div>

        <div className="min-w-0 space-y-3 max-h-[320px] lg:max-h-[min(620px,calc(100svh-11rem))] overflow-y-auto pr-1">
          <h3 className="font-mono text-xs tracking-[0.24em] text-exp-text-dim uppercase sticky top-0 bg-exp-dark py-2">
            Expedition Crew
          </h3>
          {enrichedPlayers.length === 0 && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded border border-exp-border bg-exp-panel p-3">
                  <div className="h-3 w-28 animate-pulse rounded bg-exp-border/70" />
                  <div className="mt-3 grid gap-2">
                    <div className="h-2 animate-pulse rounded bg-exp-border/50" />
                    <div className="h-2 animate-pulse rounded bg-exp-border/40" />
                    <div className="h-2 animate-pulse rounded bg-exp-border/30" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {enrichedPlayers.map((player, i) => (
            <PlayerDossier
              key={i}
              player={player}
              index={i}
              isCurrentUser={player.playerAddress?.toLowerCase() === address?.toLowerCase()}
              isFocused={focusedPlayerID === player.playerID}
              isNearIntent={player.currentZone === intentAlias || intentNeighbors.has(player.currentZone)}
              onFocus={() => setFocusedPlayerID(player.playerID)}
            />
          ))}
        </div>
      </div>

      <details className="group rounded border border-exp-border/70 bg-exp-panel/45 px-4 py-3" open={interfaceDensity.details.turnBriefingOpen}>
        <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-mono text-xs tracking-[0.24em] text-exp-text-dim uppercase">
              Turn briefing
            </h3>
            <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">
              Mission state, suggestions, readiness, and mood details.
            </p>
          </div>
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-compass-bright border border-compass/30 rounded px-2 py-1 bg-compass/5">
            Details
          </span>
        </summary>
      <div className="mt-4 grid gap-3 xl:grid-cols-2">
          <MissionStatus
            turnState={turnState}
            movePathLength={movePath.length}
            moveValidation={moveValidation}
            crewCount={enrichedPlayers.length}
            departPressure={departPressure}
            escapeCostPreview={escapeCostPreview}
          />
          <ExpeditionArcTrack arc={expeditionArc} />
          <ChartDepartStrip
            movement={movement}
            movePath={movePath}
            routeStatus={routeStatus}
            turnGuidance={turnGuidance}
            departPressure={departPressure}
            escapeCostPreview={escapeCostPreview}
            expeditionArc={expeditionArc}
          />
          <GuidedFirstTurn
            isSpectator={isSpectator}
            hasSubmitted={hasSubmitted}
            movePathLength={movePath.length}
            turnState={turnState}
            departPressure={departPressure}
            escapeCostPreview={escapeCostPreview}
            expeditionArc={expeditionArc}
          />
          <EscapeCostPreview preview={escapeCostPreview} compact />
          <TraitPreviewPanel preview={traitPreview} compact />
          <CostReductionActions
            preview={escapeCostPreview}
            compact
            activeAction={activeTab}
            onAction={setActiveTab}
          />
          <UXStatusPanel
            guidance={turnGuidance}
            suggestion={suggestion}
            onSuggestion={() => suggestion.action && setActiveTab(suggestion.action)}
          />
          <FunStatusPanel telemetry={funTelemetry} />
          <div className="xl:col-span-2">
            <TurnReadinessStrip
              players={enrichedPlayers}
              readinessByPlayerID={readinessByPlayerID}
              currentPlayerIndex={currentPlayerIndex}
              turnState={turnState}
            />
          </div>
        </div>
      </details>

      <UserPreferencesPanel />

      {preferences.showTelemetry && (
      <details className="group rounded border border-exp-border bg-exp-panel/70 px-4 py-3">
        <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
          <div>
            <h3 className="font-mono text-xs tracking-[0.3em] text-exp-text-dim uppercase">
              Mission telemetry
            </h3>
            <p className="mt-1 font-mono text-[11px] text-exp-text-dim">
              Queue phase, submission readiness, and turn history.
            </p>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-compass-bright border border-compass/30 rounded px-2 py-1 bg-compass/5">
            Details
          </span>
        </summary>
        <div className="mt-3 space-y-3">
          <TurnTimeline queueTelemetry={queueTelemetry} events={events} />
          <ReadinessMatrix
            players={enrichedPlayers}
            readinessByPlayerID={readinessByPlayerID}
            queueActive={queueTelemetry.hasActiveQueue}
          />
        </div>
      </details>
      )}

      {isSpectator && <SpectatorBanner />}

      {!isSpectator && (
        <ErrorBoundary>
          <ActionPanel
            gameId={view.gameId}
            playerID={playerID}
            currentLocation={location}
            stats={stats}
            currentAction={action}
            movement={movement}
            movePath={movePath}
            onMoveSubmit={clearMovePath}
            onMoveClear={clearMovePath}
            onMoveBacktrack={backtrackMovePath}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            isSpectator={isSpectator}
            moveValidation={moveValidation}
            routeStatus={routeStatus}
            boardInput={boardInput}
            turnState={turnState}
            funTelemetry={funTelemetry}
            interfaceDensity={interfaceDensity}
            departPressure={departPressure}
            escapeCostPreview={escapeCostPreview}
            traitPreview={traitPreview}
            expeditionArc={expeditionArc}
          />
        </ErrorBoundary>
      )}

      {focusedPlayer && (
        <div className="rounded border border-blueprint/30 bg-blueprint/5 px-4 py-2 font-mono text-xs text-blueprint">
          Roster focus linked to board: P{focusedPlayer.playerID} at {focusedPlayer.currentZone || 'unknown'}.
        </div>
      )}

      <ErrorBoundary>
        <TurnResolution
          gameId={view.gameId}
          events={events}
          turnState={turnState}
          turnReplay={view.turnReplay}
          departPressure={departPressure}
          escapeCostPreview={escapeCostPreview}
          traitPreview={traitPreview}
          expeditionArc={expeditionArc}
        />
      </ErrorBoundary>
      <DiscoveryJournal entries={funTelemetry.journalEntries} />

      <details className="group rounded border border-exp-border bg-exp-panel/70 px-4 py-3">
        <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
          <div>
            <h3 className="font-mono text-xs tracking-[0.3em] text-exp-text-dim uppercase">
              Expedition history
            </h3>
            <p className="mt-1 font-mono text-[11px] text-exp-text-dim">
              Full replay and event log for the current run.
            </p>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-compass-bright border border-compass/30 rounded px-2 py-1 bg-compass/5">
            Details
          </span>
        </summary>
        <div className="mt-3 space-y-3">
          <MatchReplay
            events={events}
            onLoadFullHistory={loadFullHistory}
            isLoadingFullHistory={isLoadingFullHistory}
          />
          <EventLog events={events} address={address} />
        </div>
      </details>

      {debugEnabled && showDebug && <ExpeditionDebugOverlay view={view} />}
    </div>
  );
}
