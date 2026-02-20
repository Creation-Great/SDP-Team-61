# SDP Peer Review System – Integrated

> AI-enhanced peer review platform for university courses. Integrated from `SDP-Team-61-main` and `SDP-Team-61-old-main`, keeping the strengths of each.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 · React Router 7 · Vite 7 · Axios · Framer Motion · CSS Variables |
| **Backend** | TypeScript (ES2022) · Express 5 · PostgreSQL 16 · JWT httpOnly cookies · Zod 4 · Pino |
| **AI Service** | Python · Flask · OpenAI API |
| **DevOps** | Docker Compose (4 services) · GitHub Actions CI · ESLint 9 · Prettier |
| **Testing** | Jest 29 · ts-jest · Supertest |

## Architecture

```
┌───────────────────┐      ┌──────────────────────┐      ┌──────────────┐
│    Frontend       │────▶│  Backend (TS)        │────▶│ PostgreSQL   │
│  React 19 / Vite  │      │  Express 5 + JWT     │      │  RLS + Audit │
│  :5173 (dev)      │      │  Pino + Zod + Helmet │      │  :5432       │
│  :80  (prod/nginx)│      │  :8080               │      └──────────────┘
└───────────────────┘      └──────────┬───────────┘
                                    │
                            ┌───────▼────────┐
                            │  AI Service    │
                            │  Flask + OpenAI│
                            │  :5001         │
                            └────────────────┘
```

## Features

### Core Functionality
- **File Submission & Review**: Students upload assignments; reviewers assigned automatically or manually
- **Peer Review Sessions**: Instructor creates sessions with team chemistry + technical contribution scores
- **Session Deadline**: Instructor can set an optional deadline when creating a session; expired sessions auto-close lazily on next access, and students see a live countdown timer
- **Privacy-Isolated Reviews**: Students can only view their own peer review scores — other team members' data is filtered server-side
- **CSV Aggregation**: Batch upload CSV peer review results with per-student/category breakdown
- **Weekly Check-ins**: Students self-rate and rate teammates; instructors manage scores across weeks
- **AI Feedback & Rewrite**: OpenAI-powered review quality analysis and rewrite suggestions
- **Enrollment Management**: Multi-course support with team grouping

### Security
- **Row-Level Security (RLS)**: PostgreSQL policies enforce data isolation per user
- **JWT httpOnly Cookies**: Stateless auth with secure, httpOnly, SameSite cookies
- **Cookie Identity Auto-Sync**: On tab focus/visibility change, frontend re-verifies the cookie identity and updates React state — prevents stale-session issues when multiple accounts are used in the same browser
- **Session Mismatch Detection**: Peer review form detects when the logged-in cookie no longer matches the React user state and blocks submission with a warning banner
- **CAS SSO**: University single sign-on integration (production)
- **RBAC Middleware**: `requireRole()` guards protect instructor/student-only routes
- **Zod Validation**: All request bodies validated with Zod schemas
- **Rate Limiting**: Global, auth-specific, and upload-specific rate limiters
- **Audit Trail**: All critical operations logged to `audit` table
- **bcrypt**: Passwords hashed (10 rounds)
- **Helmet**: HTTP security headers
- **CORS**: Configurable origin whitelist
- **File Validation**: Upload magic-byte checks + type/size limits

### Accessibility (WCAG 2.1)
- **ARIA radiogroup**: Score selectors use `role="radiogroup/radio"` with full keyboard navigation
- **Live regions**: Error messages use `role="alert"` + `aria-live="assertive"` for screen reader announcements
- **Table semantics**: All 13 data tables have `<caption>` and `scope="col"` on headers
- **Form labels**: All inputs have associated `<label>` elements (visually hidden where placeholder is shown)
- **Keyboard navigation**: All interactive elements support keyboard (Enter/Space/Arrow keys)

### Developer Experience
- **Structured Logging**: Pino with pino-pretty (dev) / JSON (production)
- **ESLint 9 Flat Config**: TypeScript-ESLint for backend, React Hooks + Refresh for frontend
- **Prettier**: Unified code formatting across the monorepo
- **Jest Test Suite**: 7 suites / 36 tests covering utils, middleware, auth, and submissions
- **GitHub Actions CI**: 4-job pipeline (backend, frontend, AI service, Docker build)
- **Hot Reload**: tsx watch (backend) + Vite HMR (frontend)

## Quick Start

### Prerequisites

- Node.js ≥ 18
- Docker & Docker Compose
- Python ≥ 3.10 (only for AI service)

### 1. Start Database

```bash
docker compose up db -d
```

PostgreSQL 16 starts and auto-runs `backend/sql/migrations.sql` + `seed.sql`.

### 2. Setup Backend

```bash
cd backend
cp .env.example .env    # Set JWT_SECRET, DATABASE_URL, etc.
npm install
npm run dev             # tsx watch on :8080
```

### 3. Setup Frontend

```bash
cd frontend
npm install
npm run dev             # Vite on :5173, API proxy to :8080
```

### 4. (Optional) AI Service

```bash
cd ai-service
pip install -r requirements.txt
OPENAI_API_KEY=sk-... python app.py     # Flask on :5001
```

### One-command (from root)

```bash
docker compose up -d            # All 4 services
# or for dev:
npm run install:all             # installs backend + frontend
npm run dev                     # runs backend + frontend concurrently
```

## API Routes (37 endpoints)

### Auth (`/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/auth/cas/login` | — | CAS SSO login redirect |
| GET | `/auth/cas/callback` | — | CAS SSO callback |
| POST | `/auth/register` | — | Local registration (dev) |
| POST | `/auth/login` | — | Local login (dev) |
| GET | `/auth/me` | ✓ | Current user info |
| POST | `/auth/logout` | — | Logout / clear cookie |

### Submissions (`/submissions`)

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/submissions/upload` | ✓ | — | Upload assignment (file + metadata) |
| GET | `/submissions/mine` | ✓ | — | Student's own submissions |
| GET | `/submissions/all` | ✓ | instructor | All submissions overview |
| GET | `/submissions/reviews/my-tasks` | ✓ | — | Assigned review tasks |

### Reviews (`/reviews`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/reviews/by-submission/:id` | ✓ | Reviews for a submission |
| GET | `/reviews/:id` | ✓ | Single review detail |
| POST | `/reviews/:id/submit` | ✓ | Submit a review |

### Instructor (`/instructor`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/instructor/overview` | ✓ | Cohort overview (materialized view) |
| GET | `/instructor/unified-dashboard` | ✓ | Unified dashboard data |
| POST | `/instructor/assign` | ✓ | Manual reviewer assignment |
| POST | `/instructor/peer-review/aggregate` | ✓ | Aggregate peer review CSVs |
| GET | `/instructor/checkins/current` | ✓ | Current check-in records |
| POST | `/instructor/checkins/current` | ✓ | Save check-in records |
| GET | `/instructor/checkins/students` | ✓ | Check-in student list |
| GET | `/instructor/checkins/insights` | ✓ | Check-in AI insights |

### Peer Review (`/peer-review`)

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/peer-review/sessions` | ✓ | — | List sessions |
| GET | `/peer-review/sessions/:id/my-team` | ✓ | — | Student's team |
| POST | `/peer-review/sessions/:id/submit` | ✓ | — | Submit peer reviews |
| GET | `/peer-review/sessions/:id/team-reviews` | ✓ | — | Own reviews only (privacy-filtered) |
| POST | `/peer-review/sessions` | ✓ | instructor | Create session (optional `deadline`) |
| PATCH | `/peer-review/sessions/:id` | ✓ | instructor | Toggle open/closed |
| GET | `/peer-review/sessions/:id/results` | ✓ | instructor | Session results |
| GET | `/peer-review/sessions/:id/export-csv` | ✓ | instructor | Export CSV |

### Check-ins (`/checkins`)

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/checkins/context` | ✓ | student | Student check-in context |
| POST | `/checkins/self` | ✓ | student | Save self check-in |

### Enrollments (`/enrollments`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/enrollments/` | ✓ | List enrollments |
| POST | `/enrollments/` | ✓ | Add/upsert enrollment |
| PATCH | `/enrollments/:id` | ✓ | Update group/primary |
| DELETE | `/enrollments/:id` | ✓ | Remove enrollment |
| GET | `/enrollments/course/:id/members` | ✓ | Course member list |

### AI (`/api/ai`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/ai/feedback` | ✓ | Request AI feedback analysis |
| GET | `/api/ai/feedback/:reviewId` | ✓ | Get AI feedback |
| POST | `/api/ai/rewrite` | ✓ | Request AI rewrite suggestion |
| GET | `/api/ai/rewrite/:reviewId` | ✓ | Get AI rewrite |
| PATCH | `/api/ai/rewrite/:reviewId/adopt` | ✓ | Adopt AI rewrite |

## Project Structure

```
SDP-Team-61-integrated/
├── .github/workflows/ci.yml     # GitHub Actions: 4-job CI pipeline
├── .prettierrc                   # Shared Prettier config
├── .prettierignore
├── docker-compose.yml            # PostgreSQL + Backend + AI + Frontend
├── package.json                  # Monorepo root (concurrently, lint, format)
│
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── eslint.config.js          # ESLint 9 flat config (TypeScript)
│   ├── jest.config.js            # Jest ESM config (ts-jest)
│   ├── Dockerfile
│   ├── .env.example
│   ├── migrations/                # node-pg-migrate SQL files (versioned)
│   │   ├── 001_initial-enums-users.sql
│   │   ├── 002_file-review-system.sql
│   │   ├── 003_rls-views-mv.sql
│   │   ├── 004_peer-review-system.sql
│   │   ├── 005_checkins-unified-views.sql
│   │   ├── 006_submissions-updated-at.sql
│   │   ├── 007_user-enrollments.sql
│   │   ├── 008_cascade-delete-policies.sql
│   │   └── 009_tighten-rls-policies.sql
│   ├── sql/
│   │   ├── migrations.sql        # Legacy full schema (Docker init)
│   │   └── seed.sql
│   ├── src/
│   │   ├── app.ts                # Express setup, middleware, routes
│   │   ├── server.ts             # Entry point
│   │   ├── db.ts                 # PG pool + RLS context
│   │   ├── schemas.ts            # Zod request schemas
│   │   ├── types.ts              # Shared TypeScript types
│   │   ├── migrate.ts            # node-pg-migrate runner
│   │   ├── controllers/
│   │   │   ├── authController.ts
│   │   │   ├── submissionController.ts
│   │   │   ├── reviewController.ts
│   │   │   ├── instructorController.ts
│   │   │   ├── peerReviewController.ts
│   │   │   ├── checkinController.ts
│   │   │   ├── enrollmentController.ts
│   │   │   └── aiController.ts
│   │   ├── routes/
│   │   │   ├── authRoutes.ts
│   │   │   ├── submissionRoutes.ts
│   │   │   ├── reviewRoutes.ts
│   │   │   ├── instructorRoutes.ts
│   │   │   ├── peerReviewRoutes.ts
│   │   │   ├── checkinRoutes.ts
│   │   │   ├── enrollmentRoutes.ts
│   │   │   └── aiRoutes.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts           # JWT verify + CAS SSO
│   │   │   ├── roleGuard.ts      # RBAC
│   │   │   ├── validate.ts       # Zod validation middleware
│   │   │   ├── upload.ts         # Multer config + magic-byte check
│   │   │   └── csvUpload.ts      # CSV multi-file upload
│   │   └── utils/
│   │       ├── logger.ts         # Pino structured logging
│   │       ├── AppError.ts       # Custom error class
│   │       ├── asyncHandler.ts   # Async route wrapper
│   │       ├── audit.ts          # Audit trail helper
│   │       ├── cookieHelper.ts   # JWT cookie helpers
│   │       ├── jwtConfig.ts      # JWT config
│   │       ├── tokenBlacklist.ts # Token revocation
│   │       ├── userSchema.ts     # User validation
│   │       ├── csvPeerReview.ts  # CSV parsing utilities
│   │       ├── enrollment.ts     # Enrollment helpers
│   │       └── mvRefresh.ts      # Materialized view refresh
│   ├── tests/
│   │   ├── envSetup.ts           # Test environment variables
│   │   ├── helpers.ts            # Mock DB factories, JWT helpers
│   │   ├── utils.test.ts         # AppError + asyncHandler tests
│   │   ├── validate.test.ts      # Zod middleware tests
│   │   ├── roleGuard.test.ts     # RBAC tests
│   │   ├── cookieHelper.test.ts  # Cookie parsing tests
│   │   ├── health.test.ts        # Health + CORS + rate limiting
│   │   ├── auth.test.ts          # Auth integration tests
│   │   └── submissions.test.ts   # Submission + role tests
│   └── uploads/                  # Uploaded files (gitignored)
│
├── frontend/
│   ├── package.json
│   ├── vite.config.js            # Dev proxy to backend
│   ├── eslint.config.js          # ESLint 9 flat config (React)
│   ├── Dockerfile
│   ├── nginx.conf              # Production reverse-proxy config
│   ├── index.html
│   └── src/
│       ├── main.jsx              # App entry
│       ├── App.jsx               # Router + layout
│       ├── App.css               # Component styles + sr-only utility
│       ├── index.css             # CSS variables + theme
│       ├── config.js             # Runtime config
│       ├── contexts/
│       │   └── AuthContext.jsx    # Auth state provider
│       ├── hooks/
│       │   └── useFilteredList.js # Pagination + search + sort hook
│       ├── services/
│       │   └── api.js            # Axios instance + interceptors
│       ├── utils/
│       │   └── csvHelpers.js     # CSV parsing utilities
│       ├── components/
│       │   ├── Navbar.jsx        # Responsive nav + mobile drawer
│       │   ├── Navbar.css
│       │   ├── ProtectedRoute.jsx
│       │   ├── InstructorRoute.jsx
│       │   ├── StudentRoute.jsx
│       │   ├── ScoreSelector.jsx # Accessible 1–5 score radio group
│       │   ├── SearchInput.jsx   # Debounced search input
│       │   ├── Pagination.jsx    # Page navigation
│       │   └── checkins/         # Check-in sub-components
│       │       ├── WeeklyScoresTable.jsx
│       │       ├── RollingAveragesTable.jsx
│       │       ├── InsightsTable.jsx
│       │       ├── MappingPanel.jsx
│       │       ├── HandedOutTable.jsx
│       │       ├── WeeklyCommentsPanel.jsx
│       │       └── checkins.css
│       └── pages/
│           ├── LoginPage.jsx
│           ├── RegisterPage.jsx
│           ├── StudentDashboardPage.jsx
│           ├── InstructorDashboardPage.jsx
│           ├── UploadAssignment.jsx
│           ├── AssignedReviewsPage.jsx
│           ├── ReviewPage.jsx
│           ├── ViewReviewPage.jsx
│           ├── PeerReviewSessionsPage.jsx
│           ├── PeerReviewFormPage.jsx
│           ├── PeerReviewResultsPage.jsx
│           ├── InstructorPeerReviewPage.jsx
│           ├── StudentCheckinsPage.jsx
│           └── NotFoundPage.jsx
│
└── ai-service/
    ├── app.py                    # Flask API (OpenAI integration)
    ├── Dockerfile
    └── requirements.txt
```

## Scripts

### Root

| Command | Description |
|---------|-------------|
| `npm run dev` | Start backend + frontend concurrently |
| `npm run install:all` | Install deps for backend + frontend |
| `npm run build` | Build frontend for production |
| `npm test` | Run backend tests |
| `npm run lint` | Lint backend + frontend |
| `npm run format` | Format backend + frontend |

### Backend

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with tsx watch (hot reload) |
| `npm run build` | TypeScript compile |
| `npm test` | Jest test suite (7 suites, 36 tests) |
| `npm run lint` | ESLint check |
| `npm run format` | Prettier format |
| `npm run migrate` | Run DB migrations (up) |
| `npm run migrate:down` | Rollback last migration |

### Frontend

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production build |
| `npm run lint` | ESLint check |
| `npm run format` | Prettier format |

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) runs on push to `main`/`integrated` and PRs to `main`:

| Job | Steps |
|-----|-------|
| **Backend CI** | `npm ci` → TypeScript type-check → Jest tests (with PostgreSQL service) |
| **Frontend CI** | `npm ci` → ESLint → Vite build → Upload artifact |
| **AI Service CI** | `pip install` → Python syntax check |
| **Docker Build** | Build all 3 images → Validate docker-compose config |

## Environment Variables

### Backend (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Server port |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `JWT_SECRET` | — | JWT signing secret (required) |
| `JWT_EXPIRES_IN` | `30d` | Token expiry |
| `NODE_ENV` | `development` | Environment |
| `FRONTEND_URL` | `http://localhost:5173` | CORS + CAS redirect |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated origins |
| `AI_SERVICE_URL` | `http://localhost:5001` | AI service endpoint |
| `AI_API_KEY` | — | Internal API key for AI service |
| `CAS_BASE_URL` | `https://login.uconn.edu/cas` | CAS SSO base URL |

### AI Service

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | — | OpenAI API key |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model to use |
| `AI_API_KEY` | — | Internal API key (must match backend) |
| `AI_PORT` | `5001` | Flask port |

## Default Accounts (from seed.sql)

| Email | Role | Password |
|-------|------|----------|
| instructor@example.com | instructor | password123 |
| alice@example.com | student | password123 |
| bob@example.com | student | password123 |
| carol@example.com | student | password123 |

> All seed accounts use real bcrypt hashes. Change passwords for any non-local deployment.

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
| CSS Variables + semantic classes | Old | Maintainable, responsive styling |
| Vite dev proxy | New | No hardcoded API URLs |
| Framer Motion animations | New | Smooth transitions |
| Smart reviewer auto-assignment | Old | Fair distribution algorithm |
| OpenAI AI integration | Enhanced | Review feedback + rewrite suggestions |

## License

University coursework project — see institutional guidelines.
