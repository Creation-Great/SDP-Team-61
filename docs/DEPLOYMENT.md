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
- With same-origin deployment, the browser sends the JWT via cookie automatically. SSE (EventSource) works with cookies on same-origin requests. Query param `?token=` has been removed for security (tokens in URLs leak to logs and browser history).

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

## 8. JWT Secret Rotation

When rotating `JWT_SECRET` in production:

1. **Generate a new secret**: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
2. **Minimum length**: 64 characters (256 bits). The server refuses to start with shorter keys in production.
3. **Rolling update**:
   - Set the new `JWT_SECRET` in your secrets manager.
   - Restart backend service(s). All existing tokens become invalid immediately.
   - Users will be logged out and must re-authenticate.
4. **No downtime rotation**: Not currently supported (would require dual-key verification). Plan rotation during low-traffic windows.
5. **In-memory token blacklist**: Restarting the server clears the blacklist. For multi-instance deployments, consider Redis-backed blacklist.

---

## 9. Database Backup & Recovery

### 9.1 Automated Backups

```bash
# Daily backup with pg_dump (add to cron or CI/CD schedule)
pg_dump -U postgres -h localhost -d peerreview -F c -f backup_$(date +%Y%m%d).dump

# Restore from backup
pg_restore -U postgres -h localhost -d peerreview -c backup_20260315.dump
```

### 9.2 Backup Strategy

- **Frequency**: Daily full backups; keep 7 days of rolling backups minimum.
- **Upload volume**: Back up `backend_uploads` Docker volume (submitted files).
- **Test restores**: Periodically restore a backup to a staging environment to verify integrity.

### 9.3 Disaster Recovery

- **RTO target**: 1 hour (restore from backup + redeploy services).
- **RPO target**: 24 hours (daily backups). For tighter RPO, enable WAL archiving or use managed PostgreSQL with continuous backup.

---

## 10. Monitoring & Observability

### 10.1 Health Checks

| Service | Endpoint | Healthy | Unhealthy |
|---------|----------|---------|-----------|
| Backend | `GET /healthz` | `200 { ok: true, db: "ok" }` | `503 { ok: false, db: "error" }` |
| AI Service | `GET /healthz` | `200 { status: "ok" }` | Connection refused |
| Frontend | `GET /` (nginx) | `200` | Connection refused |
| Database | `pg_isready -U postgres` | Exit 0 | Exit non-zero |

### 10.2 Key Metrics to Monitor

- **Backend**: Request latency (p50/p95/p99), error rate (5xx), active DB connections.
- **AI Service**: OpenAI API latency, token usage per request (logged as structured JSON), retry count.
- **Database**: Active connections vs pool max, query latency, disk usage.
- **Frontend**: Nginx access log error rate (4xx/5xx).

### 10.3 Log Aggregation

- Backend outputs structured JSON logs (Pino) — pipe to ELK, Datadog, or CloudWatch.
- AI service outputs structured JSON logs — same destination.
- Nginx access/error logs available at `/var/log/nginx/`.

---

## 11. Resource Limits (Docker)

The `docker-compose.yml` sets resource limits for all services:

| Service | CPU | Memory |
|---------|-----|--------|
| db | 2 | 2 GB |
| backend | 1 | 1 GB |
| ai-service | 1 | 1 GB |
| frontend | 0.5 | 256 MB |

Adjust based on actual load. AI service may need more memory if handling large text inputs.

---

## 12. Security Headers (Nginx)

The production nginx.conf includes these security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), microphone=(), camera=()`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`

---

## 13. Functional Rollout Notes

- The current deployment includes additional functional modules:
  - Rubrics API (`GET/POST /rubrics`)
  - Submission edit/withdraw and grade summary (`PATCH/DELETE /submissions/:id`, `GET /submissions/my-grades`)
  - Instructor bulk assignment (`POST /instructor/assign/bulk`)
  - Peer-review appeals (`/peer-review/appeals*`)
- Ensure backend migrations are up-to-date before rollout so new tables/columns exist (`submissions.course_id`, `rubrics`, `peer_review_appeals`).

---

## 14. Mobile and Responsive

- Tables use horizontal scroll (`overflow-x-auto`); on small screens users can scroll horizontally to see all columns.
- Validate on a real device or emulator: login, sidebar collapse, table scroll, modals and forms on small screens; touch targets are designed to be tappable and focusable.
- If tables are hard to read on small screens, prefer “Export CSV” and view on desktop.

---

## v3.0 Deployment Notes

### Redis Service
- Docker Compose includes `redis:7-alpine` on port 6379
- Backend connects via `REDIS_URL` env var (defaults to `redis://redis:6379` in Docker)
- Redis is **optional**: system degrades gracefully to in-memory caching/blacklisting
- Recommended: 256MB maxmemory with `allkeys-lru` eviction policy

### New Database Migrations (021-036)
Run automatically on backend startup via `migrateUp()`. Key tables added:
- `semesters` — Academic semester management
- `announcements` — Enhanced announcements with pinned/scheduled/attachments
- `anonymous_reviewer_map` — Stable pseudonyms for anonymous reviews
- `review_exclusions` — Conflict-of-interest rules for reviewer assignment
- `review_helpfulness` — Student votes on review usefulness
- `reviewer_reputation` — Aggregate reviewer quality metrics
- `review_depth_scores` — AI-computed review depth metrics
- `grade_weights` — Per-course grading weight configuration
- `similarity_reports` — Plagiarism/similarity detection results
- `ai_conversations` — Multi-turn AI chat history
- `lms_config` — LMS integration configuration (mock)
- `deadline_reminders` / `deadline_extensions` — Reminder and extension management
- `review_attachments` — Rich text review file attachments
- `user_preferences` — User theme/font/contrast settings
- `data_deletion_requests` — GDPR account deletion requests
- `ai_score_suggestions` / `ai_calibration_results` — AI scoring assistant data

### New Environment Variables
| Variable | Service | Default | Description |
|----------|---------|---------|-------------|
| `REDIS_URL` | Backend | _(none)_ | Redis connection URL |
| `OBJECT_STORAGE_TYPE` | Backend | `local` | `local` or `mock-s3` |
| `REMINDER_CHECK_INTERVAL_MS` | Backend | `900000` | Deadline reminder check interval (ms) |

### AI Service Dependencies
- New pip package: `scikit-learn>=1.3.0` (for TF-IDF similarity detection)
- 7 new AI endpoints added (review-depth, score-suggestion, calibration, score-reasoning, similarity, similarity/turnitin, chat)

### Frontend Changes
- 11 new pages (33 total, all lazy-loaded)
- PWA support via vite-plugin-pwa (generates sw.js + workbox runtime caching)
- Dark mode (Tailwind `darkMode: 'class'` + CSS variables)
- New npm packages: recharts, @tiptap/react, react-pdf, vite-plugin-pwa, diff, react-virtuoso

### Nginx Configuration
Ensure all new route prefixes have proxy `location` blocks:
`/anonymity`, `/assignment-strategy`, `/quality`, `/semesters`, `/revisions`, `/grades`, `/lms`, `/deadlines`, `/preferences`, `/compliance`, `/similarity`, `/rubrics`, `/assignment-templates`

### Scheduler
- Deadline reminder scheduler starts automatically on backend boot
- Runs every 15 minutes (configurable via `REMINDER_CHECK_INTERVAL_MS`)
- Creates notifications for students with approaching deadlines

### TA Role
- New `ta` value in `user_role` enum (migration 022)
- TA has instructor-level read access but cannot create peer review sessions
- Configure via `user_enrollments` table with `role = 'ta'`

---

*Document version: 3.0 — 2026-03*
