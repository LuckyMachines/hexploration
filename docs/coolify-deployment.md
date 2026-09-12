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
- Chain configuration: `VITE_GAME_EVENTS_START_BLOCK` and `VITE_RPC_URL`.
- Public services: `VITE_LIVE_PLAY_URL`, `VITE_RETURN_API_URL`, `VITE_PLAUSIBLE_HOST`, and `VITE_PLAUSIBLE_DOMAIN`.
- Release policy: `VITE_APP_ENV=production`, `VITE_ANALYTICS_SOURCE=player`, and `VITE_ENABLE_INTERNAL_TOOLS=false`.
- Optional wallet and sponsored-session values: `VITE_WALLETCONNECT_PROJECT_ID`, `VITE_SESSION_FORWARDER_ADDRESS`, `VITE_SPONSOR_RELAY_URL`, and `VITE_CONTROLLER_SUPPORTS_DELEGATION`.

Coolify supplies `SOURCE_COMMIT`; the Dockerfile uses it as `VITE_RELEASE_SHA` so `/release.json` identifies the exact deployed commit. Do not hard-code `VITE_RELEASE_SHA` in Coolify.

These browser variables are public by design. Never place private keys, admin tokens, or server credentials in a `VITE_*` variable.

### Release verification

After pushing `main`, wait for Coolify to report a healthy deployment, then verify:

```bash
curl --fail https://play.xenovoya.com/release.json
curl --fail https://return-api.xenovoya.com/ready
```

The `release` value must equal the full commit SHA that was pushed, and `environment` must be `production`.

## Sponsor relay

The sponsor relay is a separate Coolify application using `/Dockerfile.sponsor-relay`, port `8787`, and health path `/livez`. Store its values from `sponsor-relay.env.example` in Coolify as server-only runtime variables. Attach persistent storage at `/data`, keep exactly one replica, and never expose the admin token or relayer key to the player build.
