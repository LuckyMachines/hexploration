# Hexploration

An on-chain multiplayer explore & escape game where players work together to explore uncharted planets and recover buried artifacts.

- 1st place winner of Polygon Gaming prize @ Chainlink Spring 22 Hackathon
- Recipient of Chainlink Top Quality prize @ Chainlink Spring 22 Hackathon

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

### Mock VRF

The deployment uses mock VRF mode (no Chainlink subscription needed). The automation worker fulfills randomness requests locally. To enable mock VRF on an existing deployment:

```bash
node scripts/enable-mock-vrf.mjs
```

## Project Structure

```
hexploration/
  contracts/         24 Solidity contracts
  script/            Foundry deploy scripts
  scripts/           Worker + diagnostic Node scripts
  app/               React SPA (Vite + Wagmi + TailwindCSS)
  abi/               Contract ABIs for the frontend
  lib/               Git submodules (forge-std, OpenZeppelin, etc.)
  deployments.json   Deployed contract addresses by network
```

## Current Sepolia Deployment

Owner: `0x98609e60FDd4C5fB656a4C4A7D229c515bDE139b`

Key addresses:
- Board: `0xE1baE692be42980760C661c31338EEcfed2D9e33`
- Controller: `0x5B5F1Fecc66FDc4c5028e7Ca7510aa8870A0Dd36`
- Game Queue: `0x77c5886c1e2be7E4100C31607D4E1EBF3965B484`

See `deployments.json` for all contract addresses.

## License

GPL-3.0
