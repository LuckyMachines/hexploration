# Authoritative game service

Players interact with Xenovoya as a conventional server-authoritative game. The browser creates an opaque, expiring play session and sends `create`, `join`, and `action` commands to the game authority. It never asks for a wallet, signature, network switch, gas payment, or transaction inspection.

Internally, the service deterministically derives a distinct signing identity for each opaque session from `GAME_AUTHORITY_SECRET`. The derived key exists only in server memory. The dedicated relay account submits accepted commands and pays Sepolia fees. The public API returns encrypted operation references and the states `processing`, `complete`, or `failed`; hashes, addresses, gas, RPC URLs, and chain identifiers stay inside operator logs and the protected ledger.

## Production boundary

- Deploy the updated controller and `XenovoyaSessionForwarder`, then grant the forwarder `ACTION_FORWARDER_ROLE`.
- Configure `GAME_AUTHORITY_REGISTRY_ADDRESS`, `GAME_AUTHORITY_READ_ADDRESSES`, `GAME_AUTHORITY_SECRET`, and the existing service-only values from `sponsor-relay.env.example` in Coolify. Generate the authority secret independently from the admin token and signing key. The read-address list must contain every deployed contract queried by the player client.
- Reverse-proxy the service below the player origin (recommended: `/api`) and configure the player build with `VITE_GAME_AUTHORITY_URL=https://play.xenovoya.com/api`. Keep signing keys, RPC credentials, limits, and admin credentials server-only.
- Leave `SPONSOR_RELAY_LEGACY_API=false`. This removes the old browser-signed sponsorship routes from the public API.
- Browser reads use the authenticated `/v1/game/state` boundary. It accepts only read methods, restricts contract calls and logs to the configured game addresses, and bounds history queries.
- Run one service replica with persistent `/data` storage, TLS, exact origin allowlisting, trusted-proxy validation, and alerts on readiness, low balance, pauses, daily cost, and rejected commands.

## Spend policy

The defaults cap one command at 0.003 test ETH and the whole service at 0.03 test ETH per UTC day, with independent gas, per-player, per-hour, IP, and concurrency limits. These ceilings are intentionally generous safety rails, not target prices. A 10 gwei maximum fee and 0.05 gwei priority-fee ceiling keep ordinary Sepolia settlement responsive without bidding aggressively; when the required base fee exceeds the ceiling, the service waits instead of overspending. Compatible crew actions arriving inside 175 ms share one transaction, while a failed combined simulation automatically falls back to isolated submissions. Gas reservations include 10% execution headroom, which improves reliability without increasing actual charges for unused gas.

Only authoritative commands settle; route planning, animation, previews, polling, and intermediate presentation remain free client/server work. Once a receipt arrives, the ledger replaces its conservative reservation with actual gas used and actual effective price so unused headroom does not consume the daily play allowance.

Tune `SPONSOR_RELAY_MAX_FEE_PER_GAS_WEI` from observed inclusion latency rather than lowering it blindly. The most durable savings come from action batching and avoiding redundant writes, not from a cap that makes ordinary play fail. Fund a dedicated Sepolia account with only the next operating window, never the deployment/admin account. The ledger reserves worst-case cost before submission and fails closed if balance, deployment wiring, role assignment, simulation, fee policy, or any budget is invalid.

Operators can read the current reconciled daily action, gas, and wei totals from authenticated `GET /admin/budget`. This endpoint is never available without the administrator bearer token.

The service must be deployed and the upgraded contracts wired before enabling `VITE_CONTROLLER_SUPPORTS_DELEGATION=true` in production. Until then, keep the current release live rather than exposing a partially configured managed-play path.
