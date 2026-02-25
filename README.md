# Hexploration

An on-chain multiplayer explore & escape game where players work together to explore uncharted planets and recover buried artifacts.

- 1st place winner of Polygon Gaming prize @ Chainlink Spring 22 Hackathon
- Recipient of Chainlink Top Quality prize @ Chainlink Spring 22 Hackathon

## Game Overview

1-4 players explore a 10x10 hexagonal grid, collecting artifacts and surviving events to escape before their stats hit zero.

- **Day/Night cycle** -- day phases let players move and explore; night phases trigger random events
- **Card draws** -- land tiles, events, ambushes, treasures, and relics are drawn from on-chain card decks
- **Combat & items** -- players find items, fight enemies, and manage inventory
- **Escape** -- reach the landing zone with enough artifacts before your movement/agility/dexterity run out

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

Full deployment costs approximately 0.00014 ETH on Sepolia.

### Mock VRF

The deployment uses mock VRF mode (no Chainlink subscription needed). The automation worker fulfills randomness requests locally. To enable mock VRF on an existing deployment:

```bash
node scripts/enable-mock-vrf.mjs
```

## Worker

The automation worker (`scripts/hexploration-worker.mjs`) keeps the game running by:

- Polling for games that need updates (pending VRF fulfillment or phase advancement)
- Fulfilling mock VRF randomness requests on-chain
- Advancing game phases (processing queued state updates)

Configure via `scripts/hexploration-worker.env.example`. The worker needs a funded private key to submit transactions.

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
