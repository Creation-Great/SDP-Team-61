FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# --- Production image ---
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY sql/ ./sql/
COPY migrations/ ./migrations/

# Create uploads directory
RUN mkdir -p uploads

EXPOSE 8080

CMD ["node", "dist/server.js"]
