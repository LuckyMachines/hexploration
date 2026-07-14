import { Link } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { useExpedition } from '../../contexts/ExpeditionContext';
import { truncateAddress } from '../../lib/formatting';
import { PLAYER_COLORS } from '../../lib/constants';
import { emitMusicDirectorState, trackForGameOverOutcome } from '../../lib/musicDirector';
import { deriveDepartPressure } from '../../lib/departPressure';
import { deriveEscapeCostPreview } from '../../lib/escapeCostPreview';
import { deriveExpeditionArc } from '../../lib/expeditionArc';
import { memoryFromGameOver, recordExpeditionMemory } from '../../lib/expeditionMemory';
import { deriveNextChallenge } from '../../lib/expeditionChallenges';
import { useLandingSite } from '../../hooks/useLandingSite';
import ExpeditionMemoryPanel from '../memory/ExpeditionMemoryPanel';
import RunRelicSharePanel from '../memory/RunRelicSharePanel';
import { trackJourneyEvent } from '../../lib/analytics';

export default function GameOver({ gameId }) {
  const { address } = useWallet();
  const expedition = useExpedition();
  const players = expedition.enrichedPlayers || [];
  const reportGameId = expedition.gameId || gameId;
  const { zoneAlias: landingSite } = useLandingSite(reportGameId);
  const replayProof = expedition.turnReplay?.proof || [];
  const latestReplayStep = expedition.turnReplay?.latest;
  const replayGroups = Object.entries(expedition.turnReplay?.grouped || {});
  const [copied, setCopied] = useState(false);
  const [memoryState, setMemoryState] = useState(null);
  const recordedMemoryRef = useRef(null);
  const survivorCount = useMemo(
    () => players.filter((player) => player.isActive).length,
    [players],
  );
  const lostCount = Math.max(players.length - survivorCount, 0);
  const outcomeTone = lostCount === 0 ? 'text-oxide-green' : survivorCount > 0 ? 'text-compass-bright' : 'text-signal-red';
  const reportUrl = typeof window !== 'undefined' ? window.location.href : '';
  const reportPath = typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : '';
  const finalPressure = useMemo(
    () => deriveDepartPressure({
      phase: expedition.phase,
      stats: expedition.stats,
      location: expedition.location,
      landingSite,
      activeInventory: expedition.activeInventory,
      events: expedition.events,
      crew: players,
      turnState: expedition.turnState,
    }),
    [expedition.activeInventory, expedition.events, expedition.location, expedition.phase, expedition.stats, expedition.turnState, landingSite, players],
  );
  const finalEscapeCost = useMemo(
    () => deriveEscapeCostPreview({
      departPressure: finalPressure,
      players,
      activeInventory: expedition.activeInventory,
      location: expedition.location,
      landingSite,
      routeStatus: {},
      movePath: [],
      stats: expedition.stats,
      turnState: expedition.turnState,
    }),
    [expedition.activeInventory, expedition.location, expedition.stats, expedition.turnState, finalPressure, landingSite, players],
  );
  const finalArc = useMemo(
    () => deriveExpeditionArc({
      departPressure: finalPressure,
      escapeCostPreview: finalEscapeCost,
      revealedCount: expedition.events?.length || 0,
      crew: players,
      visibleOpportunity: finalPressure.recoveredValue <= 0,
    }),
    [expedition.events, finalEscapeCost, finalPressure, players],
  );
  const chapterTransition = finalArc.id === 'final-call'
    ? 'Survey -> Greed Window -> Redline -> Final Call'
    : finalArc.id === 'redline'
      ? 'Survey -> Greed Window -> Redline'
      : finalArc.id === 'departure-window'
        ? 'Survey -> Greed Window -> Departure Window'
        : finalArc.id === 'greed-window'
          ? 'Survey -> Greed Window'
          : 'Survey';
  const completedMemory = useMemo(
    () => memoryFromGameOver({
      gameId: reportGameId,
      players,
      finalPressure,
      finalEscapeCost,
      finalArc,
      replayProof,
      reportPath,
      events: expedition.events,
    }),
    [expedition.events, finalArc, finalEscapeCost, finalPressure, players, replayProof, reportGameId, reportPath],
  );
  const completedChallenge = useMemo(
    () => deriveNextChallenge(memoryState || { entries: [completedMemory], badges: completedMemory.badges }, completedMemory),
    [completedMemory, memoryState],
  );

  useEffect(() => {
    emitMusicDirectorState(trackForGameOverOutcome({ lostCount, survivorCount }));
  }, [lostCount, survivorCount]);

  useEffect(() => {
    if (!completedMemory?.id || recordedMemoryRef.current === completedMemory.id) return;
    recordedMemoryRef.current = completedMemory.id;
    setMemoryState(recordExpeditionMemory(completedMemory));
  }, [completedMemory]);

  useEffect(() => {
    trackJourneyEvent('recap', {
      lifecycle: 'complete',
      outcome: lostCount === 0 ? 'crew_survived' : survivorCount > 0 ? 'partial_survival' : 'crew_lost',
    }, { dedupeKey: String(reportGameId) });
  }, [lostCount, reportGameId, survivorCount]);

  const copyReport = async () => {
    if (!navigator.clipboard || !reportUrl) return;
    await navigator.clipboard.writeText(reportUrl);
    trackJourneyEvent('share', { share_type: 'report_link' }, { dedupeKey: String(reportGameId) });
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="space-y-6">
      {/* Final Briefing Header */}
      <div className="border border-exp-border rounded bg-exp-panel overflow-hidden">
        <div className="bg-exp-dark border-b border-exp-border px-4 py-2 flex items-center justify-between">
          <span className="font-display text-xs tracking-[0.3em] text-exp-text-dim uppercase">
            Expedition Report
          </span>
          <span className="font-mono text-xs text-exp-text-dim">
            Expedition #{reportGameId}
          </span>
        </div>

        <div className="relative overflow-hidden p-8 text-center">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(196,166,74,0.08) 0%, transparent 60%)',
            }}
          />

          <div className="relative z-10 space-y-4">
            <h2 className={`text-2xl font-display font-bold tracking-[0.3em] uppercase ${outcomeTone}`}>
              Expedition Complete
            </h2>

            <p className="font-mono text-sm text-exp-text-dim">
              The expedition has concluded. All crew have returned or been lost to the planet.
            </p>
            <div className="mx-auto mt-4 grid max-w-xl gap-2 sm:grid-cols-3">
              {['Crew', 'Survived', 'Lost'].map((label, index) => {
                const value = [players.length, survivorCount, lostCount][index];
                const tone = index === 1 ? 'text-oxide-green' : index === 2 ? 'text-signal-red' : 'text-exp-text';
                return (
                  <div key={label} className="rounded border border-exp-border bg-exp-dark/45 px-3 py-2">
                    <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-exp-text-dim">{label}</p>
                    <p className={`mt-1 font-mono text-2xl ${tone}`}>{value}</p>
                  </div>
                );
              })}
            </div>
            <div className="mx-auto mt-3 grid max-w-xl gap-2 sm:grid-cols-3">
              <div className="rounded border border-exp-border bg-exp-dark/45 px-3 py-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">Final Pressure</p>
                <p className="mt-1 font-mono text-xs uppercase tracking-[0.12em] text-exp-text">
                  {finalPressure.pressure} {finalPressure.band.label}
                </p>
              </div>
              <div className="rounded border border-exp-border bg-exp-dark/45 px-3 py-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">Depart Timing</p>
                <p className="mt-1 font-mono text-xs uppercase tracking-[0.12em] text-exp-text">
                  {finalEscapeCost.reportLabel}
                </p>
              </div>
              <div className="rounded border border-exp-border bg-exp-dark/45 px-3 py-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">Recovered Value</p>
                <p className="mt-1 font-mono text-xs uppercase tracking-[0.12em] text-exp-text">
                  {finalPressure.recoveredValue}
                </p>
              </div>
            </div>
            <div className="mx-auto mt-3 grid max-w-xl gap-2 sm:grid-cols-3">
              <div className="rounded border border-blueprint/30 bg-blueprint/5 px-3 py-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">Final Arc</p>
                <p className="mt-1 font-mono text-xs uppercase tracking-[0.12em] text-exp-text">
                  {finalArc.label}
                </p>
              </div>
              <div className="rounded border border-exp-border bg-exp-dark/45 px-3 py-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">Chapter Path</p>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-exp-text">
                  {chapterTransition}
                </p>
              </div>
              <div className="rounded border border-compass/30 bg-compass/5 px-3 py-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">Timing</p>
                <p className="mt-1 font-mono text-xs uppercase tracking-[0.12em] text-exp-text">
                  {finalArc.id === 'final-call' ? 'After Final Call' : 'Before Final Call'}
                </p>
              </div>
            </div>
            <p className="mx-auto mt-3 max-w-xl font-mono text-xs leading-relaxed text-exp-text-dim">
              {finalEscapeCost.headline}: {finalEscapeCost.body}
            </p>
          </div>
        </div>
      </div>

      <ExpeditionMemoryPanel
        initialMemory={memoryState}
        latestMemory={completedMemory}
        title="Memory Created"
      />

      <RunRelicSharePanel
        memory={completedMemory}
        challenge={completedChallenge}
        title="Run Relic Card"
      />

      {/* Explorer Report */}
      <div className="border border-compass/30 rounded bg-exp-panel overflow-hidden">
        <div className="bg-exp-dark border-b border-exp-border px-4 py-2 flex items-center justify-between gap-3">
          <span className="font-display text-xs tracking-[0.3em] text-exp-text-dim uppercase">
            Expedition Recap
          </span>
          <span className="font-mono text-xs text-compass-bright">
            EXP-{String(reportGameId).padStart(3, '0')}
          </span>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-3">
          <div className="rounded border border-exp-border bg-exp-dark/40 px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-exp-text-dim">
              Crew
            </p>
            <p className="mt-2 font-mono text-2xl text-exp-text">
              {players.length}
            </p>
          </div>
          <div className="rounded border border-oxide-green/35 bg-oxide-green/5 px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-exp-text-dim">
              Survived
            </p>
            <p className="mt-2 font-mono text-2xl text-oxide-green">
              {survivorCount}
            </p>
          </div>
          <div className="rounded border border-signal-red/35 bg-signal-red/5 px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-exp-text-dim">
              Lost
            </p>
            <p className="mt-2 font-mono text-2xl text-signal-red">
              {lostCount}
            </p>
          </div>
        </div>
        <div className="mx-5 mb-4 h-2 overflow-hidden rounded bg-exp-dark">
          <div
            className="h-full rounded bg-oxide-green"
            style={{ width: `${players.length ? (survivorCount / players.length) * 100 : 0}%` }}
          />
        </div>
        <div className="border-t border-exp-border px-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-xs leading-relaxed text-exp-text-dim">
            Share this report as the canonical record for the completed expedition.
          </p>
          <button
            onClick={copyReport}
            className="rounded border border-compass/40 bg-compass/5 px-4 py-2 font-display text-xs uppercase tracking-widest text-compass transition-colors hover:border-compass/70 hover:bg-compass/10"
          >
            {copied ? 'Copied' : 'Copy Report Link'}
          </button>
        </div>
      </div>

      <div className="border border-blueprint/30 rounded bg-exp-panel overflow-hidden">
        <div className="bg-exp-dark border-b border-exp-border px-4 py-2 flex items-center justify-between gap-3">
          <span className="font-display text-xs tracking-[0.3em] text-exp-text-dim uppercase">
            Resolution Proof
          </span>
          <span className="font-mono text-xs text-blueprint">
            {expedition.turnState?.label || 'Complete'}
          </span>
        </div>
        <div className="space-y-3 p-5">
          <p className="font-mono text-xs leading-relaxed text-exp-text-dim">
            {latestReplayStep
              ? `Latest replay step: ${latestReplayStep.summary}.`
              : 'No replay events have loaded for this report yet.'}
          </p>
          <div className="grid gap-2">
            {replayGroups.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {replayGroups.map(([actor, steps]) => (
                  <div key={actor} className="rounded border border-exp-border bg-exp-dark/35 px-3 py-2">
                    <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">
                      {actor}
                    </p>
                    <p className="mt-1 font-mono text-xs text-exp-text">
                      {steps.length} replay event{steps.length === 1 ? '' : 's'}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {replayProof.length > 0 ? replayProof.map((proof, index) => (
              <div
                key={`${proof.tx}-${index}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-exp-border bg-exp-dark/40 px-3 py-2"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">
                  {proof.label} {proof.blockNumber ? `block ${proof.blockNumber}` : ''}
                </span>
                <span className="font-mono text-xs text-blueprint">
                  {truncateAddress(proof.tx)}
                </span>
              </div>
            )) : (
              <div className="rounded border border-exp-border bg-exp-dark/35 px-3 py-2 font-mono text-xs text-exp-text-dim">
                Replay proof is waiting on chain event history.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border border-exp-border rounded bg-exp-panel overflow-hidden">
        <div className="bg-exp-dark border-b border-exp-border px-4 py-2">
          <span className="font-display text-xs tracking-[0.3em] text-exp-text-dim uppercase">
            Crew Report
          </span>
        </div>

        <table className="w-full">
          <thead>
            <tr className="border-b border-exp-border bg-exp-dark/50">
              <th className="px-4 py-2 text-left font-display text-xs tracking-widest text-exp-text-dim uppercase">
                Crew
              </th>
              <th className="px-4 py-2 text-center font-display text-xs tracking-widest text-exp-text-dim uppercase">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {players.map((player, i) => {
              const addr = player.playerAddress || (typeof player === 'string' ? player : '');
              const isYou = addr?.toLowerCase() === address?.toLowerCase();

              return (
                <tr key={i} className={`border-b border-exp-border/50 ${isYou ? 'bg-compass/5' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="grid h-7 w-7 place-items-center rounded border border-exp-border bg-exp-dark/60" style={{ color: PLAYER_COLORS[i] }}>
                        <span className="font-mono text-[10px] font-bold">P{i + 1}</span>
                      </div>
                      <div>
                        <span className="block font-mono text-xs text-exp-text">
                          {truncateAddress(addr)}
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-exp-text-dim">
                          {player.currentZone || 'unknown'}
                        </span>
                      </div>
                      {isYou && (
                        <span className="font-display text-xs tracking-widest uppercase text-compass-bright border border-compass/30 rounded px-1.5 py-0.5 bg-compass/5">
                          YOU
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-display text-xs tracking-widest uppercase
                      ${player.isActive ? 'text-oxide-green' : 'text-exp-text-dim'}`}>
                      {player.isActive ? 'SURVIVED' : 'LOST'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-center gap-4">
        <Link
          to="/"
          className="font-display text-xs tracking-widest uppercase text-exp-text-dim hover:text-exp-text border border-exp-border rounded px-4 py-2 bg-exp-panel hover:bg-exp-dark transition-colors"
        >
          Return to Tablet
        </Link>
        <Link
          to="/"
          onClick={() => trackJourneyEvent('second_expedition_start', { return_interval: 'same_session' }, { dedupeKey: String(reportGameId) })}
          className="font-display text-xs tracking-widest uppercase text-compass hover:text-compass-bright border border-compass/30 hover:border-compass/50 rounded px-4 py-2 bg-compass/5 hover:bg-compass/10 transition-colors"
        >
          New Expedition
        </Link>
      </div>

      <div className="flex items-center justify-center gap-2">
        <div className="h-px w-12 bg-exp-border" />
        <span className="font-display text-xs tracking-[0.4em] text-exp-text-dim uppercase">
          End of Report
        </span>
        <div className="h-px w-12 bg-exp-border" />
      </div>
    </div>
  );
}
