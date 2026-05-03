# Architecture

> System architecture, process model, request lifecycle, and the invariants every contributor should know.

This document is the single source of truth for *how the system is wired together*. For per-route detail, see [API.md](API.md). For schema detail, see [DATABASE.md](DATABASE.md).

---

## 1. System Overview

The platform is composed of five processes (three application services + PostgreSQL + Redis), all orchestrated by `docker-compose.yml`.

```
┌─────────────────────────┐         ┌──────────────────────────────┐
│ Frontend                │  HTTP   │ Backend (Express :8080)      │
│ React 19 + Vite + nginx │ ──────▶ │ • 22 route prefixes          │
│ :5173 (dev) / :80 (prod)│ ◀─SSE── │ • JWT cookie + Bearer auth   │
└─────────────────────────┘         │ • Helmet + per-user rate-lim │
                                    │ • Auto-runs 37 migrations    │
                                    └─┬───────────────┬────────────┘
                                      │ X-AI-API-Key  │ pg pool (max 20)
                                      ▼               ▼
                            ┌──────────────────┐ ┌──────────────────┐
                            │ AI Service       │ │ PostgreSQL 16    │
                            │ Flask + Gunicorn │ │ • RLS enforced   │
                            │ + OpenAI/xAI     │ │ • 41 tables      │
                            │ + scikit-learn   │ │ :5432            │
                            │ :5001            │ └──────────────────┘
                            └─┬────────────────┘
                              │ psycopg2 pool (min 1, max 25)
                              ▼
                            ┌──────────────────────────────────────┐
                            │ Redis 7 (token blacklist, cache,     │
                            │  rate-limit store, flask-limiter)    │
                            │ All operations have in-memory        │
                            │  fallbacks; service degrades gracefully │
                            │ :6379                                │
                            └──────────────────────────────────────┘
```

Services communicate over HTTP using JSON. The frontend never talks directly to the AI service — every AI call is proxied through the backend, which adds the shared-secret `X-AI-API-Key` header.

---

## 2. Process Model

| Service | Runtime | Concurrency model | Entry |
|---------|---------|-------------------|-------|
| Backend | Node.js 20 (ESM) | Single process, event loop | [`backend/src/server.ts`](../backend/src/server.ts) → [`app.ts`](../backend/src/app.ts) |
| Frontend (dev) | Vite | Single process, HMR | `npm run dev` → Vite dev server |
| Frontend (prod) | Nginx | Static files + reverse proxy | [`frontend/nginx.conf`](../frontend/nginx.conf) |
| AI Service | Python 3.12 | Gunicorn 4 workers × gevent (100 conns each) | [`ai-service/app.py`](../ai-service/app.py) → `create_app()` |
| PostgreSQL | postgres:16 | Server process | docker-compose-managed |
| Redis | redis:7-alpine | Server process | docker-compose-managed |

The AI service deliberately uses **lazy initialization** for both its database pool and OpenAI client (see [`ai-service/extensions.py:50-60`](../ai-service/extensions.py#L50-L60)). Importing the module never opens connections — this keeps tests deterministic and avoids slow boots when only health checks are exercised.

---

## 3. Authentication and Authorization

### Token shape

JWT signed with HS256, claims `{ user_id, email, role, jti? }`. Default expiry 30 days (`JWT_EXPIRES_IN`).

### Token resolution order

[`backend/src/middleware/auth.ts:25-37`](../backend/src/middleware/auth.ts#L25-L37) checks in this order:

1. **`token` httpOnly cookie** — preferred for browser sessions; XSS-safe.
2. **`Authorization: Bearer <jwt>`** header — for API clients and scripts.

Query-parameter tokens were removed from the middleware to prevent JWT leakage into server access logs and browser history.

### Role guards

Per-role enforcement uses [`requireRole()`](../backend/src/middleware/roleGuard.ts) (called per route after `authenticate`). Course-scoped checks use `verifyCourseAccess()` and `verifySessionAccess()` from [`utils/enrollment.ts`](../backend/src/utils/enrollment.ts).

| Role | Can | Cannot |
|------|-----|--------|
| `student` | Submit, review, view own grades | Read other students' grades, manage courses |
| `instructor` | Manage owned courses (sessions, grades, LMS, deadlines, anonymity, compliance) | Touch courses they don't own |
| `ta` | Read like instructor; restricted on session creation | Create sessions in courses they aren't TA for |
| `admin` | Bypass course-ownership checks; access audit log | Self-register (admin role assignment is server-side only) |

### Token revocation

Logout revokes the token's `jti` via Redis `SETEX` ([`utils/tokenBlacklist.ts`](../backend/src/utils/tokenBlacklist.ts)). When Redis is unavailable, blacklisting falls back to in-memory storage (per-process; lost on restart).

### Row-Level Security

Sensitive queries run inside [`withDb(userId, role, cb)`](../backend/src/db.ts#L22-L41), which `BEGIN`s a transaction and sets two PostgreSQL session variables that RLS policies read:

```sql
SELECT set_config('app.current_user_id', $1, true);
SELECT set_config('app.current_role',    $2, true);
```

Authentication endpoints that *must* succeed before a user identity exists (register, login) use [`withDbNoRLS()`](../backend/src/db.ts#L46-L61).

---

## 4. Request Lifecycle

A typical authenticated AI request, traced end-to-end:

```
Browser
  │ POST /api/ai/feedback  { text }   (cookie: token=<jwt>)
  ▼
Vite dev proxy  (or nginx in prod)
  │ proxy_pass → backend:8080
  ▼
Express :8080
  │ helmet (CSP, X-Frame-Options, …)
  │ cors (allowlist + private-net allow in dev)
  │ express.json()
  │ correlationId = randomUUID() → req.correlationId
  │ pino-http access log (skip /healthz)
  │ globalLimiter (600/min keyed by user)
  ▼
app.use('/api/ai', aiRoutes)
  │ authenticate              ← JWT verify, blacklist check, load user + enrollments
  │ validate(zodSchema)       ← from schemas.ts
  │ h(controller)             ← async error wrapper
  ▼
aiController.postFeedback
  │ axios.post(`${AI_SERVICE_URL}/api/ai/feedback`, body, {
  │   headers: { 'X-AI-API-Key': process.env.AI_API_KEY }
  │ })
  ▼
Flask :5001
  │ @require_api_key                     ← fail-closed if key unset
  │ @limiter.limit (per-endpoint)        ← Flask-Limiter, Redis-backed
  │ get_db()                             ← per-request connection from pool
  ▼
routes/feedback.py
  │ call_openai(model=gpt-4o-mini, …)    ← retry 2× with exponential backoff
  │ INSERT INTO ml_outputs (…)
  │ jsonify(result)
  ▼
Express forwards JSON downstream
  │ Global error handler:
  │   AppError       → status + { error, message }
  │   ZodValidation  → 400 + details
  │   unknown        → 500, full stack only in dev
  ▼
Browser receives { toxicity, politeness, sentiment }
```

---

## 5. Data Layer

### PostgreSQL

- Single database `peerreview` on PostgreSQL 16.
- **41 tables** spread across 37 sequential migrations (`backend/migrations/001*.sql` … `037*.sql`).
- RLS policies enforced via session variables (see §3).
- Materialised views refreshed by [`utils/mvRefresh.ts`](../backend/src/utils/mvRefresh.ts) on a periodic timer.
- Connection pool defaults: `max=20`, `idleTimeout=30s`, `connectionTimeout=5s`. Tunable via `PG_POOL_MAX`, `PG_IDLE_TIMEOUT_MS`, `PG_CONN_TIMEOUT_MS`.

Migrations are auto-applied at backend startup unless `SKIP_MIGRATE=true` is set ([`server.ts:49`](../backend/src/server.ts#L49)).

For schema details, see [DATABASE.md](DATABASE.md).

### Redis (optional)

When `REDIS_URL` is set, the backend uses Redis for:

| Use | Key pattern | TTL |
|-----|-------------|-----|
| JWT blacklist | `bl:jti:<jti>` | Token's remaining lifetime |
| Application cache | varies (per `cacheGet`/`cacheSet`) | Caller-defined |
| `express-rate-limit` store | rate-limit-redis library | Window-based |
| Flask-Limiter store (AI) | flask-limiter library | Window-based |

When Redis is unavailable, every operation degrades:

- `cacheGet` returns `null` → callers re-derive value
- `cacheSet` is a no-op
- Token blacklist falls back to in-memory `Map` (per-process; lost on restart, multi-process inconsistent)
- Rate limiters use in-memory stores (per-process; abuse caps are per-worker rather than global)

The fallback path is intentional: the system **must boot without Redis** to support local development and graceful failure in production. See [`utils/redis.ts`](../backend/src/utils/redis.ts).

---

## 6. Real-Time Updates (Server-Sent Events)

A lightweight SSE hub lives at [`utils/sse.ts`](../backend/src/utils/sse.ts) and exposes channel-based broadcast:

| Channel | Producer | Consumer |
|---------|----------|----------|
| `course:<courseId>` | submission/review/peer-review controllers | Instructor dashboard |
| `session:<sessionId>` | peer-review controllers | Per-session live feed |
| `global` | System events | Admin only |

The single SSE endpoint is `GET /instructor/events` ([`backend/src/routes/instructorRoutes.ts:46`](../backend/src/routes/instructorRoutes.ts#L46)).

The frontend hook [`hooks/useSSE.js`](../frontend/src/hooks/useSSE.js) uses `EventSource(fullUrl, { withCredentials: true })`, relying on the same-origin cookie to authenticate. It supports auto-reconnect with exponential backoff (capped at 30 s) and 90 s silence detection.

> **Known issue**: comments inside `instructorController.ts:754` and `useSSE.js:12` still reference a removed `?token=` query-param fallback. Tracked in [ROADMAP.md](ROADMAP.md#open-issues).

---

## 7. AI Service Architecture

The Flask app uses an **application-factory** pattern ([`app.py:17-34`](../ai-service/app.py#L17-L34)):

```
create_app()
  ├── Flask(__name__)
  ├── CORS(origins=[FRONTEND_URL])
  ├── limiter.init_app(app)
  ├── teardown_appcontext(close_db)
  └── register_all(app)         ← imports & registers 10 Blueprints
```

Blueprint registration is centralised in [`routes/__init__.py`](../ai-service/routes/__init__.py).

### OpenAI compatibility layer

The AI service uses the official `openai` Python SDK but points it at xAI's API endpoint:

```python
OpenAI(api_key=OPENAI_API_KEY, base_url="https://api.x.ai/v1", timeout=20.0)
```

This means `OPENAI_MODEL=gpt-4o-mini` actually routes to xAI's Grok endpoint that exposes an OpenAI-compatible interface. To switch to OpenAI proper, change the `base_url` (or remove it and let the SDK default to `https://api.openai.com/v1`). See [`extensions.py:59`](../ai-service/extensions.py#L59).

### Retry and rate limiting

- Each OpenAI call retries up to **2 times** on `APIConnectionError`, `RateLimitError`, or `APITimeoutError`, with exponential backoff + jitter (`2^attempt + rand(0,1)` seconds).
- Per-endpoint limits are enforced by Flask-Limiter (default `300 per minute`; tighter limits per endpoint).
- Storage backend is Redis when `REDIS_URL` is set, otherwise in-memory.

### Inter-service authentication

Every AI route uses the [`@require_api_key`](../ai-service/extensions.py#L241-L255) decorator, which:

- Returns `503 not_configured` if `AI_API_KEY` is unset (**fail-closed**).
- Returns `401 unauthorized` on header mismatch.
- Otherwise calls the wrapped handler.

---

## 8. Startup Sequence

[`backend/src/server.ts`](../backend/src/server.ts) boots in this order:

1. `verifySecurity()` — fatal exit in production if `DATABASE_URL`, `AI_API_KEY`, or production-grade `FRONTEND_URL` are missing. Warn-only in dev.
2. `migrateUp()` — applies any pending migration unless `SKIP_MIGRATE=true`.
3. `initRedis()` — non-blocking; logs and continues if Redis is unavailable.
4. `startPeriodicRefresh()` — periodic `REFRESH MATERIALIZED VIEW`.
5. `startReminderScheduler()` — checks deadlines and sends reminder notifications.
6. `startDataCleanup()` — schedules daily cleanup (drafts > 30 d, read notifications > 90 d, AI logs > 90 d), first run at +1 h.
7. `app.listen(port, host)`.

The frontend has no startup ceremony beyond Vite or nginx.

The AI service has no startup ceremony — connections are lazy ([`extensions.py:200-211`](../ai-service/extensions.py#L200-L211) for DB, [`extensions.py:53-60`](../ai-service/extensions.py#L53-L60) for OpenAI).

---

## 9. Module Maturity

The system ships 19 feature modules. Maturity is recorded by the team:

| Status | Modules |
|--------|---------|
| **Production** | Anonymous Reviews · Multi-Round Review · Assignment Strategy · Review Quality · AI Feedback · AI Rewrite · AI Polish · AI Summarize · Grade Management · Semester Management · Deadlines & Reminders · Notifications · User Preferences · Audit & Compliance |
| **Beta** | AI Scoring & Calibration · AI Chat · Similarity Detection (TF-IDF) |
| **Mock** | LMS Integration (simulated LTI) · Turnitin (randomised scores) |

"Mock" means the module exposes the full UI and API surface but the underlying integration is simulated — useful for demo and for downstream code that should not block on third-party access.

---

## 10. Invariants

These are non-obvious rules a contributor must respect to keep the system coherent. Most are enforced socially (via PR review), not automatically.

1. **Express route order matters.** Static routes before parameterised routes — `/read-all` must be registered before `/:id/read`, otherwise `/:id` swallows `read-all`.
2. **Never modify an applied migration.** Add a new numbered file; the next slot is `038_*.sql`.
3. **Frontend talks to the backend only.** Never call the AI service URL directly from the browser; the shared `X-AI-API-Key` is server-side only.
4. **Frontend uses `services/api.js`.** Do not import `axios` or call `fetch` directly from components.
5. **Vite proxy and nginx config must stay in sync.** Both files contain a list of backend prefixes. Adding a backend prefix without updating both will fail in only one environment.
6. **AI service uses OpenAI-compatible interface, not OpenAI itself.** Anything that depends on OpenAI-specific features (assistants API, beta endpoints) will not work without a `base_url` change.
7. **`anonymous_reviewer_map` writes use `WHERE NOT EXISTS` + retry.** Two reviewers must never share a pseudonym in the same session.
8. **CSV exports prefix formula characters.** `safeCsv()` from [`utils/csvPeerReview.ts`](../backend/src/utils/csvPeerReview.ts) prepends `'` to fields starting with `=+\-@`.
9. **Backend logs use Pino, not `console.log`.** Frontend may use `console.error` inside `ErrorBoundary` only.
10. **Tests must not touch real OpenAI or real Redis.** Mock both. AI service achieves this via lazy initialisation; backend uses Jest mocks.

---

## 11. References

- Source entry points: [`backend/src/server.ts`](../backend/src/server.ts), [`backend/src/app.ts`](../backend/src/app.ts), [`frontend/src/App.jsx`](../frontend/src/App.jsx), [`ai-service/app.py`](../ai-service/app.py)
- Container orchestration: [`docker-compose.yml`](../docker-compose.yml)
- Reverse proxy: [`frontend/nginx.conf`](../frontend/nginx.conf)
- Dev launcher: [`start-dev.ps1`](../start-dev.ps1), [`Makefile`](../Makefile)
- See [DEVELOPMENT.md](DEVELOPMENT.md) for daily workflow.
- See [API.md](API.md) and [openapi.yaml](openapi.yaml) for endpoint detail.
- See [DATABASE.md](DATABASE.md) for schema and RLS.
- See [DEPLOYMENT.md](DEPLOYMENT.md) for operations.
