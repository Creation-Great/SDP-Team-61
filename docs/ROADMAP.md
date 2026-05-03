# Roadmap

> Forward-looking work, deferred initiatives, and tracked open issues.

This document supersedes the older `fastapi-migration-plan.md`. Items here describe **what may happen next**, not what has shipped.

---

## 1. Open Issues

### 1.1 SSE auth comment drift  *(low priority, doc-only)*

The auth middleware [`backend/src/middleware/auth.ts:36`](../backend/src/middleware/auth.ts#L36) explicitly removed the `?token=` query-param fallback, but two surrounding files still describe it as if it were active:

- [`backend/src/controllers/instructorController.ts:754`](../backend/src/controllers/instructorController.ts#L754) — comment claims "pass JWT via ?token= query param".
- [`frontend/src/hooks/useSSE.js:12`](../frontend/src/hooks/useSSE.js#L12) — same claim in the JSDoc.

**Action**: rewrite the two comments to match `useSSE.js:52`'s actual implementation (`new EventSource(fullUrl, { withCredentials: true })` — cookie-only).

### 1.2 Stale rate-limit comments in `backend/.env.example`  *(low priority, doc-only)*

Lines 91-96 of [`backend/.env.example`](../backend/.env.example) describe the original 100/20/100/30 limits. Actual values (in code) are 600/100/300/50 — see [DEPLOYMENT.md §6](DEPLOYMENT.md#6-rate-limiting-reference).

**Action**: replace the comment block with a one-liner pointing to `DEPLOYMENT.md`.

### 1.3 Frontend repo cleanliness  *(housekeeping)*

`frontend/debug-after-login.png` and `frontend/debug-login.png` were captured during a debugging session and remain on disk. They are correctly gitignored (`frontend/debug-*.png`), but they still show up in `ls` and bloat the working directory.

**Action**: delete the local copies; do nothing in git.

### 1.4 Root `node_modules` is wasteful  *(housekeeping)*

The root `package.json` declares only three devDependencies (`concurrently`, `eslint`, `prettier`). Cloning the root `node_modules` brings in ~150 MB of supporting packages. Consider migrating to npm workspaces so backend, frontend, and `concurrently` share one install.

**Action**: convert to workspaces; remove root `node_modules` once shared.

### 1.5 No `LICENSE` file  *(blocker for any open-source publication)*

The repo has no `LICENSE`. This is acceptable for a private course project, but the lack of an explicit licence prevents external reuse and any open-sourcing.

**Action**: add one (MIT or Apache-2.0 are the usual defaults for academic projects) when the team decides on a posture.

### 1.6 AI service points at xAI, not OpenAI  *(documentation gap, not a bug)*

[`ai-service/extensions.py:59`](../ai-service/extensions.py#L59) configures the OpenAI SDK with `base_url="https://api.x.ai/v1"`, which routes to xAI's Grok API. The variable name `OPENAI_API_KEY` and the model setting `gpt-4o-mini` make this surprising for a new contributor.

**Action**: rename the variable to `LLM_API_KEY` (with `OPENAI_API_KEY` as a deprecated alias) or add a prominent comment in `extensions.py` and `config.py`. Keep [ARCHITECTURE.md §7](ARCHITECTURE.md#7-ai-service-architecture) up to date with whatever ships.

---

## 2. Deferred: AI Service → FastAPI

**Status**: Deferred. Flask + gevent (4 workers × 100 connections = 400 concurrent) is sufficient for the current course-pilot load and the current 11-suite test surface.

**Trigger conditions** — pursue when *any* of these become real:

- The `chat` endpoint needs **token-by-token streaming** (SSE or WebSocket) — Flask + gevent cannot produce a clean async generator without monkey-patching headaches.
- A third party requests an **OpenAPI spec produced from the AI service code itself** (rather than the hand-maintained YAML in this repo).
- `psycopg2` is replaced with `asyncpg` — at that point the entire I/O stack becomes async-native and `async def` handlers stop wasting threads.

### Migration mapping (Flask → FastAPI)

| Flask | FastAPI |
|-------|---------|
| `Blueprint(name, url_prefix=…)` | `APIRouter(prefix=…, tags=[…])` |
| `@bp.route(path, methods=["POST"])` | `@router.post(path)` |
| `request.get_json()` | Pydantic model parameter |
| `request.args.get("q")` | `q: str = Query(...)` |
| `jsonify(data)` | `return data` (auto-serialised) |
| `jsonify(error=…), 400` | `JSONResponse(status_code=400, content={…})` |
| `flask.g` (per-request DB) | `Depends(get_db)` generator |
| `@require_api_key` decorator | `Depends(verify_api_key)` |
| `flask_limiter.Limiter` | `slowapi.Limiter` (API-compatible) |
| `CORS(app)` | `app.add_middleware(CORSMiddleware)` |
| `app.teardown_appcontext` | Dependency `finally` block |
| `app.test_client()` | `fastapi.testclient.TestClient` |

### Critical design decisions

1. **Keep handlers `def`, not `async def`** while psycopg2 is in use — synchronous calls run in FastAPI's threadpool; making them `async` would block the event loop on every DB query.
2. **Use `JSONResponse` for errors, not `HTTPException`** — `HTTPException(detail=…)` wraps in `{"detail": …}`, breaking the existing `{ error, message }` contract that the frontend expects.
3. **Use slowapi for rate limiting** — API-compatible with flask_limiter; each rate-limited route adds `request: Request` to its signature.
4. **Run under Gunicorn + UvicornWorker** in production — better lifecycle management than uvicorn standalone.

### Dependency change

```diff
- flask==3.1.0
- flask-cors==5.0.1
- flask-limiter==3.12
- gevent==24.11.1
+ fastapi>=0.115.0
+ uvicorn[standard]>=0.34.0
+ slowapi>=0.1.9
+ pydantic>=2.9.0
+ httpx>=0.27.0
```

Keep: `psycopg2-binary`, `gunicorn`, `openai`, `scikit-learn`, `python-dotenv`, `pytest-cov`.

### New file: `models.py`

Roughly twelve Pydantic request models, one per endpoint:

`FeedbackRequest`, `RewriteRequest`, `PolishRequest`, `SummarizeRequest`, `ReviewDepthRequest`, `ScoreSuggestionRequest`, `CalibrationRequest`, `ScoreReasoningRequest`, `SimilaritySubmission` + `SimilarityRequest`, `TurnitinRequest`, `ChatRequest`.

### Implementation sequence

| Step | Files | Notes |
|------|-------|-------|
| 1 | `requirements.txt` | Replace Flask stack with FastAPI stack |
| 2 | `models.py` | New — Pydantic request models |
| 3 | `extensions.py` | `flask.g` → `Depends`, `flask_limiter` → `slowapi`, `@require_api_key` → `Depends` |
| 4 | `app.py` | Flask factory → FastAPI factory |
| 5 | `routes/__init__.py` | Blueprint → Router registration |
| 6 | `routes/health.py` | Simplest route — validates the app boots |
| 7 | `routes/*.py` (other 9) | Migrate one at a time; tests stay green between each |
| 8 | `tests/conftest.py` | Replace Flask test client with `TestClient` |
| 9 | `tests/test_*.py` | Update mock paths; `get_json()` → `json()` |
| 10 | `Dockerfile` | gevent worker → uvicorn worker |
| 11 | `docker-compose.yml` | Update worker class env |
| 12 | Documentation | Update [ARCHITECTURE.md §7](ARCHITECTURE.md#7-ai-service-architecture) and [README.md](../README.md) |

### Verification

```bash
python -c "from app import create_app; app = create_app(); print(type(app))"

# Should list all 17 endpoints
python -c "
from app import create_app
app = create_app()
for r in sorted(set(r.path for r in app.routes if hasattr(r, 'path'))):
    print(r)
"

python -m pytest tests/ -v --cov=. --cov-fail-under=60
```

---

## 3. Other Deferred Work

### 3.1 Real LMS integration

The LMS module (`/lms`) currently mocks LTI 1.3 — launches and grade passback are simulated and recorded in logs. To go live:

1. Pick an LTI library (PyLTI 1.3, ims-lti).
2. Replace mock handlers in [`backend/src/controllers/lmsController.ts`](../backend/src/controllers/lmsController.ts) with real outbound calls.
3. Store consumer keys / shared secrets via the secrets manager, not `lms_config.lti_secret`.
4. Add Canvas / Blackboard / Moodle smoke tests.

### 3.2 Real Turnitin

The Turnitin endpoint (`/api/ai/similarity/turnitin`) returns randomised scores for development. Production integration requires a Turnitin Originality contract, OAuth 2.0 setup, and webhooks for asynchronous report retrieval.

### 3.3 Multi-instance Redis correctness

When the platform scales beyond one backend instance, the in-memory fallbacks in [`utils/redis.ts`](../backend/src/utils/redis.ts), the rate limiter, and the SSE hub stop being equivalent across replicas. Today the system survives a Redis outage but loses cross-instance consistency. Make Redis a hard dependency in production once horizontal scaling is real.

### 3.4 Continuous backups

Daily `pg_dump` is documented in [DEPLOYMENT.md §5](DEPLOYMENT.md#5-database-backup-and-recovery). For an RPO better than 24 hours, enable WAL archiving (or migrate to managed PostgreSQL with continuous backup).

### 3.5 Coverage targets

- Backend Jest: no enforced floor in CI; aim for ≥ 80 % on new code.
- Frontend Vitest: no enforced floor; visual regression supplements.
- AI service pytest: `--cov-fail-under=60` in CI; raise to 80 once flaky areas stabilise.

### 3.6 PWA capabilities

`vite-plugin-pwa` ships a service worker with NetworkFirst caching for `/auth`, `/submissions`, `/reviews`, `/notifications` (5-min TTL, 50-entry cap). The PWA today is install-only — no offline write queue. A real offline mode would require IndexedDB-backed mutation buffering and conflict resolution.

---

## 4. Done (recently — for context)

These shipped in v3.0+ and no longer count as "future work":

- 19 feature modules — see [ARCHITECTURE.md §9](ARCHITECTURE.md#9-module-maturity).
- 5-job CI pipeline (backend, frontend, ai-service, docker, security via Trivy).
- 37 numbered migrations with auto-apply on backend startup.
- Per-user rate limiting (was per-IP) — see [DEPLOYMENT.md §6](DEPLOYMENT.md#6-rate-limiting-reference).
- Application-factory + lazy-init pattern for the AI service.
- Documentation rewrite (this commit).

---

## 5. References

- Source of truth: live code under `backend/`, `frontend/`, `ai-service/`.
- Architecture: [ARCHITECTURE.md](ARCHITECTURE.md).
- Deployment: [DEPLOYMENT.md](DEPLOYMENT.md).
- Original FastAPI migration draft (now folded into §2 of this document): replaced.
