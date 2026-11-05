FROM node:22-bookworm-slim

# Prisma's query engine needs OpenSSL
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src

ENV NODE_ENV=production
EXPOSE 5000
USER node

# Sync the schema (no migrations folder yet), then start the API.
# db push refuses destructive changes non-interactively, so it won't silently drop data.
CMD ["sh", "-c", "npx prisma db push --skip-generate && node src/server.js"]
