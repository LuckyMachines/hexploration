import { Action, Tile } from '../lib/constants';
import { TurnState } from '../lib/turnState';
import MissionStatus from '../components/expedition/MissionStatus';
import ActionSimulator from '../components/actions/ActionSimulator';
import MoveControl from '../components/actions/MoveControl';
import BoardPresence from '../components/board/BoardPresence';
import { buildRouteStatus } from '../lib/routeStatus';

const STATES = [
  { state: TurnState.PLANNING, label: 'Planning', phaseLabel: 'Submission', copy: 'Choose an action and preview the consequence before submitting.' },
  { state: TurnState.WAITING_CREW, label: 'Waiting Crew', phaseLabel: 'Submission', copy: 'Your action is locked. Waiting for the crew.', waitingFor: 1, hasSubmitted: true },
  { state: TurnState.RESOLVING, label: 'Resolving', phaseLabel: 'Processing', copy: 'Submitted actions are resolving through the queue.', isResolving: true, hasSubmitted: true },
  { state: TurnState.SPECTATING, label: 'Watching', phaseLabel: 'Submission', copy: 'This wallet is observing the expedition.' },
];

const INPUT_STATES = [
  { label: 'Idle', inputMode: 'mouse', inputCadence: 'idle', lastInputKind: 'wait', analogPressure: 0.05 },
  { label: 'Keyboard', inputMode: 'keys', inputCadence: 'steady', lastInputKind: 'move', analogPressure: 0.42 },
  { label: 'Controller', inputMode: 'pad', inputCadence: 'urgent', lastInputKind: 'commit', analogPressure: 0.9 },
  { label: 'Observing', inputMode: 'mouse', inputCadence: 'idle', lastInputKind: 'observe', analogPressure: 0.12, isObserving: true },
];

export default function GameUILab() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-5">
        <h1 className="font-display text-2xl uppercase tracking-[0.2em] text-exp-text">
          Game UI Lab
        </h1>
        <p className="mt-2 font-mono text-xs text-exp-text-dim">
          Integrated states for mission copy, action validation, board presence, input feel, and turn status.
        </p>
      </div>

      <section className="mb-4 rounded border border-exp-border bg-exp-panel p-4">
        <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-exp-text-dim">
          Input Feel Harness
        </h2>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          {INPUT_STATES.map((input) => (
            <div key={input.label} className="rounded border border-exp-border/60 bg-exp-dark/40 p-3">
              <svg viewBox="-90 -90 180 180" className="h-44 w-full">
                <BoardPresence
                  currentLocation="0,0"
                  intentAlias={input.inputMode === 'pad' ? '1,1' : '1,0'}
                  intentTile={{ tileType: input.inputMode === 'pad' ? Tile.RELIC : Tile.JUNGLE }}
                  activeAction={input.inputMode === 'pad' ? Action.FLEE : Action.MOVE}
                  path={input.inputMode === 'pad' ? ['1,0', '1,1'] : ['1,0']}
                  previewPath={input.inputMode === 'pad' ? ['1,0', '1,1'] : ['1,0']}
                  inputMode={input.inputMode}
                  isObserving={input.isObserving}
                  movement={3}
                  stats={{ movement: 3, agility: 2, dexterity: 4 }}
                  controlFeel={{
                    ...input,
                    fatigue: input.inputMode === 'pad' ? 0.76 : 0.15,
                    intentIsDanger: input.inputMode === 'pad',
                    activeInventory: { shield: input.inputMode === 'pad', leftHandItem: 'Compass' },
                    routeStatus: buildRouteStatus({ currentLocation: '0,0', path: ['1,0'], movement: 3 }),
                  }}
                />
              </svg>
              <MoveControl
                currentLocation="0,0"
                movement={3}
                path={input.inputMode === 'mouse' ? [] : ['1,0']}
                validation={{ ok: input.inputMode !== 'pad', reason: input.inputMode === 'pad' ? 'Relic route requires one more step.' : 'Path is valid.' }}
                routeStatus={buildRouteStatus({
                  currentLocation: '0,0',
                  path: input.inputMode === 'mouse' ? [] : ['1,0'],
                  movement: 3,
                  validation: { ok: input.inputMode !== 'pad', reason: 'Relic route requires one more step.' },
                  activeInventory: { shield: input.inputMode === 'pad' },
                  companionLocations: [{ isNearIntent: input.inputMode === 'keys' }],
                })}
                disabled
              />
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {STATES.map((turnState, index) => (
          <section key={turnState.state} className="rounded border border-exp-border bg-exp-panel p-4">
            <MissionStatus
              turnState={turnState}
              movePathLength={index === 0 ? 2 : 0}
              moveValidation={{ ok: true, reason: 'Path is valid' }}
              crewCount={4}
            />

            <div className="mt-4 rounded border border-exp-border/60 bg-exp-dark/45 p-3">
              <svg viewBox="-80 -90 180 180" className="h-64 w-full">
                <BoardPresence
                  currentLocation="0,0"
                  intentAlias={index === 2 ? '1,1' : '1,0'}
                  intentTile={{ tileType: index === 2 ? Tile.RELIC : Tile.JUNGLE }}
                  activeAction={index === 1 ? Action.DIG : Action.MOVE}
                  path={index === 0 ? ['1,0'] : []}
                  previewPath={index === 0 ? ['1,0', '1,1'] : []}
                  hasSubmitted={turnState.hasSubmitted}
                  isResolving={turnState.isResolving}
                  isSpectator={turnState.state === TurnState.SPECTATING}
                  isObserving={index === 3}
                  inputMode={index === 0 ? 'keys' : 'pad'}
                  currentPlayerIndex={0}
                  movement={3}
                  stats={{ movement: index === 2 ? 1 : 3, agility: 2, dexterity: 4 }}
                  companionLocations={[{ zone: '1,1', index: 1, isNearIntent: true }]}
                  controlFeel={{
                    analogPressure: index === 2 ? 0.9 : 0.35,
                    inputCadence: index === 2 ? 'urgent' : 'steady',
                    lastInputKind: index === 1 ? 'commit' : 'move',
                    fatigue: index === 2 ? 0.8 : 0.2,
                    intentIsDanger: index === 2,
                    activeInventory: { shield: index === 2, leftHandItem: 'Compass' },
                  }}
                />
              </svg>
            </div>

            <div className="mt-4">
              <ActionSimulator
                activeTab={Action.MOVE}
                movement={3}
                currentLocation="0,0"
                path={index === 0 ? ['1,0', '1,1'] : []}
                hasCampsiteKit
                hasSubmitted={turnState.hasSubmitted}
                isSpectator={turnState.state === TurnState.SPECTATING}
              />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
