# CLAUDE.md — Project Development Guidelines

## Project Overview

SDP Peer Review System — an AI-enhanced peer review platform for university courses.
- **Monorepo**: backend (Express/TS), frontend (React/Vite), ai-service (Flask/Python)
- **Theme**: UConn Blue `#000E2F` — all primary colors use this value
- **Database**: PostgreSQL 16 with RLS, 10 versioned migrations via `node-pg-migrate`

## Quick Reference

### Start Development (Local)

```powershell
# Option A — one-click script
.\start-dev.ps1

# Option B — manual
docker compose up db -d                           # PostgreSQL
cd backend  && npm install && npx tsx watch src/server.ts   # :8080
cd frontend && npm install && npx vite --host              # :5173
cd ai-service && pip install -r requirements.txt && python app.py  # :5001
```

### Start with Docker Compose (Full)

```bash
docker compose up --build -d    # db + backend + ai-service + frontend
```

## Architecture Rules

### Backend (TypeScript + Express)
- **Entry**: `backend/src/server.ts` → `app.ts`
- **Pattern**: MVC — controllers in `src/controllers/`, routes in `src/routes/`
- **Auth**: JWT httpOnly cookies. Middleware: `authenticate` → `requireRole()`
- **DB**: `pool` from `src/db.ts`. Use `pool.query()` with parameterized queries. Never string-interpolate SQL.
- **Migrations**: Numbered SQL files in `backend/migrations/` (001–010). Auto-run on startup via `src/migrate.ts`.
- **Logging**: Use `logger` from `src/utils/logger.ts` (Pino). Never `console.log` in production code.
- **Error handling**: Throw `AppError(statusCode, message)`. Async routes wrapped with `h()` from `asyncHandler.ts`.
- **Validation**: Use Zod schemas in `src/schemas.ts` + `validate` middleware.
- **Notification routes** use direct `pool.query()` (no separate controller) in `notificationRoutes.ts`.

### Frontend (React 19 + Vite + Tailwind)
- **Layout**: `App.jsx` renders `<AppLayout>` with `<Sidebar>` + header (`<HeaderSearchBar>` + `<NotificationBell>`)
- **Styling**: Tailwind CSS utility classes. Primary color: `#000E2F` (used as `bg-[#000E2F]`, `text-[#000E2F]`, etc.)
- **CSS Variables**: Defined in `index.css` — `--primary: #000E2F`, `--uconn-blue: #000E2F`
- **API calls**: Always use `API` from `services/api.js` (Axios instance). Never use raw `fetch` or `axios` directly.
- **Proxy**: Vite proxies 12 path prefixes to `http://localhost:8080` — see `vite.config.js`
- **UI primitives**: Use `Card`, `Button`, `Badge` from `components/ui/` for consistency.
- **Icons**: Lucide React (`lucide-react`). Never add new icon libraries.
- **Background images**: Login/register → `content.png`, content area → `background3.jpg` (in `public/images/`)
- **Auth context**: `useAuth()` from `contexts/AuthContext.jsx`. Provides `user`, `login()`, `logout()`.

### AI Service (Flask + OpenAI)
- **Entry**: `ai-service/app.py`
- **Endpoints**: `/api/ai/feedback`, `/api/ai/rewrite`, `/api/ai/polish`, `/api/ai/summarize`, `/api/ai/logs`, `/api/search`
- **Auth**: Inter-service `X-AI-API-Key` header validated by `@require_api_key` decorator
- **DB**: Direct `psycopg2` connection to PostgreSQL for `ai_activity_logs` and search queries
- **Rate limiting**: Flask-Limiter per endpoint (30/min for polish, 20/min for rewrite/summarize)

## Coding Conventions

### General
- No `console.log` in committed code (use logger/structured logging)
- All async Express handlers wrapped with `h()` helper
- All API paths match: frontend → Vite proxy → Express routes → AI service
- Backend responses: `res.json(data)` on success, `res.status(N).json({ error, message })` on failure

### Naming
- Routes: kebab-case paths (`/peer-review/sessions/:id/my-team`)
- Controllers: camelCase functions (`postFeedback`, `getAiLogs`)
- React components: PascalCase files and exports (`HeaderSearchBar.jsx`)
- DB: snake_case tables and columns (`ai_activity_logs`, `user_id`)

### Route Registration Order
- In Express, **static routes must be registered before parameterized routes** (e.g., `/read-all` before `/:id/read`)
- All routes under `/api/ai` require authentication
- All routes under `/notifications` require authentication

### Database
- 10 sequential migrations (001–010) — **never modify existing migration files**, always add new ones
- `ai_activity_logs.user_id` is VARCHAR (not UUID FK) — may be "unknown" for anonymous calls
- `notifications.user_id` is UUID FK → `users(user_id)` ON DELETE CASCADE
- Use `ILIKE` for case-insensitive search in PostgreSQL

### Frontend-Backend Data Contract
- Search results: `{ submissions: [{ submission_id, title, original_filename, status, uploader_name, created_at }], students: [...] }`
- AI logs: Plain JSON array `[{ id, action, user_id, detail, created_at }]` (not wrapped in object)
- Notifications: Plain JSON array from `GET /notifications`, `{ count }` from `GET /notifications/unread-count`
- AI polish detail stores `{ input_length }`, AI summarize stores `{ input_length, review_count }`

## Testing

```bash
cd backend && npm test    # Jest — 7 suites, 36 tests
```

- Tests in `backend/tests/` — use mock factories from `helpers.ts`
- Test env vars set in `envSetup.ts`
- Coverage includes: utils, validation, role guards, auth, submissions, health/CORS

## CI/CD (GitHub Actions)

- Triggers: push to `main`/`integrated`, PRs to `main`
- 4 jobs: Backend CI (with PG service), Frontend CI, AI Service CI, Docker Build
- Frontend lint runs with `continue-on-error: true`

## Common Pitfalls

1. **Vite proxy**: Any new backend route prefix needs a matching entry in `frontend/vite.config.js`
2. **Express route order**: Parameterized routes (`/:id`) catch everything — put specific routes first
3. **AI service search SQL**: `submissions` table uses `user_id` (not `student_id`), column is `title` (not `original_filename`)
4. **Notification polling**: Bell polls every 30s — don't add WebSocket unless explicitly needed
5. **Migration numbering**: Next migration should be `011_*.sql`
