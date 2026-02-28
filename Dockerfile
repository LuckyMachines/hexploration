# -- Build stage --
FROM node:20-alpine AS build
WORKDIR /build
COPY app/package*.json ./
RUN npm ci
COPY app/ ./

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

RUN npm run build

# -- Serve stage --
FROM node:20-alpine
RUN npm install -g serve@14
WORKDIR /app
COPY --from=build /build/dist .
CMD ["sh", "-c", "serve -s . -l ${PORT:-3000}"]
