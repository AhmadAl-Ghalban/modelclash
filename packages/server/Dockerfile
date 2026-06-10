FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace root manifests
COPY package.json package-lock.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/server/package.json ./packages/server/

# Install all workspace deps
RUN npm ci

# Build core first
COPY packages/core/ ./packages/core/
RUN npm run build -w @modelclash/core

# Build server
COPY packages/server/ ./packages/server/
RUN npm run build -w @modelclash/server

# Production stage
FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/server/package.json ./packages/server/

RUN npm ci --omit=dev

COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist

EXPOSE 3001
CMD ["node", "packages/server/dist/main.js"]
