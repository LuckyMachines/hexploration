# Game UI Readability Audit

This audit classifies the current active-play UI against the negative-space standard.

## Active Play Inventory

| Surface | Classification | Default Treatment |
| --- | --- | --- |
| Hex board | Primary gameplay | Persistent, largest visual area |
| Player marker and path | Primary gameplay | Persistent when location/path exists |
| Current location | Current decision support | Compact board header readout |
| Action tabs | Current decision support | Persistent, compact glyph-first controls |
| Active action help | Current decision support | Persistent, one concise block |
| Submit controls | Safety or transaction feedback | Persistent in active action section |
| Transaction status | Safety or transaction feedback | Compact persistent status, full detail in drawer |
| Turn briefing | Secondary detail | Closed disclosure by default |
| Mission status | Secondary detail | Inside turn briefing |
| First-turn guidance | Secondary detail | Inside turn briefing unless a future state requires stronger surfacing |
| UX suggestion | Secondary detail | Inside turn briefing |
| Fun telemetry | Secondary detail | Inside turn briefing and action context |
| Readiness strip | History/debug/telemetry | Inside turn briefing |
| Crew sidebar | Secondary detail | Visible beside board on wide screens, below board on narrow screens |
| Action condition/stakes/requirements | Secondary detail | Closed action context disclosure by default |
| Outcome simulator | Secondary detail | Closed outcome preview disclosure by default |
| Event history | History/debug/telemetry | Closed expedition history disclosure |
| Match replay | History/debug/telemetry | Closed expedition history disclosure |
| Debug overlay | History/debug/telemetry | Development/debug-triggered only |
| User preferences | Secondary detail | Closed disclosure |

## Hierarchy

1. Board and live player silhouette.
2. Current route/action intent.
3. Primary action controls and submit path.
4. Blocking errors, invalid route feedback, and transaction status.
5. Crew context and optional turn briefing.
6. History, telemetry, replay, and debug detail.

## Density Rules

| Density | Use When | Persistent UI |
| --- | --- | --- |
| Quiet | Idle, no route, no risk, no transaction | Board, explorer, compact HUD, action controls |
| Standard | Normal planning without urgent risk | Board, route affordances, action controls |
| Focused | Route intent, active input, submitted turn, resolving, transaction pending | Board, intent cursor, route readouts, action controls |
| High-alert | Invalid route, redline risk, transaction error | Board, localized alert readouts, action controls, required error text |

## First Implementation Slice

The first implementation slice establishes source-controlled standards, an audit inventory, a reusable density model, context-gated board overlays, persisted detail preferences, and focused tests. Remaining slices should continue converting one-off surfaces into shared quiet primitives while preserving the hierarchy above.

