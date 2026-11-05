# ---- Build the static frontend ----
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite inlines these at build time
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_API_BASE_URL=/api
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
    VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# ---- Serve it with Caddy (auto HTTPS + reverse proxy to the API) ----
FROM caddy:2.8
COPY --from=build /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
