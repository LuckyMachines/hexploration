# Session, Performance, and Social System Checklist

- [x] Define one versioned player-session lifecycle and authority boundary.
- [x] Replace aggressive hidden-tab polling with coordinated query policy and event invalidation.
- [x] Replace block-zero event scans with indexed, bounded, cursor-based, confirmation-aware history loading.
- [x] Add progressive restore state and retain cached data during revalidation.
- [x] Add checksummed IndexedDB snapshots, an offline outbox, BroadcastChannel updates, and Web Lock serialization.
- [x] Add idempotent mutation identities to cloud return and social writes.
- [x] Restore unresolved transactions and reconcile wallet, chain, party, game, and cached state.
- [x] Define soft pause explicitly so the shared world continues while player focus is paused.
- [x] Add durable party creation, discovery, readiness, ownership, capacity, privacy, and game linkage.
- [x] Add expiring, usage-limited, revocable deep-link invitations with native share and QR output.
- [x] Add callsign search, friend requests, favorites, recent players, removal, blocking, and reporting.
- [x] Add expiring presence, authenticated SSE invalidation, and a polling fallback.
- [x] Add expedition filtering, quick join, party preferences, and route prefetching.
- [x] Define measurable performance, save, reconnect, lobby, and integrity budgets and collect browser samples.
- [x] Add an automated-only quality contract, strict doctor, scenario coverage, and report registry entry.

## Verification and release gates

- [x] Apply migrations 001-006 twice to a fresh isolated PostgreSQL database and prove the social/save lifecycle with cleanup.
- [ ] Apply migration `006_session_social` to production.
- [ ] Deploy return API contract `2026-09-10.1` before deploying the matching player bundle.
- [ ] Run synthetic 1-4 browser-context recovery and social journeys against the deployed release.
- [ ] Collect sufficient deployed p75/p95 samples to promote measured performance from provisional to verified.
