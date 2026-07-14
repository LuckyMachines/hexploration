# -- Build stage --
FROM node:26-alpine@sha256:e88a35be04478413b7c71c455cd9865de9b9360e1f43456be5951032d7ac1a66 AS build
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
FROM nginxinc/nginx-unprivileged:1.31.2-alpine@sha256:6320020c7da8714feab524e02c08c5a1958675c4e68700e93a2fd8970b065786
USER root
RUN apk del --no-cache curl
USER 101
COPY --from=build /build/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
