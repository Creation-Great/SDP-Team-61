# ── Stage 1: Build (compile TypeScript) ─────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Install deps first — better layer caching
COPY package*.json ./
RUN npm ci

# Copy source and compile
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Stage 2: Run (production only) ──────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Install production deps only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled JS from builder
COPY --from=builder /app/dist ./dist

# Ensure uploads directory exists
RUN mkdir -p uploads

EXPOSE 8080
CMD ["node", "dist/server.js"]
