FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace root manifests
COPY package.json package-lock.json ./
COPY packages/web/package.json ./packages/web/

# Install deps (only web workspace needs)
RUN npm ci --workspace @modelclash/web

# Copy web source and build
COPY packages/web/ ./packages/web/
RUN npm run build -w @modelclash/web

# Production stage
FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app/packages/web/.output ./

EXPOSE 3000
ENV HOST=0.0.0.0
ENV PORT=3000

CMD ["node", "server/index.mjs"]
