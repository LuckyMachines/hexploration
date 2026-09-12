# Session, Performance, and Social System Report Card

## Snapshot 1 - Baseline (2026-09-10)

Overall: **C+**

| Dimension | Grade | Primary gap |
| --- | --- | --- |
| Runtime performance | B- | Overlapping polling and full-history event scans |
| Loading | C+ | Independent spinners without coordinated hydration |
| Save integrity | B+ | Strong cloud conflict handling but a localStorage-only device record |
| Pause and resume | C | No canonical lifecycle or unresolved-transaction recovery |
| Parties | C | Create, list, join, and copy-link only |
| Friends and presence | D | No relationship, safety, invite-token, or presence model |
| Improvement automation | C+ | No dedicated contract, scenarios, or budgets |

## A bar, stricter

Every player transition is explicit and recoverable; confirmed actions are never lost or duplicated; cached and cold resume meet budgets; hidden tabs perform no unnecessary work; party membership and invitation mutations are durable and replay-safe; presence reveals no identity without a relationship; discovery does not expose wallets; all recovery and social scenarios pass with 1-4 synthetic players; and deployed percentile evidence is required before claiming a production A.

## Snapshot 2 - Implemented automated-system pass (2026-09-10)

Overall: **A (automated implementation), B (production evidence)**

| Dimension | Grade | Evidence |
| --- | --- | --- |
| Runtime performance | A- | Shared query policy, multicall, event invalidation, hidden-tab suspension, RPC fallback, renderer visibility suspension, route chunking, and enforced bundle budgets |
| Loading | A- | Canonical hydration phases, cached-query restoration, progressive status, preserved prior data, and route prefetch |
| Save integrity | A | Checksummed IndexedDB snapshots, local fallback, outbox, cross-tab locking, idempotent mutations, version reconciliation, and visible save states |
| Pause and resume | A- | Soft-pause semantics, background/reconnect states, cached restoration, and unresolved transaction confirmation; production timing is not yet calibrated |
| Parties | A- | Durable privacy/capacity/state/version model, readiness, leadership, removal, discovery, preferences, game linkage, and reconnect restoration |
| Friends and presence | A- | Callsign search, requests, favorites, recent co-players, blocks, reports, relationship-scoped TTL presence, and SSE invalidation |
| Improvement automation | A | Versioned contract, strict doctor, 24 required scenarios, bundle gates, tests, report generation, and registry integration |

Migration 006 and its save/social lifecycle have also passed an isolated PostgreSQL 16 run, including a second idempotent migration pass and cascade cleanup. The production-evidence grade remains B until migration deployment, exact contract rollout, synthetic deployed journeys, and enough real runtime samples are recorded. This is deliberately not represented as a completed production A.

## Snapshot 3 - On-chain player experience pass (2026-09-10)

Overall: **A- (local implementation), B (production evidence)**

| Dimension | Grade | Evidence |
| --- | --- | --- |
| Wallet-free observation | A | Read-chain and wallet-chain state are separate; public expedition state loads without a connected wallet and custom RPC lists never drift to an implicit endpoint |
| Action confidence | A | Exact `eth_call` preflight, optional gas estimate, explicit signature/broadcast/confirmation phases, optimistic intent, and readable failure recovery |
| Receipt recovery | A- | Device-persisted and cross-tab receipts reconcile while disconnected, require two confirmations, handle replacements, and surface unresolved broadcasts |
| Canonical history | A | Chain-and-contract-scoped cache, bounded backfill, 12-block canonical recheck, removed-log handling, readable chronicle, and explorer proofs |
| Portable continuity | A- | Resume links and downloadable expedition passports preserve public chain/game/contract proof identifiers; a second production client is not yet verified |
| Delegated and sponsored actions | A- | Scoped, expiring, usage-limited session forwarder; ephemeral browser session keys; exact preflight; durable replay-safe relay; bounded batches; layered spend limits; low-balance readiness; emergency pause; and a real local grant-use journey with only one wallet approval |
| Real-chain journey | A | Fresh Anvil deployment, real seeded expedition, live board restoration, and gameplay capture pass end to end |
| Production release | B | Build and protocol are deployment-ready, but the legacy live controller has not been migrated and no secured sponsor relay is being claimed as live |

### A bar, stricter

Promote the whole experience to A only after the updated controller and forwarder are deployed and role-verified, the single-instance relay is deployed with persistent state and a dedicated funded key, grant-use-expiry-exhaustion-revoke journeys pass against Sepolia, portable resume is proven in a second compatible client, and deployed p75/p95 transaction and restoration evidence meets the quality contract.
