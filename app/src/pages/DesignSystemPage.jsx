import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import EmptyState from '../components/shared/EmptyState';
import Spinner from '../components/shared/Spinner';
import TxStatus from '../components/shared/TxStatus';
import UIQualityStatus from '../components/shared/UIQualityStatus';
import UXQualityStatus from '../components/shared/UXQualityStatus';
import SurveyTabletFrame from '../components/layout/SurveyTabletFrame';
import ActionSimulator from '../components/actions/ActionSimulator';
import ThreeBoard from '../components/board/ThreeBoard';
import EscapeCostPreview from '../components/expedition/EscapeCostPreview';
import ExpeditionArcTrack from '../components/expedition/ExpeditionArcTrack';
import MissionStatus from '../components/expedition/MissionStatus';
import ReadinessMatrix from '../components/expedition/ReadinessMatrix';
import PlayerDossier from '../components/player/PlayerDossier';
import InventoryPanel from '../components/player/InventoryPanel';
import AftermathMoment from '../components/resolution/AftermathMoment';
import BeatThisChallenge from '../components/memory/BeatThisChallenge';
import MemoryCard from '../components/memory/MemoryCard';
import RunRelicCard from '../components/memory/RunRelicCard';
import { Action, Tile } from '../lib/constants';
import { TurnState } from '../lib/turnState';
import {
  accessibilityStandards,
  actionPatterns,
  aftermathFixture,
  arcFixture,
  challengeFixture,
  copyPairs,
  coverageRegistry,
  designViews,
  emotionalBeats,
  escapePreviewFixture,
  languageTerms,
  lifecycle,
  memoryFixture,
  playersFixture,
  relicCardFixture,
  stateLenses,
  statusTones,
} from '../design-system/catalog';
import { colorTokens, scaleTokens, semanticTokens } from '../design-system/tokens';

const sectionNav = [
  ['overview', 'Map', 'all'],
  ['foundations', 'Foundations', 'foundation'],
  ['controls', 'Controls', 'components'],
  ['board', 'Board', 'gameplay'],
  ['gameplay', 'Game states', 'gameplay'],
  ['feedback', 'Feedback', 'components'],
  ['journeys', 'Journeys', 'journeys'],
  ['responsive', 'Responsive', 'journeys'],
  ['standards', 'Standards', 'standards'],
  ['registry', 'Registry', 'standards'],
];

const lensTurnState = {
  ready: {
    state: TurnState.PLANNING,
    label: 'Planning',
    phaseLabel: 'Submission',
    copy: 'Choose an action and preview the consequence before submitting.',
  },
  waiting: {
    state: TurnState.WAITING_CREW,
    label: 'Waiting Crew',
    phaseLabel: 'Submission',
    copy: 'Your action is locked. Waiting for one more explorer.',
    waitingFor: 1,
    hasSubmitted: true,
  },
  resolving: {
    state: TurnState.RESOLVING,
    label: 'Resolving',
    phaseLabel: 'Processing',
    copy: 'Submitted actions are resolving through the queue.',
    isResolving: true,
    hasSubmitted: true,
  },
  danger: {
    state: TurnState.PLANNING,
    label: 'Final Call',
    phaseLabel: 'Submission',
    copy: 'Leave, save someone, or pay the named cost.',
  },
  complete: {
    state: TurnState.COMPLETE,
    label: 'Complete',
    phaseLabel: 'Closed',
    copy: 'The expedition is complete. Preserve what made it worth remembering.',
    hasSubmitted: true,
  },
};

const boardTiles = [
  ['0,0', Tile.LANDING, 'LZ'],
  ['1,0', Tile.JUNGLE, 'J'],
  ['2,0', Tile.PLAINS, 'P'],
  ['3,0', Tile.NONE, '?'],
  ['0,1', Tile.JUNGLE, 'J'],
  ['1,1', Tile.RELIC, '*'],
  ['2,1', Tile.DESERT, 'D'],
  ['3,1', Tile.MOUNTAIN, 'M'],
  ['0,2', Tile.NONE, '?'],
  ['1,2', Tile.PLAINS, 'P'],
  ['2,2', Tile.MOUNTAIN, 'M'],
  ['3,2', Tile.NONE, '?'],
];

const ownerByFamily = {
  Navigation: 'Product',
  Discovery: 'Product',
  Lobby: 'Protocol UX',
  Board: 'Game UX',
  Controls: 'Game UX',
  Mission: 'Game UX',
  Player: 'Game UX',
  Feedback: 'Platform UX',
  Resolution: 'Game UX',
  Memory: 'Growth + Game',
  Settings: 'Platform UX',
  Wallet: 'Protocol UX',
  Responsive: 'Design systems',
};

const maturityCounts = coverageRegistry.reduce((counts, item) => ({
  ...counts,
  [item[3]]: (counts[item[3]] || 0) + 1,
}), {});

function Section({ id, eyebrow, title, body, children, className = '' }) {
  return (
    <section id={id} data-design-section={id} className={`scroll-mt-40 border-t border-exp-border/70 py-12 first:border-t-0 ${className}`}>
      <div className="mb-6 grid gap-3 lg:grid-cols-[minmax(0,0.7fr)_minmax(18rem,0.3fr)] lg:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-compass">{eyebrow}</p>
          <h2 className="mt-2 max-w-4xl font-display text-3xl uppercase leading-none tracking-[0.12em] text-exp-text sm:text-4xl">{title}</h2>
        </div>
        {body && <p className="ds-copy text-sm text-exp-text-dim">{body}</p>}
      </div>
      {children}
    </section>
  );
}

function Surface({ children, className = '', as: Element = 'div', ...props }) {
  return (
    <Element className={`rounded-md border border-exp-border bg-exp-panel/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] ${className}`} {...props}>
      {children}
    </Element>
  );
}

function ToneBadge({ children, className = 'border-exp-border bg-exp-dark/45 text-exp-text-dim' }) {
  return (
    <span className={`inline-flex items-center rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] ${className}`}>
      {children}
    </span>
  );
}

function MiniLabel({ children }) {
  return <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-exp-text-dim">{children}</p>;
}

function ResolvedTokenValue({ cssVar }) {
  const [value, setValue] = useState(cssVar);
  useEffect(() => {
    const resolved = window.getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
    if (resolved) setValue(resolved);
  }, [cssVar]);
  return <code className="font-mono text-[9px] uppercase text-exp-text-dim">{value}</code>;
}

function parseColor(value) {
  const match = String(value).trim().match(/^#([0-9a-f]{6})$/i);
  if (match) return [0, 2, 4].map((offset) => Number.parseInt(match[1].slice(offset, offset + 2), 16));
  const rgb = String(value).match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  return rgb ? rgb.slice(1, 4).map(Number) : null;
}

function contrastRatio(foreground, background) {
  const luminance = (value) => {
    const rgb = parseColor(value);
    if (!rgb) return null;
    const channels = rgb.map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
  };
  const a = luminance(foreground);
  const b = luminance(background);
  if (a == null || b == null) return null;
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function ContrastBadge({ backgroundVar, foregroundVar, foregroundLabel }) {
  const [ratio, setRatio] = useState(null);
  useEffect(() => {
    const styles = window.getComputedStyle(document.documentElement);
    setRatio(contrastRatio(styles.getPropertyValue(foregroundVar), styles.getPropertyValue(backgroundVar)));
  }, [backgroundVar, foregroundVar]);
  const passes = ratio >= 4.5;
  return (
    <span className={`rounded border px-1.5 py-1 font-mono text-[9px] uppercase tracking-[0.1em] ${passes ? 'border-oxide-green/35 text-oxide-green-bright' : 'border-compass/35 text-compass-bright'}`}>
      {ratio ? `${ratio.toFixed(1)}:1` : '--'} / {foregroundLabel}
    </span>
  );
}

const lifecycleArt = [
  '/images/art/environments/glassroot-cavern.webp',
  '/images/art/characters/signal-cartographer.png',
  '/images/art/terrain/verdant-signal-base.webp',
  '/images/art/props/route-fork-marker.png',
  '/images/art/fx/redline-pressure.png',
  '/images/art/relics/sunstone-lens.png',
];

function SystemHero() {
  return (
    <header
      className="relative overflow-hidden rounded-md border border-compass/30 bg-exp-panel px-5 py-7 sm:px-8 sm:py-10"
      style={{
        backgroundImage: 'radial-gradient(circle at 86% 12%, rgba(196,166,74,0.16), transparent 28%), radial-gradient(circle at 6% 92%, rgba(76,145,219,0.12), transparent 34%)',
      }}
    >
      <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-center">
        <div className="max-w-4xl">
          <div className="flex flex-wrap items-center gap-2">
            <ToneBadge className="border-compass/45 bg-compass/10 text-compass-bright">living system 1.0</ToneBadge>
            <ToneBadge>internal review surface</ToneBadge>
            <ToneBadge className="border-oxide-green/45 bg-oxide-green/10 text-oxide-green">evidence-linked registry</ToneBadge>
          </div>
          <p className="mt-7 font-mono text-[10px] uppercase tracking-[0.34em] text-compass">Xenovoya game interface system</p>
          <h1 className="mt-3 max-w-4xl break-words font-display text-5xl uppercase leading-[0.88] tracking-[0.07em] text-exp-text sm:text-7xl">
            One language.<br /><span className="text-compass-bright">Every expedition moment.</span>
          </h1>
          <p className="ds-copy mt-6 max-w-3xl text-base text-exp-text-dim">
            A critiqueable source of truth for the entire player experience - from first promise to final memory. Quiet by default, alive on input, precise under pressure, and human after the outcome.
          </p>
        </div>
        <div className="hidden lg:block">
          <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.2em] text-compass">System pulse</p>
          <StateSummary lens="danger" eyebrow="Pressure example" />
        </div>
      </div>
      <div className="relative mt-8 grid gap-px overflow-hidden rounded border border-exp-border bg-exp-border sm:grid-cols-4">
        {[
          ['6', 'journey moments'],
          [String(coverageRegistry.length), 'patterns mapped'],
          [String(maturityCounts.Proven || 0), 'patterns proven'],
          [String((maturityCounts.Audit || 0) + (maturityCounts.Prototype || 0)), 'open evidence gates'],
        ].map(([value, label]) => (
          <div key={label} className="bg-exp-dark/85 px-4 py-3">
            <p className="font-display text-2xl text-compass-bright">{value}</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-exp-text-dim">{label}</p>
          </div>
        ))}
      </div>
    </header>
  );
}

function CritiqueDeck({
  view,
  setView,
  lens,
  setLens,
  compare,
  setCompare,
  compareLens,
  setCompareLens,
  reducedMotion,
  setReducedMotion,
  pseudo,
  setPseudo,
  onCopyReview,
  copied,
  onReset,
}) {
  return (
    <div className="z-40 mt-4 rounded-md border border-exp-border bg-exp-surface/95 p-3 shadow-xl backdrop-blur lg:sticky lg:top-3" data-testid="design-system-controls">
      <div className="grid gap-3 xl:grid-cols-[1fr_auto] xl:items-center">
        <div className="min-w-0">
          <MiniLabel>Review scope</MiniLabel>
          <div className="mt-2 grid grid-cols-2 gap-1 sm:flex sm:overflow-x-auto sm:pb-1">
            {designViews.map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={view === id}
                onClick={() => setView(id)}
                className={`min-h-11 min-w-0 break-words rounded border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] transition sm:shrink-0 ${view === id ? 'border-compass/60 bg-compass/15 text-compass-bright' : 'border-exp-border bg-exp-dark/45 text-exp-text-dim hover:border-compass/35 hover:text-exp-text'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <MiniLabel>State lens</MiniLabel>
          <div className="mt-2 grid grid-cols-3 gap-1 sm:flex sm:overflow-x-auto sm:pb-1">
            {stateLenses.map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={lens === id}
                onClick={() => setLens(id)}
                className={`min-h-11 min-w-0 break-words rounded border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] transition sm:shrink-0 ${lens === id ? 'border-blueprint/60 bg-blueprint/15 text-blueprint-bright' : 'border-exp-border bg-exp-dark/45 text-exp-text-dim hover:border-blueprint/35 hover:text-exp-text'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-exp-border/70 pt-3">
        <button type="button" aria-pressed={compare} onClick={() => setCompare(!compare)} className={`min-h-11 rounded border px-3 font-mono text-[10px] uppercase tracking-[0.14em] ${compare ? 'border-relic/60 bg-relic/15 text-relic-bright' : 'border-exp-border bg-exp-dark/45 text-exp-text-dim'}`}>{compare ? 'Comparison on' : 'Compare states'}</button>
        {compare && (
          <label className="font-mono text-[9px] uppercase tracking-[0.14em] text-exp-text-dim">
            Compare with
            <select aria-label="Compare with state" value={compareLens} onChange={(event) => setCompareLens(event.target.value)} className="ml-2 min-h-11 rounded border border-exp-border bg-exp-dark px-3 font-mono text-[10px] uppercase text-exp-text">
              {stateLenses.filter(([id]) => id !== lens).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
        )}
        <button type="button" aria-pressed={reducedMotion} onClick={() => setReducedMotion(!reducedMotion)} className={`min-h-11 rounded border px-3 font-mono text-[10px] uppercase tracking-[0.14em] ${reducedMotion ? 'border-oxide-green/50 bg-oxide-green/10 text-oxide-green' : 'border-exp-border bg-exp-dark/45 text-exp-text-dim'}`}>{reducedMotion ? 'Motion reduced' : 'Reduce motion'}</button>
        <button type="button" aria-pressed={pseudo} onClick={() => setPseudo(!pseudo)} className={`min-h-11 rounded border px-3 font-mono text-[10px] uppercase tracking-[0.14em] ${pseudo ? 'border-compass/50 bg-compass/10 text-compass-bright' : 'border-exp-border bg-exp-dark/45 text-exp-text-dim'}`}>{pseudo ? 'Copy stress on' : 'Stress copy'}</button>
        <button type="button" onClick={onCopyReview} className="min-h-11 rounded border border-blueprint/45 bg-blueprint/10 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-blueprint">{copied ? 'Review link copied' : 'Copy review link'}</button>
        <button type="button" onClick={onReset} className="min-h-11 rounded border border-exp-border bg-exp-dark/45 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-exp-text-dim">Reset</button>
      </div>
    </div>
  );
}

function SystemMap() {
  return (
    <>
      <div className="grid gap-px overflow-hidden rounded-md border border-exp-border bg-exp-border lg:grid-cols-[0.9fr_0.95fr_1fr_1.15fr_1.25fr_1.05fr]">
        {lifecycle.map(([step, title, feeling, body], index) => (
          <div key={title} className={`group relative min-h-56 overflow-hidden bg-exp-panel p-4 pt-24 ${index === 3 ? 'bg-compass/10' : ''} ${index === 4 ? 'bg-signal-red/10' : ''}`}>
            <img src={lifecycleArt[index]} alt="" className={`absolute inset-x-0 top-0 h-20 w-full object-cover opacity-55 saturate-[0.8] transition duration-300 group-hover:opacity-75 ${index === 1 || index === 5 ? 'object-contain' : ''}`} />
            <span aria-hidden="true" className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-transparent via-exp-panel/25 to-exp-panel" />
            {index < lifecycle.length - 1 && <span aria-hidden="true" className="absolute right-[-5px] top-7 z-10 hidden h-2 w-2 rotate-45 border-r border-t border-compass/50 bg-exp-panel lg:block" />}
            <div className="relative flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] text-compass">{step}</span>
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-exp-text-dim">{feeling}</span>
            </div>
            <h3 className={`relative mt-4 font-display uppercase tracking-[0.14em] ${index === 3 || index === 4 ? 'text-2xl text-compass-bright' : 'text-xl text-exp-text'}`}>{title}</h3>
            <p className="ds-copy relative mt-2 text-xs text-exp-text-dim">{body}</p>
          </div>
        ))}
      </div>
      <div className="mx-auto flex max-w-3xl items-center justify-center gap-3 py-3 text-center text-compass" aria-label="Remembered expeditions create the next discovery">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-compass/45" />
        <span className="font-mono text-[10px] uppercase tracking-[0.2em]">Remember <span aria-hidden="true">-&gt;</span> share <span aria-hidden="true">-&gt;</span> invite <span aria-hidden="true">-&gt;</span> discover again</span>
        <span className="h-px flex-1 bg-gradient-to-l from-transparent to-compass/45" />
      </div>
      <div className="grid gap-3 lg:grid-cols-[0.9fr_1.2fr_0.9fr]">
        {[
          ['Quiet until useful', 'Persistent UI earns its place. The board, objective, current state, and one next action lead.'],
          ['Consequences before commitment', 'Cost, risk, eligibility, and route impact appear while the choice is still reversible.'],
          ['A run becomes a story', 'Resolution names what changed; memory preserves why the decision mattered.'],
        ].map(([title, body], index) => (
          <Surface key={title} className={index === 1 ? 'border-compass/45 bg-compass/10 lg:-translate-y-1' : 'border-exp-border/65 bg-exp-panel/50'}>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-compass">Principle 0{index + 1}</p>
            <h3 className="mt-2 font-display text-xl uppercase tracking-[0.12em] text-exp-text">{title}</h3>
            <p className="ds-copy mt-2 text-sm text-exp-text-dim">{body}</p>
          </Surface>
        ))}
      </div>
    </>
  );
}

function Foundations() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {colorTokens.map(([name, role, cssVar, className]) => {
          const surface = ['Void', 'Surface', 'Panel', 'Border'].includes(name);
          const terrain = ['Jungle', 'Desert'].includes(name);
          return (
          <Surface key={name} className="p-3">
            <div className={`grid h-12 place-items-center rounded border border-white/10 ${className}`}>
              <span className={`${surface ? 'text-exp-text' : 'text-exp-dark'} font-display text-lg uppercase tracking-[0.12em]`}>{terrain ? 'Map' : 'Aa'}</span>
            </div>
            <div className="mt-3 flex items-start justify-between gap-2">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.14em] text-exp-text">{name}</p>
                <p className="mt-1 font-mono text-[10px] text-exp-text-dim">{role}</p>
              </div>
              <ResolvedTokenValue cssVar={cssVar} />
            </div>
            <div className="mt-2">
              {terrain ? <span className="rounded border border-exp-border px-1.5 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-exp-text-dim">Non-text / terrain</span> : <ContrastBadge
                backgroundVar={cssVar}
                foregroundVar={surface ? '--color-exp-text' : '--color-exp-dark'}
                foregroundLabel={surface ? 'Text' : 'Void'}
              />}
            </div>
          </Surface>
          );
        })}
      </div>
      <Surface>
        <MiniLabel>Semantic aliases</MiniLabel>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {semanticTokens.map(([name, cssVar, role]) => (
            <div key={name} className="rounded border border-exp-border/70 bg-exp-dark/45 px-3 py-2">
              <div className="flex items-center justify-between gap-3"><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-exp-text">{name}</p><ResolvedTokenValue cssVar={cssVar} /></div>
              <p className="ds-copy mt-1 text-xs text-exp-text-dim">{role}</p>
            </div>
          ))}
        </div>
      </Surface>
      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Surface className="p-5">
          <MiniLabel>Typography roles</MiniLabel>
          <div className="mt-5 border-l border-compass/45 pl-4 sm:pl-6">
            <p className="font-display text-5xl uppercase leading-none tracking-[0.08em] text-exp-text sm:text-6xl">Final call</p>
            <p className="mt-3 font-display text-2xl uppercase tracking-[0.14em] text-compass-bright">Leave with the story</p>
            <p className="ds-copy mt-5 max-w-2xl text-sm text-exp-text">Display type gives the fantasy weight. Monospace carries decisions, system state, readable facts, and the calm voice of the expedition instrument.</p>
            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.28em] text-blueprint">Submission / route valid / 2 steps</p>
          </div>
        </Surface>
        <Surface className="p-5">
          <MiniLabel>Glyph grammar</MiniLabel>
          <div className="mt-5 grid grid-cols-4 gap-2">
            {['+', '-', '!', '?', '>', '*', '~', '^'].map((glyph) => <div key={glyph} className="grid aspect-square place-items-center rounded border border-exp-border bg-exp-dark/50 font-mono text-xl text-compass-bright">{glyph}</div>)}
          </div>
          <p className="ds-copy mt-4 text-sm text-exp-text-dim">Glyphs reinforce a written label. They never become the only path to meaning.</p>
        </Surface>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded border border-exp-border/60 bg-exp-dark/35 p-4">
          <MiniLabel>Resting</MiniLabel>
          <button type="button" className="mt-3 min-h-11 w-full rounded border border-exp-border bg-exp-panel px-3 font-mono text-xs uppercase tracking-[0.14em] text-exp-text-dim">Inspect route</button>
        </div>
        <div className="rounded border border-blueprint/45 bg-blueprint/5 p-4">
          <MiniLabel>Keyboard focus</MiniLabel>
          <button type="button" className="mt-3 min-h-11 w-full rounded border-2 border-blueprint bg-exp-panel px-3 font-mono text-xs uppercase tracking-[0.14em] text-blueprint-bright ring-2 ring-blueprint/25 ring-offset-2 ring-offset-exp-dark">Inspect route</button>
        </div>
        <div className="rounded border border-compass/45 bg-compass/5 p-4">
          <MiniLabel>Pressed / committed</MiniLabel>
          <button type="button" className="mt-3 min-h-11 w-full translate-y-px rounded border border-compass bg-compass/20 px-3 font-mono text-xs uppercase tracking-[0.14em] text-compass-bright shadow-inner">Route locked</button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {scaleTokens.map(([name, cssVar, value, rule]) => (
          <Surface key={name}>
            <div className="flex items-baseline justify-between gap-3"><p className="font-mono text-[10px] uppercase tracking-[0.22em] text-compass">{name}</p><code className="text-right font-mono text-[9px] text-exp-text-dim">{value}</code></div>
            <p className="mt-1 font-mono text-[9px] text-blueprint">{cssVar}</p>
            <p className="ds-copy mt-3 text-sm text-exp-text">{rule}</p>
          </Surface>
        ))}
      </div>
    </div>
  );
}

function ActionConsoleSpec() {
  const [active, setActive] = useState('Move');
  const selected = actionPatterns.find(([label]) => label === active) || actionPatterns[0];
  return (
    <Surface className="overflow-hidden p-0" data-testid="action-console-spec">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-exp-border px-4 py-4">
        <div><MiniLabel>Action console anatomy</MiniLabel><p className="mt-2 font-mono text-xs leading-relaxed text-exp-text-dim">Select verb - preview consequence - validate requirements - commit once.</p></div>
        <ToneBadge className="border-compass/45 bg-compass/10 text-compass-bright">reversible until submit</ToneBadge>
      </div>
      <div className="grid gap-px bg-exp-border sm:grid-cols-3 xl:grid-cols-6">
        {actionPatterns.map(([label, , glyph, className]) => (
          <button key={label} type="button" aria-pressed={active === label} onClick={() => setActive(label)} className={`min-h-20 bg-exp-dark px-4 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-compass ${active === label ? className : 'text-exp-text-dim hover:bg-exp-panel hover:text-exp-text'}`}>
            <span className="block font-display text-xl uppercase tracking-[0.12em]">{label}</span><kbd className="mt-2 inline-flex min-w-6 justify-center rounded border border-current/30 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em]">{glyph}</kbd>
          </button>
        ))}
      </div>
      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_15rem]">
        <div className={`rounded border p-4 ${selected[3]}`}>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em]">{selected[0]} intent</p>
          <p className="mt-2 font-mono text-sm leading-relaxed text-exp-text">{selected[1]}</p>
          <div className="mt-3 flex flex-wrap gap-2"><ToneBadge>Cost 1 turn</ToneBadge><ToneBadge>Risk visible</ToneBadge><ToneBadge>Undo available</ToneBadge></div>
        </div>
        <div className="rounded border border-compass/45 bg-compass/10 p-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-compass">One next action</p>
          <button type="button" className="mt-2 min-h-14 w-full rounded border border-compass bg-compass px-4 py-3 font-display text-base font-semibold uppercase tracking-[0.18em] text-exp-dark shadow-[0_0_24px_rgba(196,166,74,0.18)] hover:bg-compass-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-compass">Submit {selected[0]}</button>
          <p className="mt-2 font-mono text-[9px] leading-relaxed text-exp-text-dim">Enter submits only while this command has focus.</p>
        </div>
      </div>
    </Surface>
  );
}

function ControlMatrix() {
  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Surface>
          <MiniLabel>Button hierarchy</MiniLabel>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button type="button" className="min-h-11 rounded border border-compass bg-compass px-4 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-exp-dark">Primary command</button>
            <button type="button" className="min-h-11 rounded border border-blueprint/50 bg-blueprint/10 px-4 font-mono text-xs uppercase tracking-[0.16em] text-blueprint">Inspect details</button>
            <button type="button" className="min-h-11 rounded border border-signal-red/50 bg-signal-red/10 px-4 font-mono text-xs uppercase tracking-[0.16em] text-signal-red">Abandon run</button>
            <button type="button" disabled className="min-h-11 cursor-not-allowed rounded border border-exp-border bg-exp-dark/45 px-4 font-mono text-xs uppercase tracking-[0.16em] text-exp-text-dim opacity-45">Unavailable</button>
          </div>
        </Surface>
        <Surface>
          <MiniLabel>Inputs and selection</MiniLabel>
          <label className="mt-4 block font-mono text-[10px] uppercase tracking-[0.18em] text-exp-text-dim" htmlFor="design-system-call-sign">Explorer call sign</label>
          <input id="design-system-call-sign" defaultValue="Lantern Keeper" className="mt-2 min-h-11 w-full rounded border border-exp-border bg-exp-dark/60 px-3 font-mono text-sm text-exp-text outline-none focus:border-blueprint focus:ring-2 focus:ring-blueprint/25" />
          <div className="mt-3 flex flex-wrap gap-2">
            <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded border border-exp-border bg-exp-dark/45 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-exp-text"><input type="checkbox" defaultChecked className="accent-[#e8c860]" /> Show route costs</label>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded border border-exp-border bg-exp-dark/45 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-exp-text"><input type="checkbox" className="accent-[#e8c860]" /> Compact HUD</label>
          </div>
        </Surface>
      </div>
      <div className="overflow-hidden rounded border border-exp-border/70 bg-exp-dark/35">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-exp-border/70 px-4 py-3">
          <div><MiniLabel>Interaction state lifecycle</MiniLabel><p className="ds-copy mt-1 text-sm text-exp-text-dim">Every command exposes input, processing, outcome, and recovery - not just an ideal resting state.</p></div>
          <ToneBadge>keyboard K / controller A</ToneBadge>
        </div>
        <div className="grid gap-px bg-exp-border/70 sm:grid-cols-2 xl:grid-cols-7">
          {[
            ['Resting', 'Inspect', 'border-exp-border text-exp-text-dim'],
            ['Hover', 'Inspect', 'border-compass/45 bg-compass/5 text-exp-text'],
            ['Focused', 'Inspect', 'border-blueprint bg-blueprint/10 text-blueprint-bright ring-2 ring-inset ring-blueprint/40'],
            ['Pressed', 'Inspect', 'translate-y-px border-compass bg-compass/15 text-compass-bright shadow-inner'],
            ['Pending', 'Sending...', 'border-relic/50 bg-relic/10 text-relic-bright'],
            ['Confirmed', 'Route saved', 'border-oxide-green/50 bg-oxide-green/10 text-oxide-green-bright'],
            ['Failed', 'Try again', 'border-signal-red/50 bg-signal-red/10 text-signal-red-bright'],
          ].map(([state, label, className]) => (
            <div key={state} className="bg-exp-panel/95 p-3">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-exp-text-dim">{state}</p>
              <button type="button" className={`mt-3 min-h-11 w-full rounded border px-2 font-mono text-[10px] uppercase tracking-[0.12em] ${className}`}>{label}</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BoardScene({ lens = 'ready' }) {
  const isWaiting = lens === 'waiting';
  const isResolving = lens === 'resolving';
  const isDanger = lens === 'danger';
  const isComplete = lens === 'complete';
  const path = isComplete || isDanger ? ['1,0', '1,1', '2,1'] : isResolving ? ['1,0', '1,1'] : ['1,0'];
  const previewPath = lens === 'ready' ? ['1,0', '1,1'] : path;
  const intentAlias = path[path.length - 1];
  const cells = boardTiles.map(([alias, tileType]) => ({
    alias,
    tileType,
    revealed: tileType !== Tile.NONE,
    hasCampsite: alias === '2,0',
  }));
  return (
    <div className="self-start overflow-hidden rounded-md border border-exp-border bg-exp-dark/75">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-exp-border px-3 py-2">
        <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-compass-bright" /><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-exp-text">Board / {lens}</p></div>
        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-exp-text-dim">route, presence, pressure</p>
      </div>
      <div className={`h-[25rem] w-full ${lens === 'danger' ? 'xl:h-[43rem]' : 'xl:h-[38rem]'}`}>
        <ThreeBoard
          cells={cells}
          currentLocation="0,0"
          intentAlias={intentAlias}
          selectedPath={path}
          previewPath={previewPath}
          reachableAliases={lens === 'ready' ? ['0,1', '1,0', '1,1'] : []}
          landingSite="0,0"
          crew={playersFixture}
          playerLocationMap={isDanger
            ? { '0,0': [0], '2,0': [1], '1,1': [2], '2,1': [3] }
            : isWaiting
              ? { '2,1': [0, 1], '1,1': [2], '2,0': [3] }
              : { '0,0': [0], '2,1': [1], '1,1': [2], '2,0': [3] }}
          currentPlayerIndex={isWaiting ? 1 : isResolving ? 2 : 0}
          activeAction={isDanger ? Action.FLEE : isWaiting ? Action.HELP : Action.MOVE}
          hasSubmitted={isWaiting || isResolving || isComplete}
          isResolving={isResolving}
          isDanger={isDanger}
          lowStats={isDanger}
          ariaLabel={`${lens} board state`}
        />
      </div>
    </div>
  );
}

const comparisonSignals = {
  ready: { world: 'Input open', route: 'Gold preview', pressure: 'Rising', accent: 'text-blueprint border-blueprint/35 bg-blueprint/10' },
  waiting: { world: 'Intent locked', route: 'Committed', pressure: 'Crew wait', accent: 'text-compass-bright border-compass/35 bg-compass/10' },
  resolving: { world: 'World moving', route: 'Resolving', pressure: 'Suspended', accent: 'text-relic-bright border-relic/35 bg-relic/10' },
  danger: { world: 'Choice open', route: 'Escape line', pressure: 'Redline', accent: 'text-signal-red border-signal-red/35 bg-signal-red/10' },
  complete: { world: 'World settled', route: 'Recorded', pressure: 'Safe', accent: 'text-oxide-green border-oxide-green/35 bg-oxide-green/10' },
};

function StateSummary({ lens, eyebrow }) {
  const state = lensTurnState[lens];
  const signals = comparisonSignals[lens];
  return (
    <div className={`rounded border p-3 ${signals.accent}`} data-testid={`state-summary-${lens}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em]">{eyebrow} / {lens}</p>
        <span className="rounded-full border border-current/30 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.16em]">{state.label}</span>
      </div>
      <p className="mt-3 min-h-10 text-sm leading-relaxed text-exp-text">{state.copy}</p>
      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-current/15 pt-3">
        {Object.entries({ World: signals.world, Route: signals.route, Pressure: signals.pressure }).map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="font-mono text-[8px] uppercase tracking-[0.16em] text-exp-text-dim">{label}</dt>
            <dd className="mt-1 break-words font-mono text-[9px] uppercase tracking-[0.1em] text-current">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function StateComparison({ lens, compareLens }) {
  return (
    <div className="mb-4 rounded-md border border-relic/35 bg-relic/5 p-3" data-testid="state-comparison">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <MiniLabel>State comparison</MiniLabel>
          <p className="ds-copy mt-1 text-sm text-exp-text-dim">Compare geometry, emphasis, route treatment, and emotional temperature without changing the viewport.</p>
        </div>
        <ToneBadge className="border-relic/45 bg-relic/10 text-relic-bright">one live renderer</ToneBadge>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <StateSummary lens={lens} eyebrow="Current" />
        <StateSummary lens={compareLens} eyebrow="Compare" />
      </div>
      <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.14em] text-exp-text-dim">The live board below renders the current lens. Switch lenses to inspect its full visual state.</p>
    </div>
  );
}

function GameplayState({ lens }) {
  const turnState = lensTurnState[lens];
  const danger = lens === 'danger';
  const waiting = lens === 'waiting';
  const resolving = lens === 'resolving';
  const complete = lens === 'complete';
  const departPressure = {
    pressure: danger ? 78 : complete ? 0 : 42,
    band: { label: danger ? 'Redline' : complete ? 'Safe' : 'Rising', tone: danger ? 'red' : complete ? 'green' : 'gold' },
    readiness: { body: danger ? 'A named cost is imminent.' : complete ? 'The crew made it home.' : 'There is still room to chart.', canFlee: true },
  };
  const selectedArc = {
    ...arcFixture,
    ...(complete ? { id: 'final-call', label: 'Remember', shortLabel: 'Final', tone: 'green', summary: 'The run now belongs to memory.', playerQuestion: 'What will the crew carry forward?', directive: 'Name the choice that defined the expedition.', nextThreshold: 'Share, replay, or begin again.' } : {}),
    ...(lens === 'ready' ? { id: 'survey', label: 'Survey', shortLabel: 'Survey', tone: 'blue', summary: 'Reveal enough to choose a route.', playerQuestion: 'What is out there?', directive: 'Chart useful ground before the route gets expensive.', nextThreshold: 'Reveal 4 tiles or find value.' } : {}),
  };
  return (
    <div className="space-y-4">
      <MissionStatus turnState={turnState} movePathLength={lens === 'ready' ? 2 : 0} moveValidation={{ ok: true, reason: 'Path is valid.' }} crewCount={4} departPressure={departPressure} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.85fr)_minmax(19rem,0.72fr)]">
        <BoardScene lens={lens} />
        <div className="space-y-3">
          <ActionSimulator
            activeTab={danger ? Action.FLEE : waiting ? Action.HELP : Action.MOVE}
            movement={danger ? 2 : 4}
            currentLocation="0,0"
            path={complete ? [] : danger ? ['1,0', '1,1'] : ['1,0']}
            hasCampsiteKit
            hasSubmitted={waiting || resolving || complete}
            isSpectator={false}
            helpPreview={waiting ? {
              valid: true,
              targetID: 1,
              statLabel: 'Agility',
              targetBefore: 1,
              targetAfter: 3,
              crewGain: 3,
              isRescue: true,
            } : null}
          />
          {danger && (
            <div className="relative overflow-hidden rounded border border-signal-red/45 bg-signal-red/10 p-3 pl-24">
              <img src="/images/art/relics/sunstone-lens.png" alt="Sunstone Lens at risk" className="absolute -bottom-3 left-0 h-24 w-24 object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.65)]" />
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-signal-red-bright">Threatened relic</p>
              <p className="mt-1 font-display text-xl uppercase tracking-[0.1em] text-exp-text">Sunstone Lens</p>
              <p className="ds-copy mt-1 text-xs text-exp-text-dim">One more delay puts the crew's rarest find at risk.</p>
            </div>
          )}
          {!complete && <EscapeCostPreview preview={danger ? escapePreviewFixture : { ...escapePreviewFixture, tone: 'gold', label: 'Close window', headline: 'A clean departure is still possible', body: 'The crew can leave with its current value if it protects the return route.', nextDelayWarning: 'Further delay raises pressure by at least one band.' }} />}
          {complete && (
            <div className="rounded border border-relic/45 bg-relic/10 p-4">
              <MiniLabel>Outcome preserved</MiniLabel>
              <p className="mt-2 font-display text-2xl uppercase tracking-[0.12em] text-relic-bright">The Lantern Route</p>
              <p className="ds-copy mt-2 text-sm text-exp-text-dim">All four explorers returned with the Sunstone Lens.</p>
            </div>
          )}
          <div className={`rounded border p-3 ${danger ? 'border-signal-red/55 bg-signal-red/10' : complete ? 'border-relic/45 bg-relic/10' : 'border-compass/45 bg-compass/10'}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-exp-text-dim">Next action</p>
                <p className="mt-1 font-mono text-xs text-exp-text">{danger ? 'Keep the relic or accept the next cost.' : complete ? 'Turn the outcome into a story.' : waiting ? 'Your intent is safe while you inspect.' : resolving ? 'Follow the result; do not resubmit.' : 'The route and cost are ready to commit.'}</p>
              </div>
              <kbd className="rounded border border-current/30 px-2 py-1 font-mono text-[9px] text-exp-text-dim">Enter</kbd>
            </div>
            <button type="button" disabled={waiting || resolving} className={`mt-3 min-h-12 w-full rounded border px-4 font-display text-base font-semibold uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-55 ${danger ? 'border-signal-red bg-signal-red text-exp-dark' : complete ? 'border-relic bg-relic text-exp-dark' : 'border-compass bg-compass text-exp-dark'}`}>
              {danger ? 'Depart with Sunstone Lens' : complete ? 'Open Run Relic' : waiting ? 'Waiting for crew' : resolving ? 'Resolving actions' : 'Submit move'}
            </button>
          </div>
        </div>
      </div>
      <ExpeditionArcTrack arc={selectedArc} />
    </div>
  );
}

function PlayerSystems({ lens }) {
  const submitted = lens === 'waiting' || lens === 'resolving' || lens === 'complete';
  const [focusedPlayer, setFocusedPlayer] = useState(0);
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.48fr)]">
      <div className="grid gap-3 md:grid-cols-2">
        {playersFixture.slice(0, 2).map((player, index) => <PlayerDossier key={player.playerAddress} player={player} index={index} isCurrentUser={index === 0} isFocused={focusedPlayer === index} isNearIntent={index === 1} onFocus={() => setFocusedPlayer(index)} />)}
      </div>
      <div className="space-y-4">
        <InventoryPanel active={{ artifact: 'Sunstone Lens', status: 'Exposed', relic: 'Moss Cipher', shield: lens !== 'danger', campsite: true }} inactive={{ itemTypes: ['Rope', 'Signal flare'], itemBalances: [2, 1] }} />
        <ReadinessMatrix players={playersFixture} readinessByPlayerID={{ 1: submitted, 2: true, 3: submitted, 4: lens === 'complete' }} queueActive />
      </div>
    </div>
  );
}

function RecoveryLab() {
  const [resolved, setResolved] = useState([]);
  const cases = [
    ['Wallet declined', 'No transaction was sent. Your route is still editable.', 'Try wallet again'],
    ['Connection offline', 'The board is preserved locally. Reconnect before committing.', 'Check connection'],
    ['Confirmation delayed', 'The action is pending on-chain. Do not submit a duplicate.', 'Inspect transaction'],
    ['Action blocked', 'Route exceeds Movement by 1. Undo the last step or Rest.', 'Undo last step'],
  ];
  return (
    <Surface className="p-0 overflow-hidden" data-testid="recovery-lab">
      <div className="border-b border-exp-border p-4"><MiniLabel>Recovery laboratory</MiniLabel><p className="ds-copy mt-2 text-sm text-exp-text-dim">Every failure preserves context, names what happened, and offers one safe next action.</p></div>
      <div className="grid gap-px bg-exp-border md:grid-cols-2">
        {cases.map(([title, body, action]) => {
          const isResolved = resolved.includes(title);
          return (
            <div key={title} className={`bg-exp-panel p-4 ${isResolved ? 'text-oxide-green' : 'text-signal-red'}`} aria-live="polite">
              <div className="flex items-center justify-between gap-2"><p className="font-display text-lg uppercase tracking-[0.12em] text-exp-text">{isResolved ? 'Recovery available' : title}</p><span aria-hidden="true" className="font-mono text-lg">{isResolved ? '+' : '!'}</span></div>
              <p className="ds-copy mt-2 min-h-12 text-sm text-exp-text-dim">{isResolved ? 'The example is reset-safe; no player intent or progress was lost.' : body}</p>
              <button type="button" onClick={() => setResolved((items) => isResolved ? items.filter((item) => item !== title) : [...items, title])} className={`mt-3 min-h-11 rounded border px-3 font-mono text-[10px] uppercase tracking-[0.14em] ${isResolved ? 'border-oxide-green/45 bg-oxide-green/10 text-oxide-green-bright' : 'border-signal-red/45 bg-signal-red/10 text-signal-red-bright'}`}>{isResolved ? 'Reset example' : action}</button>
            </div>
          );
        })}
      </div>
    </Surface>
  );
}

function FeedbackSystem() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {statusTones.map(([label, tone, body, className]) => (
          <Surface key={label} className={className}>
            <div className="flex items-center justify-between gap-3"><p className="font-display text-lg uppercase tracking-[0.14em]">{label}</p><span className="font-mono text-[9px] uppercase tracking-[0.18em]">{tone}</span></div>
            <p className="mt-2 font-mono text-[11px] leading-relaxed text-exp-text-dim">{body}</p>
          </Surface>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3"><EmptyState title="No surveys found" body="Connect when you want live sessions. Public scenarios remain available." tone="gold" /><EmptyState title="Route unavailable" body="Undo one step or choose a nearby revealed tile." tone="red" /></div>
        <div className="space-y-3"><TxStatus isPending /><TxStatus isConfirming hash="0x1234567890abcdef1234567890abcdef12345678" /></div>
        <div className="space-y-3"><TxStatus isSuccess hash="0x1234567890abcdef1234567890abcdef12345678" /><div className="rounded border border-exp-border bg-exp-dark/60 px-3 py-3 font-mono text-xs text-exp-text-dim" role="status"><div className="flex items-center gap-2 text-compass-bright"><Spinner size="h-4 w-4" /><span className="uppercase tracking-[0.18em]">Scanning surveys</span></div><p className="mt-2 text-[11px] leading-relaxed">Progress stays specific, calm, and cancellable when possible.</p></div></div>
      </div>
      <RecoveryLab />
    </div>
  );
}

function StageComposition() {
  return (
    <SurveyTabletFrame title="Verdant Signal" subtitle="Crew staging / survey 17" status="3 / 4 READY">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded border border-exp-border bg-exp-dark/45 p-3"><MiniLabel>Shared objective</MiniLabel><p className="mt-2 font-display text-xl uppercase tracking-[0.1em] text-exp-text">Recover one relic. Return together.</p><p className="mt-2 font-mono text-[11px] leading-relaxed text-exp-text-dim">Average session: 18 minutes / cooperative / one decisive exit.</p></div>
        <div className="grid grid-cols-2 gap-2">
          {playersFixture.map((player, index) => <div key={player.playerAddress} className="rounded border border-exp-border bg-exp-dark/45 p-2"><p className="font-mono text-[10px] uppercase text-exp-text">P{index + 1}</p><p className={`mt-1 font-mono text-[9px] uppercase tracking-[0.12em] ${index === 2 ? 'text-compass' : 'text-oxide-green'}`}>{index === 2 ? 'choosing role' : 'ready'}</p></div>)}
        </div>
      </div>
      <button type="button" disabled className="mt-3 min-h-11 w-full rounded border border-exp-border bg-exp-dark/45 font-mono text-[10px] uppercase tracking-[0.18em] text-exp-text-dim opacity-70">Waiting for P3</button>
    </SurveyTabletFrame>
  );
}

function JourneyCompositions({ lens }) {
  const complete = lens === 'complete';
  if (complete) {
    return (
      <div className="space-y-4">
        <Surface className="overflow-hidden border-relic/45 bg-relic/5 p-3">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div><MiniLabel>06 / Outcome first</MiniLabel><h3 className="mt-2 font-display text-3xl uppercase tracking-[0.12em] text-relic-bright">The expedition became a story</h3></div>
            <ToneBadge className="border-relic/45 bg-relic/10 text-relic-bright">all four returned</ToneBadge>
          </div>
          <RunRelicCard card={relicCardFixture} compact />
          <blockquote className="mx-auto mt-4 max-w-4xl border-l-2 border-compass/55 pl-4 font-display text-2xl uppercase tracking-[0.08em] text-exp-text">
            "We left the easy route behind so nobody had to leave alone."
          </blockquote>
        </Surface>
        <div className="grid items-start gap-4 xl:grid-cols-[1.08fr_0.92fr]">
          <Surface className="self-start"><div className="mb-4 flex items-center justify-between gap-3"><MiniLabel>05 / What changed</MiniLabel><ToneBadge className="border-compass/45 bg-compass/10 text-compass-bright">drama resolved</ToneBadge></div><AftermathMoment moment={aftermathFixture} departPressure={{ pressure: 0, band: { label: 'Safe' } }} escapeCostPreview={escapePreviewFixture} expeditionArc={arcFixture} /></Surface>
          <Surface className="self-start"><div className="mb-4 flex items-center justify-between gap-3"><MiniLabel>06 / What remains</MiniLabel><ToneBadge className="border-relic/45 bg-relic/10 text-exp-text">meaning</ToneBadge></div><MemoryCard memory={memoryFixture} label="Latest expedition" /><div className="mt-3"><BeatThisChallenge challenge={challengeFixture} compact /></div><button type="button" className="mt-3 min-h-12 w-full rounded border border-compass bg-compass px-4 font-display text-base font-semibold uppercase tracking-[0.16em] text-exp-dark hover:bg-compass-bright">Challenge the Lantern Route</button></Surface>
        </div>
        <div className="overflow-hidden rounded border border-exp-border/70 bg-exp-dark/35">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-exp-border/70 px-4 py-3"><div><MiniLabel>Expedition receipt</MiniLabel><p className="ds-copy mt-1 text-sm text-exp-text-dim">The path remains inspectable without making the player relive every setup panel.</p></div><ToneBadge>6 moments / 1 memory</ToneBadge></div>
          <div className="grid gap-px bg-exp-border/70 sm:grid-cols-3 xl:grid-cols-6">
            {lifecycle.map(([step, title, feeling]) => (
              <div key={title} className="bg-exp-panel/95 p-3">
                <div className="flex items-center justify-between gap-2"><span className="font-mono text-[9px] text-compass">{step}</span><span className="h-1.5 w-1.5 rounded-full bg-oxide-green" /></div>
                <p className="mt-3 font-display text-lg uppercase tracking-[0.12em] text-exp-text">{title}</p>
                <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-exp-text-dim">{feeling} / preserved</p>
              </div>
            ))}
          </div>
        </div>
        <details className="rounded border border-exp-border/70 bg-exp-panel/45 p-4">
          <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.2em] text-exp-text-dim">Inspect emotional pattern library</summary>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {emotionalBeats.map(([title, glyph, promise, motion, still, className]) => (
              <div key={title} className={`rounded border p-3 ${className}`}><div className="flex items-center justify-between gap-3"><p className="font-display text-lg uppercase tracking-[0.12em] text-exp-text">{title}</p><span className="grid h-8 w-8 place-items-center rounded-full border border-current/40 bg-exp-dark/30 font-mono text-sm" aria-hidden="true">{glyph}</span></div><p className="ds-copy mt-3 text-sm text-exp-text">{promise}</p><p className="mt-3 font-mono text-[9px] uppercase tracking-[0.14em]">Motion</p><p className="ds-copy mt-1 text-xs text-exp-text-dim">{motion}</p><p className="mt-2 font-mono text-[9px] uppercase tracking-[0.14em]">Reduced motion</p><p className="ds-copy mt-1 text-xs text-exp-text-dim">{still}</p></div>
            ))}
          </div>
        </details>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Surface className="self-start p-3"><div className="mb-3 flex items-center justify-between gap-3"><MiniLabel>02 / Stage</MiniLabel><ToneBadge>belonging</ToneBadge></div><StageComposition /></Surface>
        <Surface className="self-start p-3"><div className="mb-3 flex items-center justify-between gap-3"><MiniLabel>03-04 / Plan and commit</MiniLabel><ToneBadge className="border-blueprint/45 bg-blueprint/10 text-blueprint">agency + trust</ToneBadge></div><StateSummary lens={lens} eyebrow="Board state" /></Surface>
      </div>
      <div className="grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
        <Surface><div className="mb-4 flex items-center justify-between gap-3"><MiniLabel>05 / Resolve</MiniLabel><ToneBadge className="border-compass/45 bg-compass/10 text-compass-bright">drama</ToneBadge></div><AftermathMoment moment={aftermathFixture} departPressure={{ pressure: 78, band: { label: 'Redline' } }} escapeCostPreview={escapePreviewFixture} expeditionArc={arcFixture} /></Surface>
        <Surface><div className="mb-4 flex items-center justify-between gap-3"><MiniLabel>06 / Remember</MiniLabel><ToneBadge className="border-relic/45 bg-relic/10 text-exp-text">meaning</ToneBadge></div><MemoryCard memory={memoryFixture} label="Latest expedition" /><div className="mt-3"><BeatThisChallenge challenge={challengeFixture} compact /></div></Surface>
      </div>
      <Surface className="overflow-hidden p-3"><div className="mb-4 flex items-center justify-between gap-3"><MiniLabel>Shareable artifact</MiniLabel><ToneBadge className="border-oxide-green/45 bg-oxide-green/10 text-oxide-green">retention loop</ToneBadge></div><RunRelicCard card={relicCardFixture} compact /></Surface>
      <Surface>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><MiniLabel>Emotional pattern library</MiniLabel><h3 className="mt-2 font-display text-2xl uppercase tracking-[0.12em] text-exp-text">Joy has more than one temperature</h3></div><ToneBadge>motion + still equivalent</ToneBadge></div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {emotionalBeats.map(([title, glyph, promise, motion, still, className]) => (
            <div key={title} className={`rounded border p-3 ${className}`}>
              <div className="flex items-center justify-between gap-3"><p className="font-display text-lg uppercase tracking-[0.12em] text-exp-text">{title}</p><span className="grid h-8 w-8 place-items-center rounded-full border border-current/40 bg-exp-dark/30 font-mono text-sm" aria-hidden="true">{glyph}</span></div>
              <p className="ds-copy mt-3 text-sm text-exp-text">{promise}</p>
              <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.14em]">Motion</p><p className="ds-copy mt-1 text-xs text-exp-text-dim">{motion}</p>
              <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.14em]">Reduced motion</p><p className="ds-copy mt-1 text-xs text-exp-text-dim">{still}</p>
            </div>
          ))}
        </div>
      </Surface>
    </div>
  );
}

function ResponsiveContracts({ lens }) {
  const responsiveState = lensTurnState[lens] || lensTurnState.ready;
  const [playerFocused, setPlayerFocused] = useState(true);
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
      <Surface className="hidden overflow-hidden p-3 xl:block">
        <div className="mb-3 flex items-center justify-between gap-3"><MiniLabel>Wide cockpit / 1440+</MiniLabel><ToneBadge>real components</ToneBadge></div>
        <div className="overflow-hidden rounded border border-exp-border bg-exp-dark p-3">
          <MissionStatus turnState={responsiveState} movePathLength={lens === 'ready' ? 2 : 0} moveValidation={{ ok: true }} crewCount={4} />
          <div className="mt-3 grid gap-3 lg:grid-cols-[15rem_1fr]">
            <div className="space-y-3">
              <PlayerDossier player={playersFixture[0]} index={0} isCurrentUser isFocused={playerFocused} onFocus={() => setPlayerFocused((value) => !value)} />
              <InventoryPanel active={{ artifact: 'Sunstone Lens', relic: 'Moss Cipher', shield: true, campsite: true }} inactive={{ itemTypes: ['Rope'], itemBalances: [2] }} />
            </div>
            <StateSummary lens={lens} eyebrow="Responsive board state" />
          </div>
          <div className="mt-3"><ActionSimulator activeTab={Action.MOVE} movement={4} currentLocation="0,0" path={['1,0']} hasCampsiteKit hasSubmitted={false} isSpectator={false} /></div>
        </div>
        <p className="ds-copy mt-3 text-sm text-exp-text-dim">Real player, inventory, board, mission, and action components preserve their hierarchy inside the wide composition.</p>
      </Surface>
      <div className="ds-mobile-proof mx-auto w-full max-w-[22rem] bg-exp-dark sm:rounded-[2rem] sm:border-4 sm:border-exp-border sm:p-2 sm:shadow-xl">
        <div className="overflow-hidden bg-exp-surface sm:rounded-[1.45rem] sm:border sm:border-exp-border">
          <div className="mx-auto mt-2 hidden h-1.5 w-16 rounded-full bg-exp-border sm:block" />
          <div className="space-y-3 p-2 sm:p-3">
            <div className="flex items-center justify-between border-b border-exp-border pb-2"><div><MiniLabel>Phone / active turn</MiniLabel><p className="mt-1 text-sm text-exp-text">One decision, thumb distance.</p></div><span className="h-2 w-2 rounded-full bg-oxide-green" /></div>
            <MissionStatus turnState={responsiveState} movePathLength={lens === 'ready' ? 1 : 0} moveValidation={{ ok: true }} crewCount={4} />
            <div className="relative h-40 overflow-hidden rounded border border-exp-border bg-exp-dark">
              <img src="/images/art/environments/glassroot-cavern.webp" alt="Glassroot cavern route" className="h-full w-full object-cover opacity-75" />
              <span className="absolute inset-0 bg-gradient-to-t from-exp-dark via-transparent to-transparent" />
              <img src="/images/art/characters/routekeeper-strained.png" alt="The Routekeeper holding the escape route" className="absolute bottom-0 left-3 h-32 w-28 object-contain drop-shadow-[0_10px_10px_rgba(0,0,0,0.8)]" />
              <img src="/images/art/relics/sunstone-lens.png" alt="Sunstone Lens at risk" className="absolute bottom-2 right-3 h-20 w-20 object-contain drop-shadow-[0_8px_12px_rgba(0,0,0,0.75)]" />
              <p className="absolute bottom-2 left-32 right-20 font-mono text-[10px] uppercase tracking-[0.14em] text-compass-bright">Route open / relic exposed</p>
            </div>
            <StateSummary lens={lens} eyebrow="Compact board state" />
            <ActionSimulator activeTab={Action.MOVE} movement={4} currentLocation="0,0" path={['1,0']} hasCampsiteKit hasSubmitted={false} isSpectator={false} />
            <div className="sticky bottom-2 z-20 rounded border border-compass bg-exp-dark/95 p-2 shadow-[0_-12px_28px_rgba(0,0,0,0.55)] backdrop-blur">
              <button type="button" className="min-h-12 w-full rounded border border-compass bg-compass px-4 font-display text-base font-semibold uppercase tracking-[0.15em] text-exp-dark">{lens === 'danger' ? 'Depart with relic' : 'Submit move'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Standards() {
  return (
    <div className="space-y-4">
      <UIQualityStatus />
      <UXQualityStatus />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-blueprint/35 bg-blueprint/5 px-4 py-3">
        <div><MiniLabel>Evidence refreshed 2026-09-08</MiniLabel><p className="ds-copy mt-1 text-sm text-exp-text-dim">Automation is repeatable evidence. Manual verification is never implied by a green build.</p></div>
        <div className="flex flex-wrap gap-2"><code className="rounded border border-exp-border bg-exp-dark/65 px-2 py-1.5 font-mono text-[10px] text-blueprint-bright">npm run ui:quality</code><code className="rounded border border-exp-border bg-exp-dark/65 px-2 py-1.5 font-mono text-[10px] text-blueprint-bright">npm run ux:input</code></div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {accessibilityStandards.map(([title, body, status, evidence]) => {
          const automated = status === 'automated';
          const verified = status === 'manual verified';
          const badgeClass = automated ? 'border-blueprint/45 bg-blueprint/10 text-blueprint-bright' : verified ? 'border-oxide-green/45 bg-oxide-green/10 text-oxide-green-bright' : 'border-compass/45 bg-compass/10 text-compass-bright';
          return <Surface key={title} className="border-exp-border/65 bg-exp-panel/55"><div className="flex items-start justify-between gap-2"><p className="font-display text-xl uppercase tracking-[0.12em] text-exp-text">{title}</p><span className={`rounded border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] ${badgeClass}`}>{status}</span></div><p className="mt-3 font-mono text-xs leading-relaxed text-exp-text-dim">{body}</p><p className="mt-3 border-t border-exp-border/60 pt-2 font-mono text-[10px] leading-relaxed text-blueprint-bright">Evidence: {evidence}</p></Surface>;
        })}
      </div>
      <Surface className="overflow-hidden p-0">
        <div className="border-b border-exp-border p-4"><MiniLabel>Writing system / specific, calm, consequential</MiniLabel></div>
        <div className="divide-y divide-exp-border">
          {copyPairs.map(([moment, avoid, use]) => <div key={moment} className="grid gap-3 p-4 lg:grid-cols-[10rem_1fr_1fr]"><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-exp-text">{moment}</p><p className="rounded border border-signal-red/30 bg-signal-red/5 px-3 py-2 font-mono text-[11px] leading-relaxed text-exp-text-dim"><span className="mr-2 text-signal-red">Avoid</span>{avoid}</p><p className="rounded border border-oxide-green/30 bg-oxide-green/5 px-3 py-2 font-mono text-[11px] leading-relaxed text-exp-text"><span className="mr-2 text-oxide-green">Use</span>{use}</p></div>)}
        </div>
      </Surface>
      <Surface className="overflow-hidden p-0">
        <div className="border-b border-exp-border p-4"><MiniLabel>Language contract / one name per player concept</MiniLabel></div>
        <div className="divide-y divide-exp-border">
          {languageTerms.map(([term, meaning, rule]) => <div key={term} className="grid gap-2 p-4 lg:grid-cols-[9rem_1fr_1fr]"><p className="font-display text-lg uppercase tracking-[0.12em] text-compass-bright">{term}</p><p className="ds-copy text-sm text-exp-text">{meaning}</p><p className="ds-copy text-sm text-exp-text-dim">{rule}</p></div>)}
        </div>
      </Surface>
      <Surface>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><MiniLabel>Governance contract</MiniLabel><h3 className="mt-2 font-display text-2xl uppercase tracking-[0.12em] text-exp-text">Maturity must be earned</h3></div><a href="https://github.com/LuckyMachines/hexploration/blob/main/app/src/design-system/README.md" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded border border-blueprint/45 bg-blueprint/10 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-blueprint">Open governance</a></div>
        <div className="mt-4 grid gap-2 md:grid-cols-4">
          {[
            ['Proven', 'Source plus component and browser evidence.', 'border-oxide-green/40 text-oxide-green'],
            ['Verified', 'Source plus at least one automated proof.', 'border-blueprint/40 text-blueprint'],
            ['Audit', 'Implemented but missing current evidence.', 'border-compass/40 text-compass-bright'],
            ['Prototype', 'Exploratory and not production-ready.', 'border-relic/40 text-relic-bright'],
          ].map(([title, body, className]) => <div key={title} className={`rounded border bg-exp-dark/40 p-3 ${className}`}><p className="font-mono text-[10px] uppercase tracking-[0.18em]">{title}</p><p className="ds-copy mt-2 text-xs text-exp-text-dim">{body}</p></div>)}
        </div>
      </Surface>
    </div>
  );
}

function CoverageRegistry({ query, setQuery, status, setStatus }) {
  const filtered = useMemo(() => coverageRegistry.filter((item) => {
    const evidence = item[4];
    const haystack = [...item.slice(0, 4), evidence.source, ...evidence.evidence].join(' ').toLowerCase();
    return haystack.includes(query.trim().toLowerCase()) && (status === 'All' || item[3] === status);
  }), [query, status]);
  const provenCount = coverageRegistry.filter((item) => item[3] === 'Proven').length;
  return (
    <Surface className="overflow-hidden p-0" data-testid="coverage-registry">
      <div className="grid gap-3 border-b border-exp-border p-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div><label htmlFor="component-search" className="font-mono text-[10px] uppercase tracking-[0.2em] text-exp-text-dim">Search the game system</label><input id="component-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try board, wallet, loading, memory..." className="mt-2 min-h-11 w-full rounded border border-exp-border bg-exp-dark/60 px-3 font-mono text-xs text-exp-text outline-none placeholder:text-exp-text-dim/60 focus:border-blueprint focus:ring-2 focus:ring-blueprint/20" /></div>
        <div className="flex flex-wrap gap-2">{['All', 'Proven', 'Verified', 'Audit', 'Prototype'].map((item) => <button key={item} type="button" aria-pressed={status === item} onClick={() => setStatus(item)} className={`min-h-11 rounded border px-3 font-mono text-[10px] uppercase tracking-[0.14em] ${status === item ? 'border-compass/55 bg-compass/10 text-compass-bright' : 'border-exp-border bg-exp-dark/45 text-exp-text-dim'}`}>{item}</button>)}</div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-exp-border bg-exp-dark/35 px-4 py-3"><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-exp-text-dim"><span className="text-oxide-green">{provenCount} proven</span> / {coverageRegistry.length} mapped</p><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-exp-text-dim">Showing {filtered.length}</p></div>
      <div className="hidden grid-cols-[0.55fr_0.85fr_1.35fr_0.65fr_0.4fr] border-b border-exp-border bg-exp-dark/60 px-4 py-2 font-mono text-[9px] uppercase tracking-[0.18em] text-exp-text-dim md:grid"><span>Family</span><span>Pattern</span><span>State coverage</span><span>Owner</span><span>Status</span></div>
      <div className="divide-y divide-exp-border/70">
        {filtered.map(([family, pattern, states, itemStatus, evidence]) => (
          <div key={`${family}-${pattern}`} className="grid gap-2 px-4 py-3 md:grid-cols-[0.55fr_0.85fr_1.35fr_0.65fr_0.4fr] md:items-center">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-compass">{family}</p>
            <div>
              <p className="font-mono text-xs text-exp-text">{pattern}</p>
              <a href={`https://github.com/LuckyMachines/hexploration/blob/main/app/${evidence.source}`} target="_blank" rel="noreferrer" className="mt-1 block break-all font-mono text-[9px] text-blueprint hover:underline">{evidence.source}</a>
            </div>
            <div>
              <p className="font-mono text-[11px] leading-relaxed text-exp-text-dim">{states}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {evidence.evidence.length > 0 ? evidence.evidence.map((proof) => <a key={proof} href={`https://github.com/LuckyMachines/hexploration/blob/main/app/${proof}`} target="_blank" rel="noreferrer" className="rounded border border-exp-border/80 bg-exp-dark/40 px-1.5 py-0.5 font-mono text-[8px] text-exp-text-dim hover:border-blueprint/40 hover:text-blueprint">{proof.split('/').pop()}</a>) : <span className="font-mono text-[9px] text-signal-red">Evidence required</span>}
              </div>
            </div>
            <div><p className="font-mono text-[10px] uppercase tracking-[0.12em] text-exp-text-dim">{ownerByFamily[family]}</p><p className="mt-1 font-mono text-[8px] text-exp-text-dim">Reviewed {evidence.reviewedAt}</p></div>
            <span className={`w-fit rounded border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] ${itemStatus === 'Proven' ? 'border-oxide-green/40 bg-oxide-green/10 text-oxide-green' : itemStatus === 'Verified' ? 'border-blueprint/40 bg-blueprint/10 text-blueprint' : itemStatus === 'Audit' ? 'border-compass/40 bg-compass/10 text-compass-bright' : 'border-relic/40 bg-relic/10 text-relic-bright'}`}>{itemStatus}</span>
          </div>
        ))}
        {filtered.length === 0 && <p className="p-6 text-center font-mono text-xs text-exp-text-dim">No mapped patterns match this review filter.</p>}
      </div>
    </Surface>
  );
}

export default function DesignSystemPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [copied, setCopied] = useState(false);
  const validViews = designViews.map(([id]) => id);
  const validLenses = stateLenses.map(([id]) => id);
  const requestedView = searchParams.get('view');
  const requestedLens = searchParams.get('lens');
  const requestedCompareLens = searchParams.get('compareWith');
  const view = validViews.includes(requestedView) ? requestedView : 'all';
  const lens = validLenses.includes(requestedLens) ? requestedLens : 'ready';
  const compareLens = validLenses.includes(requestedCompareLens) && requestedCompareLens !== lens ? requestedCompareLens : lens === 'danger' ? 'ready' : 'danger';
  const compare = searchParams.get('compare') === '1';
  const reducedMotion = searchParams.get('motion') === 'reduce';
  const pseudo = searchParams.get('pseudo') === '1';
  const registryQuery = searchParams.get('q') || '';
  const requestedStatus = searchParams.get('maturity');
  const registryStatus = ['All', 'Proven', 'Verified', 'Audit', 'Prototype'].includes(requestedStatus) ? requestedStatus : 'All';
  const setParam = (key, value, defaultValue = '') => {
    const next = new URLSearchParams(searchParams);
    if (value === defaultValue || value === '' || value === false) next.delete(key);
    else next.set(key, value === true ? '1' : value);
    setSearchParams(next, { replace: true });
  };
  const copyReview = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  const resetReview = () => setSearchParams({}, { replace: true });
  const visible = (category) => view === 'all' || category === view;
  const visibleNav = sectionNav.filter(([, , category]) => category === 'all' || visible(category));
  return (
    <div className={`design-system-shell mx-auto max-w-[92rem] px-4 py-6 sm:px-6 lg:px-8 ${reducedMotion ? 'ux-reduced-motion' : ''}`}>
      <SystemHero />
      <CritiqueDeck
        view={view}
        setView={(value) => setParam('view', value, 'all')}
        lens={lens}
        setLens={(value) => setParam('lens', value, 'ready')}
        compare={compare}
        setCompare={(value) => setParam('compare', value, false)}
        compareLens={compareLens}
        setCompareLens={(value) => setParam('compareWith', value)}
        reducedMotion={reducedMotion}
        setReducedMotion={(value) => setParam('motion', value ? 'reduce' : '', '')}
        pseudo={pseudo}
        setPseudo={(value) => setParam('pseudo', value, false)}
        onCopyReview={copyReview}
        copied={copied}
        onReset={resetReview}
      />
      <div className="mt-7 grid gap-8 xl:grid-cols-[11rem_minmax(0,1fr)]">
        <aside className="hidden xl:block">
          <nav aria-label="Design system sections" className="sticky top-40 space-y-1 border-l border-exp-border pl-3">{visibleNav.map(([id, label]) => <a key={id} href={`#${id}`} className="flex min-h-11 items-center rounded-r border-l-2 border-transparent px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-exp-text-dim hover:border-compass hover:bg-compass/5 hover:text-exp-text">{label}</a>)}</nav>
          <Link to="/ui-lab" className="mt-5 inline-flex min-h-11 items-center rounded border border-blueprint/40 bg-blueprint/10 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-blueprint">Open UI lab</Link>
          <Link to="/art-lab" className="mt-2 inline-flex min-h-11 items-center rounded border border-relic/40 bg-relic/10 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-relic-bright">Open art lab</Link>
          <Link to="/material-lab" className="mt-2 inline-flex min-h-11 items-center rounded border border-compass/40 bg-compass/10 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-compass-bright">Open material lab</Link>
        </aside>
        <main className="min-w-0">
          {view === 'all' && <Section id="overview" eyebrow="System map" title="Design the feeling across the whole run" body="Each phase has one emotional job. Components succeed only when they preserve that handoff."><SystemMap /></Section>}
          {visible('foundation') && <Section id="foundations" eyebrow="01 / Foundations" title="A restrained expedition instrument" body="Tokens make hierarchy repeatable. Warm compass light signals agency; cooler colors explain systems; red always names a cost."><Foundations /></Section>}
          {visible('components') && <Section id="controls" eyebrow="02 / Controls" title="Every verb shows its stakes before commitment" body="Controls are tactile, explicit, keyboard-visible, and stable across wallet and transaction states."><ActionConsoleSpec /><ControlMatrix /></Section>}
          {visible('gameplay') && <Section id="board" eyebrow="03 / Board language" title="The board owns the stage" body={`The ${lens} lens changes pressure, route, presence, copy, and action posture together - without moving the player's mental map.`}>{compare && <StateComparison lens={lens} compareLens={compareLens} />}<GameplayState lens={lens} /></Section>}
          {visible('gameplay') && <Section id="gameplay" eyebrow="04 / Crew systems" title="Players read self, crew, and readiness in one scan" body="Identity, condition, inventory, and submission state use the same compact grammar at every expedition phase."><PlayerSystems lens={lens} /></Section>}
          {visible('components') && <Section id="feedback" eyebrow="05 / Feedback" title="State changes are calm, specific, and recoverable" body="Color, words, geometry, and motion agree. A player should never wonder whether the game heard them."><FeedbackSystem /></Section>}
          {visible('journeys') && <Section id="journeys" eyebrow="06 / Journey compositions" title="The pieces become a coherent expedition" body="Canonical compositions expose hierarchy and handoffs that isolated components cannot reveal."><JourneyCompositions lens={lens} /></Section>}
          {visible('journeys') && <Section id="responsive" eyebrow="07 / Responsive contracts" title="Reflow protects priority at every scale" body="The phone is not a tiny desktop. The same decision model becomes a deliberate stack with the command nearest the thumb."><ResponsiveContracts lens={lens} /></Section>}
          {visible('standards') && <Section id="standards" eyebrow="08 / Product standards" title="Accessibility and writing are system primitives" body="A game that communicates clearly creates more confidence, more tension, and more joy for more players."><Standards /></Section>}
          {visible('standards') && <Section id="registry" eyebrow="09 / Coverage registry" title="One review surface for the whole game" body="Search every family, open its implementation and proof, and distinguish proven behavior from work that still needs review."><CoverageRegistry query={registryQuery} setQuery={(value) => setParam('q', value)} status={registryStatus} setStatus={(value) => setParam('maturity', value, 'All')} /></Section>}
        </main>
      </div>
    </div>
  );
}
