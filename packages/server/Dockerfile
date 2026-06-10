FROM node:20-alpine AS builder
WORKDIR /app

# Copy root manifest + ALL workspace package.json files so npm workspaces resolves correctly
COPY package.json package-lock.json ./
COPY packages/core/package.json    ./packages/core/
COPY packages/cli/package.json     ./packages/cli/
COPY packages/server/package.json  ./packages/server/
COPY packages/web/package.json     ./packages/web/

RUN npm ci

# Build @modelclash/core first (server depends on it at runtime)
COPY packages/core/ ./packages/core/
RUN npm run build -w @modelclash/core

# Build the NestJS server
COPY packages/server/ ./packages/server/
RUN npm run build -w @modelclash/server

# ── Production image ──────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Reuse node_modules from builder (avoids a second npm ci + keeps image lean)
COPY --from=builder /app/node_modules         ./node_modules
COPY --from=builder /app/packages/core/dist   ./packages/core/dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist

# Minimal package files needed for Node workspace resolution at runtime
COPY package.json ./
COPY packages/core/package.json   ./packages/core/
COPY packages/server/package.json ./packages/server/

EXPOSE 3001
CMD ["node", "packages/server/dist/main.js"]
