import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FUTURE_RELIC_SIGNALS, GUEST_ABILITY_ART, GUEST_ENCOUNTER_ART } from '../art-pipeline/finalArtCatalog';
import ThreeBoard from '../components/board/ThreeBoard';
import AftermathMoment from '../components/resolution/AftermathMoment';
import DiscoveryJournal from '../components/expedition/DiscoveryJournal';
import ExpeditionMemoryPanel from '../components/memory/ExpeditionMemoryPanel';
import RunRelicSharePanel from '../components/memory/RunRelicSharePanel';
import { deriveBoardViewModel } from '../components/board/boardViewModel';
import { presentationDurationMs } from '../components/board/premiumPresentation';
import { useUserPreferences } from '../hooks/useUserPreferences';
import { emitFeedbackEvent } from '../lib/feedbackEvents';
import { emitMusicDirectorState } from '../lib/musicDirector';
import { deriveNextChallenge } from '../lib/expeditionChallenges';
import { recordExpeditionMemory } from '../lib/expeditionMemory';
import { memoryFromGuestExpedition } from '../lib/guestExpeditionMemory';
import { ARC_ORDER, ARC_DEFINITIONS } from '../lib/expeditionArc';
import {
  GUEST_CREW_ABILITIES,
  GUEST_TERRAIN,
  canDepartGuestExpedition,
  canUseGuestCrewAbility,
  clearGuestExpedition,
  commitGuestMove,
  createGuestExpedition,
  departGuestExpedition,
  emergencyExtractGuestExpedition,
  guestBoardInput,
  guestCrewBark,
  guestDistanceToLanding,
  guestEmotionalBeat,
  guestExpeditionArc,
  guestLocationProfile,
  guestOutcome,
  guestPendingEncounter,
  guestReachableAliases,
  guestRouteForecast,
  guestRouteRecommendation,
  guestTerrainLabel,
  loadGuestExpedition,
  resolveGuestEncounter,
  saveGuestExpedition,
  selectGuestTile,
  useGuestCrewAbility,
} from '../lib/guestExpedition';

function StatCard({ label, value, detail, tone = 'text-exp-text' }) {
  return (
    <div className="rounded border border-exp-border bg-exp-dark/45 p-3">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-exp-text-dim">{label}</p>
      <p className={`mt-1 font-display text-xl uppercase tracking-[0.1em] ${tone}`}>{value}</p>
      <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">{detail}</p>
    </div>
  );
}

function GuestArcRail({ arc }) {
  const currentIndex = ARC_ORDER.indexOf(arc.id);
  return (
    <div className="rounded border border-exp-border/75 bg-exp-dark/50 px-3 py-3" aria-label={`Expedition chapter: ${arc.label}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-exp-text-dim">Expedition arc</p>
          <p className="mt-1 font-display text-base uppercase tracking-[0.12em] text-compass-bright">{arc.label}</p>
        </div>
        <p className="max-w-[13rem] text-right font-mono text-[10px] leading-relaxed text-exp-text-dim">{arc.playerQuestion}</p>
      </div>
      <div className="mt-3 grid grid-cols-5 gap-1" role="list" aria-label="Expedition chapters">
        {ARC_ORDER.map((id, index) => (
          <div key={id} role="listitem" aria-current={id === arc.id ? 'step' : undefined} className={`rounded border px-1 py-1.5 text-center font-mono text-[9px] uppercase tracking-[0.08em] ${id === arc.id ? 'border-compass bg-compass/15 text-compass-bright' : index < currentIndex ? 'border-oxide-green/30 bg-oxide-green/5 text-oxide-green' : 'border-exp-border/50 text-exp-text-dim'}`}>
            {ARC_DEFINITIONS[id].shortLabel}
          </div>
        ))}
      </div>
    </div>
  );
}

function EncounterDecision({ encounter, isResolving, onChoose }) {
  if (!encounter) return null;
  const artwork = GUEST_ENCOUNTER_ART[encounter.id];
  return (
    <section
      className="guest-encounter rounded border border-compass/55 bg-[rgba(20,24,17,0.96)] bg-cover bg-center p-4"
      aria-labelledby="guest-encounter-title"
      data-encounter-art={encounter.id}
      style={artwork ? { backgroundImage: `linear-gradient(90deg, rgba(14,18,12,0.98) 0%, rgba(14,18,12,0.92) 54%, rgba(14,18,12,0.32) 100%), url('${artwork}')` } : undefined}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-compass">Landmark decision / {encounter.speaker}</p>
      <h2 id="guest-encounter-title" className="mt-2 font-display text-xl uppercase tracking-[0.1em] text-exp-text">{encounter.title}</h2>
      <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text-dim">{encounter.prompt}</p>
      <div className="mt-4 grid gap-2">
        {encounter.choices.map((choice) => (
          <button key={choice.id} type="button" disabled={isResolving} onClick={() => onChoose(choice.id)} className="min-h-14 rounded border border-exp-border bg-exp-dark/55 px-3 py-3 text-left transition hover:border-compass/65 hover:bg-compass/10 disabled:cursor-wait disabled:opacity-55">
            <span className="block font-display text-sm uppercase tracking-[0.12em] text-compass-bright">{choice.label}</span>
            <span className="mt-1 block font-mono text-[10px] leading-relaxed text-exp-text-dim">{choice.detail}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function RouteDecision({
  canDepart,
  expedition,
  isResolving,
  onCommit,
  onDepart,
  onSelect,
  reachableAliases,
  recommendation,
  selectedLocation,
}) {
  return (
    <section className="rounded-lg border border-compass/45 bg-[linear-gradient(145deg,rgba(51,91,79,0.18),rgba(13,16,12,0.96))] p-4 shadow-[0_14px_36px_rgba(0,0,0,0.24)]" data-testid="guest-command-deck">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-compass">Your next decision</p>
          <h2 className="mt-1 font-display text-lg uppercase tracking-[0.1em] text-exp-text">Choose the crossing</h2>
        </div>
        <span className="rounded border border-exp-border/70 bg-exp-dark/55 px-2 py-1 font-mono text-xs text-exp-text-dim">Turn {expedition.turns + 1}</span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-exp-text-dim">Select a neighboring place, compare its cost, then commit. The highlighted route is guidance - the choice is yours.</p>
      <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="Reachable routes">
        {reachableAliases.map((alias) => {
          const profile = guestLocationProfile(alias);
          const forecast = guestRouteForecast(expedition, alias);
          const selected = expedition.selectedAlias === alias;
          return (
            <button
              key={alias}
              type="button"
              data-route-alias={alias}
              disabled={isResolving}
              onClick={() => onSelect(alias)}
              aria-pressed={selected}
              className={`min-h-16 rounded-md border px-3 py-2 text-left transition ${selected ? 'border-blueprint bg-blueprint/15 text-blueprint shadow-[0_0_22px_rgba(76,145,219,0.14)]' : recommendation?.alias === alias ? 'border-compass/60 bg-compass/10 text-compass-bright' : 'border-exp-border bg-exp-dark/45 text-exp-text hover:border-blueprint/50'}`}
            >
              <span className="block font-display text-sm uppercase tracking-[0.06em]">{profile?.name || alias}</span>
              <span className="mt-1 flex items-center justify-between gap-2 text-xs text-exp-text-dim"><span>{guestTerrainLabel(alias, expedition)}</span><span>{forecast ? `+${forecast.pressure}%` : ''}</span></span>
              {recommendation?.alias === alias && <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.08em] text-compass-bright">Recommended</span>}
            </button>
          );
        })}
      </div>
      <div className="sticky bottom-2 z-20 mt-3 rounded-md bg-exp-dark/90 p-1 backdrop-blur sm:static sm:bg-transparent sm:p-0">
        <button
          type="button"
          data-testid="commit-guest-route"
          onClick={onCommit}
          disabled={!expedition.selectedAlias || isResolving}
          className="min-h-12 w-full rounded-md border border-compass bg-compass px-4 py-3 font-display text-sm font-semibold uppercase tracking-[0.12em] text-exp-dark transition hover:bg-compass-bright disabled:cursor-not-allowed disabled:border-exp-border disabled:bg-exp-dark disabled:text-exp-text-dim"
        >
          {isResolving ? 'World resolving...' : expedition.selectedAlias ? `Commit to ${selectedLocation?.name || expedition.selectedAlias}` : 'Select a neighboring place'}
        </button>
        {canDepart && (
          <button type="button" onClick={onDepart} className="mt-2 min-h-11 w-full rounded border border-oxide-green/55 bg-oxide-green/10 px-4 py-2 font-display text-sm uppercase tracking-[0.12em] text-oxide-green hover:bg-oxide-green/20">
            {expedition.relics ? `Depart with ${expedition.relics} relic${expedition.relics === 1 ? '' : 's'}` : 'Depart with the completed map'}
          </button>
        )}
      </div>
    </section>
  );
}

function GuestTacticalBoard({ expedition, reachableAliases, recommendation, onSelect }) {
  const revealed = new Set(expedition.revealedAliases);
  return (
    <div className="absolute inset-0 overflow-auto bg-[radial-gradient(circle_at_center,rgba(76,145,219,0.08),transparent_55%),#0d0f0a] p-4 sm:p-8" data-testid="guest-tactical-board">
      <div className="mx-auto grid min-h-full max-w-3xl grid-cols-5 grid-rows-4 gap-2" role="group" aria-label="Tactical guest expedition map">
        {GUEST_TERRAIN.map((cell) => {
          const [column, row] = cell.alias.split(',').map(Number);
          const canSelect = reachableAliases.includes(cell.alias);
          const isCurrent = expedition.currentLocation === cell.alias;
          const isSelected = expedition.selectedAlias === cell.alias;
          const isRecommended = recommendation?.alias === cell.alias;
          const location = guestLocationProfile(cell.alias);
          return (
            <button
              key={cell.alias}
              type="button"
              disabled={!canSelect}
              onClick={() => onSelect(cell.alias)}
              aria-label={`${location?.name || cell.alias}, ${revealed.has(cell.alias) ? guestTerrainLabel(cell.alias, expedition) : 'Uncharted'}${isCurrent ? ', current position' : ''}${isRecommended ? ', recommended route' : ''}`}
              aria-pressed={isSelected}
              style={{ gridColumn: column + 1, gridRow: row + 1, transform: column % 2 ? 'translateY(1.25rem)' : undefined }}
              className={`relative min-h-20 rounded-lg border p-2 font-mono text-[11px] transition-colors ${isCurrent ? 'border-oxide-green bg-oxide-green/15 text-oxide-green' : isSelected ? 'border-blueprint bg-blueprint/20 text-blueprint' : isRecommended ? 'border-compass bg-compass/10 text-compass-bright' : revealed.has(cell.alias) ? 'border-exp-border bg-exp-panel text-exp-text' : 'border-exp-border/70 bg-exp-dark/70 text-exp-text-dim'} disabled:cursor-default disabled:opacity-75`}
            >
              <span className="block text-xs">{isCurrent ? 'YOU' : cell.alias}</span>
              <span className="mt-1 block normal-case leading-tight tracking-normal">{revealed.has(cell.alias) ? location?.name || guestTerrainLabel(cell.alias, expedition) : 'Fog'}</span>
              {isRecommended && <span className="mt-1 block text-[10px] uppercase text-compass-bright">Recommended</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function GuestExpeditionPage() {
  const [searchParams] = useSearchParams();
  const { preferences, setPreference } = useUserPreferences();
  const [expedition, setExpedition] = useState(loadGuestExpedition);
  const [isResolving, setIsResolving] = useState(false);
  const [rendererState, setRendererState] = useState('building');
  const [focusMode, setFocusMode] = useState(false);
  const [memoryState, setMemoryState] = useState(null);
  const resolveTimer = useRef(null);
  const awaitingWorld = useRef(false);
  const recordedMemoryId = useRef(null);

  useEffect(() => {
    saveGuestExpedition(expedition);
  }, [expedition]);

  useEffect(() => () => {
    if (resolveTimer.current) window.clearTimeout(resolveTimer.current);
  }, []);

  useEffect(() => {
    if (!focusMode) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setFocusMode(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [focusMode]);

  useEffect(() => {
    const director = expedition.status === 'complete'
      ? expedition.result === 'safe'
        ? { trackId: 'xenovoya-victory-extraction', state: 'Victory', reason: 'The guest expedition returned safely.' }
        : { trackId: 'xenovoya-defeat-lost', state: 'Recovery', reason: 'Emergency extraction protected the crew.' }
      : expedition.lastEvent === 'relic'
        ? { trackId: 'xenovoya-relic-discovery', state: 'Relic Discovery', reason: 'The Tideglass Cradle answered.' }
        : expedition.pressure >= 65
          ? { trackId: 'xenovoya-expedition-danger', state: 'Danger', reason: 'Storm pressure crossed the safe band.' }
          : { trackId: 'xenovoya-expedition-calm', state: 'Expedition Calm', reason: 'The crew is surveying the route.' };
    emitMusicDirectorState(director);
  }, [expedition.lastEvent, expedition.pressure, expedition.result, expedition.status]);

  const completedMemory = useMemo(() => memoryFromGuestExpedition(expedition), [expedition]);

  useEffect(() => {
    if (!completedMemory || recordedMemoryId.current === completedMemory.id) return;
    recordedMemoryId.current = completedMemory.id;
    setMemoryState(recordExpeditionMemory(completedMemory));
  }, [completedMemory]);

  const boardViewModel = useMemo(
    () => deriveBoardViewModel(guestBoardInput(expedition, { isResolving })),
    [expedition, isResolving],
  );
  const reachableAliases = guestReachableAliases(expedition);
  const distanceHome = guestDistanceToLanding(expedition);
  const canDepart = canDepartGuestExpedition(expedition);
  const recommendation = useMemo(() => guestRouteRecommendation(expedition), [expedition]);
  const emotionalBeat = useMemo(() => guestEmotionalBeat(expedition), [expedition]);
  const crewBark = useMemo(() => guestCrewBark(expedition), [expedition]);
  const currentLocation = useMemo(() => guestLocationProfile(expedition.currentLocation), [expedition.currentLocation]);
  const selectedLocation = useMemo(() => guestLocationProfile(expedition.selectedAlias), [expedition.selectedAlias]);
  const selectedForecast = useMemo(() => guestRouteForecast(expedition, expedition.selectedAlias), [expedition]);
  const pendingEncounter = useMemo(() => guestPendingEncounter(expedition), [expedition]);
  const expeditionArc = useMemo(() => guestExpeditionArc(expedition), [expedition]);
  const outcome = useMemo(() => guestOutcome(expedition), [expedition]);
  const nextChallenge = useMemo(
    () => (memoryState && completedMemory ? deriveNextChallenge(memoryState, completedMemory) : null),
    [completedMemory, memoryState],
  );
  const isPractice = searchParams.get('mode') === 'practice';
  const tacticalBoard = preferences.tacticalBoard || rendererState === 'unavailable';
  const pressureTone = expedition.pressure >= 65 ? 'text-signal-red' : expedition.pressure >= 40 ? 'text-compass-bright' : 'text-oxide-green';

  const commitRoute = () => {
    if (!expedition.selectedAlias || isResolving || expedition.status !== 'exploring') return;
    setIsResolving(true);
    resolveTimer.current = window.setTimeout(() => {
      setExpedition((current) => {
        const next = commitGuestMove(current);
        const soundCue = next.lastEvent === 'relic'
          ? 'board.relic.resonate'
          : next.lastEvent === 'danger'
            ? 'board.danger'
            : next.lastEvent === 'return'
              ? 'board.return'
              : 'board.discovery';
        emitFeedbackEvent({ source: 'guest-expedition', kind: 'board-beat', soundCue, motionCue: next.lastEvent });
        return next;
      });
      if (tacticalBoard) {
        setIsResolving(false);
        resolveTimer.current = null;
      } else {
        awaitingWorld.current = true;
        resolveTimer.current = window.setTimeout(() => {
          awaitingWorld.current = false;
          setIsResolving(false);
          resolveTimer.current = null;
        }, presentationDurationMs());
      }
    }, presentationDurationMs());
  };

  const worldReady = () => {
    setRendererState('ready');
    if (!awaitingWorld.current) return;
    awaitingWorld.current = false;
    if (resolveTimer.current) window.clearTimeout(resolveTimer.current);
    resolveTimer.current = window.setTimeout(() => {
      setIsResolving(false);
      resolveTimer.current = null;
    }, presentationDurationMs());
  };

  const restart = () => {
    if (resolveTimer.current) window.clearTimeout(resolveTimer.current);
    resolveTimer.current = null;
    awaitingWorld.current = false;
    setIsResolving(false);
    clearGuestExpedition();
    setExpedition(createGuestExpedition());
    setMemoryState(null);
    recordedMemoryId.current = null;
    setFocusMode(false);
  };

  const depart = () => {
    setExpedition((current) => departGuestExpedition(current));
    setFocusMode(false);
    emitFeedbackEvent({ source: 'guest-expedition', kind: 'board-beat', soundCue: 'board.escape.commit', motionCue: 'extraction' });
  };

  const emergencyExtract = () => {
    setExpedition((current) => emergencyExtractGuestExpedition(current));
    setFocusMode(false);
    emitFeedbackEvent({ source: 'guest-expedition', kind: 'board-beat', soundCue: 'board.emergency', motionCue: 'recovery' });
  };

  const chooseEncounter = (choiceId) => {
    setExpedition((current) => resolveGuestEncounter(current, choiceId));
    emitFeedbackEvent({ source: 'guest-expedition', kind: 'board-beat', soundCue: choiceId === 'anchor' || choiceId === 'mark' ? 'board.recovery' : 'board.discovery', motionCue: choiceId });
  };

  const useCrewAbility = (abilityId) => {
    setExpedition((current) => useGuestCrewAbility(current, abilityId));
    emitFeedbackEvent({ source: 'guest-expedition', kind: 'board-beat', soundCue: abilityId === 'anchor' ? 'board.recovery' : 'board.discovery', motionCue: abilityId });
  };

  return (
    <section data-testid="guest-expedition" data-focus-mode={focusMode ? 'active' : 'standard'} data-current-location={expedition.currentLocation} data-expedition-status={expedition.status} data-resolving={isResolving ? 'true' : 'false'} className={`player-readable mx-auto w-full max-w-[110rem] px-3 py-4 sm:px-5 sm:py-5 2xl:px-6 ${focusMode ? 'guest-focus-shell' : ''}`}>
      <div className={`overflow-hidden rounded-xl border border-exp-border bg-[radial-gradient(circle_at_72%_8%,rgba(76,145,219,0.12),transparent_30%),linear-gradient(180deg,rgba(25,31,21,0.96),rgba(10,14,10,0.98))] shadow-[0_24px_90px_rgba(0,0,0,0.35)] ${focusMode ? 'flex h-full flex-col' : ''}`}>
        <header className={`border-b border-exp-border px-4 sm:px-6 ${expedition.turns > 0 ? 'py-2.5' : 'py-4'} ${focusMode ? 'hidden' : ''}`}>
          {expedition.turns === 0 ? (
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-3xl">
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-blueprint">{isPractice ? 'Replayable training voyage' : 'Playable solo prologue'}</p>
                <h1 className="mt-2 font-display text-3xl uppercase tracking-[0.1em] text-exp-text sm:text-4xl">The Living Survey</h1>
                <p className="mt-2 font-mono text-sm leading-relaxed text-exp-text-dim">
                  Read the world, survive its landmark choices, recover a relic, and bring the whole story home.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 font-mono text-[11px] uppercase tracking-[0.14em]">
                <span className="rounded border border-blueprint/35 bg-blueprint/10 px-3 py-2 text-blueprint">Living 3D world</span>
                <span className="rounded border border-oxide-green/35 bg-oxide-green/10 px-3 py-2 text-oxide-green">Progress remembered</span>
                <span className="rounded border border-exp-border bg-exp-dark/50 px-3 py-2 text-exp-text-dim">Four crew abilities</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-baseline gap-3">
                <p className="font-display text-lg uppercase tracking-[0.12em] text-exp-text">The Living Survey</p>
                <p className="truncate font-mono text-[10px] uppercase tracking-[0.18em] text-blueprint">{currentLocation?.name} / {expeditionArc.label}</p>
              </div>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-exp-text-dim">Turn {expedition.turns} / {expedition.status === 'complete' ? 'Memory secured' : 'Route active'}</p>
            </div>
          )}
        </header>

        <div className={`grid gap-4 p-3 sm:p-4 xl:grid-cols-[minmax(0,2.2fr)_minmax(300px,0.62fr)] ${focusMode ? 'min-h-0 flex-1 xl:grid-cols-[minmax(0,1fr)_22rem]' : ''}`}>
          <div className={`min-w-0 ${focusMode ? 'min-h-0' : 'xl:sticky xl:top-20 xl:self-start'}`}>
            <div className={`relative overflow-hidden rounded-xl border border-exp-border bg-exp-dark ${focusMode ? 'h-full min-h-[28rem]' : 'h-[54svh] min-h-[25rem] max-h-[38rem] sm:h-[62svh] sm:min-h-[32rem] sm:max-h-[46rem] xl:h-[calc(100svh-9rem)] xl:min-h-[36rem] xl:max-h-[52rem]'}`}>
              {tacticalBoard ? (
                <GuestTacticalBoard expedition={expedition} reachableAliases={reachableAliases} recommendation={recommendation} onSelect={(alias) => setExpedition((current) => selectGuestTile(current, alias))} />
              ) : (
                <ThreeBoard
                  viewModel={boardViewModel}
                  onTileClick={(alias) => setExpedition((current) => selectGuestTile(current, alias))}
                  onTileHover={() => {}}
                  onReady={worldReady}
                  onUnavailable={() => setRendererState('unavailable')}
                  onBeat={(beat) => emitFeedbackEvent({ source: 'guest-board', kind: 'board-beat', beatId: beat.id, soundCue: beat.soundCue, motionCue: beat.motionCue })}
                  ariaLabel="Interactive 3D guest expedition board"
                />
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 font-mono text-[11px] uppercase tracking-[0.12em] text-exp-text-dim">
              <span>{tacticalBoard ? rendererState === 'unavailable' ? 'Tactical fallback - 3D unavailable' : 'Tactical map ready' : rendererState === 'ready' ? 'World ready' : 'Building terrain'}</span>
              <button type="button" onClick={() => { setRendererState('building'); setPreference('tacticalBoard', !tacticalBoard); }} className="min-h-11 rounded border border-exp-border bg-exp-dark/70 px-3 py-2 text-exp-text hover:border-blueprint/50">{tacticalBoard ? 'Try 3D diorama' : 'Use tactical map'}</button>
              <button type="button" aria-pressed={focusMode} onClick={() => setFocusMode((active) => !active)} className="hidden min-h-11 rounded border border-compass/35 bg-compass/10 px-3 py-2 text-compass-bright hover:border-compass sm:inline-flex sm:items-center">{focusMode ? 'Exit focus' : 'Focus world'}</button>
              {!tacticalBoard && <span>Drag to orbit / right-drag to pan / scroll to zoom</span>}
            </div>
          </div>

          <aside className="space-y-4 xl:max-h-[calc(100svh-9rem)] xl:overflow-y-auto xl:pr-1" aria-label="Guest expedition controls">
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Pressure" value={`${expedition.pressure}%`} detail="Redline at 100" tone={pressureTone} />
              <StatCard label="Supplies" value={expedition.supplies} detail="One used per move" tone={expedition.supplies <= 2 ? 'text-signal-red' : 'text-exp-text'} />
              <StatCard label="Relics" value={expedition.relics} detail="Carry them home" tone="text-relic-bright" />
              <StatCard label="Route home" value={distanceHome === 0 ? 'Here' : `${distanceHome} step${distanceHome === 1 ? '' : 's'}`} detail={`Turn ${expedition.turns}`} tone={distanceHome === 0 ? 'text-oxide-green' : 'text-compass-bright'} />
            </div>

            {pendingEncounter && <EncounterDecision encounter={pendingEncounter} isResolving={isResolving} onChoose={chooseEncounter} />}

            {expedition.status === 'exploring' && !pendingEncounter && (
              <RouteDecision
                canDepart={canDepart}
                expedition={expedition}
                isResolving={isResolving}
                onCommit={commitRoute}
                onDepart={depart}
                onSelect={(alias) => setExpedition((current) => selectGuestTile(current, alias))}
                reachableAliases={reachableAliases}
                recommendation={recommendation}
                selectedLocation={selectedLocation}
              />
            )}

            {expedition.status !== 'complete' && <GuestArcRail arc={expeditionArc} />}

            {currentLocation && expedition.status !== 'complete' && (
              <div className="rounded border border-exp-border/75 bg-[linear-gradient(135deg,rgba(76,145,219,0.08),rgba(13,16,12,0.72))] px-4 py-3" data-testid="guest-location-identity">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-blueprint">Current location / {currentLocation.terrain}</p>
                    <h2 className="mt-1 font-display text-lg uppercase tracking-[0.12em] text-exp-text">{currentLocation.name}</h2>
                  </div>
                  <span className="rounded border border-exp-border/60 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-exp-text-dim">{expedition.visitedAliases.length}/{GUEST_TERRAIN.length} charted</span>
                </div>
                <p className="mt-2 font-mono text-[11px] leading-relaxed text-exp-text-dim">{currentLocation.motif}</p>
              </div>
            )}

            {selectedLocation && selectedForecast && (
              <div className="rounded border border-compass/35 bg-compass/5 px-4 py-3" data-testid="guest-route-forecast">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-compass">Route forecast</p>
                    <p className="mt-1 font-display text-base uppercase tracking-[0.1em] text-exp-text">{selectedLocation.name}</p>
                  </div>
                  <span className={`rounded border px-2 py-1 font-mono text-[10px] uppercase ${selectedForecast.projectedPressure >= 65 ? 'border-signal-red/45 text-signal-red' : 'border-compass/35 text-compass-bright'}`}>+{selectedForecast.pressure} pressure</span>
                </div>
                <p className="mt-2 font-mono text-[11px] leading-relaxed text-exp-text-dim">{selectedLocation.omen}</p>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-exp-text-dim">1 supply / {selectedForecast.warning}{selectedForecast.encounter ? ' / landmark decision' : ''}</p>
              </div>
            )}

            {!pendingEncounter && expedition.status !== 'complete' && (emotionalBeat ? (
              <div key={emotionalBeat.id} className="guest-emotional-beat" data-guest-beat={emotionalBeat.category} aria-live="polite">
                <AftermathMoment moment={emotionalBeat} />
              </div>
            ) : (
              <div className="rounded border border-blueprint/40 bg-blueprint/5 p-4" role="status" aria-live="polite">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-blueprint">First signal</p>
                <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text">{expedition.message}</p>
                {recommendation && <p className="mt-2 font-mono text-[11px] leading-relaxed text-exp-text-dim"><span className="text-blueprint">Recommended {recommendation.alias}:</span> {recommendation.reason}</p>}
              </div>
            ))}

            <div className="rounded border border-exp-border/75 bg-exp-dark/50 px-4 py-3" aria-live="polite" data-testid="guest-crew-bark">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-oxide-green">Field comms / {crewBark.speaker}</p>
              <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text">"{crewBark.line}"</p>
            </div>

            {expedition.status === 'exploring' && !pendingEncounter && (
              <div className="rounded border border-exp-border/75 bg-exp-panel/45 p-3" data-testid="guest-crew-abilities">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-exp-text-dim">Crew abilities</p>
                  <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-exp-text-dim">Once per voyage</span>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  {Object.values(GUEST_CREW_ABILITIES).map((ability) => {
                    const used = expedition.usedAbilities.includes(ability.id);
                    const available = canUseGuestCrewAbility(expedition, ability.id);
                    const artwork = GUEST_ABILITY_ART[ability.id];
                    return (
                      <button
                        key={ability.id}
                        type="button"
                        disabled={!available}
                        onClick={() => useCrewAbility(ability.id)}
                        className="min-h-20 rounded border border-exp-border bg-exp-dark/50 bg-cover bg-center px-3 py-2 text-left transition hover:border-blueprint/55 disabled:cursor-not-allowed disabled:opacity-45"
                        style={artwork ? { backgroundImage: `linear-gradient(90deg, rgba(8,12,9,0.97) 0%, rgba(8,12,9,0.88) 62%, rgba(8,12,9,0.28) 100%), url('${artwork}')` } : undefined}
                      >
                        <span className="block font-mono text-[9px] uppercase tracking-[0.16em] text-blueprint">{ability.speaker}{used ? ' / spent' : ''}</span>
                        <span className="mt-1 block font-display text-xs uppercase tracking-[0.1em] text-exp-text">{ability.label}</span>
                        <span className="mt-1 block font-mono text-[9px] leading-relaxed text-exp-text-dim">{ability.detail}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {expedition.status === 'redline' && (
              <button type="button" onClick={emergencyExtract} className="min-h-12 w-full rounded border border-signal-red bg-signal-red/15 px-4 py-3 font-display text-sm font-semibold uppercase tracking-[0.14em] text-signal-red hover:bg-signal-red/25">
                Call emergency extraction
              </button>
            )}

            {expedition.status === 'complete' && (
              <div className="rounded border border-oxide-green/35 bg-[radial-gradient(circle_at_top_right,rgba(64,160,128,0.14),transparent_46%),rgba(64,160,128,0.04)] p-4" data-testid="guest-outcome">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-oxide-green">Expedition record</p>
                    <p className="mt-1 font-display text-xl uppercase tracking-[0.12em] text-exp-text">{outcome?.title || (expedition.result === 'safe' ? 'Findings secured' : 'Crew recovered')}</p>
                  </div>
                  {outcome && <div className="text-right"><p className="font-display text-4xl leading-none text-compass-bright">{outcome.grade}</p><p className="font-mono text-[9px] uppercase tracking-[0.16em] text-exp-text-dim">{outcome.score} score</p></div>}
                </div>
                <p className="mt-3 font-mono text-xs leading-relaxed text-exp-text-dim">{outcome?.summary}</p>
                <p className="mt-2 font-mono text-[11px] leading-relaxed text-exp-text-dim">The route, discoveries, crew choices, and extraction cost are now part of your persistent expedition memory.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to="/?mode=join" className="inline-flex min-h-11 items-center rounded border border-compass/50 bg-compass/10 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-compass-bright">Find a live crew</Link>
                  <button type="button" onClick={restart} className="min-h-11 rounded border border-exp-border bg-exp-dark/45 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-exp-text">Explore another route</button>
                </div>
              </div>
            )}

            {expedition.status === 'complete' && (
              <section className="rounded border border-relic/30 bg-relic/5 p-3" aria-labelledby="future-relic-signals-title">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-relic" id="future-relic-signals-title">Signals beyond this survey</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {FUTURE_RELIC_SIGNALS.map((relic) => (
                    <article key={relic.id} className="rounded border border-exp-border/70 bg-exp-dark/65 p-2 text-center">
                      <img src={relic.image} alt={relic.name} loading="lazy" className="mx-auto h-20 w-20 object-contain drop-shadow-[0_8px_14px_rgba(0,0,0,0.8)]" />
                      <p className="mt-1 font-display text-xs uppercase tracking-[0.1em] text-exp-text">{relic.name}</p>
                      <p className="mt-1 font-mono text-[9px] leading-relaxed text-exp-text-dim">{relic.promise}</p>
                    </article>
                  ))}
                </div>
              </section>
            )}

            <details className="rounded border border-exp-border/70 bg-exp-dark/45 p-3" data-testid="guest-field-journal">
              <summary className="flex min-h-11 cursor-pointer items-center font-mono text-[10px] uppercase tracking-[0.2em] text-exp-text-dim">Open field journal / {expedition.journal.length} entries</summary>
              <div className="mt-3"><DiscoveryJournal entries={expedition.journal} /></div>
            </details>

            {expedition.status !== 'complete' && (
              <button type="button" onClick={restart} className="min-h-11 w-full rounded border border-exp-border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-exp-text-dim hover:border-compass/40 hover:text-exp-text">
                Restart local expedition
              </button>
            )}
          </aside>
        </div>

        <footer className={`grid gap-3 border-t border-exp-border px-4 py-5 font-mono text-xs leading-relaxed text-exp-text-dim sm:grid-cols-3 sm:px-6 ${focusMode ? 'hidden' : ''}`}>
          <p><span className="text-blueprint">Read:</span> reveal omens before committing to a route.</p>
          <p><span className="text-compass-bright">Choose:</span> spend pressure, supplies, and crew abilities deliberately.</p>
          <p><span className="text-oxide-green">Remember:</span> bring the route home as a scored expedition relic.</p>
        </footer>
      </div>

      {completedMemory && memoryState && !focusMode && (
        <div className="mt-4 grid gap-4 2xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]" data-testid="guest-memory-reward">
          <RunRelicSharePanel memory={completedMemory} challenge={nextChallenge} title="Living Survey Relic" />
          <ExpeditionMemoryPanel initialMemory={memoryState} latestMemory={completedMemory} compact title="Voyage Memory" />
        </div>
      )}
    </section>
  );
}
