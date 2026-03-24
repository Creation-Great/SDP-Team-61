# Production Deployment

This document describes security and configuration for deploying the SDP Peer Review System in production or non-local environments.

---

## 0. Architecture and Ports

- See the Architecture section in the root [README.md](../README.md) for the diagram and data flow.
- Services and default ports:

| Service | Port | Notes |
|---------|------|--------|
| Frontend (Vite dev) | 5173 | Development only; production serves static assets via nginx |
| Frontend (nginx) | 80 / 443 | Production reverse proxy and static assets |
| Backend (Express) | 8080 | API, SSE, auth |
| PostgreSQL | 5432 | Database |
| AI Service (Flask) | 5001 | Feedback, rewrite, polish, summarize, search |

Ensure the backend, DB, and AI service can reach each other in production; the frontend talks to the backend (and AI) via nginx proxy.

---

## 1. Seed Data and Default Accounts

### 1.1 Default accounts are for development only

- `backend/sql/seed.sql` creates sample users; all use password **password123**:
  - instructor@example.com (instructor)
  - alice@example.com, bob@example.com, carol@example.com (students)
- **Do not use these accounts or passwords in production or any non-local environment.**

### 1.2 How to handle seed in production

- **Option A (recommended)**: Do **not** run seed.sql in production.
  - With Docker: do not mount `seed.sql` into `docker-entrypoint-initdb.d` (e.g. use a copy of `docker-compose.yml` as `docker-compose.prod.yml` without the `./backend/sql/seed.sql` volume; keep only migrations.sql).
  - With a standalone PostgreSQL: run only `migrations.sql` (or versioned migrations), not `seed.sql`.
- **Option B**: If you must run seed (e.g. for a demo), **immediately** after deployment:
  - Change all seed account passwords, or
  - Remove unneeded seed accounts and use normal registration or CAS login instead.

### 1.3 Controlling seed execution via environment (optional)

- The current `docker-compose.yml` runs both `migrations.sql` and `seed.sql` on first DB init (via PostgreSQL `docker-entrypoint-initdb.d`).
- To never run seed in production, remove the `seed.sql` mount from the production Compose file and keep only the migrations mount, or use an init script that runs only migrations.

---

## 2. Environment Variables

- Required and optional variables are documented in **backend/.env.example** and **ai-service/.env.example**.
- The root **.env.example** is for docker-compose and root-level config; per-service config lives in each subdirectory.
- In production, set:
  - **JWT_SECRET**: Strong random string (e.g. `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`).
  - **NODE_ENV=production** (backend).
  - **FRONTEND_URL** / **CORS_ORIGINS** to the actual frontend origin(s).
  - If using the AI service: **OPENAI_API_KEY** and **AI_API_KEY** matching the backend.

---

## 3. SSE and Nginx

- The instructor real-time event stream uses **GET /instructor/events** (SSE).
- If nginx is used as reverse proxy in production, configure **/instructor/events** separately: disable `proxy_buffering`, set a longer `proxy_read_timeout`, etc. See **frontend/nginx.conf** under `location /instructor/events`.
- With same-origin deployment, the browser sends the JWT via cookie; for cross-origin setups use the `?token=` method (see README Security section and the `getToken` option in `useSSE`).

---

## 4. Database Connection Pool (optional tuning)

- The backend uses `pg.Pool`. You can tune it via environment variables:
  - **PG_POOL_MAX** (default `20`): Maximum pool size; increase for higher concurrency (e.g. 50), and align with PostgreSQL `max_connections`.
  - **PG_IDLE_TIMEOUT_MS** (default `30000`): Idle connection reclaim time (ms).
  - **PG_CONN_TIMEOUT_MS** (default `5000`): Connection acquisition timeout (ms).
- See `backend/src/db.ts`. If you hit connection exhaustion in production, try increasing `PG_POOL_MAX` and monitor DB connections.

---

## 5. Health Check and Logging

- **Backend health**: **GET /healthz**. When `DATABASE_URL` is set, it runs a DB connectivity check (`SELECT 1`); if the DB is unreachable it returns **503** with `{ ok: false, db: 'error' }`, suitable for K8s/Docker readiness probes or load balancer health checks.
- In production, set **LOG_LEVEL** to `info` or `warn` and avoid logging sensitive data (e.g. full cookies, tokens).

---

## 6. Troubleshooting

- **Cannot log in**: Ensure JWT_SECRET is the same for the service that issued the login; ensure cookie domain and path are correct (for same-origin, usually no change needed).
- **No SSE events**: Ensure nginx has buffering disabled for `/instructor/events`; ensure the instructor account has a `course_id` (otherwise the channel is `instructor:${user_id}`, which must match the backend event channel).
- **AI features unavailable**: Ensure the AI service is running and that `AI_SERVICE_URL` and `AI_API_KEY` match the ai-service configuration.

---

## 7. Branches and Release

- **main**: Primary branch for stable releases. CI runs on push and on PRs (backend, frontend, AI service, Docker).
- **integrated**: Integration branch; CI also runs for this branch (see `.github/workflows/ci.yml`). If used as a long-lived integration branch:
  - Develop on feature branches and merge into `integrated` for integration and testing;
  - Merge `integrated` into `main` via PR for release;
  - After release, tag `main` (e.g. `v1.0.0`) for rollback and traceability.
- For production, build images from `main` or a specific tag; avoid building from unmerged `integrated`.

---

## 8. Functional Rollout Notes (Current)

- The current deployment includes additional functional modules:
  - Rubrics API (`GET/POST /rubrics`)
  - Submission edit/withdraw and grade summary (`PATCH/DELETE /submissions/:id`, `GET /submissions/my-grades`)
  - Instructor bulk assignment (`POST /instructor/assign/bulk`)
  - Peer-review appeals (`/peer-review/appeals*`)
- Ensure backend migrations are up-to-date before rollout so new tables/columns exist (`submissions.course_id`, `rubrics`, `peer_review_appeals`).

---

## 9. Mobile and Responsive

- Tables use horizontal scroll (`overflow-x-auto`); on small screens users can scroll horizontally to see all columns.
- Validate on a real device or emulator: login, sidebar collapse, table scroll, modals and forms on small screens; touch targets are designed to be tappable and focusable.
- If tables are hard to read on small screens, prefer “Export CSV” and view on desktop.

---

*Document version: 1.3 — 2026-03*
