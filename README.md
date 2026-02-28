# Hexploration

A fully on-chain multiplayer explore & escape game. Land on an uncharted planet, navigate a hex grid shrouded in fog, recover ancient relics, and make it back alive. Every action, dice roll, and card draw lives on-chain -- no hidden server state, no trust required.

Built on the [Lucky Machines Game Core](https://github.com/LuckyMachines/game-core) framework with Chainlink VRF for provably fair randomness.

- 1st place winner of Polygon Gaming prize @ Chainlink Spring 22 Hackathon
- Recipient of Chainlink Top Quality prize @ Chainlink Spring 22 Hackathon

## Why Play

- **Fully on-chain** -- all game state, randomness, and resolution happen in smart contracts. No backend server, no hidden information asymmetry.
- **Cooperative tension** -- players share a board but compete for relics. Help each other survive, or race ahead and leave them behind.
- **Emergent strategy** -- fog of war, random events, and inventory management mean no two games play the same way.
- **Verifiable fairness** -- supports Chainlink VRF for provably random dice rolls, card draws, and event triggers. Mock VRF available for testing and low-cost deployments.

## The Game

1-4 players land on an unexplored planet represented by a 10x10 hexagonal grid. The goal: **explore the map, collect relics, and escape back to the landing site before your stats run out.**

### How It Works

1. **Land** -- all players start at the landing site. The rest of the grid is hidden under fog of war.
2. **Explore** -- on your turn, choose an action: **Move** to a new hex, **Dig** for artifacts, **Camp** to set up a safe point, **Rest** to recover stats, **Help** another player, or **Flee** back to the landing site.
3. **Discover** -- moving into unexplored hexes reveals terrain (Jungle, Plains, Desert, Mountain) and triggers card draws: events, ambushes, treasures, and relics.
4. **Survive** -- your character has three stats: **Movement**, **Agility**, and **Dexterity**. Events and combat drain them. If any stat hits zero, you're out.
5. **Escape** -- return to the landing site with relics in your inventory to win. But don't wait too long -- the planet gets more dangerous at night.

### Key Mechanics

- **Day/Night cycle** -- day phases let players move and explore freely. Night phases trigger random events, enemies, and disasters.
- **Card decks** -- 5 on-chain decks (Event, Ambush, Treasure, Land, Relic) are shuffled and drawn during gameplay. What you draw changes everything.
- **Items & inventory** -- find shields, campsites, and tools. Equip items in your left/right hand slots. Manage limited inventory space.
- **Combat** -- enemies appear during exploration and at night. Agility determines your odds. Failing costs stats.
- **Relics** -- scattered across the map. Dig to find them. Collect enough and escape to win.

### At a Glance

| | |
|---|---|
| **Players** | 1-4 per game |
| **Board** | 10x10 hex grid with fog of war |
| **Terrain** | Jungle, Plains, Desert, Mountain, Landing, Relic |
| **Actions** | Move, Dig, Camp, Rest, Help, Flee |
| **Stats** | Movement, Agility, Dexterity |
| **Randomness** | AutoLoop VRF (recommended), Mock VRF, or Chainlink VRF v2 |
| **Contracts** | 25 Solidity contracts |

## Contract Architecture

25 Solidity contracts organized by role:

### Core Game Loop

| Contract | Purpose |
|----------|---------|
| **HexplorationController** | Player action submission (move, explore, rest, help) |
| **HexplorationGameplay** | Main gameplay logic and turn processing |
| **HexplorationGameplayUpdates** | Gameplay state mutation helpers |
| **HexplorationStateUpdate** | Phase transitions and state advancement |
| **HexplorationQueue** | Pending game update queue for automation |

### Board & Zones

| Contract | Purpose |
|----------|---------|
| **HexplorationBoard** | 10x10 hex grid extending Game Core's HexGrid |
| **HexplorationZone** | Zone logic for hex tiles |
| **HexplorationRules** | Ruleset defining movement, capacity, and game parameters |

### Data & Inventory

| Contract | Purpose |
|----------|---------|
| **CharacterCard** | Player character stats (movement, agility, dexterity) |
| **TokenInventory** | Per-player token/item tracking |
| **GameToken** | ERC-1155 token contract for game state tokens |
| **CardDeck** | On-chain shuffled card deck with draw mechanics |

### Game Tokens (6 GameToken instances)

DayNight, Disaster, Enemy, Item, PlayerStatus, Relic -- each tracks a different aspect of game state per zone or player.

### Card Decks (5 CardDeck instances)

Event, Ambush, Treasure, Land, Relic -- each deck is populated from `scripts/onchain-data.json` and drawn during gameplay.

### Support Contracts

| Contract | Purpose |
|----------|---------|
| **RollDraw** | Dice rolling and card drawing logic |
| **RelicManagement** | Relic placement and collection |
| **RandomnessConsumer** | Chainlink VRF / mock VRF randomness |
| **VRFVerifier** | ECVRF proof verification library |
| **AutoLoopVRFCompatible** | Abstract base for VRF-enabled AutoLoop contracts |
| **RandomIndices** | Random index generation for shuffling |
| **StateUpdateHelpers** | Shared state update utilities |
| **StringToUint** | String-to-number conversion for coordinate parsing |
| **Utilities** | General-purpose utility functions |
| **GameWallets** | Player wallet management for gas subsidization |

### Read-Only Summary Contracts

| Contract | Purpose |
|----------|---------|
| **GameSummary** | High-level game state queries |
| **PlayerSummary** | Per-player state queries |
| **PlayZoneSummary** | Per-zone state queries |
| **GameEvents** | Centralized event emission |
| **GameSetup** | Game initialization and configuration queries |

## Automation & Randomness

Hexploration requires two things to keep running: **automation** (advancing game phases) and **randomness** (card draws, dice rolls, events). Both are pluggable. Three randomness modes are supported:

### AutoLoop VRF (recommended)

The recommended approach. The worker generates an ECVRF proof off-chain, passes it to `progressLoop()`, and the contract verifies the proof on-chain — all in one transaction. Cheaper, faster, and cryptographically verifiable without Chainlink fees.

```bash
# One-time setup
node scripts/register-vrf-key.mjs      # Register worker's VRF public key
node scripts/enable-autoloop-vrf.mjs    # Enable VRF mode on contracts

# Run the worker
USE_AUTOLOOP_VRF=true node scripts/hexploration-worker.mjs
```

How it works:
- Worker polls `shouldProgressLoop()` — no randomness check needed (randomness comes with the proof)
- Worker computes `seed = keccak256(gameplayAddress, loopID)` and generates an ECVRF proof
- Worker wraps the proof + game data into a VRF envelope and calls `progressLoop(vrfEnvelope)`
- On-chain: `progressLoop()` verifies the ECVRF proof, extracts randomness, writes it to Queue, then processes the turn
- GameSetup still uses Mock VRF (one-time cold path, not worth VRF overhead)

### AutoLoop with Mock VRF (testing)

The simplest setup for testing and development. Uses blockhash-based pseudo-randomness:

```bash
node scripts/hexploration-worker.mjs
```

- Polls `shouldProgressLoop()` on Controller, Gameplay, and GameSetup contracts every 5 seconds
- Calls `progressLoop()` to advance game phases when ready
- Fulfills mock VRF randomness requests on-chain (separate transaction)
- No external subscriptions or token balances needed

### Chainlink VRF (alternative)

Chainlink VRF v2 for provably fair randomness without running your own worker:

1. Create and fund a Chainlink VRF subscription
2. Call `setVRFSubscriptionID(subscriptionId)` on GameSetup and Queue contracts
3. Add the contract addresses as consumers on your VRF subscription

The `AutomationCompatibleInterface` (`checkUpkeep`/`performUpkeep`) is implemented on both `HexplorationController` and `HexplorationGameplay`, so Chainlink Automation can also replace the worker for phase advancement.

### How the Automation Loop Works

**AutoLoop VRF mode:**
```
Player submits action → Controller tracks submission
                              ↓
         All players submit OR 10-min timeout
                              ↓
         Controller.shouldProgressLoop() → true
                              ↓
         Worker calls progressLoop() → Queue enters Processing phase
                              ↓
         Gameplay.shouldProgressLoop() → true (no randomness wait)
                              ↓
         Worker generates ECVRF proof for seed(address, loopID)
                              ↓
         Worker calls progressLoop(vrfEnvelope)
                              ↓
         On-chain: verify proof → extract randomness → write to Queue → process turn
                              ↓
         New queue created for next turn
```

**Mock VRF mode:**
```
Player submits action → Controller tracks submission
                              ↓
         All players submit OR 10-min timeout
                              ↓
         Controller.shouldProgressLoop() → true
                              ↓
         Worker calls progressLoop() → Queue enters Processing phase
                              ↓
         Queue requests randomness (mock VRF)
                              ↓
         Worker fulfills mock randomness → stored in Queue
                              ↓
         Gameplay.shouldProgressLoop() → true
                              ↓
         Worker calls progressLoop() → processes actions, advances state
                              ↓
         New queue created for next turn
```

### Enabling AutoLoop VRF

To switch an existing deployment from Mock VRF to AutoLoop VRF:

```bash
# 1. Register the worker's VRF public key on Gameplay
node scripts/register-vrf-key.mjs

# 2. Enable AutoLoop VRF on Queue and Gameplay contracts
node scripts/enable-autoloop-vrf.mjs

# 3. Start the worker with VRF mode
USE_AUTOLOOP_VRF=true node scripts/hexploration-worker.mjs
```

To switch back to Mock VRF:
```bash
node scripts/enable-autoloop-vrf.mjs --disable
node scripts/hexploration-worker.mjs
```

### Cost Comparison

Estimated costs per game round and per full game (10-round average) on Ethereum mainnet at current prices (Feb 2026: ETH ~$1,850, LINK ~$8.20, gas ~0.5 gwei).

| | AutoLoop VRF | AutoLoop (Mock VRF) | Chainlink VRF + Automation |
|---|---|---|---|
| **VRF cost per round** | Included in progressLoop (~50K extra gas for proof verification) = ~$0.00005 | Gas only: ~400K gas = ~$0.0004 | Gas + 20% LINK premium. ~$0.002 |
| **Transactions per round** | 3 (GameSetup VRF + Controller loop + Gameplay VRF loop) | 5 (2 VRF fulfills + 3 loops) | 5 (Chainlink handles VRF + automation) |
| **Automation cost per round** | Gas only: ~1.1M gas = ~$0.001 | Gas only: ~1.1M gas = ~$0.001 | Gas + LINK premium. ~$0.003 |
| **Total per round** | **~$0.001** | **~$0.0014** | **~$0.005** |
| **Per 10-round game** | **~$0.01** | **~$0.014** | **~$0.05** |
| **Per 100 games** | **~$1.00** | **~$1.40** | **~$5.00** |
| **Requires LINK tokens** | No | No | Yes |
| **Requires VRF subscription** | No | No | Yes |
| **Requires running a worker** | Yes | Yes | No |
| **Provably fair randomness** | Yes (ECVRF proof on-chain) | No (blockhash) | Yes (Chainlink VRF proof) |

**Bottom line:** AutoLoop VRF gives you provably fair randomness at the lowest cost. Mock VRF is cheapest for testing. Chainlink is hands-off but costs ~5x more.

## Quick Start

```bash
# Build contracts
forge build

# Run the SPA
cd app && npm install && npm run dev

# Run the automation worker
node scripts/hexploration-worker.mjs
```

## Local Development

Run the entire stack locally with a single command -- Anvil chain, deployed contracts, populated card decks, a seeded game, the automation worker, and the Vite frontend:

```bash
npm run local
```

This takes about 60 seconds to boot. When you see the `Local Stack Running` banner, open `http://localhost:5502` in your browser.

### What it does

1. Starts an [Anvil](https://book.getfoundry.sh/reference/anvil/) local chain on port 9955 (chain ID 31337)
2. Deploys all 25 contracts via `forge script`
3. Populates all 5 card decks from `onchain-data.json`
4. Seeds an open 2-player game so you can join immediately
5. Writes `app/.env.local` with the deployed addresses
6. Starts the automation worker (2s poll interval)
7. Starts the Vite dev server on port 5502

### MetaMask setup

Add a custom network in MetaMask:

| Field | Value |
|-------|-------|
| Network name | Anvil Local |
| RPC URL | `http://127.0.0.1:9955` |
| Chain ID | `31337` |
| Currency symbol | ETH |

Import the Anvil default account (pre-funded with 10,000 ETH):

```
Private key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
Address:     0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
```

### Configuration

| Env var | Default | Description |
|---------|---------|-------------|
| `ANVIL_PORT` | `9955` | Port for the Anvil RPC server |

```bash
# Use a different port
ANVIL_PORT=8545 npm run local
```

### Stopping

Press `Ctrl+C` to cleanly shut down Anvil, the worker, and the dev server.

### Notes

- `app/.env.local` is gitignored (covered by the `.env.*` pattern) and is overwritten on each run
- The existing `npm run worker` and `npm run dev` commands still work unchanged for Sepolia

## Deployment

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Node.js 18+
- Sepolia ETH for deployment

### Deploy

```bash
# 1. Create .env at repo root
cp .env.example .env
# Edit .env with your PRIVATE_KEY and SEPOLIA_RPC_URL

# 2. Deploy all contracts + wire + register tokens + create grid
forge script script/DeployHexploration.s.sol --rpc-url sepolia --broadcast

# 3. Update deployments.json with new addresses from output

# 4. Populate card decks (reads from scripts/onchain-data.json)
node scripts/populate-decks.mjs

# 5. Update app/.env with new VITE_* addresses

# 6. Verify deployment
node scripts/check-hex-status.mjs
```

Full deployment costs approximately 0.00014 ETH on Sepolia. Deploys in mock VRF mode by default (no Chainlink subscription needed).

## Frontend

The SPA in `app/` is built with React 19, Vite, Wagmi 2, viem, and TailwindCSS. Dark expedition-themed UI with custom colors and fonts (Barlow Condensed for headings, JetBrains Mono for data).

### Pages

- **`/`** -- Expedition Console. Browse active games, create new expeditions (select 1-4 players), join open games. Game cards show ID, player count, and registration status.
- **`/game/:gameId`** -- Routes between three views based on game state:
  - **Lobby** -- Crew manifest showing registered players, join/start buttons
  - **Expedition Bench** -- Full game UI (see below)
  - **Game Over** -- Final results and winner

### Expedition Bench (Active Game)

The main gameplay screen is a dashboard layout:

- **Top bar** -- Day/Night badge, current phase, day counter
- **Hex grid** (left 2/3) -- SVG hexagonal grid with fog of war. Terrain tiles (Jungle, Plains, Desert, Mountain, Landing, Relic) reveal as players explore. Player position markers, landing site highlight, movement path overlay, and terrain legend.
- **Expedition Crew** (right 1/3) -- Player dossiers showing address, current zone, three stat bars (Movement, Agility, Dexterity), active/inactive status, and action-submitted indicators
- **Action Console** -- Tabbed interface with 6 actions: Move, Camp, Dig, Rest, Help, Flee
- **Turn Results** -- Displays action outcomes and card draws after each phase
- **Event Log** -- Real-time feed of on-chain game events

### Contract Integration

The SPA reads from 8 contracts (Board, Controller, GameSummary, PlayerSummary, GameEvents, Queue, GameSetup, GameRegistry) via 15+ custom Wagmi hooks with polling intervals (3-10s). Writes go through the Controller for game actions and the Board for game creation/registration. All contract events are watched in real-time.

### Help System

Built-in Field Manual modal with 4 tabs: Overview, Actions, Terrain types, and How to Play tutorial.

### Running

```bash
cd app && npm install && npm run dev
```

### Environment Variables

```
VITE_RPC_URL                     # Sepolia RPC endpoint
VITE_WALLETCONNECT_PROJECT_ID    # WalletConnect project ID (optional)
VITE_BOARD_ADDRESS               # HexplorationBoard contract
VITE_CONTROLLER_ADDRESS          # HexplorationController contract
VITE_GAME_SUMMARY_ADDRESS        # GameSummary contract
VITE_PLAYER_SUMMARY_ADDRESS      # PlayerSummary contract
VITE_GAME_EVENTS_ADDRESS         # GameEvents contract
VITE_GAME_REGISTRY_ADDRESS       # GameRegistry contract
VITE_GAME_QUEUE_ADDRESS          # HexplorationQueue contract
VITE_GAME_SETUP_ADDRESS          # GameSetup contract
```

## Project Structure

```
hexploration/
├── contracts/              # 25 Solidity contracts
├── script/
│   └── DeployHexploration.s.sol  # Foundry deploy script
├── scripts/
│   ├── hexploration-worker.mjs   # Automation worker
│   ├── populate-decks.mjs        # Populate card decks on-chain
│   ├── check-hex-status.mjs      # Verify deployment status
│   ├── enable-mock-vrf.mjs       # Enable mock VRF mode
│   ├── enable-autoloop-vrf.mjs   # Enable/disable AutoLoop VRF mode
│   ├── register-vrf-key.mjs     # Register worker VRF public key
│   ├── run-local-stack.mjs       # Local full-stack orchestrator
│   ├── ecvrf-prover.mjs         # ECVRF proof generation library
│   ├── pull-onchain-data.mjs     # Pull game data from chain
│   ├── onchain-data.json         # Card deck + token data
│   └── hexploration-worker.env.example
├── app/                    # React SPA (Vite + Wagmi + TailwindCSS)
│   ├── src/
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── abi/                    # Contract ABIs for frontend
├── lib/                    # Git submodules (forge-std, game-core, OpenZeppelin)
├── deployments.json        # Deployed contract addresses by network
├── foundry.toml
└── remappings.txt
```

## Scripts Reference

| Script | Description |
|--------|-------------|
| `hexploration-worker.mjs` | Automation worker -- polls for pending games, fulfills VRF, advances phases |
| `run-local-stack.mjs` | Boots full local stack: Anvil + contracts + decks + worker + frontend |
| `populate-decks.mjs` | Populates all 5 card decks from `onchain-data.json` |
| `check-hex-status.mjs` | Reads on-chain state to verify deployment is correctly wired |
| `enable-mock-vrf.mjs` | Enables mock VRF mode on deployed contracts |
| `enable-autoloop-vrf.mjs` | Enables/disables AutoLoop VRF mode on deployed contracts |
| `register-vrf-key.mjs` | Registers worker's VRF public key on Gameplay contract |
| `ecvrf-prover.mjs` | ECVRF proof generation library (used by worker in VRF mode) |
| `pull-onchain-data.mjs` | Pulls current game/card data from deployed contracts |

## Current Sepolia Deployment

Owner: `0x98609e60FDd4C5fB656a4C4A7D229c515bDE139b`

Key addresses:
- Board: `0xE1baE692be42980760C661c31338EEcfed2D9e33`
- Controller: `0x5B5F1Fecc66FDc4c5028e7Ca7510aa8870A0Dd36`
- Game Queue: `0x77c5886c1e2be7E4100C31607D4E1EBF3965B484`

See `deployments.json` for all contract addresses.

## License

GPL-3.0
