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

## On-chain player experience

- [x] Keep public observation available without connecting a wallet.
- [x] Simulate the exact contract request before opening the wallet.
- [x] Keep optimistic player intent visible through confirmation without presenting it as final chain state.
- [x] Persist, reconcile, and explain submitted, replaced, reverted, failed, unresolved, and confirmed receipts.
- [x] Require two confirmations before recovered transactions become final in the UI.
- [x] Scope cached events by chain, GameEvents contract, and game; re-read the reorg window before presenting canonical history.
- [x] Turn raw events into a readable expedition chronicle with proof links and a downloadable portable passport.
- [x] Add a narrowly authorized session forwarder with board/game scope, expiry, action limits, revocation, typed signatures, nonces, deadlines, and bounded batches.
- [x] Deploy and exercise the forwarder in the fresh-chain end-to-end harness.
- [x] Add the server-side sponsor relay with signature recovery, exact chain simulation, nonce and authorization checks, durable idempotency, single and batch submission, receipt tracking, and readiness checks.
- [x] Add per-IP, per-session, per-player, gas, transaction-cost, and global daily sponsorship limits plus authenticated pause and resume controls.
- [x] Add the browser grant, sponsored-use, receipt-recovery, expiry/exhaustion disclosure, and revoke experience with an ephemeral per-tab session key.
- [x] Prove locally that one wallet grant can be followed by a real sponsored game action without a second wallet transaction.
- [x] Verify the real seeded expedition restores into the playable board rather than waiting on an undeclared Multicall3 contract.

## Verification and release gates

- [x] Apply migrations 001-006 twice to a fresh isolated PostgreSQL database and prove the social/save lifecycle with cleanup.
- [ ] Apply migration `006_session_social` to production.
- [ ] Deploy return API contract `2026-09-10.1` before deploying the matching player bundle.
- [ ] Run synthetic 1-4 browser-context recovery and social journeys against the deployed release.
- [ ] Collect sufficient deployed p75/p95 samples to promote measured performance from provisional to verified.
- [ ] Migrate the production controller and deploy and role-verify `XenovoyaSessionForwarder`.
- [ ] Deploy the sponsor relay as one persistent Sepolia instance, fund its dedicated wallet, connect HTTPS monitoring, and complete an independent security review.
- [ ] Verify browser grant, sponsored-use, expiry, exhaustion, and revoke journeys against the deployed forwarder.
- [ ] Prove expedition-passport restoration in a second compatible client.
