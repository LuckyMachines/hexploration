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
| **Randomness** | Mock VRF (default) or Chainlink VRF v2 |
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

Hexploration requires two things to keep running: **automation** (advancing game phases) and **randomness** (card draws, dice rolls, events). Both are pluggable.

### AutoLoop (default)

The automation worker (`scripts/hexploration-worker.mjs`) handles both automation and randomness out of the box:

- Polls `shouldProgressLoop()` on Controller, Gameplay, and GameSetup contracts every 5 seconds
- Calls `progressLoop()` to advance game phases when ready
- Fulfills mock VRF randomness requests on-chain
- No external subscriptions or token balances needed

This is the recommended way to run Hexploration. Just start the worker:

```bash
node scripts/hexploration-worker.mjs
```

Configure via `scripts/hexploration-worker.env.example`. The worker needs a funded private key to submit transactions.

### Chainlink VRF (alternative)

The contracts also support Chainlink VRF v2 for provably fair randomness. To switch from mock VRF to Chainlink:

1. Create and fund a Chainlink VRF subscription
2. Call `setVRFSubscriptionID(subscriptionId)` on GameSetup and Queue contracts
3. Add the contract addresses as consumers on your VRF subscription

The `AutomationCompatibleInterface` (`checkUpkeep`/`performUpkeep`) is implemented on both `HexplorationController` and `HexplorationGameplay`, so Chainlink Automation can also replace the worker for phase advancement if desired.

### How the Automation Loop Works

```
Player submits action → Controller tracks submission
                              ↓
         All players submit OR 10-min timeout
                              ↓
         Controller.shouldProgressLoop() → true
                              ↓
         Worker calls progressLoop() → Queue enters Processing phase
                              ↓
         Queue requests randomness (mock or Chainlink VRF)
                              ↓
         Randomness fulfilled → stored in Queue
                              ↓
         Gameplay.shouldProgressLoop() → true
                              ↓
         Worker calls progressLoop() → processes actions, advances state
                              ↓
         New queue created for next turn
```

## Quick Start

```bash
# Build contracts
forge build

# Run the SPA
cd app && npm install && npm run dev

# Run the automation worker
node scripts/hexploration-worker.mjs
```

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
| `populate-decks.mjs` | Populates all 5 card decks from `onchain-data.json` |
| `check-hex-status.mjs` | Reads on-chain state to verify deployment is correctly wired |
| `enable-mock-vrf.mjs` | Enables mock VRF mode on deployed contracts |
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
