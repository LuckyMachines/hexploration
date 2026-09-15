# Coolify deployment

## Production player

The player is a Git-backed Coolify application on Hetzner. Its intended production contract is:

| Setting | Value |
|---|---|
| Coolify host | `fleet-eu` |
| Repository | `LuckyMachines/hexploration` |
| Branch | `main` |
| Base directory | `/` |
| Build pack | Dockerfile |
| Dockerfile | `/Dockerfile` |
| Exposed port | `8080` |
| Health path | `/` |
| Domain | `https://play.xenovoya.com` |
| Auto deploy | Enabled for pushes to `main` |

Use the `LuckyMachines` Git source in Coolify. A normal release is an intentional commit pushed to `main`; Coolify receives the source update and performs the build, health check, and rollout.

### Build variables

Mark each `VITE_*` value as available during the Docker build. At minimum, configure:

- Contract addresses: `VITE_BOARD_ADDRESS`, `VITE_CONTROLLER_ADDRESS`, `VITE_GAME_SUMMARY_ADDRESS`, `VITE_PLAYER_SUMMARY_ADDRESS`, `VITE_GAME_EVENTS_ADDRESS`, `VITE_GAME_REGISTRY_ADDRESS`, `VITE_GAME_QUEUE_ADDRESS`, and `VITE_GAME_SETUP_ADDRESS`.
- World configuration: `VITE_GAME_EVENTS_START_BLOCK`.
- Public services: `VITE_GAME_AUTHORITY_URL=https://play.xenovoya.com/api`, `VITE_LIVE_PLAY_URL`, `VITE_RETURN_API_URL`, `VITE_PLAUSIBLE_HOST`, and `VITE_PLAUSIBLE_DOMAIN`.
- Release policy: `VITE_APP_ENV=production`, `VITE_ANALYTICS_SOURCE=player`, and `VITE_ENABLE_INTERNAL_TOOLS=false`.
- Managed-play values: `VITE_SESSION_FORWARDER_ADDRESS` and `VITE_CONTROLLER_SUPPORTS_DELEGATION=true` after the upgraded contracts are deployed and verified.

Coolify supplies `SOURCE_COMMIT`; the Dockerfile uses it as `VITE_RELEASE_SHA` so `/release.json` identifies the exact deployed commit. The release document also declares whether the return API and sponsored delegation were enabled at build time, allowing the live gate to require only applicable services. Do not hard-code `VITE_RELEASE_SHA` in Coolify.

These browser variables are public by design. Never place private keys, admin tokens, or server credentials in a `VITE_*` variable.

### Release verification

After pushing `main`, wait for Coolify to report a healthy deployment, then run the machine-readable live gate from the repository root:

```bash
XENOVOYA_EXPECTED_RELEASE_SHA=<40-character-player-commit> XENOVOYA_EXPECTED_MARKETING_RELEASE_SHA=<40-character-marketing-commit> npm run release:verify-live
```

The gate checks the player origin, deployed route chunks, SPA deep linking, both sites' security headers and exact release identities, robots, sitemap, return API, managed-play authority, and the rollback contract. It writes `reports/release/latest-live.json` and `reports/release/latest-live.md`. A failed required check blocks promotion even when Coolify itself reports a healthy container. Strict mode rejects missing expected SHAs rather than treating an unknown deployment as promotion evidence.

Use `npm run release:audit` for a non-blocking observation that still writes the report. It is useful during diagnosis, but it is not promotion evidence when the expected SHA is omitted.

### Rollback

The durable rollback contract is `release/rollback-plan.json`. Select the most recent previously validated immutable commit from Coolify deployment history, redeploy that commit, then rerun `release:verify-live` with the rollback SHA. Do not rebuild an unpinned working tree and do not call a container-only health check sufficient evidence.

## Game authority

The game authority is a separate Coolify application using `/Dockerfile.sponsor-relay`, port `8787`, and health path `/livez`. Store its values from `sponsor-relay.env.example` in Coolify as server-only runtime variables. Attach persistent storage at `/data`, keep exactly one replica, and never expose the admin token, RPC URL, authority secret, or signing key to the player build. Route `https://play.xenovoya.com/api/*` to this service with the `/api` prefix stripped.

## Return API

The return API is the separate `LuckyMachines/xenovoya-return-service` application on port `3000`, with Git-backed auto deployment from `main`. Both Coolify and the image health check must use `/ready`, not `/health`: `/health` proves only that Node is alive, while `/ready` verifies PostgreSQL and the optional chain projector. The live release gate treats an unavailable return API as a required failure because saves, resume, parties, friends, and presence depend on it.
