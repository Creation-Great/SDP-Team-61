# ── Stage 1: Build (Vite) ───────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy only package.json (not the lock file) so npm resolves
# platform-specific optional deps for Linux/musl correctly.
# The lock file was generated on Windows and is missing
# @rollup/rollup-linux-x64-musl, which causes npm ci to fail.
COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

# ── Stage 2: Serve (nginx) ──────────────────────────
FROM nginx:1.27-alpine AS runner

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy built React app and our nginx config
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
