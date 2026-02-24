# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy manifests first for layer caching
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Declare VITE_ build args — Vite bakes these into the static bundle at build
# time, so they cannot be changed at container runtime.
ARG VITE_AQAIR_API_KEY
ARG VITE_AQAIR_API_ENDPOINT
ARG VITE_OPENWEATHER_API_KEY
ARG VITE_OPENWEATHER_API_ENDPOINT
ARG VITE_STATION_API_ENDPOINT
ARG VITE_STATION_API_PORT

ENV VITE_AQAIR_API_KEY=$VITE_AQAIR_API_KEY \
    VITE_AQAIR_API_ENDPOINT=$VITE_AQAIR_API_ENDPOINT \
    VITE_OPENWEATHER_API_KEY=$VITE_OPENWEATHER_API_KEY \
    VITE_OPENWEATHER_API_ENDPOINT=$VITE_OPENWEATHER_API_ENDPOINT \
    VITE_STATION_API_ENDPOINT=$VITE_STATION_API_ENDPOINT \
    VITE_STATION_API_PORT=$VITE_STATION_API_PORT

COPY . .
RUN pnpm build

# ── Stage 2: Serve ──────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
