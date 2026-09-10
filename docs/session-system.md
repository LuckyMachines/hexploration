# Player Session and Social System

## Authority boundaries

- The chain owns committed gameplay, registration, turn phase, and terminal outcomes.
- The confirmation-aware return-service projector owns derived expedition summaries.
- IndexedDB owns immediate device snapshots and the retry outbox; localStorage is only a synchronous bootstrap and compatibility fallback.
- The return service owns parties, invitations, friend relationships, blocks, reports, and expiring presence.
- Presence and the local soft-pause state never change authoritative gameplay.

## Session lifecycle

`booting -> hydrating -> lobby -> ready -> active -> backgrounded -> reconnecting -> resumed -> terminal`

Resume validates the current wallet and chain, restores cached state, checks unresolved transactions, refreshes authoritative reads, and keeps stale content visible while revalidating. A player's Pause control pauses their focus and effects, not the shared world.

## Save protocol

1. Commit an immediate local bootstrap snapshot.
2. Write a checksummed IndexedDB snapshot.
3. Enqueue the cloud mutation with a stable UUID.
4. Serialize writers across tabs with Web Locks and announce changes through BroadcastChannel.
5. Send the expected cloud version and mutation UUID.
6. On a 409, merge individual expedition fields and event identities, enqueue a new mutation, and retry against the winner.
7. Remove acknowledged outbox entries and show the player whether state is local, queued, syncing, or cloud-confirmed.

## Party and friend model

Parties support 1-4 members, public/friends/private discovery, readiness, leader transfer, removal, persistent game linkage, and soft reconnect reservations through durable membership. Invite tokens are unguessable, expiring, usage-limited, revocable, and previewable without disclosing wallet addresses.

Friend discovery uses callsigns behind wallet authentication. Public party and invite previews redact wallet addresses; friend actions use authenticated wallet identities. Friend requests are bilateral; favorites are private; blocks remove friendships and favorites while hiding discovery/presence; safety reports are rate-limited. Presence expires after 90 seconds and its SSE channel only sends a refresh signal, never another player's identity.

## Performance and reliability

- Contract reads share one global cache, use batched multicalls, and pause interval polling in hidden tabs.
- Game events use one filtered subscription plus bounded, confirmation-aware block backfill and a per-game cursor.
- RPC reads use ranked fallback transports with bounded timeout and retry.
- The 3D renderer suspends animation when the page or board is not visible and retains adaptive effects.
- Runtime measurements expose local-save, cloud-save, reconnect, loading, LCP, and long-task samples without player identity.

## Verification

Run `npm run session:test` and `npm run session:doctor`. The doctor writes `reports/session-system/latest.json` and enforces source, architecture, privacy, scenario, and built-bundle gates. Production rollout additionally requires the return-service migration, deployed API contract verification, synthetic multi-context probes, and percentile evidence from the deployed player client.
