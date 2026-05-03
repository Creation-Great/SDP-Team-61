# Development Guide

> Day-to-day workflow for working in this repository. Read [ARCHITECTURE.md](ARCHITECTURE.md) first.

## Local Setup

1. **Install Docker Desktop, Node.js 20+, Python 3.10+.**
2. Copy `.env.example` to `.env` and set `POSTGRES_PASSWORD` and `JWT_SECRET` (≥ 64 hex chars; generate with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`).
3. Install dependencies in each service:

   ```bash
   make install
   # or manually:
   cd backend     && npm install
   cd frontend    && npm install
   cd ai-service  && pip install -r requirements.txt
   ```

4. Boot supporting infra and start dev servers:

   ```bash
   # Windows one-click
   .\start-dev.ps1

   # Cross-platform Make
   make dev        # db + redis + backend + frontend
   make dev-ai     # add the AI service
   ```

Default URLs after boot:

- Frontend: <http://localhost:5173>
- Backend API: <http://localhost:8080>
- API docs: <http://localhost:8080/api-docs> (dev only)
- AI service: <http://localhost:5001>

## Repository Layout

```
.
├── backend/
│   ├── src/
│   │   ├── server.ts        # process bootstrap
│   │   ├── app.ts           # Express assembly + global error handler
│   │   ├── db.ts            # pg Pool + withDb()/withDbNoRLS()
│   │   ├── migrate.ts       # CLI: up / down
│   │   ├── schemas.ts       # Zod schemas for request validation
│   │   ├── types.ts         # AuthRequest, AuthUser, shared types
│   │   ├── controllers/     # 22 *Controller.ts files
│   │   ├── routes/          # 22 *Routes.ts files (one per controller)
│   │   ├── middleware/      # auth, validate, roleGuard, upload, csvUpload, exportLimiter
│   │   └── utils/           # AppError, asyncHandler, redis, sse, scheduler, …
│   ├── migrations/          # 001…037 incremental SQL
│   ├── sql/                 # legacy full schema + seed data
│   └── tests/               # Jest specs (14 files)
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # 35 <Route> declarations, route-level lazy import
│   │   ├── main.jsx         # ReactDOM.createRoot + providers
│   │   ├── pages/           # 33 *Page.jsx
│   │   ├── components/      # cross-page UI (Sidebar, NotificationBell, etc.)
│   │   │   └── ui/          # primitives: Card, Button, Badge, …
│   │   ├── services/api.js  # ONLY allowed Axios entry-point
│   │   ├── contexts/        # AuthContext, ToastProvider, …
│   │   ├── hooks/           # useSSE, useDebounce, …
│   │   └── lib/             # pure utilities
│   ├── e2e/                 # Playwright specs
│   ├── vite.config.js       # 22 proxy prefixes (must stay in sync with nginx)
│   └── nginx.conf           # production reverse proxy
├── ai-service/
│   ├── app.py               # create_app() factory
│   ├── config.py            # env vars + structured JSON logger
│   ├── extensions.py        # DB pool, OpenAI client, Limiter, @require_api_key
│   ├── routes/              # 10 Blueprints + register_all()
│   └── tests/               # 11 test_*.py files + conftest.py
├── docs/                    # this directory
├── tests/full-e2e-test.sh   # cross-service shell harness
├── docker-compose.yml       # 5 services (db, redis, backend, ai-service, frontend)
├── Makefile                 # cross-platform dev shortcuts
└── start-dev.ps1            # Windows one-click launcher
```

## Coding Conventions

### General

- All source code, comments, identifiers, and commit messages are written in **English**.
- Default file encoding **UTF-8 without BOM**.
- Line endings: follow `.gitattributes` if present, otherwise LF.

### Backend (TypeScript + Express)

- ESM project (`"type": "module"` in `package.json`). Import paths point to compiled `.js` files even from `.ts` source — that is intentional, not a bug.
- All async route handlers wrap with [`h()`](../backend/src/utils/asyncHandler.ts) so unhandled rejections surface to the global error middleware.
- Throw [`AppError(statusCode, message)`](../backend/src/utils/AppError.ts) for typed failures; the global handler maps it to a JSON response.
- SQL: always parameterise. `pool.query('SELECT … WHERE id = $1', [id])`. Never string-interpolate user input.
- Validate every request body with a Zod schema in [`schemas.ts`](../backend/src/schemas.ts). UUID URL params validate via `validateParams(uuidSchema)`.
- Logging via [`logger`](../backend/src/utils/logger.ts) (Pino). **No `console.log` in committed code.**
- Static Express routes register before parameterised ones (`/read-all` before `/:id`).
- Naming: routes `kebab-case`, functions `camelCase`, exported types/interfaces `PascalCase`, constants `UPPER_SNAKE_CASE`.

### Frontend (React 19 + Vite)

- All HTTP calls go through [`services/api.js`](../frontend/src/services/api.js) (Axios). No raw `fetch`/`axios`.
- Use the existing UI primitives in [`components/ui/`](../frontend/src/components/) (Card, Button, Badge, Skeleton, ConfirmDialog, ToastProvider, …) before introducing new ones.
- Icons from `lucide-react` only; no other icon libraries.
- Tailwind utility classes; primary colour is `#000E2F` (apply via `bg-[#000E2F]` / `text-[#000E2F]` or the `--primary` CSS variable).
- All non-trivial subtrees wrap with `<ErrorBoundary>` so isolated crashes never take down the whole shell. See [`App.jsx`](../frontend/src/App.jsx) for the layout pattern.
- Components: PascalCase files and exports; hooks: `useFoo` camelCase.
- Component props: define a named `interface`/`type` (or JSDoc in `.jsx` files when type clarity helps).

### AI Service (Flask + Python)

- Application-factory pattern: never construct `Flask(__name__)` at import time.
- All AI route handlers carry the `@require_api_key` decorator.
- Database access pattern: `conn = get_db()`; cursor work; rely on `close_db` teardown to return the connection.
- OpenAI calls go through [`call_openai()`](../ai-service/extensions.py#L63) or [`call_openai_chat()`](../ai-service/extensions.py#L116) for built-in retry + token-usage logging.
- All output destined for the database goes through a validator (e.g. [`validate_feedback`](../ai-service/extensions.py#L165)); never trust the model.
- Logs are structured JSON (see [`config.py`](../ai-service/config.py#L41)). Use `log.info("msg", extra={"extra_data": {...}})`, not `print()`.
- Follow PEP 8; type hints on function signatures recommended.

## Common Workflows

### Add a new backend API endpoint

1. **Migration** (if a new table or column is needed). Add `backend/migrations/038_descriptive-name.sql`. Numbered slot is the next free integer; current head is 037.
2. **Schema** — add a Zod schema for the request body and any response shape to [`schemas.ts`](../backend/src/schemas.ts).
3. **Controller** — add a handler to the relevant `*Controller.ts`, throwing `AppError` on failure. Wrap any DB transaction in `withDb()` so RLS variables are set.
4. **Route** — register the path in the matching `*Routes.ts`. Apply `authenticate` plus any `requireRole(...)` and `validate(schema)` middleware.
5. **Frontend client** — add a function in `services/api.js`, then call it from the page that needs it.
6. **Vite + nginx proxy** — only required when introducing a *new top-level prefix*. If you add `/foo`, edit both `frontend/vite.config.js` and `frontend/nginx.conf`.
7. **Tests** — add a Jest spec under `backend/tests/` (mock `pg.Pool`; use the helpers in `tests/helpers.ts`).
8. **OpenAPI** — update `docs/openapi.yaml` and the table in `docs/API.md`.

### Add a new frontend page

1. Create `frontend/src/pages/MyFeaturePage.jsx`.
2. In [`App.jsx`](../frontend/src/App.jsx), add a `lazy(() => import('./pages/MyFeaturePage'))` and a `<Route>` declaration. Wrap it in `<ProtectedRoute>` and the appropriate role guard (`<StudentRoute>` / `<InstructorRoute>`) inside `<AppLayout>`.
3. Add a sidebar entry in [`components/Sidebar.jsx`](../frontend/src/components/Sidebar.jsx).
4. Add an `services/api.js` function for any new endpoint the page calls.
5. Add a Vitest spec for non-trivial logic; add a Playwright E2E for critical user flows.

### Add a new AI endpoint

1. Create `ai-service/routes/<name>.py` with a Blueprint, e.g. `<name>_bp = Blueprint('<name>', __name__, url_prefix='/api/ai')`.
2. Decorate handlers with `@<name>_bp.route('/<path>', methods=['POST'])` and `@require_api_key`.
3. Register the Blueprint in [`routes/__init__.py`](../ai-service/routes/__init__.py): import and append to the loop in `register_all()`.
4. Add a backend forwarder in [`controllers/aiController.ts`](../backend/src/controllers/aiController.ts) and route in [`routes/aiRoutes.ts`](../backend/src/routes/aiRoutes.ts), wrapped with `validate()` and rate-limited as appropriate.
5. Update Vite proxy and nginx config — the path is under `/api/ai`, which is already wired, so usually no change is needed.
6. Add a pytest spec under `ai-service/tests/test_<name>.py`.

### Run a one-off migration

```bash
cd backend
npm run migrate            # apply pending
npm run migrate:down       # roll back the most recent
npm run migrate:redo       # down + up
SKIP_MIGRATE=true npm run dev   # boot without auto-migrating
```

The Docker `db` service additionally seeds itself from `backend/sql/migrations.sql` and `backend/sql/seed.sql` on first start.

## Testing

| Layer | Command | Framework | Notes |
|-------|---------|-----------|-------|
| Backend unit / integration | `cd backend && npm test` | Jest 29 + Supertest | 14 spec files; uses `cross-env NODE_OPTIONS=--experimental-vm-modules` |
| Backend coverage | `npm test -- --coverage` | Jest | Outputs to `backend/coverage/` |
| Frontend unit | `cd frontend && npm run test` | Vitest 2 + jsdom | Pattern: `src/**/*.test.{js,jsx}` |
| Frontend E2E | `npm run e2e` | Playwright (chromium) | Specs under `frontend/e2e/` |
| AI Service | `cd ai-service && pytest tests/ -v` | pytest | 11 spec files; CI gate `--cov-fail-under=60` |

Test the whole flow end-to-end with `bash tests/full-e2e-test.sh` (requires Git Bash or WSL on Windows).

### Writing tests

- **Default to TDD.** Write the failing test, then the implementation.
- **Mock external services.** Tests must not call OpenAI, push notifications, or real Redis.
- **Use the helpers.** Backend tests share fixtures via [`backend/tests/helpers.ts`](../backend/tests/helpers.ts).
- **Aim for ≥ 80 % coverage on new code.** The AI service has a CI floor of 60 %; raise it as coverage grows.

## Lint and Format

```bash
# all packages
npm run lint
npm run lint:fix
npm run format
npm run format:check
```

Backend uses ESLint + Prettier; frontend uses ESLint (with React plugins) + Prettier; AI service has a `.ruff_cache/` directory but no enforced ruff config — set this up before adding more Python code if linting becomes a friction point.

## Git Workflow

### Branches

- `main` — protected; CI required to pass.
- `integrated` — staging branch for cross-feature merges.
- Feature branches — `<author>-<short-name>` (the live history shows e.g. `kyle-feature`, `anish-dev`).

### Commit messages

Conventional Commits, lowercase scope and verb:

```
feat(ai-service): add review-depth scoring endpoint
fix(backend): close IDOR gap on grade export
refactor: modularize AI service Blueprints
docs: rewrite README to match v3.0
```

Allowed types: `feat` · `fix` · `refactor` · `docs` · `test` · `chore` · `perf` · `ci`.

### Pull requests

1. Push your branch and open a PR into `integrated` (or `main` for hotfixes).
2. PR title = a single Conventional Commit.
3. PR body = bullet summary + manual test checklist.
4. CI must be green (5 jobs: backend, frontend, ai-service, docker, security).
5. At least one reviewer approval before merge. Squash-merge by default.

### Read-only git operations

For local exploration, use:

```bash
git status
git log --oneline -20
git diff main...HEAD
git branch -a
```

Never run `push --force`, `reset --hard`, or any destructive operation on shared branches.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Backend boots but every request returns 503 | DB unreachable | `docker compose up db -d` and check `DATABASE_URL` |
| AI service returns `{ error: "not_configured" }` | `AI_API_KEY` empty in `.env` | Set `AI_API_KEY` in root `.env` and restart |
| Frontend can't reach backend | Vite proxy and nginx not in sync after adding a new prefix | Update both `frontend/vite.config.js` *and* `frontend/nginx.conf` |
| `ECONNREFUSED redis:6379` | Redis not running | Either start it (`docker compose up redis -d`) or unset `REDIS_URL` to fall back to in-memory |
| Migration "already exists" error | Migrations re-run after manual `psql` import | Run `npm run migrate:down` then `npm run migrate` |
| Jest hangs | Unclosed pg pool in a test | Add `--forceExit --detectOpenHandles` (already in `npm test`); double-check `afterAll` closes the pool |
| Playwright says browser not found | First-time setup | `npx playwright install chromium` |
| `TypeError: dotenv` in tests | `.env` overrides test env | Use `envSetup.ts`; do not import `dotenv` directly in tests |

## References

- [ARCHITECTURE.md](ARCHITECTURE.md) — system architecture and invariants
- [API.md](API.md) — endpoint reference
- [DATABASE.md](DATABASE.md) — schema and RLS
- [DEPLOYMENT.md](DEPLOYMENT.md) — production operations
