# -- Build stage --
FROM node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS build
WORKDIR /build
COPY app/package*.json ./
RUN npm ci
COPY app/ ./
# ABIs live at repo root; app imports them via ../../../abi/
COPY abi/ /abi/

# Vite inlines VITE_* env vars at build time.
# Railway passes service variables as Docker build args automatically.
ARG VITE_BOARD_ADDRESS
ARG VITE_CONTROLLER_ADDRESS
ARG VITE_GAME_SUMMARY_ADDRESS
ARG VITE_PLAYER_SUMMARY_ADDRESS
ARG VITE_GAME_EVENTS_ADDRESS
ARG VITE_GAME_REGISTRY_ADDRESS
ARG VITE_GAME_QUEUE_ADDRESS
ARG VITE_GAME_SETUP_ADDRESS
ARG VITE_WALLETCONNECT_PROJECT_ID
ARG VITE_RPC_URL
ARG VITE_LIVE_PLAY_URL
ARG VITE_PLAUSIBLE_HOST
ARG VITE_PLAUSIBLE_DOMAIN
ARG VITE_RETURN_API_URL
ARG VITE_APP_ENV
ARG VITE_RELEASE_SHA
ARG VITE_ANALYTICS_SOURCE
ARG VITE_ENABLE_INTERNAL_TOOLS=false

RUN npm run build

# -- Serve stage --
FROM nginxinc/nginx-unprivileged:1.31.3-alpine@sha256:18d67281256ded39ff65e010ae4f831be18f19356f83c60bc546492c7eb6dd23
USER root
RUN apk del --no-cache curl
USER 101
COPY --from=build /build/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
