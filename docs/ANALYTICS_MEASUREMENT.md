# Xenovoya journey and retention measurement

This document is the canonical measurement contract for the question: **what makes a first-time player care enough to return, and how do we know?** The production site is `play.xenovoya.com`; events are collected by the self-hosted Plausible Community Edition instance at `plausible.racerverse.com`.

## Identity and privacy boundary

- `installation_id` is a random UUID generated in the browser and retained in local storage. It measures same-browser return behavior until that browser storage is cleared.
- `journey_id` is a random UUID retained only for the current tab session. It groups one visit and prevents rerender/reload duplicates.
- `journey_sequence` is a strictly increasing integer scoped to that tab session. It proves same-hour event order without adding another identity or exposing a timestamp.
- `event_id` is a new random UUID for each accepted event. It gives an operator a safe correlation handle without exposing a player identity.
- None of these identifiers is derived from a wallet, email, IP address, callsign, or cloud-profile record.
- Cross-device resume is measured as an aggregate conversion. Two devices are deliberately not identity-joined in analytics; the wallet-authenticated return service performs the product synchronization without sending the wallet to Plausible.
- Event properties are allowlisted in `app/src/lib/analytics.js`. Values are enum/range validated and strings resembling email, wallet addresses, URLs, bearer tokens, Stripe secrets, webhook secrets, signatures, or database URLs are discarded.
- `route` contains only the URL pathname. Query strings and fragments are never included in custom event properties.
- Production cohort queries must include `environment=production` and `source=player`. Synthetic checks use `source=synthetic`; browser tests use `environment=test` and `source=synthetic`.

Plausible still performs its normal anonymous visitor aggregation. The application-level UUIDs exist only to calculate explicit return cohorts and can be reset by clearing site data.

## Version 1 event contract

Every event carries `event_id`, `event_version`, `environment`, `release`, `route`, `journey_id`, `journey_sequence`, `installation_id`, and `source`.

| Event | Meaning | Additional permitted properties |
| --- | --- | --- |
| `starter_opened` | The first-player return panel rendered | `persona` |
| `role_selected` | The player selected a distinct crew role | `role` |
| `meaningful_choice` | The player made the first deliberate contribution choice | `choice`, `role` |
| `visible_consequence` | The UI showed a persistent consequence of that choice | `outcome`, `lifecycle` |
| `starter_completed` | The starter decision reached its promised outcome | `outcome`, `role` |
| `cloud_save_offered` | Cross-device continuity became available in context | `has_expedition`, `role` |
| `cloud_save_completed` | Authenticated state was durably synchronized | `has_expedition`, `role`, `cloud_version`, `sync_result` |
| `live_join` | The player selected a live on-chain expedition | `game_context` |
| `resume` | A saved expedition was resumed locally or from cloud state | `has_expedition`, `lifecycle`, `resume_source` |
| `recap` | A recoverable/completed expedition recap was seen | `lifecycle`, `outcome` |
| `share` | The player intentionally shared a crew invite or run artifact | `share_type` |
| `second_expedition_start` | The player followed the unresolved thread into another expedition | `return_interval`, `role` |
| `analytics_canary` | Synthetic ingestion and reporting proof | `canary_id` |

The deterministic automated persona is `first-player-v1`: callsign `Voyager`, role `Scout`, starter thread `Sector 0 signal`, an eight-day simulated return, and a second expedition start. Its source of truth is `app/e2e/fixtures/first-player.js`.

## Canonical funnels

Plausible Community Edition 3.2 does not provide saved marketing funnels. These ordered definitions are therefore the product's canonical funnels; the operations reporter computes them by timestamp and `installation_id`, while Plausible goals provide dashboard-level event counts.

1. **First-session value:** `starter_opened` → `role_selected` → `meaningful_choice` → `visible_consequence` → `starter_completed` within one `journey_id`.
2. **Starter to live play:** `starter_completed` → `live_join` within the same installation and 24 hours.
3. **Cloud continuity:** `cloud_save_offered` → `cloud_save_completed` within the same journey.
4. **Return/resume:** `cloud_save_completed` → `resume`, reported separately for `resume_source=local` and `resume_source=cloud`.
5. **Memory and advocacy:** `recap` → `share` within the same journey.
6. **Second expedition:** first `starter_opened` → `second_expedition_start`, broken down by `return_interval`.

For each funnel, report the eligible installation count, each reached-step count, step-to-step conversion, total conversion, median elapsed time, release, and observation window. An installation reaches a step only when that step occurs after its preceding step; repeated events do not increase the count. The reporter orders different hour buckets by `time:hour` and same-hour events by `journey_sequence`. Legacy same-hour rows without a sequence are flagged and never guessed into an ordered funnel.

## D1, D3, and D7 cohorts

The cohort anchor is the first production/player `starter_opened` timestamp for an `installation_id`.

- D1 return: any `resume`, `recap`, or `second_expedition_start` from 24 through less than 72 hours after the anchor.
- D3 return: the same return events from 72 through less than 168 hours after the anchor.
- D7 return: the same return events from 168 through less than 336 hours after the anchor.
- Same-session and same-day activity is reported separately and never counted as D1.
- Each installation contributes at most once to a cohort numerator. Denominators include only installations old enough to have completed the entire cohort window.

These are installation cohorts, not people cohorts. Storage clearing creates a new installation, and a second device remains a second installation by design.

## Production filters and release comparisons

All player-facing reports require both filters:

```json
[
  ["is", "event:props:environment", ["production"]],
  ["is", "event:props:source", ["player"]]
]
```

Add `event:props:release` to compare a specific full 40-character deployment commit. Canary reports use `source=synthetic`. Never combine preview, test, synthetic, or unknown-release events with player cohorts.

## Canary and silence policy

- The analytics canary posts a unique `analytics_canary` every five minutes and requires the same `canary_id` to become queryable within five minutes.
- A stale canary is critical after two consecutive failed windows.
- Journey silence is warning-level when production/player pageviews of `/` are at least five in a rolling hour while `starter_opened` is zero.
- Journey silence is critical when that condition persists for two checks or when `starter_opened` continues but all of `meaningful_choice`, `visible_consequence`, and `starter_completed` are absent for two hours with at least five starter opens.
- Alerts identify the service, environment, release, check window, aggregate counts, and runbook URL. They never contain request bodies, identifiers, IP addresses, wallets, emails, tokens, or credentials.

The canary health endpoint is the external monitor target; a non-200 response is evidence that ingestion or queryability failed, not merely that the Plausible web process is alive.

## Verification

The client contract is covered by unit tests and the Playwright first-player and two-device journeys. Production acceptance requires all of the following:

1. Plausible liveness and readiness return 200.
2. `/js/script.manual.js` returns JavaScript and `/api/event` accepts a versioned canary with 202.
3. All 13 custom goals exist for `play.xenovoya.com`.
4. The canary is queryable inside the five-minute objective.
5. A clean browser emits every expected milestone once, with valid UUIDs and no prohibited values.
6. A second browser hydrates cloud state and emits one cloud-origin `resume` without analytics identity joining.
7. The production bundle contains the exact release SHA and production/player filters.

See `docs/RETENTION_REVIEW_TEMPLATE.md` for the weekly decision record.
