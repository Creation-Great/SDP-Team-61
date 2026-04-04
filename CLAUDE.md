# CLAUDE.md — Project Development Guidelines

## Project Overview

SDP Peer Review System — an AI-enhanced peer review platform for university courses.
- **Monorepo**: backend (Express/TS), frontend (React/Vite), ai-service (Flask/Python)
- **Theme**: UConn Blue `#000E2F` — all primary colors use this value
- **Database**: PostgreSQL 16 with RLS, 20 versioned migrations via `node-pg-migrate`

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
- **Auth**: JWT httpOnly cookies (cookie + Bearer header only; no query param). Middleware: `authenticate` → `requireRole()`. JWT verified with `algorithms: ['HS256']`.
- **DB**: `pool` from `src/db.ts`. Use `pool.query()` with parameterized queries. Never string-interpolate SQL.
- **Migrations**: Numbered SQL files in `backend/migrations/` (001–020). Auto-run on startup via `src/migrate.ts`.
- **Logging**: Use `logger` from `src/utils/logger.ts` (Pino). Never `console.log` in production code.
- **Error handling**: Throw `AppError(statusCode, message)`. Async routes wrapped with `h()` from `asyncHandler.ts`.
- **Validation**: Use Zod schemas in `src/schemas.ts` + `validate` middleware. Route params validated via `validateParams()` (UUID schemas).
- **Notification routes** use `notificationController.ts` (10 exported functions). Routes in `notificationRoutes.ts` are thin wrappers.

### Frontend (React 19 + Vite + Tailwind)
- **Layout**: `App.jsx` uses `React.lazy()` for all 22 page components (route-level code splitting). `<AppLayout>` wraps `<Sidebar>` + header + `<Suspense>` fallback.
- **New Pages (v3.0)**: 11 additional pages — RevisionHistory, SimilarityDashboard, AiChat, GradeManagement, LmsConfig, SemesterManagement, Calendar, AdvancedAnalytics, AuditLog, UserPreferences, DataExport (total: 33 pages)
- **Styling**: Tailwind CSS utility classes. Primary color: `#000E2F` (used as `bg-[#000E2F]`, `text-[#000E2F]`, etc.)
- **CSS Variables**: Defined in `index.css` — `--primary: #000E2F`, `--uconn-blue: #000E2F`
- **API calls**: Always use `API` from `services/api.js` (Axios instance). Never use raw `fetch` or `axios` directly.
- **Proxy**: Vite proxies 11 path prefixes to `http://localhost:8080` — see `vite.config.js`
- **UI primitives**: Use `Card`, `Button`, `Badge` from `components/ui/` for consistency.
- **Icons**: Lucide React (`lucide-react`). Never add new icon libraries.
- **Background images**: Login/register → `content.webp`, content area → `background3.jpg` (in `public/images/`)
- **Auth context**: `useAuth()` from `contexts/AuthContext.jsx`. Provides `user`, `login()`, `logout()`.

### AI Service (Flask + OpenAI)
- **Entry**: `ai-service/app.py`
- **Endpoints** (Express side, all under `/api/ai`): `feedback` (POST + GET), `rewrite` (POST + GET + PATCH adopt), `polish` (POST), `summarize` (POST), `logs` (GET), `search` (GET) — 9 endpoints total. POST endpoints validated via Zod schemas; `:reviewId` params validated via `validateParams(reviewIdParamSchema)`.
- **Flask paths**: Most map 1:1 (`/api/ai/*`), except search which proxies to `/api/search` on the Flask side
- **Auth**: Inter-service `X-AI-API-Key` header validated by `@require_api_key` decorator (fail closed — rejects when key unset)
- **DB**: `psycopg2.pool.ThreadedConnectionPool` (1–10 connections, 10s connect timeout, 30s statement timeout)
- **Rate limiting**: Flask-Limiter per endpoint (30/min for polish, 20/min for rewrite/summarize)
- **Retry**: OpenAI calls retry up to 3 times with exponential backoff on APIConnectionError/RateLimitError/APITimeoutError
- **Logging**: Structured JSON logs; each OpenAI call logs prompt_tokens/completion_tokens/total_tokens
- **New AI endpoints** (v3.0): `review-depth` (POST), `score-suggestion` (POST), `calibration` (POST), `score-reasoning` (POST), `similarity` (POST), `similarity/turnitin` (POST), `chat` (POST) — 7 additional endpoints under `/api/ai`

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

### New Routes (v3.0)
- `/anonymity` — Anonymous review configuration (sessions)
- `/revisions` — Multi-round revision history and diffs
- `/grades` — Grade weight config, final calculation, CSV export
- `/lms` — Mock LMS integration (LTI, grade passback, roster)
- `/deadlines` — Calendar, extensions, reminder configuration
- `/preferences` — User preferences (theme, font, contrast)
- `/compliance` — GDPR data export, deletion requests, audit log
- `/similarity` — Plagiarism/similarity reports
- `/semesters` — Semester management (CRUD, clone)
- `/assignment-strategy` — Strategy config, exclusion rules
- `/quality` — Helpfulness voting, reputation, consistency alerts

### Database
- 36 sequential migrations (001–036) — **never modify existing migration files**, always add new ones
- `ai_activity_logs.user_id` is VARCHAR (not UUID FK) — may be "unknown" for anonymous calls
- `notifications.user_id` is UUID FK → `users(user_id)` ON DELETE CASCADE
- Use `ILIKE` for case-insensitive search in PostgreSQL

### Redis (v3.0)
- **Config**: `REDIS_URL` env var; optional (graceful degradation to in-memory)
- **Usage**: Token blacklist (SETEX with TTL), rate limiting store, cache helpers
- **Init**: `initRedis()` called in `server.ts` on startup
- **Helpers**: `cacheGet()`, `cacheSet()`, `cacheDel()`, `cacheInvalidate()` from `src/utils/redis.ts`

### Frontend-Backend Data Contract
- Search results: `{ submissions: [{ submission_id, title, original_filename, status, uploader_name, created_at }], students: [...] }`
- AI logs: Plain JSON array `[{ id, action, user_id, user_name, detail, created_at }]` (not wrapped in object; `user_name` comes from JOIN with `users` table)
- AI feedback: `{ toxicity, politeness, sentiment }` from `POST /api/ai/feedback`
- AI rewrite: `{ id, original, rewritten, adopted }` from `POST /api/ai/rewrite`, adopt via `PATCH /api/ai/rewrite/:id/adopt`
- Notifications: Plain JSON array from `GET /notifications`, `{ count }` from `GET /notifications/unread-count`. Types: `review_assigned`, `review_received`, `submission_graded`, `announcement`, `deadline_approaching`, `similarity_alert`, `grade_released`, `extension_granted`, `reminder`
- AI polish detail stores `{ input_length }`, AI summarize stores `{ input_length, review_count }`
- Enrollments: `[{ enrollment_id, user_id, course_id, group_id, role, is_primary, enrolled_at, name, email }]`

## Testing

```bash
cd backend && npm test    # Jest — 14 suites, 67 tests
cd ai-service && python -m pytest tests/ -v   # 11 suites, 90 tests
```

- Backend tests in `backend/tests/` — use mock factories from `helpers.ts`
- Test env vars set in `envSetup.ts`
- Coverage includes: utils, validation, role guards, auth, submissions, health/CORS, peer review, instructor, AI controller, review, rubric, enrollment, assignment template
- AI service tests in `ai-service/tests/test_app.py` — pytest with mocked DB/OpenAI

## CI/CD (GitHub Actions)

- Triggers: push to `main`/`integrated`, PRs to `main`
- 5 jobs: Backend CI (with PG service + coverage), Frontend CI, AI Service CI (with pytest), Docker Build, Security Scan (Trivy)

## Common Pitfalls

1. **Vite proxy**: Any new backend route prefix needs a matching entry in `frontend/vite.config.js` AND `frontend/nginx.conf`
2. **Express route order**: Parameterized routes (`/:id`) catch everything — put specific routes first
3. **AI service search SQL**: `submissions` table uses `user_id` (not `student_id`), column is `title` (not `original_filename`)
4. **Notification polling**: Bell polls every 30s — don't add WebSocket unless explicitly needed
5. **Migration numbering**: Next migration should be `037_*.sql`
6. **Enrollment controller**: Instructors see all enrollments; students only see their own (role-based filtering in `listEnrollments`)
7. **Peer review team_size**: `getSessions` for instructors filters `team_size` by `user_enrollments` matching the session's `course_id` — not a global student count
8. **AI activity logs**: `user_name` is resolved via JOIN with `users` table; if no match found, frontend falls back to `user_id` or `'A user'`
9. **Session deadline**: `createSessionSchema` uses `z.string().min(1).nullish()` for `course_id` (not UUID) since course IDs are text like `"CSE4939W"`
10. **Redis optional**: All Redis operations have in-memory fallbacks; system works without Redis
11. **Anonymity column**: Column is `anonymity` (not `anonymity_level`) on `peer_review_sessions` and `submissions`
12. **Assignment strategy**: Column is on `submissions` table (not `peer_review_sessions`)
13. **Legacy vs numbered migrations**: `sql/migrations.sql` has full schema; numbered migrations (001-036) add incremental changes. Docker init runs legacy file first, then numbered migrations.
14. **AI conversations**: Table PK is `id` (not `conversation_id`); user_id must be valid UUID FK
15. **TA role**: Treated like instructor for reads, restricted for session creation

## New Features (v3.0)

### Module Maturity

| Status | Modules |
|--------|---------|
| **Production** | Anonymous Reviews, Multi-Round Review, Assignment Strategy, Review Quality, AI Feedback/Rewrite/Polish/Summarize, Grade Management, Semester Management, Deadlines & Reminders, Notifications, User Preferences, Audit & Compliance |
| **Beta** | AI Scoring & Calibration, AI Chat, Similarity Detection (TF-IDF) |
| **Mock** | LMS Integration (simulated LTI), Turnitin (randomized scores) |

### Anonymous Reviews
- `anonymity_level` enum: none, single_blind, double_blind
- Per-session and per-submission anonymity configuration
- `anonymous_reviewer_map` table for stable pseudonyms

### Multi-Round Review
- `revision_number` and `parent_submission_id` on submissions
- `review_round` on reviews and peer_reviews
- Revision history and diff endpoints

### Assignment Strategy
- `assignment_strategy` enum: random, load_balanced, reciprocal, manual_only
- `review_exclusions` table for conflict-of-interest rules
- `min_reviews_required` per submission

### Review Quality Assessment
- `review_helpfulness` voting table
- `reviewer_reputation` aggregate table
- AI depth scoring (constructiveness, specificity, actionability)

### AI Enhancements
- Score suggestion, calibration, score reasoning endpoints
- Plagiarism/similarity detection (TF-IDF cosine + mock Turnitin)
- Multi-turn conversational AI assistant (3 context modes)

### Grade Management
- `grade_weights` per course with weighted calculation
- Drop lowest/highest support
- CSV export of final grades

### Course Management
- `semesters` table with active/inactive toggle
- TA role support
- Enhanced announcements with pinned and scheduled_at

### Deadline & Reminders
- Automated reminder scheduler (configurable hours before deadline)
- Grace periods per session/template
- Individual deadline extensions
- Calendar API endpoint

### Infrastructure
- Redis for caching, token blacklist, rate limiting
- Object storage abstraction (local + mock S3)
- Review integrity hashes (SHA-256)

### UI/UX
- Dark mode with CSS variables
- Score distribution, activity trend, radar, heatmap charts
- Rich text editor with markdown toolbar
- AI chat widget
- User preferences (theme, font size, contrast)

### Compliance
- GDPR data export (JSON download)
- Account deletion requests
- Enhanced audit log viewer

### Migrations
- 021-036: New tables and schema extensions
