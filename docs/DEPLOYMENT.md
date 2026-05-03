# Deployment Guide

> Production / staging operations for the SDP Peer Review System. Covers environment, secrets, JWT rotation, backups, monitoring, and incident response.

For dev setup, read [DEVELOPMENT.md](DEVELOPMENT.md). For architecture, read [ARCHITECTURE.md](ARCHITECTURE.md).

---

## 1. Topology

| Service | Port (host) | Image / Build | Notes |
|---------|------|---------------|-------|
| `frontend` | 80 / 443 | `./frontend/Dockerfile` (multi-stage → nginx) | Static assets + reverse proxy |
| `backend` | 8080 | `./backend/Dockerfile` | Express, runs migrations on startup |
| `ai-service` | 5001 | `./ai-service/Dockerfile` | Gunicorn 4 workers (gevent), 100 connections each |
| `db` | 5432 | `postgres:16` | Persistent volume `dbdata` |
| `redis` | 6379 | `redis:7-alpine` | `maxmemory 256mb`, `allkeys-lru`, AOF on; persistent volume `redisdata` |

The backend talks to AI service over `AI_SERVICE_URL` (default `http://ai-service:5001` inside Docker). The frontend talks to the backend through nginx; nothing else is reachable from the public network.

---

## 2. Environment Variables

Three `.env.example` files document the surface — root, `backend/`, `ai-service/`. Frontend gets its env from `frontend/.env.example` (mostly build-time).

### 2.1 Root `.env` (consumed by docker-compose)

| Variable | Required | Purpose |
|----------|----------|---------|
| `POSTGRES_PASSWORD` | **Yes** | PostgreSQL superuser password. `docker compose up` refuses to start without it. |
| `POSTGRES_USER` | No (default `postgres`) | DB user. |
| `POSTGRES_DB` | No (default `peerreview`) | DB name. |
| `JWT_SECRET` | **Yes** in prod | ≥ 64 hex chars. Generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`. |
| `JWT_EXPIRES_IN` | No (default `30d`) | Token lifetime. |
| `FRONTEND_URL` | **Yes** in prod | The browser-visible origin. Production fatal-exits if this contains `localhost`. |
| `CORS_ORIGINS` | No | Comma-separated list of allowed origins. Falls back to `FRONTEND_URL`. |
| `OPENAI_API_KEY` | If using AI | Forwarded to `ai-service`. |
| `OPENAI_MODEL` | No (default `gpt-4o-mini`) | The actual upstream is `https://api.x.ai/v1` — see [ARCHITECTURE.md §7](ARCHITECTURE.md#7-ai-service-architecture). |
| `AI_API_KEY` | **Yes** in prod | Shared secret between `backend` and `ai-service`. AI service rejects all requests when unset. |

### 2.2 Backend `backend/.env` (only when running outside Docker)

Inside Docker, all backend env comes from compose. Outside Docker (dev or bare metal), inherit from root `.env` and supplement with backend-specific knobs:

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/peerreview` | pg connection string |
| `PORT` | `8080` | Express listen port |
| `HOST` | `0.0.0.0` | bind address |
| `NODE_ENV` | `development` | Set to `production` in production |
| `SKIP_MIGRATE` | `false` | Set to `true` if migrations are run by an external job |
| `TRUST_PROXY` | unset | Set to `1` (or hop count) when running behind nginx / load balancer |
| `UPLOAD_DIR` | `./uploads` | Local file upload dir; mounted as `backend_uploads` volume in Docker |
| `MAX_FILE_SIZE` | `10485760` (10 MiB) | Per-file upload cap |
| `MAX_CSV_FILE_SIZE` | `2097152` (2 MiB) | CSV upload cap (instructor) |
| `PG_POOL_MAX` | `20` | pg pool size |
| `PG_IDLE_TIMEOUT_MS` | `30000` | idle reclaim |
| `PG_CONN_TIMEOUT_MS` | `5000` | acquisition timeout |
| `LOG_LEVEL` | `info` | Pino log level (`debug`, `info`, `warn`, `error`) |
| `REDIS_URL` | unset | Enable Redis when set; in-memory fallback otherwise |
| `EMAIL_NOTIFICATIONS_ENABLED` | `false` | Enable SMTP notifications |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | unset | SMTP config |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | unset | Web Push (browser notifications) |
| `MV_DEBOUNCE_MS` | `5000` | Materialized view refresh debounce |
| `MV_PERIODIC_MS` | `600000` | Periodic MV refresh interval |
| `REMINDER_CHECK_INTERVAL_MS` | `900000` (15 min) | Deadline reminder scheduler |
| `OBJECT_STORAGE_TYPE` | `local` | `local` or `mock-s3` |
| `S3_BUCKET` / `S3_REGION` / `S3_ENDPOINT` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` | unset | S3 (or MinIO) config when storage type is not `local` |

> **Documentation drift**: The "Rate Limiting" comments in `backend/.env.example` (lines 91-96) describe legacy values. The actual rate-limit configuration lives in [`backend/src/app.ts`](../backend/src/app.ts#L141-L187) — see §6 below for the current numbers.

### 2.3 AI Service `ai-service/.env`

| Variable | Default | Purpose |
|----------|---------|---------|
| `OPENAI_API_KEY` | unset | Forwarded to OpenAI-compatible API at `https://api.x.ai/v1` |
| `OPENAI_MODEL` | `gpt-4o-mini` | Default model |
| `AI_API_KEY` | unset | Shared secret with backend; **fail-closed** when unset |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/peerreview` | psycopg2 DSN |
| `FRONTEND_URL` | `http://localhost:5173` | CORS allowlist |
| `REDIS_URL` | unset | flask-limiter storage |
| `AI_PORT` | `5001` | Listen port |
| `FLASK_DEBUG` | `0` | Set to `1` only in dev |

---

## 3. Production Deployment Path

### 3.1 Full-stack via Docker Compose

```bash
# 1. Prepare secrets (do NOT commit)
cp .env.example .env
$EDITOR .env   # set POSTGRES_PASSWORD, JWT_SECRET, AI_API_KEY, OPENAI_API_KEY, FRONTEND_URL

# 2. Build and start
docker compose up --build -d

# 3. Watch logs
docker compose logs -f backend ai-service

# 4. Health check
curl -f http://localhost:8080/healthz
curl -f http://localhost:5001/healthz
```

### 3.2 Without seed data

`docker-compose.yml` mounts both `migrations.sql` and `seed.sql` into PostgreSQL's `docker-entrypoint-initdb.d`. **The seed contains demo accounts with weak passwords (`password123`)** and must not run in production.

Two options:

1. **Recommended**: Maintain a `docker-compose.prod.yml` overlay that omits the `seed.sql` mount. Use `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`.
2. **Quick**: Do not let any production database initialise from this compose file. Instead, point `DATABASE_URL` to an externally managed PostgreSQL and let `npm run migrate` apply schema only.

### 3.3 Numbered migrations

Migrations `001-037` are applied automatically at backend startup via [`migrateUp()`](../backend/src/migrate.ts) unless `SKIP_MIGRATE=true`. To run them out of band:

```bash
cd backend
npm run migrate
npm run migrate:down       # rollback last
npm run migrate:redo       # down + up
```

The legacy `backend/sql/migrations.sql` is the bootstrap for fresh Docker DBs; numbered migrations layer on top.

---

## 4. JWT Secret Rotation

```bash
# 1. Generate
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# 2. Update secrets manager / .env

# 3. Restart backend (zero-downtime not currently supported)
docker compose restart backend
```

Effects:

- **All existing tokens become invalid immediately.** Users are logged out and must re-authenticate.
- Token blacklist is per-process when Redis is unavailable. Multi-instance deployments must use Redis to keep blacklist consistent.
- The backend rejects `JWT_SECRET` shorter than 64 chars in production.
- Plan rotations during low-traffic windows.

---

## 5. Database Backup and Recovery

### 5.1 Backup

```bash
# Daily — schedule via cron / systemd timer / managed Postgres
pg_dump -U postgres -h <host> -d peerreview -F c -f backup_$(date +%Y%m%d).dump

# Verify
pg_restore --list backup_$(date +%Y%m%d).dump | head
```

### 5.2 Restore

```bash
pg_restore -U postgres -h <host> -d peerreview -c backup_YYYYMMDD.dump
```

### 5.3 Strategy

| Knob | Recommendation |
|------|----------------|
| Frequency | Daily full dump |
| Retention | 7 rolling days minimum, 30 days for monthly snapshots |
| RTO | ≤ 1 hour (restore + redeploy) |
| RPO | ≤ 24 hours with daily dumps; tighten with WAL archiving or managed PG continuous backup |
| Upload volume | Snapshot the `backend_uploads` Docker volume on the same cadence as the DB |
| Test restores | Restore to a staging environment monthly |

### 5.4 Volumes

`docker-compose.yml` declares three named volumes: `dbdata` (PostgreSQL), `backend_uploads` (file submissions), `redisdata` (Redis AOF). Back up `dbdata` and `backend_uploads`; `redisdata` is recoverable from source-of-truth state.

---

## 6. Rate Limiting (Reference)

Source: [`backend/src/app.ts`](../backend/src/app.ts#L141-L187) and [`backend/src/middleware/exportLimiter.ts`](../backend/src/middleware/exportLimiter.ts).

| Tier | Window | Max | Key | Routes |
|------|--------|-----|-----|--------|
| Global | 60 s | 600 | per user (JWT) or IP fallback | All routes |
| Auth | 15 min | 100 | per IP only | `/auth/*` |
| Write | 10 min | 300 | per user | `/instructor`, `/peer-review`, `/enrollments`, `/semesters`, `/lms`, `/assignment-strategy` |
| Upload | 10 min | 50 | per user | `/submissions`, `/revisions` |
| Export | 60 min | 10 | per user | `/grades/export/:courseId`, `/compliance/export/:userId` |

AI service has per-endpoint limits via Flask-Limiter (Redis-backed when available). Default `300 per minute`; check the `@limiter.limit(...)` decorators in `ai-service/routes/*.py`.

When `TRUST_PROXY=1` is set, `req.ip` is the forwarded client IP; otherwise it is the proxy's IP and per-IP keys collapse onto the proxy.

---

## 7. Health Checks and Observability

### 7.1 Endpoints

| Service | URL | Healthy | Unhealthy |
|---------|-----|---------|-----------|
| Backend | `GET /healthz` | `200 { ok: true, db: "ok" }` | `503 { ok: false, db: "error" }` |
| AI Service | `GET /healthz` | `200 { status: "ok" }` (Blueprint registered as `health_bp`) | Connection refused |
| Frontend | `GET /` | nginx returns the SPA shell | Connection refused |
| Database | `pg_isready -U postgres` | exit 0 | non-zero |
| Redis | `redis-cli ping` → `PONG` | — | — |

### 7.2 Logs

- **Backend**: structured JSON via Pino (`logger`), correlation ID per request (`X-Request-Id` or auto-generated UUID). Pipe stdout to your log aggregator (ELK / Datadog / CloudWatch / Loki).
- **AI Service**: structured JSON via the formatter in [`config.py:41`](../ai-service/config.py#L41). Each OpenAI call logs `prompt_tokens`, `completion_tokens`, `total_tokens`.
- **Nginx**: standard access/error logs at `/var/log/nginx/`.

### 7.3 Metrics worth watching

- Request latency (p50/p95/p99) and 5xx rate per service.
- pg pool: active vs `PG_POOL_MAX`, wait time for new connections.
- AI service: OpenAI latency, retry count, tokens per minute.
- Redis: memory pressure (eviction count under `allkeys-lru`).

---

## 8. SSE and Nginx

- The instructor real-time event stream is `GET /instructor/events`.
- Nginx must **disable buffering** and **extend the read timeout** for that path. The shipped [`frontend/nginx.conf`](../frontend/nginx.conf) handles this — copy the `location /instructor/events { ... }` block when porting to a different reverse proxy.
- SSE is authenticated by the same-origin cookie (`token`). Tokens in the URL (`?token=`) are no longer accepted by the auth middleware ([`backend/src/middleware/auth.ts:36`](../backend/src/middleware/auth.ts#L36)).

---

## 9. Resource Limits

The shipped compose file declares limits per service:

| Service | CPU | Memory |
|---------|-----|--------|
| db | 2 | 2 GB |
| backend | 1 | 1 GB |
| ai-service | 1 | 1 GB |
| frontend | 0.5 | 256 MB |
| redis | 0.5 | 512 MB |

Tune for actual load. AI service may need extra memory under large submission summarisation; PostgreSQL benefits from more memory once `shared_buffers` is raised.

---

## 10. Security Headers

Production nginx (per [`frontend/nginx.conf`](../frontend/nginx.conf)) sets:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

Backend additionally applies a Helmet-managed CSP — see [`backend/src/app.ts:58-70`](../backend/src/app.ts#L58-L70).

---

## 11. Production Pre-flight Checklist

- [ ] `JWT_SECRET` set, ≥ 64 chars, **not** the example value
- [ ] `AI_API_KEY` set, **identical** in backend env and AI service env
- [ ] `OPENAI_API_KEY` set if AI features are enabled
- [ ] `POSTGRES_PASSWORD` set to a strong value (no `postgres:postgres`)
- [ ] `FRONTEND_URL` (and `CORS_ORIGINS` if used) point at the **production** domain — backend fatal-exits otherwise
- [ ] `NODE_ENV=production`
- [ ] `TRUST_PROXY=1` if behind nginx / load balancer
- [ ] Seed file is **not** mounted into the production database
- [ ] `.env` files are excluded from version control (verified by `.gitignore`)
- [ ] Daily DB backup configured and **tested by a real restore**
- [ ] `backend_uploads` volume is included in backups
- [ ] TLS terminates at nginx with a current certificate
- [ ] Log aggregation collects backend + AI structured JSON
- [ ] Alerts wired for: backend `/healthz` 5xx, pg pool saturation, OpenAI 5xx > threshold, disk usage > 80 %

---

## 12. Troubleshooting

| Symptom | Root cause | Fix |
|---------|-----------|-----|
| Backend exits with `Cannot start in production with failed security checks` | Required env var missing or `FRONTEND_URL` contains `localhost` | Set the missing variable; restart |
| Browser cannot log in | `JWT_SECRET` rotated, or cookie domain/path mismatch | Verify cookie `Domain` matches site; users re-auth |
| AI features return `{ error: "not_configured" }` | `AI_API_KEY` empty in either service | Set in both, restart both |
| AI features return `{ error: "unauthorized" }` | Backend and AI service have different `AI_API_KEY` values | Reconcile; restart |
| SSE stream silently disconnects | Nginx buffering enabled or read timeout too short | Apply the `/instructor/events` location block |
| `ECONNREFUSED redis:6379` | Redis missing | Start Redis or unset `REDIS_URL` (in-memory fallback) |
| Backend logs many `Idle-client error in pg Pool` | Network or DB restart | Investigate DB; pool will reconnect automatically |
| Migration error on boot | Manual schema drift | Inspect `migrations` table; reconcile or `migrate:down` and re-apply |
| Frontend cannot reach a new backend prefix | `vite.config.js` updated but `nginx.conf` not (or vice versa) | Update **both** in lockstep |
| Backend rate-limit headers say tiny limits | `TRUST_PROXY` not set; per-IP keys collapse on proxy IP | Set `TRUST_PROXY=1` |

---

## 13. Branches and Releases

- `main` — protected, source of release builds. Tag with `vMAJOR.MINOR.PATCH` after each release.
- `integrated` — long-lived integration branch; CI runs but releases never come from here directly.
- Build production images from `main` or a tag, never from `integrated`.

CI is described in §1 of this repo's [README.md](../README.md#ci) — five jobs (backend, frontend, ai-service, docker, security) on every push to `main`/`integrated` and every PR into `main`.

---

## 14. References

- [`docker-compose.yml`](../docker-compose.yml)
- [`.env.example`](../.env.example), [`backend/.env.example`](../backend/.env.example), [`ai-service/.env.example`](../ai-service/.env.example)
- [`frontend/nginx.conf`](../frontend/nginx.conf)
- [`backend/src/server.ts`](../backend/src/server.ts) — startup security checks
- [`backend/src/migrate.ts`](../backend/src/migrate.ts) — migration runner
- [ARCHITECTURE.md](ARCHITECTURE.md) — system architecture
- [DEVELOPMENT.md](DEVELOPMENT.md) — daily workflow
