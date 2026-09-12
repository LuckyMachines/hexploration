# On-chain player experience

The chain is the authoritative game engine. The browser makes that engine feel immediate, legible, and recoverable without inventing a second source of truth.

## Action lifecycle

1. Local outcome forecast explains the likely game consequence.
2. `eth_call` simulation validates the exact contract request against current state.
3. The wallet signs only after simulation succeeds.
4. The planned route remains visible as optimistic intent while the transaction confirms.
5. The receipt is saved locally and reconciled after reload, reconnect, replacement, or revert.
6. Confirmed events invalidate cached contract reads and rebuild the board from chain state.

Statuses are: `simulating`, `ready`, `awaiting_signature`, `submitted`, `confirming`, `replaced`, `confirmed`, `reverted`, `failed`, and `unresolved`.

## Observation and history

- Read-only visitors use the configured game network even if an unconnected browser wallet happens to be set to another chain.
- Recent events are cached locally for fast restoration.
- Confirmed history is backfilled automatically.
- The last 12 blocks are re-read so orphaned logs disappear after a reorganization.
- The expedition chronicle converts raw logs into readable chapters with explorer proofs.
- The exported expedition passport contains chain, game, contract, resume URL, and latest proof identifiers so another compatible client can restore the same public game.

## Delegated and sponsored actions

`XenovoyaSessionForwarder` is deliberately separate from the main controller. A player can authorize a session key for one board and one game, with both an expiry and an action limit. The player can revoke it immediately.

The forwarder supports:

- direct session-key transactions;
- replay-protected EIP-712 signed actions submitted by a gas sponsor;
- bounded relay batches of up to eight signed actions;
- owner signatures without a session grant;
- per-signer nonces and signature deadlines.

The controller exposes only `submitActionFor` to accounts holding `ACTION_FORWARDER_ROLE`. This keeps delegation authority narrow and leaves the controller comfortably below the EIP-170 deployment-size limit.

### Sponsor relay architecture

The relay never receives the player's wallet key. The browser creates an ephemeral session key, keeps it in per-tab `sessionStorage`, and asks the player's wallet for one on-chain grant scoped to one player, board, and game. The grant expires after eight hours or 30 actions and can be revoked immediately. Each later action is an EIP-712 signature with a forwarder nonce and a short deadline.

Before the relay spends Sepolia ETH it:

1. validates the chain, forwarder, controller, board, payload bounds, signature deadline, and recovered signer;
2. confirms the exact nonce and current on-chain session authorization;
3. simulates the exact forwarder call from the relay account;
4. estimates gas and maximum fee, then atomically reserves per-request, per-session, per-player, and global budgets;
5. submits once, records the transaction durably, and returns the same hash for duplicate signed requests; and
6. waits for the configured confirmation count while the browser independently reconciles the receipt.

The HTTP surface is deliberately small: `GET /livez`, readiness-oriented `GET /healthz`, `GET /v1/sponsor/config`, `POST /v1/sponsor/actions`, `POST /v1/sponsor/actions/batch`, `GET /v1/sponsor/actions/:hash`, and authenticated `POST /admin/pause` or `/admin/resume`. Exact-origin CORS, request-size and concurrency limits, proxy-aware request throttling, cost ceilings, nonce-managed relay submissions, low-balance readiness, structured logs, graceful shutdown, a non-root container, and an emergency stop are included. The container platform probes `/livez`; alerts probe `/healthz`, so an intentional pause stays live but cannot spend gas.

The current JSON ledger is intentionally a single-instance Sepolia design. Mount `/data` on persistent storage and run exactly one relay replica. Do not horizontally scale it until the reservations and idempotency records use a shared transactional store such as PostgreSQL or Redis.

### Sepolia activation

Use a dedicated relay wallet, not the deployer wallet, and keep only a small operating balance in it. Copy `sponsor-relay.env.example` into the host's encrypted secret store, set the deployed addresses, a dedicated relay private key, a random admin token, and the exact player origin, then run `npm run relay:doctor`. The doctor must report the correct chain, adequate balance, deployed forwarder bytecode, matching immutable controller, and a granted `ACTION_FORWARDER_ROLE` before the service is advertised.

Deploy `Dockerfile.sponsor-relay` on an HTTPS-capable container host, mount `/data`, and expose the service only through HTTPS. Configure the player build with `VITE_SESSION_FORWARDER_ADDRESS`, `VITE_SPONSOR_RELAY_URL`, and `VITE_CONTROLLER_SUPPORTS_DELEGATION=true` only after the doctor passes. Start paused for the first release, fund the dedicated relay address from the Sepolia treasury wallet, run a grant-use-revoke canary, and then resume through the authenticated admin endpoint.

Never place `SPONSOR_RELAYER_PRIVATE_KEY` in a `VITE_*` variable, browser bundle, repository file, log, or client-visible hosting setting. Rotate the relay key and admin token after any suspected disclosure, pause first, and revoke the old wallet's host secret before resuming.

## Deployment order

1. Deploy the updated `XenovoyaController`.
2. Deploy `XenovoyaSessionForwarder` with the controller address.
3. Grant the forwarder through `addActionForwarder`.
4. Complete the normal controller, board, queue, setup, event, and summary wiring.
5. Configure `VITE_SESSION_FORWARDER_ADDRESS`.
6. Set `VITE_CONTROLLER_SUPPORTS_DELEGATION=true` only after on-chain role verification.
7. Deploy the sponsor relay with persistent state, fund its dedicated Sepolia wallet, and require a passing relay doctor and grant-use-revoke canary before advertising sponsored actions.

Never enable the frontend delegation flag against the legacy production controller. That release uses direct player authorization and cannot safely accept forwarded actions.

## Verification snapshot

The 2026-09-10 implementation pass is verified by:

- 225 passing client tests across 67 files;
- 193 passing system and quality tests, including eight focused relay tests;
- 6 passing session-forwarder contract tests;
- a strict 29/29 session-quality report;
- production-mode compilation of 812 modules;
- controller and forwarder runtime bytecode below EIP-170 limits; and
- a fresh-chain seeded Playwright journey that grants, uses, and revokes a scoped session while proving the sponsored game action caused no second wallet transaction.

This is deployment-ready, not a claim that delegation or sponsorship is already active in production. Production activation requires the controller/forwarder migration, role verification, relay security controls, and deployed browser evidence listed in the session-system release gates.
