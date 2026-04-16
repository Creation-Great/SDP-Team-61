# SDP Peer Review System – Integrated

> AI-enhanced peer review platform for university courses. Built with **UConn Blue (#000E2F)** theme, featuring **SSE real-time streaming**, review quality flags, global search, AI-powered writing tools, and instructor analytics. Integrated from `SDP-Team-61-main`, `SDP-Team-61-old-main`, and `SDP-Team-61-anish-dev`, keeping the strengths of each. **v3.0** adds anonymous reviews, multi-round revisions, 4 assignment strategies, AI scoring/calibration/similarity detection, grade management, semesters, dark mode, PWA, Redis caching, and GDPR compliance. This version also includes a security/stability hardening pass (IDOR guards on grade/LMS/deadline/anonymity routes, export rate limiting, anonymous-ID collision fix, frontend unmount safety, per-section error boundaries, localStorage compatibility for private browsing, and a production Docker deploy fix for the ai-service Redis dependency).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 · React Router 7 · Vite 7 · Axios · Tailwind CSS · Lucide Icons · Framer Motion · Recharts · Tiptap (rich-text) · vite-plugin-pwa |
| **Backend** | TypeScript (ES2022) · Express 5 · PostgreSQL 16 (RLS + materialized views) · JWT httpOnly cookies · Zod 4 · Pino · Redis 7 · ioredis · bcrypt · web-push · nodemailer · archiver |
| **AI Service** | Python 3.10+ · Flask 3.1 · Gunicorn (gevent) · OpenAI SDK (via `https://api.x.ai/v1`) · `gpt-4o-mini` · psycopg2 · scikit-learn (TF-IDF) · Flask-Limiter · redis |
| **DevOps** | Docker Compose (5 services) · GitHub Actions CI (5-job pipeline) · ESLint 9 · Prettier · Trivy security scan |
| **Testing** | Backend: Jest 29 · ts-jest · Frontend: Vitest · @testing-library/react · Playwright E2E · AI: pytest |

## Architecture

```
┌──────────────────────┐       ┌──────────────────────┐      ┌──────────────┐
│   Frontend           │────▶│  Backend (TS)        │────▶│ PostgreSQL 16│
│  React 19 / Vite 7   │       │  Express 5 + JWT     │      │  RLS + MV    │
│  Tailwind + UConn    │◀─SSE─│  Pino + Zod + Helmet │      │  37 migs     │
│  :5173 (dev)         │       │  :8080               │      │  :5432       │
│  :80 / :443 (nginx)  │       └──┬────────┬──────────┘      └──────┬───────┘
└──────────────────────┘          │        │                        │
                                  │        │  Bearer X-AI-API-Key   │
                                  │        ▼                        │
                                  │    ┌──────────────────┐         │
                                  │    │  AI Service      │         │
                                  │    │  Flask + OpenAI  │─────────┤
                                  │    │  + scikit-learn  │         │
                                  │    │  :5001           │         │
                                  │    └──────┬───────────┘         │
                                  │           │                     │
                                  ▼           ▼                     ▼
                            ┌─────────────────────────────────────────┐
                            │  Redis 7 (cache, token blacklist,       │
                            │  rate-limit store, flask-limiter store) │
                            │  :6379                                  │
                            └─────────────────────────────────────────┘
```

**5 Docker services**: `db` (PostgreSQL 16) · `redis` (7-alpine) · `backend` (Express) · `ai-service` (Flask/Gunicorn) · `frontend` (Nginx). All have health checks; backend/ai-service wait on db+redis healthy.

## Features

### Core Functionality
- **File Submission & Review**: students upload assignments; reviewers assigned automatically or manually
- **Submission Edit/Withdraw**: students can edit title/description or withdraw before reviews are submitted
- **Submission File Replacement + Policy Controls**: students can replace files; instructors can configure post-review edit/withdraw policy per course
- **Peer Review Sessions**: instructor creates sessions with team chemistry + technical contribution scores
- **Session Edit & Duplicate**: instructors can edit title/deadline/open-state and duplicate sessions as templates
- **Self-Review Support**: `is_self` flag auto-set when a student reviews themselves
- **Grading Rubric Panels**: collapsible rubric descriptions; 5-level file review, 3×5 peer review
- **Configurable Rubrics**: instructor-configurable rubrics at global/course/session scope
- **Session Deadline**: optional deadline; expired sessions auto-close; live countdown timer
- **Privacy-Isolated Reviews**: students only see their own peer-review scores; others filtered server-side
- **Score Release Control**: instructor gates aggregated score visibility
- **Student Score Viewing / My Grades / Clarification Appeals**: dedicated pages for viewing released scores and filing/resolving appeals
- **Assignment Templates**: reusable course templates
- **Self-Score Bias Analytics**: flags students with |self-peer| ≥ 1.0
- **Instructor Review (All Students)**: single page to score whole session
- **CSV Aggregation / Weekly Check-ins / Enrollment Management**: bulk operations and multi-course support

### AI-Powered Features
- **AI Feedback / Rewrite / Polish / Summarize**: 4 core assistance endpoints over `gpt-4o-mini`
- **AI Activity Logs**: instructor dashboard shows AI usage with user names
- **Global Search**: full-text search across submissions and users
- **v3.0 AI endpoints (Beta)**: `review-depth` (constructiveness / specificity / actionability scoring), `score-suggestion`, `calibration`, `score-reasoning`, `similarity` (TF-IDF), `similarity/turnitin` (mock), `chat` (multi-turn, 3 context modes)

### Real-Time & Notification System
- **SSE Live Streaming**: `submission_created`, `review_submitted`, `peer_review_submitted`, `heartbeat` events pushed to instructor dashboard
- **Auto-Reconnect**: `useSSE` hook with exponential backoff (capped at 30 s) and 90 s silence detection
- **Real-Time Bell**: unread-count polling every 30 s; dropdown panel with mark-read / mark-all-read
- **9 Notification Types**: `review_assigned`, `review_received`, `deadline`, `ai_complete`, `system`, `similarity_alert`, `grade_released`, `extension_granted`, `reminder`
- **Multi-channel**: per-type preferences across in-app / email / push (Web Push via VAPID)

### UI / UX
- **UConn Blue Theme** (`#000E2F`), sidebar navigation, reusable UI primitives (`Card`, `Button`, `Badge`, `Skeleton`, `ConfirmDialog`, `ToastProvider`, `InfiniteGridBackground`, `TextReveal`, `AnimatedTable`)
- **Per-section Error Boundaries**: `Sidebar`, `HeaderSearchBar`, `NotificationBell`, and each route all have isolated error boundaries so one crash never takes down the whole app
- **Responsive Design**: mobile-first Tailwind with sidebar drawer

### Instructor Tools
- **Unified Dashboard** (stats + AI logs + SSE live events + weekly trends), **Analytics Page** (score distribution / anomaly detection / file + peer quality flags / appeals / rubric management / CSV export), **Bulk Reviewer Assignment**, **Quality Flags** (identical scores, short comments), **Class Check-ins** (3-tab: Insights / Weekly Scores / Students)

### Security
- **JWT httpOnly Cookies** (Secure, SameSite=Strict) + Bearer-header fallback — **no query param token**, except SSE (EventSource cannot set headers) where cross-origin setups use a short-lived `?token=…`
- **Same-origin SSE**: behind nginx the browser cookie is forwarded automatically; `useSSE` supports an optional `getToken` callback for cross-origin
- **Row-Level Security (RLS)**: PostgreSQL policies enforce per-user/per-role isolation via `app.current_user_id` / `app.current_role` session variables
- **Course-ownership IDOR guards**: `verifyCourseAccess` (instructor/TA-only) and `verifyCourseEnrollment` (any enrolled role) applied to grade / LMS / deadline / anonymity / compliance routes; admins bypass
- **Cookie Identity Auto-Sync / Session Mismatch Detection**: tab-focus re-verifies cookie identity; peer-review form blocks submission on mismatch
- **CAS SSO** (university auth, production)
- **RBAC Middleware** (`requireRole()`)
- **Zod Validation** on all request bodies; admin blocked from self-registration
- **Rate Limiting** (five tiers — see below)
- **Content Security Policy** via Helmet
- **Audit Trail** — critical operations logged to `audit` table; admin-only `/compliance/audit` viewer
- **Anonymous-ID Collision Protection** — `getAnonymousId` uses a guarded INSERT with `WHERE NOT EXISTS` + retry loop so two reviewers can never share a pseudonym in the same session
- **bcrypt** password hashes (10 rounds), **Helmet** headers, **CORS** whitelist, **file upload magic-byte checks**
- **SSL Keys Excluded** (`.gitignore` blocks `ssl/` and `*.pem`)
- **Secrets in `.env`** (required): `JWT_SECRET`, `POSTGRES_PASSWORD` (no hardcoded fallback in docker-compose); optional: `AI_API_KEY`, `OPENAI_API_KEY`

#### Rate Limit Tiers (actual values from `backend/src/app.ts` + `backend/src/middleware/exportLimiter.ts`)

| Scope | Window | Max | Key |
|-------|--------|-----|-----|
| **Global** | 60 s | **600** | per user (JWT) or IP |
| **Auth** (`/auth/*`) | 15 min | **100** | per IP |
| **Write** (`/instructor`, `/peer-review`, `/enrollments`, `/semesters`, `/lms`, `/assignment-strategy`) | 10 min | **300** | per user |
| **Upload** (`/submissions`, `/revisions`) | 10 min | **50** | per user |
| **Export** (`/grades/export/:courseId`, `/compliance/export/:userId`) | 60 min | **10** | per user |

### v3.0 — New Features

#### Module Maturity

| Module | Status | Notes |
|--------|--------|-------|
| Anonymous Reviews | **Production** | Per-session config, stable pseudonyms, collision-safe ID assignment |
| Multi-Round Review | **Production** | Revision chain, auto-reassignment, diff view |
| Assignment Strategy | **Production** | 4 strategies, exclusion rules |
| Review Quality | **Production** | Helpfulness voting, reputation, consistency alerts |
| AI Feedback / Rewrite / Polish / Summarize | **Production** | OpenAI-powered, cached in `ml_outputs`/`rewrite_suggestions` |
| Grade Management | **Production** | Weighted calculation, drop lowest/highest, CSV export (formula-injection escaped) |
| Semester Management | **Production** | CRUD with active/inactive toggle |
| Deadline & Reminders | **Production** | Scheduler every 15 min, grace periods, individual extensions |
| Notifications | **Production** | 9 types, polling + SSE + email + Web Push |
| User Preferences | **Production** | Theme, font size, contrast — private-browsing safe |
| Audit & Compliance | **Production** | GDPR export, deletion requests, audit log (admin) |
| AI Scoring & Calibration | **Beta** | Functional, limited validation |
| AI Chat | **Beta** | 3 context modes, multi-turn, message limit enforced |
| Similarity Detection (TF-IDF) | **Beta** | Basic cosine similarity — not production-grade plagiarism |
| LMS Integration | **Mock** | Simulated LTI 1.3 — no real LMS connection |
| Turnitin Integration | **Mock** | Randomized scores — no real Turnitin API |

#### Highlights
- **Anonymous Review System** — single-blind / double-blind; stable pseudonyms in `anonymous_reviewer_map` (UNIQUE per `user+session`); guarded INSERT prevents duplicate `#N` labels under concurrency.
- **Multi-Round Review** — revisions linked via `parent_submission_id`; original reviewers auto-reassigned; `RevisionHistoryPage` walks the chain with a diff view.
- **Assignment Strategy** — `random` / `load_balanced` / `reciprocal` / `manual_only`, with `review_exclusions` and `min_reviews_required`.
- **Review Quality** — helpfulness thumbs-up/down, consistency alerts (score spread >2), AI depth scoring, reviewer reputation aggregation.
- **AI Scoring & Calibration** — `/api/ai/score-suggestion`, `/api/ai/calibration`, `/api/ai/score-reasoning`.
- **Plagiarism / Similarity** — TF-IDF pairwise, mock Turnitin; results in `similarity_reports` with `UNIQUE(submission_id_a, submission_id_b)` check constraint enforcing ordered pairs.
- **AI Conversational Assistant** — `/api/ai/chat` with `writing_review` / `reading_review` / `teacher_summary` context modes, persisted in `ai_conversations`, conversation trimmed to last 20 messages per call, capped at `MAX_CONVERSATION_MESSAGES` (50).
- **Grade Management** — per-course weights, drop-lowest / drop-highest, CSV export via **single CTE batch query** (no N+1); formula-injection safe.
- **LMS Integration (Mock)** — simulated LTI launch / grade passback / roster; `lms_config` per course.
- **Semesters + TA role + Announcements** — pinned / scheduled / attachment-aware.
- **Deadline & Reminder System** — automated scheduler (15 min tick), grace periods, individual extensions, `/deadlines/calendar` endpoint, monthly grid view.
- **Dashboard Data Visualization** — score distribution, activity trends, peer-review radar, completion heatmap (Recharts).
- **Rich Text Review Editor** — Tiptap-based with Markdown toolbar, PDF viewer, inline PDF annotator, drag-drop attachment upload.
- **PWA & Mobile** — Workbox precaching, NetworkFirst API caching (5 min TTL), swipe-to-dismiss, responsive sidebar drawer.
- **Accessibility** — dark mode (CSS variables), font-size selector, ARIA labels, keyboard navigation. `localStorage` wrapped in try/catch throughout for **private-browsing compatibility**.
- **Offline & Collaborative Editing** — `useAutoSave` (30 s, version conflict via HTTP 409, `AbortController` + `useRef` to prevent churn), `useOfflineQueue` (IndexedDB, accurate remaining-count after partial sync).
- **Audit & Compliance** — SHA-256 review integrity hashes, GDPR data export, deletion requests, admin audit log viewer (`/admin/audit`).
- **Performance & Infrastructure** — Redis 7 caching + token blacklist (SETEX TTL) + flask-limiter store; object-storage abstraction (`LocalStorageAdapter` + `MockS3Adapter`); virtual scrolling on large tables.

### Accessibility (WCAG 2.1)
- **ARIA radiogroup** score selectors with full keyboard support
- **Live regions**: `role="alert"` + `aria-live="assertive"` for error/status messages
- **Table semantics** (`<caption>`, `scope="col"`)
- **All inputs labeled** (visually hidden where appropriate)
- **Keyboard navigation** via Enter / Space / Arrow keys

### Developer Experience
- **Structured Logging** (Pino with pino-pretty in dev / JSON in prod; request correlation ID middleware)
- **ESLint 9 Flat Config** (TypeScript-ESLint for backend, React Hooks + Refresh for frontend)
- **Prettier** (unified monorepo)
- **Backend Tests** — Jest, **14 suites / 67 tests** covering utils, middleware, auth, submissions, peer review, instructor, AI controller, review, rubric, enrollment, assignment template (v3.0 controllers are added but test coverage for them is pending)
- **AI Service Tests** — pytest, **90 tests across 11 modules** (`health`, `feedback`, `rewrite`, `polish`, `summarize`, `scoring`, `similarity`, `chat`, `logs`, `search`, `extensions`) at ≈88% coverage
- **Frontend Unit Tests** — Vitest, **6 suites / 38 tests**
- **E2E** — Playwright (Chromium in CI)
- **GitHub Actions CI** — **5-job pipeline** (`backend` / `frontend` / `ai-service` / `docker` / `security`)
- **Hot Reload** — `tsx watch` (backend) + Vite HMR (frontend)

## Quick Start

### Prerequisites

- Node.js ≥ 18
- Docker & Docker Compose
- Python ≥ 3.10 (only for AI service when running outside Docker)

### One-command (recommended)

```powershell
# Windows / PowerShell
.\start-dev.ps1              # local dev: db + redis + backend + frontend
.\start-dev.ps1 -WithAI      # include AI service locally
.\start-dev.ps1 -Docker      # all 5 services via docker compose
.\start-dev.ps1 -Docker -Build   # force rebuild images
.\start-dev.ps1 -StopAll     # stop and clean up
```

```bash
# macOS / Linux
make dev          # local dev
make dev-ai       # + AI service
make docker       # full docker compose
make stop
```

### Manual (per-service)

```bash
# 1. Database + Redis
docker compose up db redis -d

# 2. Backend
cd backend
cp .env.example .env     # set JWT_SECRET, DATABASE_URL, AI_API_KEY
npm install
npm run dev              # tsx watch on :8080 — auto-runs migrations on boot

# 3. Frontend
cd frontend
npm install
npm run dev              # Vite on :5173, 11 proxy rules -> :8080

# 4. AI service (optional)
cd ai-service
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                              # set OPENAI_API_KEY
python app.py                                     # Flask on :5001
```

### Full Docker stack

```bash
cp .env.example .env                  # set POSTGRES_PASSWORD + JWT_SECRET
docker compose up -d --build          # 5 services
docker compose ps                     # all should be healthy
docker compose logs -f backend        # follow logs

# tear down (keep volumes)
docker compose down
# tear down + drop volumes (wipes DB data)
docker compose down -v
```

**Endpoints after startup:**
- Frontend (HTTPS): https://localhost/ (http → 301 https)
- Backend: http://localhost:8080 · Swagger UI: http://localhost:8080/api-docs (dev only)
- Health: http://localhost:8080/healthz (returns `{ok:true, db:ok}`)
- AI service: http://localhost:5001/healthz
- SSE stream: http://localhost:8080/instructor/events
- PostgreSQL: `localhost:5432` · Redis: `localhost:6379`

## Documentation

- **API (OpenAPI 3.0)** — [docs/openapi.yaml](docs/openapi.yaml) — main routes, request/response shapes, cookie + Bearer security. View with [Swagger Editor](https://editor.swagger.io/).
- **Swagger UI** — `http://localhost:8080/api-docs` (dev builds only; requires `docs/openapi.yaml` accessible from repo root).
- **Full doc index** — [docs/README.md](docs/README.md) — [deployment](docs/DEPLOYMENT.md), [user guide](docs/USER_GUIDE.md), [ERD](docs/DATABASE_ERD.md).

## API Route Groups

The backend exposes **22 route groups** mounted in [backend/src/app.ts](backend/src/app.ts). OpenAPI is the source of truth for endpoint shapes — this table is a high-level map.

| Mount | Rate Limit | Description |
|-------|-----------|-------------|
| `/auth` | auth | Register, login, CAS SSO (`/auth/cas/login`, `/auth/cas/callback`), logout, profile |
| `/submissions` | upload | Upload, list mine/all, my-grades, edit/replace/withdraw, review tasks |
| `/reviews` | global | Single review CRUD, submission reviews, draft |
| `/peer-review` | write | Sessions CRUD, team, submit, draft, results, appeals, bias analytics, CSV export |
| `/instructor` | write | Overview, unified dashboard, assignments (single/bulk), submission-policy, announcements, quality flags, server-side CSV, **SSE stream** `/instructor/events` |
| `/checkins` | global | Student self check-in context + save |
| `/enrollments` | write | CRUD, course members |
| `/notifications` | global | List, unread count, preferences, push subscriptions, mark-read |
| `/rubrics` | global | Load best-match rubric; instructor create/update |
| `/assignment-templates` | global | Template CRUD (instructor) |
| `/semesters` | write | CRUD, clone |
| `/revisions` | upload | Revision history, diff, rollback |
| `/grades` | global + **export limiter** on `/export/:courseId` | Weights CRUD, final grades, CSV export |
| `/lms` | write | Mock LTI launch / grade passback / roster; per-course config |
| `/deadlines` | global | Calendar, extensions, reminder config |
| `/preferences` | global | Theme / font / contrast |
| `/compliance` | global + **export limiter** on `/export/:userId` | GDPR data export, deletion requests, admin audit log |
| `/similarity` | global | TF-IDF + Turnitin mock dashboards |
| `/anonymity` | global | Per-session anonymity config (`verifySessionAccess` guarded) |
| `/assignment-strategy` | write | Strategy selection + exclusion rules |
| `/quality` | global | Helpfulness voting + reputation |
| `/api/ai` | global | Proxy to Flask AI service (see below) |

### AI endpoints (`/api/ai/*`, proxied to Flask)

| Method | Path | Rate | Description |
|--------|------|------|-------------|
| POST / GET | `/api/ai/feedback`, `/api/ai/feedback/:reviewId` | 60/min | Toxicity / politeness / sentiment / evidence spans |
| POST / GET / PATCH | `/api/ai/rewrite`, `/api/ai/rewrite/:id`, `/api/ai/rewrite/:id/adopt` | 20/min | Rewrite suggestions + adoption tracking |
| POST | `/api/ai/polish` | 30/min | Grammar / clarity / tone |
| POST | `/api/ai/summarize` | 20/min | Multi-review summary with themes |
| POST | `/api/ai/review-depth` | 60/min | Constructiveness / specificity / actionability |
| POST | `/api/ai/score-suggestion` | 60/min | Suggested score range from rubric + content |
| POST | `/api/ai/calibration` | 60/min | Reviewer vs peer-avg adjustment advice |
| POST | `/api/ai/score-reasoning` | 60/min | Explanation text for a given score |
| POST | `/api/ai/similarity` | 30/min | TF-IDF cosine similarity |
| POST | `/api/ai/similarity/turnitin` | 30/min | Mock Turnitin score |
| POST | `/api/ai/chat` | 60/min | Multi-turn assistant (3 context modes) |
| GET | `/api/ai/logs` | — | AI activity logs |
| GET | `/api/search` | — | Cross-collection full-text search (note: different prefix, not `/api/ai`) |
| GET | `/healthz` (AI service direct) | — | Readiness (returns `openai_configured` flag) |

## Project Structure

```
SDP-Team-61-integrated/
├── .github/workflows/ci.yml        # 5-job CI (backend / frontend / ai-service / docker / security)
├── docker-compose.yml              # 5 services with health checks + depends_on
├── start-dev.ps1                   # Windows one-click launcher
├── Makefile                        # Cross-platform (Linux/macOS)
├── package.json                    # Monorepo root (concurrently, lint, format)
├── .env.example                    # Root Docker vars (POSTGRES_PASSWORD, JWT_SECRET)
├── CLAUDE.md                       # Project rules for AI assistants
├── docs/                           # README index, DEPLOYMENT, USER_GUIDE, DATABASE_ERD, openapi.yaml
│
├── backend/
│   ├── src/
│   │   ├── server.ts               # Entry: validates env, runs migrations, starts scheduler + MV refresh + cleanup jobs
│   │   ├── app.ts                  # Express app: helmet CSP, CORS, correlation-id, Pino, rate limiters, 22 routes, error handler
│   │   ├── db.ts                   # pg Pool (max 20) + withDb() sets RLS context vars
│   │   ├── schemas.ts              # Zod request schemas (one table per entity)
│   │   ├── types.ts                # Shared TypeScript types
│   │   ├── migrate.ts              # node-pg-migrate runner
│   │   │
│   │   ├── controllers/            # 22 files
│   │   │   ├── authController.ts           submissionController.ts      reviewController.ts
│   │   │   ├── peerReviewController.ts     instructorController.ts      checkinController.ts
│   │   │   ├── enrollmentController.ts     notificationController.ts    rubricController.ts
│   │   │   ├── aiController.ts             assignmentTemplateController.ts
│   │   │   └── (v3.0) anonymityController / assignmentStrategyController / complianceController /
│   │   │              deadlineController / gradeController / lmsController /
│   │   │              preferencesController / qualityController /
│   │   │              revisionController / semesterController / similarityController
│   │   │
│   │   ├── routes/                 # 22 files (one-to-one with controllers)
│   │   │
│   │   ├── middleware/             # 6 files
│   │   │   ├── auth.ts                     # JWT verify + CAS SSO + cookie/Bearer extraction + blacklist check
│   │   │   ├── roleGuard.ts                # requireRole()
│   │   │   ├── validate.ts                 # Zod body/params/query validation
│   │   │   ├── upload.ts                   # multer + magic-byte check
│   │   │   ├── csvUpload.ts                # CSV multi-file upload
│   │   │   └── exportLimiter.ts            # 10/hour/user export rate limiter (standalone to avoid circular import)
│   │   │
│   │   └── utils/                  # 22 files
│   │       ├── logger.ts              AppError.ts            asyncHandler.ts
│   │       ├── cookieHelper.ts        jwtConfig.ts           tokenBlacklist.ts
│   │       ├── audit.ts               userSchema.ts          enrollment.ts
│   │       ├── notifications.ts       mailer.ts              push.ts            sse.ts
│   │       ├── scheduler.ts           mvRefresh.ts           redis.ts
│   │       ├── gradeCalculator.ts     anonymizer.ts          diffEngine.ts
│   │       ├── hashIntegrity.ts       objectStorage.ts       csvPeerReview.ts
│   │
│   ├── migrations/                 # 37 versioned SQL files (001 → 037)
│   ├── sql/                        # migrations.sql (full schema for Docker init) + seed.sql
│   ├── tests/                      # Jest: 14 suites / 67 tests
│   ├── uploads/                    # gitignored
│   ├── jest.config.js  tsconfig.json  eslint.config.js  Dockerfile  .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx                App.jsx               config.js
│   │   ├── index.css               App.css
│   │   │
│   │   ├── contexts/AuthContext.jsx
│   │   ├── services/api.js                          # Axios with 401 interceptor + retry
│   │   ├── utils/csvHelpers.js + lib/utils.js
│   │   ├── i18n/strings.js
│   │   │
│   │   ├── hooks/                  # 9 hooks
│   │   │   useAutoSave.js          useOfflineQueue.js       useSSE.js             useFilteredList.js
│   │   │   useAiChat.js            useGradeWeights.js       useCalendar.js
│   │   │   useDarkMode.js          useSwipeToDismiss.js
│   │   │
│   │   ├── components/
│   │   │   ├── (top-level)         Sidebar.jsx            HeaderSearchBar.jsx    NotificationBell.jsx
│   │   │   │                       ProtectedRoute / StudentRoute / InstructorRoute
│   │   │   │                       ErrorBoundary.jsx      ScoreSelector.jsx      RubricPanel.jsx
│   │   │   │                       SearchInput.jsx        Pagination.jsx
│   │   │   ├── ui/                 # Card / Button / Badge / Skeleton / ConfirmDialog / ToastProvider
│   │   │   │                       # InfiniteGridBackground / TextReveal / AnimatedTable / EmptyState
│   │   │   ├── a11y/               # DarkModeToggle / FontSizeSelector
│   │   │   ├── ai/                 # AiChatWidget / ScoreSuggestionPanel / SimilarityBadge / CalibrationAlert
│   │   │   ├── analytics/          # AppealsPanel / AnnouncementsPanel / QualityFlags / RubricEditor
│   │   │   ├── charts/             # ScoreDistribution / ActivityTrend / PeerReviewRadar / CompletionHeatmap / ChartCard
│   │   │   ├── checkins/           # WeeklyScoresTable / RollingAveragesTable / InsightsTable / MappingPanel / HandedOutTable / WeeklyCommentsPanel
│   │   │   ├── deadline/           # DeadlineCalendar / ExtensionForm / ReminderConfig
│   │   │   ├── editor/             # RichTextEditor (Tiptap) / PdfViewer / InlinePdfAnnotator / AttachmentUpload
│   │   │   ├── grade/              # GradeWeightEditor / FinalGradeTable / GradeExportButton
│   │   │   ├── instructor/         # DashboardStatsCards / SubmissionsTable / AiLogsPanel
│   │   │   └── review/             # AnonymousLabel / HelpfulnessVote / ReviewDepthBadge / ReviewRoundSelector / RevisionDiff
│   │   │
│   │   └── pages/                  # 33 pages, all React.lazy() route-level split
│   │       │ (auth)                LoginPage / RegisterPage
│   │       │ (student)             StudentDashboardPage / UploadAssignment / AssignedReviewsPage /
│   │       │                       StudentScoresPage / StudentCheckinsPage / StudentGradesPage
│   │       │ (shared auth)         ReviewPage / ViewReviewPage / PeerReviewSessionsPage /
│   │       │                       PeerReviewFormPage / PeerReviewResultsPage /
│   │       │                       RevisionHistoryPage / AiChatPage / CalendarPage
│   │       │ (settings)            NotificationPreferencesPage / UserPreferencesPage / DataExportPage
│   │       │ (admin)               AuditLogPage
│   │       │ (instructor)          InstructorDashboardPage / InstructorAnalyticsPage / InstructorPeerReviewPage /
│   │       │                       ClassCheckinsPage / EnrollmentManagementPage / ExportCenterPage /
│   │       │                       AssignmentTemplatesPage / SimilarityDashboardPage /
│   │       │                       GradeManagementPage / LmsConfigPage / SemesterManagementPage /
│   │       │                       AdvancedAnalyticsPage
│   │       │ (misc)                NotFoundPage
│   │
│   ├── vite.config.js              # 11 proxy rules to :8080 + PWA plugin + test config
│   ├── nginx.conf                  # Production: HTTPS, 11 API proxy paths, SSE buffering off, static caching
│   ├── tailwind.config.ts  postcss.config.js  playwright.config.js  eslint.config.js
│   └── package.json  Dockerfile  .env.example
│
└── ai-service/
    ├── app.py                      # Flask app factory: CORS, limiter.init_app, teardown hook, blueprint registration
    ├── config.py                   # Env + constants (MAX_TEXT_LENGTH=10k, MAX_CONVERSATION_MESSAGES=50, MAX_RETRIES=2)
    ├── extensions.py               # OpenAI lazy client, ThreadedConnectionPool (1-25), require_api_key, validate_feedback
    │
    ├── routes/                     # 10 blueprints
    │   ├── health.py               feedback.py      rewrite.py       polish.py
    │   ├── summarize.py            scoring.py       similarity.py    chat.py
    │   └── logs.py                 search.py
    │
    ├── tests/                      # pytest: 11 test modules, 90 tests, ≈88% coverage
    ├── requirements.txt            # Flask 3.1 / flask-limiter 3.12 / redis / openai 1.82 / scikit-learn / psycopg2-binary / gunicorn+gevent
    ├── Dockerfile                  # Gunicorn WSGI, 4 workers
    └── .env.example
```

## Scripts

### Root (`npm run …`)

| Command | Description |
|---------|-------------|
| `dev` | `concurrently` backend + frontend |
| `install:all` | Install root + backend + frontend deps |
| `build` | Production frontend build |
| `test` | Backend Jest |
| `lint` / `lint:fix` | ESLint both tiers |
| `format` / `format:check` | Prettier both tiers |

### Backend (`cd backend && npm …`)

| Command | Description |
|---------|-------------|
| `dev` | `tsx watch src/server.ts` (hot reload) |
| `build` | TypeScript compile to `dist/` |
| `start` | Run compiled build |
| `test` | Jest (14 suites / 67 tests) |
| `lint` / `format` | ESLint / Prettier |
| `migrate` | Run pending migrations (up) |
| `migrate:down` | Rollback last migration |
| `migrate:redo` | Down + Up latest |
| `seed` | Load `sql/seed.sql` demo data |

### Frontend (`cd frontend && npm …`)

| Command | Description |
|---------|-------------|
| `dev` | Vite dev server with HMR + proxy |
| `build` | Production bundle |
| `test` | Vitest (6 suites / 38 tests) |
| `e2e` | Playwright (Chromium) |
| `lint` / `format` | ESLint / Prettier |

### AI Service (`cd ai-service && …`)

| Command | Description |
|---------|-------------|
| `python app.py` | Dev server on :5001 |
| `gunicorn app:app -w 4 -k gevent -b 0.0.0.0:5001` | Production (as in Dockerfile) |
| `pytest tests/ -v --cov=.` | Full test suite with coverage |

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) runs on push to `main` / `integrated` and PRs to `main`. **5-job pipeline**:

| Job | Steps |
|-----|-------|
| **`backend`** | `npm ci` → dependency audit (high/critical) → `tsc --noEmit` → Jest (with PostgreSQL + Redis services) |
| **`frontend`** | `npm ci` → dependency audit → Lint → Build → Vitest → Playwright E2E (Chromium) → artifact upload |
| **`ai-service`** | `pip install -r requirements.txt` → pytest |
| **`docker`** | Build 3 images → `docker compose config` validation |
| **`security`** | Trivy vulnerability scan (filesystem + images) |

## Environment Variables

> Only variables present in the committed `.env.example` files are documented below as the contract. Redis/SMTP/VAPID/etc. are read opportunistically by the code with safe fallbacks.

### Root `.env` — consumed by `docker-compose.yml`

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_PASSWORD` | — (**required**, no default — compose fails fast) | PostgreSQL password |
| `JWT_SECRET` | — | Required by backend (propagated through compose) |
| `POSTGRES_USER` | `postgres` | Optional override |
| `POSTGRES_DB` | `peerreview` | Optional override |
| `OPENAI_API_KEY` | — | Optional — AI features return 503 when unset |
| `AI_API_KEY` | — | Shared secret backend ↔ ai-service (service refuses all calls when unset — fail-closed) |
| `REDIS_URL` | `redis://redis:6379` (docker) | Optional for local dev; falls back to in-memory |
| `FRONTEND_URL` | `http://localhost:5173` | CORS + CAS redirect origin |
| `CORS_ORIGINS` | = FRONTEND_URL | Comma-separated list for multi-origin |

### `backend/.env`

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address |
| `DATABASE_URL` | — | PostgreSQL DSN (required) |
| `JWT_SECRET` | — | **required** |
| `JWT_EXPIRES_IN` | `30d` | Token expiry |
| `NODE_ENV` | `development` | Enables Swagger UI in non-prod |
| `FRONTEND_URL` | `http://localhost:5173` | CORS + CAS |
| `UPLOAD_DIR` | `./uploads` | File upload location |
| `MAX_FILE_SIZE` | `10485760` (10 MB) | Multer limit |
| `AI_SERVICE_URL` | `http://localhost:5001` | AI service endpoint |
| `AI_API_KEY` | — | Shared secret with ai-service |
| `EMAIL_NOTIFICATIONS_ENABLED` | `false` | Toggle nodemailer delivery |

Additional optional env (read with fallbacks): `REDIS_URL`, `TRUST_PROXY`, `CORS_ORIGINS`, `CAS_BASE_URL`, `SMTP_HOST/PORT/USER/PASS`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

### `ai-service/.env`

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | — | OpenAI / xAI API key (service returns 503 when unset) |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model identifier |
| `AI_API_KEY` | — | Must match backend `AI_API_KEY` |
| `AI_PORT` | `5001` | Gunicorn bind port |
| `FLASK_DEBUG` | `0` | Set `1` for Flask dev reloader |
| `DATABASE_URL` | — | PostgreSQL DSN (for logs + search + caches) |
| `FRONTEND_URL` | `http://localhost:5173` | CORS origin |

Optional env: `REDIS_URL` (when set, `flask-limiter` uses Redis storage; requires the `redis` Python package — already in `requirements.txt`).

## Default Accounts (from `seed.sql`)

| Email | Role | Password |
|-------|------|----------|
| instructor@example.com | instructor | password123 |
| alice@example.com | student | password123 |
| bob@example.com | student | password123 |
| carol@example.com | student | password123 |

> **Development only.** All seed accounts use real bcrypt hashes. **For production or any non-local deployment:** change these passwords immediately or skip `seed.sql` (see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)).

## Integration Decisions

| Feature | Kept From | Reason |
|---------|-----------|--------|
| TypeScript backend | Old | Type safety, better maintainability |
| PostgreSQL + RLS | Old | Row-level security per user/role |
| Audit logging | Old | Traceability for all critical actions |
| Materialized views | Old | Fast instructor dashboard queries |
| JWT httpOnly cookies | New + Enhanced | Stateless, XSS-safe auth |
| CAS SSO | Old + Restored | University authentication |
| MVC controller pattern | New | Clear separation of concerns |
| Zod schema validation | Enhanced | Runtime type safety for all endpoints |
| Pino structured logging | Enhanced | Production-grade observability |
| Tailwind CSS + UConn theme | Enhanced | Utility-first + brand colors |
| Vite dev proxy (11 rules) | New | No hardcoded API URLs |
| Framer Motion animations | New | Smooth transitions |
| Smart reviewer auto-assignment | Old | Fair distribution algorithm |
| OpenAI AI integration | Enhanced | Feedback / rewrite / polish / summarize / scoring / chat / similarity |
| Sidebar navigation | Enhanced | Replaces top navbar, collapsible, role-aware |
| UI component library | New | Reusable primitives across all pages |
| Global search | New | Full-text across submissions + users |
| Notification system | New | Real-time bell + 9 types + multi-channel |
| AI activity logs | New | Track and display all AI usage for instructors |
| Instructor analytics | New | Score distribution, anomalies, export |
| Class check-ins page | Enhanced | 3-tab (Insights / Weekly / Students) |
| SSE real-time streaming | anish-dev | Live event push |
| Review quality flags | anish-dev | Identical scores + short comments detection |
| Server-side CSV export | anish-dev | File review per-submission breakdown |
| Enhanced UI components | anish-dev | Skeleton, Toast, ConfirmDialog, animations |
| Per-section Error Boundaries | v3.x hardening | Sidebar / Header / Bell / each route isolated |

## Database Schema (37 migrations)

All migrations live in `backend/migrations/` and run automatically at backend boot via `src/migrate.ts`. Numbering is strictly sequential — **never modify an existing migration file; always add a new one**.

| # | File | Summary |
|---|------|---------|
| 001 | `initial-enums-users` | Base enums + `users` |
| 002 | `file-review-system` | `submissions`, `assignments`, `reviews`, `ml_outputs`, `rewrite_suggestions` |
| 003 | `rls-views-mv` | RLS policies, materialized views |
| 004 | `peer-review-system` | `peer_review_sessions`, `peer_reviews`, team chemistry |
| 005 | `checkins-unified-views` | Check-in tables + unified dashboard views |
| 006 | `submissions-updated-at` | `updated_at` column |
| 007 | `user-enrollments` | Multi-course enrollment table |
| 008 | `cascade-delete-policies` | FK CASCADE across the graph |
| 009 | `tighten-rls-policies` | Policy refinements |
| 010 | `ai-activity-logs` | `ai_activity_logs`, `notifications` |
| 011 | `submissions-course-id` | Explicit course scoping |
| 012 | `rubrics` | Configurable rubric definitions |
| 013 | `peer-review-appeals` | Clarification / appeal workflow |
| 014 | `notification-preferences` | Per-type channel preferences |
| 015 | `push-subscriptions` | Web Push subscription storage |
| 016 | `review-drafts` | Backend draft persistence for file + peer reviews |
| 017 | `submission-policies` | Course-level edit/withdraw policy |
| 018 | `assignment-templates` | Reusable templates + FK on submissions |
| 019 | `add-missing-indexes` | Performance tuning |
| 020 | `data-cleanup-functions` | `cleanup_old_drafts / notifications / ai_logs` |
| 021 | `performance-indexes` | Covering + composite indexes |
| 022 | `semesters-ta-announcements` | Semester CRUD, TA role, enhanced announcements |
| 023 | `anonymous-reviews` | `anonymity_level` enum + `anonymous_reviewer_map` |
| 024 | `multi-round-review` | `revision_number`, `parent_submission_id`, `review_round` |
| 025 | `assignment-strategy` | Strategy enum + `review_exclusions` + `min_reviews_required` |
| 026 | `review-quality` | `review_depth_scores`, `review_helpfulness`, `reviewer_reputation` |
| 027 | `grade-weights` | `grade_weights` table |
| 028 | `similarity-reports` | TF-IDF + mock Turnitin storage |
| 029 | `ai-conversations` | Multi-turn AI chat history |
| 030 | `lms-config` | Mock LTI 1.3 per-course config |
| 031 | `deadlines-reminders` | `deadline_reminders`, `deadline_extensions`, `grace_period_hours` |
| 032 | `review-attachments` | File attachments on reviews |
| 033 | `user-preferences` | Theme / font / contrast |
| 034 | `draft-versioning` | Versioned draft history |
| 035 | `audit-compliance` | GDPR `data_deletion_requests` etc. |
| 036 | `ai-scoring` | `ai_score_suggestions`, `ai_calibration_results` |
| 037 | `performance-indexes` | v3.0 composite indexes + `ck_similarity_ordered_pair` CHECK constraint |

## License

University coursework project — see institutional guidelines.
