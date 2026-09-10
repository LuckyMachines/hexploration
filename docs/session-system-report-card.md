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
| Improvement automation | A | Versioned contract, strict doctor, 15 required scenarios, bundle gates, tests, report generation, and registry integration |

Migration 006 and its save/social lifecycle have also passed an isolated PostgreSQL 16 run, including a second idempotent migration pass and cascade cleanup. The production-evidence grade remains B until migration deployment, exact contract rollout, synthetic deployed journeys, and enough real runtime samples are recorded. This is deliberately not represented as a completed production A.
