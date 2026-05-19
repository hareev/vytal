# ── Stage 1: build frontend ──────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# Build frontend with mock disabled so env vars are evaluated at runtime
RUN VITE_USE_MOCK=false npm run build

# ── Stage 2: production image ─────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

# API server source
COPY server/ ./server/
COPY tsconfig.server.json ./
COPY drizzle.config.ts ./

# Built frontend assets (served by a static handler if needed)
COPY --from=frontend-builder /app/dist ./dist

EXPOSE 3001

CMD ["node", "--import", "tsx/esm", "server/index.ts"]
