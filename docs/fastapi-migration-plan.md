# FastAPI Migration Plan — AI Service

> **Status: Deferred.** Flask + gevent handles current load. Execute when a trigger condition is met.
>
> **Trigger conditions (any one):**
> - AI Chat needs streaming token-by-token output (SSE/WebSocket)
> - OpenAPI documentation needed for third-party integration
> - psycopg2 replaced with asyncpg (makes `async def` worthwhile)

## Current State

- **Framework:** Flask 3.1 + gevent (4 workers, 100 connections each = 400 concurrent)
- **Structure:** 13 modular files (config, extensions, 10 route Blueprints, app factory)
- **Tests:** 90 tests, 88% coverage, 0.38s execution

## Migration Mapping

| Flask | FastAPI |
|-------|---------|
| `Blueprint(name, url_prefix=...)` | `APIRouter(prefix=..., tags=[...])` |
| `@bp.route(path, methods=["POST"])` | `@router.post(path)` |
| `request.get_json()` | Pydantic model parameter |
| `request.args.get("q")` | `q: str = Query(...)` |
| `jsonify(data)` | `return data` (auto-serialized) |
| `jsonify(error=...), 400` | `JSONResponse(status_code=400, content={...})` |
| `flask.g` for DB | `Depends(get_db)` generator |
| `@require_api_key` decorator | `Depends(verify_api_key)` |
| `flask_limiter.Limiter` | `slowapi.Limiter` (same API) |
| `CORS(app)` | `app.add_middleware(CORSMiddleware)` |
| `app.teardown_appcontext` | Dependency `finally` block |
| `app.test_client()` | `fastapi.testclient.TestClient` |

## Critical Design Decisions

1. **Keep routes as `def`, not `async def`** — psycopg2 is synchronous. FastAPI runs sync functions in a threadpool. Adding `async` would block the event loop.

2. **Use `JSONResponse` for errors, not `HTTPException`** — `HTTPException(detail=...)` wraps in `{"detail": ...}`, breaking the existing `{"error": ..., "message": ...}` frontend contract.

3. **slowapi for rate limiting** — API-compatible with flask_limiter. Each rate-limited route needs `request: Request` in its signature.

4. **Gunicorn + UvicornWorker** for production (better process management than uvicorn standalone).

## Dependencies Change

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

Keep: `psycopg2-binary`, `gunicorn`, `openai`, `scikit-learn`, `python-dotenv`, `pytest-cov`

## New File: `models.py`

12 Pydantic request models:

- `FeedbackRequest(review_id: str, text: str)`
- `RewriteRequest(review_id: str, text: str, context: str = "")`
- `PolishRequest(text: str, user_id: str = "unknown")`
- `SummarizeRequest(reviews: list, user_id: str = "unknown")`
- `ReviewDepthRequest(review_id: str, text: str)`
- `ScoreSuggestionRequest(submission_text: str, rubric_json: Any)`
- `CalibrationRequest(reviewer_score: float, peer_avg_score: float, submission_context: str = "")`
- `ScoreReasoningRequest(score: int, submission_context: str)`
- `SimilaritySubmission(submission_id: str, text: str)`
- `SimilarityRequest(submissions: list[SimilaritySubmission])`
- `TurnitinRequest(submission_id: str, text: str)`
- `ChatRequest(message: str, context_type: str, context_id: str | None, conversation_id: str | None, user_id: str | None)`

## Implementation Order (12 steps)

| Step | Files | Description |
|------|-------|-------------|
| 1 | `requirements.txt` | Replace Flask with FastAPI stack |
| 2 | `models.py` | Create Pydantic request models |
| 3 | `extensions.py` | flask.g → Depends, flask_limiter → slowapi, auth → Depends |
| 4 | `app.py` | Flask → FastAPI factory |
| 5 | `routes/__init__.py` | Blueprint → Router registration |
| 6 | `routes/health.py` | Simplest route — validate app boots |
| 7 | `routes/*.py` (9 files) | Remaining routes |
| 8 | `tests/conftest.py` | TestClient fixture |
| 9 | `tests/test_*.py` | Update mock paths, `get_json()` → `json()` |
| 10 | `Dockerfile` | gevent → uvicorn worker |
| 11 | `docker-compose.yml` | Update worker class env |
| 12 | `README.md`, `CLAUDE.md` | Update tech stack references |

## Verification

```bash
# Import check
python -c "from app import create_app; app = create_app(); print(type(app))"

# Route completeness (expect 17 endpoints)
python -c "
from app import create_app
app = create_app()
routes = sorted(set(r.path for r in app.routes if hasattr(r, 'path')))
for r in routes: print(r)
"

# Full test suite
python -m pytest tests/ -v --cov=. --cov-fail-under=60
```
