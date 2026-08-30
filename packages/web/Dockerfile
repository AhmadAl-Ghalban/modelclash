FROM node:20-alpine AS builder
WORKDIR /app

# Copy root manifest + ALL workspace package.json files so npm workspaces resolves correctly
COPY package.json package-lock.json ./
COPY packages/core/package.json    ./packages/core/
COPY packages/cli/package.json     ./packages/cli/
COPY packages/server/package.json  ./packages/server/
COPY packages/web/package.json     ./packages/web/
COPY packages/mcp/package.json     ./packages/mcp/

RUN npm ci

# Build only the Nuxt app (no core dependency needed at build time)
COPY packages/web/ ./packages/web/
RUN npm run build -w @modelclash/web

# ── Production image ──────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Nuxt 3 build output is self-contained in .output
COPY --from=builder /app/packages/web/.output ./

EXPOSE 3000
ENV HOST=0.0.0.0
ENV PORT=3000

CMD ["node", "server/index.mjs"]
