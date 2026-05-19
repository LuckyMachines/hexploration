import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../components/shared/EmptyState';
import Spinner from '../components/shared/Spinner';
import TxStatus from '../components/shared/TxStatus';
import SurveyTabletFrame from '../components/layout/SurveyTabletFrame';
import StatBar from '../components/player/StatBar';

const colorTokens = [
  ['exp-dark', 'Base void', 'bg-exp-dark', '#0d0f0a'],
  ['exp-surface', 'App surface', 'bg-exp-surface', '#151a12'],
  ['exp-panel', 'Panel body', 'bg-exp-panel', '#1a2016'],
  ['exp-border', 'Quiet border', 'bg-exp-border', '#2a3224'],
  ['compass', 'Primary action', 'bg-compass', '#c4a64a'],
  ['oxide-green', 'Recovery/success', 'bg-oxide-green', '#40a080'],
  ['blueprint', 'Information/planning', 'bg-blueprint', '#3a7cc4'],
  ['signal-red', 'Danger/failure', 'bg-signal-red', '#d44040'],
  ['relic', 'Artifact/rare beat', 'bg-relic', '#9060c0'],
];

const actionPatterns = [
  ['Move', 'Route changes, path previews, board answers.', 'M', 'border-blueprint/45 bg-blueprint/10 text-blueprint'],
  ['Camp', 'Create safety and future recovery.', 'C', 'border-oxide-green/45 bg-oxide-green/10 text-oxide-green'],
  ['Dig', 'High payoff with visible pressure.', 'D', 'border-relic/45 bg-relic/10 text-exp-text'],
  ['Rest', 'Lower danger, restore agency.', 'R', 'border-oxide-green/45 bg-oxide-green/10 text-oxide-green'],
  ['Help', 'Co-op rescue and shared momentum.', 'H', 'border-compass/45 bg-compass/10 text-compass-bright'],
  ['Flee', 'Final commitment under pressure.', 'F', 'border-signal-red/45 bg-signal-red/10 text-signal-red'],
];

const statusTones = [
  ['Idle', 'border-exp-border/70 bg-exp-dark/45 text-exp-text-dim'],
  ['Ready', 'border-compass/45 bg-compass/10 text-compass-bright'],
  ['Resolving', 'border-blueprint/45 bg-blueprint/10 text-blueprint'],
  ['Confirmed', 'border-oxide-green/45 bg-oxide-green/10 text-oxide-green'],
  ['Failed', 'border-signal-red/45 bg-signal-red/10 text-signal-red'],
];

const densityRules = [
  ['Persistent HUD', 'Only current action, phase, essential stats, and one primary command stay visible.'],
  ['Secondary info', 'Move into drawers, details, tabs, hover/tap surfaces, or post-action readouts.'],
  ['Board priority', 'The board keeps the largest uninterrupted area in active play.'],
  ['High information', 'Use it during submit/resolve moments, then return to quiet state.'],
];

function Section({ id, eyebrow, title, body, children }) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-exp-border/70 py-10 first:border-t-0 first:pt-0">
      <div className="mb-5 max-w-3xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-compass">{eyebrow}</p>
        <h2 className="mt-2 font-display text-2xl uppercase tracking-[0.14em] text-exp-text sm:text-3xl">{title}</h2>
        {body && <p className="mt-3 font-mono text-sm leading-relaxed text-exp-text-dim">{body}</p>}
      </div>
      {children}
    </section>
  );
}

function Surface({ children, className = '' }) {
  return (
    <div className={`rounded border border-exp-border bg-exp-panel/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] ${className}`}>
      {children}
    </div>
  );
}

function ToneBadge({ children, className = 'border-exp-border bg-exp-dark/45 text-exp-text-dim' }) {
  return (
    <span className={`inline-flex rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] ${className}`}>
      {children}
    </span>
  );
}

function DesignBoard() {
  const cells = [
    ['jungle', 'J', 'bg-jungle/45 border-jungle/70'],
    ['fog', '', 'bg-exp-dark/80 border-exp-border'],
    ['landing', 'L', 'bg-landing/45 border-landing/70'],
    ['plains', 'P', 'bg-plains/40 border-plains/70'],
    ['camp', 'C', 'bg-oxide-green/35 border-oxide-green/70'],
    ['crew', '', 'bg-compass/25 border-compass/90'],
    ['relic', '', 'bg-relic/40 border-relic/80'],
    ['danger', '', 'bg-signal-red/25 border-signal-red/70'],
    ['mountain', 'M', 'bg-mountain/40 border-mountain/75'],
    ['path', '', 'bg-blueprint/25 border-blueprint/80'],
    ['fog', '', 'bg-exp-dark/80 border-exp-border'],
    ['plains', 'P', 'bg-plains/40 border-plains/70'],
  ];
  return (
    <div className="rounded border border-exp-border bg-exp-dark/55 p-4">
      <div className="grid grid-cols-4 gap-2">
        {cells.map(([key, label, color], index) => (
          <div
            key={`${key}-${index}`}
            className={`${color} flex aspect-[1.12] items-center justify-center border text-center font-mono text-[10px] uppercase tracking-[0.12em] text-exp-text shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]`}
            style={{ clipPath: 'polygon(25% 4%, 75% 4%, 100% 50%, 75% 96%, 25% 96%, 0 50%)' }}
          >
            {key === 'crew' && <span className="alive-explorer-ready h-4 w-4 rounded-full border border-compass-bright bg-exp-dark" />}
            {key === 'relic' && <span className="alive-relic-pulse h-3 w-3 rounded-full bg-compass-bright" />}
            {key === 'danger' && <span className="alive-pressure-urgent h-8 w-8 rounded-full border border-signal-red/80" />}
            {key === 'path' && <span className="alive-route-locked h-1 w-12 rounded bg-blueprint" />}
            {label}
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <ToneBadge className="border-compass/45 bg-compass/10 text-compass-bright">current player</ToneBadge>
        <ToneBadge className="border-blueprint/45 bg-blueprint/10 text-blueprint">planned route</ToneBadge>
        <ToneBadge className="border-signal-red/45 bg-signal-red/10 text-signal-red">pressure</ToneBadge>
      </div>
    </div>
  );
}

function ActionConsoleSpec() {
  const [active, setActive] = useState('Move');
  const activeAction = actionPatterns.find(([label]) => label === active) || actionPatterns[0];
  return (
    <Surface>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-exp-border pb-3">
        <div>
          <p className="font-display text-xs uppercase tracking-[0.25em] text-exp-text-dim">Action Console</p>
          <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">One action is selected, explained, previewed, then submitted.</p>
        </div>
        <ToneBadge className="border-compass/45 bg-compass/10 text-compass-bright">ready to plan</ToneBadge>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-6">
        {actionPatterns.map(([label, , glyph, className]) => (
          <button
            key={label}
            type="button"
            onClick={() => setActive(label)}
            className={`alive-action-tab rounded border px-3 py-3 text-left transition ${active === label ? className : 'border-exp-border bg-exp-dark/45 text-exp-text-dim'}`}
          >
            <span className="block font-display text-xl uppercase tracking-[0.12em]">{glyph}</span>
            <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.16em]">{label}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className={`rounded border p-3 ${activeAction[3]}`}>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] opacity-75">{activeAction[0]} intent</p>
          <p className="mt-2 font-mono text-sm leading-relaxed text-exp-text">{activeAction[1]}</p>
          <p className="mt-2 font-mono text-[11px] leading-relaxed text-exp-text-dim">Show cost, risk, blocked reason, and likely board response before the commit button.</p>
        </div>
        <button type="button" className="alive-commit-button rounded border border-compass/55 bg-compass/15 px-4 py-3 font-display text-sm font-semibold uppercase tracking-[0.18em] text-compass-bright">
          Submit {activeAction[0]}
        </button>
      </div>
    </Surface>
  );
}

function StatusMatrix() {
  return (
    <div className="grid gap-3 md:grid-cols-5">
      {statusTones.map(([label, className]) => (
        <Surface key={label} className={className}>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] opacity-75">{label}</p>
          <p className="mt-2 font-mono text-xs leading-relaxed">Use this tone consistently across panels, buttons, state chips, and feedback copy.</p>
        </Surface>
      ))}
    </div>
  );
}

function TokenGrid() {
  return (
    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
      {colorTokens.map(([name, role, className, hex]) => (
        <Surface key={name}>
          <div className={`h-16 rounded border border-white/10 ${className}`} />
          <p className="mt-3 font-mono text-xs uppercase tracking-[0.16em] text-exp-text">{name}</p>
          <p className="mt-1 font-mono text-[11px] text-exp-text-dim">{role}</p>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-exp-text-dim">{hex}</p>
        </Surface>
      ))}
    </div>
  );
}

function TypeSpecimen() {
  return (
    <Surface>
      <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-compass">Typography</p>
      <h3 className="mt-3 font-display text-4xl uppercase leading-none tracking-[0.12em] text-exp-text">Expedition Interface</h3>
      <p className="mt-4 max-w-3xl font-mono text-sm leading-relaxed text-exp-text-dim">
        Display type is reserved for brand, page titles, and short command labels. Monospace carries state, telemetry, details, and readable game facts.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">Display</p>
          <p className="mt-1 font-display text-2xl uppercase tracking-[0.16em] text-compass-bright">Ready</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">Label</p>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.28em] text-blueprint">Queue resolving</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">Body</p>
          <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text">The crew catches breath, and the next decision has room to matter.</p>
        </div>
      </div>
    </Surface>
  );
}

function DensitySpec() {
  return (
    <div className="grid gap-3 lg:grid-cols-4">
      {densityRules.map(([title, body]) => (
        <Surface key={title}>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-exp-text">{title}</p>
          <p className="mt-2 font-mono text-[11px] leading-relaxed text-exp-text-dim">{body}</p>
        </Surface>
      ))}
    </div>
  );
}

function FeedbackSpec() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-3">
        <EmptyState title="No surveys found" body="Connect when you want live sessions. Public scenarios remain available." tone="gold" />
        <EmptyState title="Failed to load" body="The action is recoverable. Keep the next command obvious." tone="red" />
      </div>
      <div className="space-y-3">
        <TxStatus isPending />
        <TxStatus isConfirming hash="0x1234567890abcdef1234567890abcdef12345678" />
      </div>
      <div className="space-y-3">
        <TxStatus isSuccess hash="0x1234567890abcdef1234567890abcdef12345678" />
        <div className="rounded border border-exp-border bg-exp-dark/60 px-3 py-3 font-mono text-xs text-exp-text-dim">
          <div className="flex items-center gap-2 text-compass-bright">
            <Spinner size="h-4 w-4" />
            <span className="uppercase tracking-[0.18em]">Scanning surveys</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ComponentInventory() {
  const items = [
    ['Board', 'Hex grid, fog, player marker, landing marker, route overlay, terrain legend, presence layer.'],
    ['Action', 'Action panel, movement control, camp, dig, rest, help, submit confirmation, receipt drawer.'],
    ['Player', 'Dossier, stat bars, hand slots, inventory, readiness.'],
    ['Feedback', 'Tx status, empty states, modal, event log, fun pulse, automation status.'],
    ['Layout', 'Header, footer, survey tablet frame, density controls, field manual.'],
    ['Growth', 'Scenario cards, share cards, replay, devlog, progress, discovery topics.'],
  ];
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map(([title, body]) => (
        <Surface key={title}>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-compass-bright">{title}</p>
          <p className="mt-2 font-mono text-[11px] leading-relaxed text-exp-text-dim">{body}</p>
        </Surface>
      ))}
    </div>
  );
}

export default function DesignSystemPage() {
  const navItems = useMemo(() => [
    ['tokens', 'Tokens'],
    ['type', 'Type'],
    ['surfaces', 'Surfaces'],
    ['board', 'Board'],
    ['actions', 'Actions'],
    ['states', 'States'],
    ['density', 'Density'],
    ['inventory', 'Inventory'],
  ], []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Surface>
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-compass">Design system</p>
            <h1 className="mt-2 font-display text-3xl uppercase tracking-[0.12em] text-exp-text">Xenovoya UI</h1>
            <p className="mt-3 font-mono text-xs leading-relaxed text-exp-text-dim">
              A living reference for the game interface: quiet by default, alive on input, readable under pressure.
            </p>
            <nav className="mt-5 grid gap-2">
              {navItems.map(([id, label]) => (
                <a key={id} href={`#${id}`} className="rounded border border-exp-border/75 bg-exp-dark/35 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-exp-text-dim hover:border-compass/40 hover:text-exp-text">
                  {label}
                </a>
              ))}
            </nav>
            <Link to="/ui-lab" className="mt-5 inline-flex rounded border border-blueprint/40 bg-blueprint/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-blueprint">
              Open UI lab
            </Link>
          </Surface>
        </aside>

        <div>
          <Section
            id="tokens"
            eyebrow="Foundation"
            title="Tokens carry the expedition tone"
            body="The palette separates surface, primary command, recovery, information, danger, terrain, and artifact beats."
          >
            <TokenGrid />
          </Section>

          <Section
            id="type"
            eyebrow="Voice"
            title="Typography is compact, readable, and intentional"
            body="Display type gives commands weight. Monospace keeps state, labels, telemetry, and instructions scan-friendly."
          >
            <TypeSpecimen />
          </Section>

          <Section
            id="surfaces"
            eyebrow="Shell"
            title="Panels frame tools without stealing the board"
            body="Cards are for repeated items and framed tools. Gameplay sections should leave enough negative space for the main action."
          >
            <SurveyTabletFrame title="Pattern Sample" subtitle="Use for live game cockpit and system-heavy views" status="READY">
              <div className="grid gap-3 md:grid-cols-3">
                <Surface>
                  <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">Metric</p>
                  <p className="mt-1 font-mono text-xl text-compass-bright">64</p>
                </Surface>
                <Surface className="border-blueprint/30 bg-blueprint/5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-blueprint">Planning</p>
                  <p className="mt-1 font-mono text-xs text-exp-text">Route preview visible.</p>
                </Surface>
                <Surface className="border-oxide-green/30 bg-oxide-green/5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-oxide-green">Recovery</p>
                  <p className="mt-1 font-mono text-xs text-exp-text">Rest creates room.</p>
                </Surface>
              </div>
            </SurveyTabletFrame>
          </Section>

          <Section
            id="board"
            eyebrow="Gameplay"
            title="The board remains the visual priority"
            body="The design language protects silhouettes, route intent, fog, pressure, player position, and current action clarity."
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(280px,0.55fr)]">
              <DesignBoard />
              <Surface>
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">Board rules</p>
                <ul className="mt-3 space-y-2 font-mono text-xs leading-relaxed text-exp-text-dim">
                  <li>Use motion as feedback, not decoration.</li>
                  <li>Keep current player, route, risk, and landing readable.</li>
                  <li>Let fog, relics, and danger create texture without filling every corner.</li>
                  <li>When the player does nothing, idle state still breathes.</li>
                </ul>
              </Surface>
            </div>
          </Section>

          <Section
            id="actions"
            eyebrow="Controls"
            title="Actions are physical verbs with visible stakes"
            body="The action console names the verb, previews the likely feeling, explains blocked states, then commits deliberately."
          >
            <ActionConsoleSpec />
          </Section>

          <Section
            id="states"
            eyebrow="Feedback"
            title="State language stays consistent across the game"
            body="Idle, ready, resolving, success, and failure use the same color, motion, copy, and border logic everywhere."
          >
            <StatusMatrix />
            <div className="mt-4">
              <FeedbackSpec />
            </div>
          </Section>

          <Section
            id="density"
            eyebrow="Readability"
            title="Negative space is gameplay space"
            body="Persistent UI should stay minimal; deep information belongs in drawers, details, tabs, and post-action readouts."
          >
            <DensitySpec />
          </Section>

          <Section
            id="inventory"
            eyebrow="Inventory"
            title="Component inventory maps the full game UI"
            body="This page is the shared language for future implementation, marketing, testing, and design review."
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.72fr)_minmax(300px,0.55fr)]">
              <ComponentInventory />
              <Surface>
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">Player stats</p>
                <div className="mt-4 space-y-3">
                  <StatBar label="Movement" value={4} />
                  <StatBar label="Agility" value={3} />
                  <StatBar label="Dexterity" value={2} />
                </div>
                <div className="mt-5 grid gap-2">
                  <ToneBadge className="border-relic/45 bg-relic/10 text-exp-text">artifact held</ToneBadge>
                  <ToneBadge className="border-compass/45 bg-compass/10 text-compass-bright">share-worthy moment</ToneBadge>
                  <ToneBadge className="border-signal-red/45 bg-signal-red/10 text-signal-red">redline risk</ToneBadge>
                </div>
              </Surface>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
