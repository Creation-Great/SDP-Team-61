# SDP Peer Review System – Integrated

> AI-enhanced peer review platform for university courses. Built with **UConn Blue (#000E2F)** theme, featuring **SSE real-time streaming**, review quality flags, global search, AI-powered writing tools, and instructor analytics. Integrated from `SDP-Team-61-main`, `SDP-Team-61-old-main`, and `SDP-Team-61-anish-dev`, keeping the strengths of each.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 · React Router 7 · Vite 7 · Axios · Tailwind CSS · Lucide Icons · Framer Motion |
| **Backend** | TypeScript (ES2022) · Express 5 · PostgreSQL 16 · JWT httpOnly cookies · Zod 4 · Pino |
| **AI Service** | Python · Flask · OpenAI GPT-4o-mini · psycopg2 |
| **DevOps** | Docker Compose (4 services) · GitHub Actions CI · ESLint 9 · Prettier |
| **Testing** | Jest 29 · ts-jest · Supertest |

## Architecture

```
┌──────────────────────┐       ┌──────────────────────┐      ┌──────────────┐
│    Frontend          │────▶ │  Backend (TS)        │────▶│ PostgreSQL   │
│  React 19 / Vite     │       │  Express 5 + JWT     │      │  RLS + Audit │
│  Tailwind + UConn    │◀─SSE─│  Pino + Zod + Helmet │      │  :5432       │
│  :5173 (dev)         │       │  :8080               │      └──────────────┘
│  :80  (prod/nginx)   │       └──────────┬───────────┘
└──────────────────────┘                  │
         │                        ┌───────▼────────┐
         │  Notifications         │  AI Service    │
         │  Search / SSE          │  Flask + OpenAI│
         │  Feedback / Rewrite    │  :5001         │
         │  Polish / Summarize    │                │
         └───────proxy─────────▶ └────────────────┘
```

## Features

### Core Functionality
- **File Submission & Review**: Students upload assignments; reviewers assigned automatically or manually
- **Peer Review Sessions**: Instructor creates sessions with team chemistry + technical contribution scores
- **Self-Review Support**: Students can review themselves as part of peer review — `is_self` flag is automatically set and displayed with an info badge
- **Grading Rubric Panels**: Collapsible rubric descriptions shown alongside score selectors for both file reviews (5-level Excellent→Poor) and peer reviews (3 categories × 5 levels)
- **Session Deadline**: Instructor can set an optional deadline when creating a session; expired sessions auto-close lazily on next access, and students see a live countdown timer
- **Privacy-Isolated Reviews**: Students can only view their own peer review scores — other team members' data is filtered server-side
- **Score Release Control**: Instructor can release/hide aggregated peer review scores — students cannot see their scores until explicitly released after the assignment is completed
- **Student Score Viewing**: Dedicated page where students view their released peer review scores (technical, interactions, management, chemistry)
- **Self-Score Bias Analytics**: Instructor analytics showing per-student self-given vs peer-given score comparison with bias metric (Self Avg − Peer Avg); flags students with |bias| ≥ 1.0
- **Instructor Review (All Students)**: Consolidated page where instructors can review all students in a session from one page, with score buttons and comments — supports non-student reviewers
- **CSV Aggregation**: Batch upload CSV peer review results with per-student/category breakdown, **Individual Comments** extraction, and **Download Aggregate CSV** export
- **Weekly Check-ins**: Students self-rate and rate teammates; instructors manage scores across weeks; CSV import auto-detects and displays Individual Comments
- **Enrollment Management**: Multi-course support with team grouping

### AI-Powered Features
- **AI Feedback & Rewrite**: OpenAI-powered review quality analysis (toxicity, politeness, sentiment) and rewrite suggestions
- **AI Polish**: One-click grammar, clarity, and tone improvements for peer review comments
- **AI Summarize**: Automatic summarization of multiple reviews per submission with theme extraction
- **AI Activity Logs**: Instructor dashboard tracks all AI usage (feedback/rewrite/polish/summarize) with user names and real-time display
- **Global Search**: Full-text search across submissions and users via the header search bar

### Real-Time & Notification System
- **SSE Live Streaming**: Server-Sent Events push `submission_created`, `review_submitted`, `peer_review_submitted` events to the instructor dashboard in real-time
- **Live Indicator**: Green "Live" badge with pulse animation when SSE connection is active
- **Live Events Feed**: Scrollable event feed on instructor dashboard with color-coded badges and timestamps
- **Auto-Reconnect**: SSE hook with exponential backoff (max 30 s) and automatic reconnection
- **Real-Time Bell**: Header notification bell with unread count badge (polls every 30 seconds)
- **Notification Panel**: Dropdown panel showing recent notifications with mark-read and mark-all-read
- **Notification Types**: `review_received`, `review_assigned`, `deadline`, `ai_complete`, `system`

### UI / UX
- **UConn Blue Theme**: Primary color `#000E2F` applied throughout the application
- **Sidebar Navigation**: Collapsible sidebar with role-based menu items (replaces top navbar)
- **UI Component Library**: Reusable `Card`, `Button` (with `asChild` prop for link styling), `Badge` (with `className` support), `Skeleton`, `ConfirmDialog`, `ToastProvider` components
- **Background Images**: Login/register use `content.png` with gradient overlay; main content area uses `background3.jpg` with animated grid overlay
- **Text Reveal Animation**: Typewriter-style text reveal component
- **Animated Table**: Row-by-row staggered table animation component
- **Error Boundary**: Graceful error fallback UI with retry option
- **Responsive Design**: Mobile-friendly layout with hidden sidebar and mobile header

### Instructor Tools
- **Unified Dashboard**: Overview stats, active sessions, AI activity logs, weekly trends, and SSE live events feed
- **Analytics Page**: Score distribution, anomaly detection, **file review quality flags**, **peer review quality flags**, roster CSV export, and server-side file review CSV export
- **Quality Flags — File Reviews**: Detects identical scores across multiple reviews by the same reviewer and short comments (<20 chars)
- **Quality Flags — Peer Reviews**: Detects identical Likert scores across 3 categories (technical, teamwork, project management) and short individual comments
- **Class Check-ins**: 3-tab page (Insights comparison, Weekly Scores matrix, Students list); CSV upload pre-fills scores and auto-shows comments panel when Individual Comments column is present

### Security
- **Row-Level Security (RLS)**: PostgreSQL policies enforce data isolation per user
- **JWT httpOnly Cookies**: Stateless auth with secure, httpOnly, SameSite cookies
- **Cookie Identity Auto-Sync**: On tab focus/visibility change, frontend re-verifies the cookie identity and updates React state — prevents stale-session issues when multiple accounts are used in the same browser
- **Session Mismatch Detection**: Peer review form detects when the logged-in cookie no longer matches the React user state and blocks submission with a warning banner
- **CAS SSO**: University single sign-on integration (production)
- **RBAC Middleware**: `requireRole()` guards protect instructor/student-only routes
- **Zod Validation**: All request bodies validated with Zod schemas; admin role blocked from self-registration
- **Rate Limiting**: Global (100/min), auth (100/15 min), upload (100/10 min), and AI-specific rate limiters
- **Audit Trail**: All critical operations logged to `audit` table
- **bcrypt**: Passwords hashed (10 rounds)
- **Helmet**: HTTP security headers
- **CORS**: Configurable origin whitelist
- **File Validation**: Upload magic-byte checks + type/size limits
- **SSL Keys Excluded**: `.gitignore` blocks `ssl/` and `*.pem` files from version control
- **JWT_SECRET**: Required via `.env` — no hardcoded fallback in docker-compose

### Accessibility (WCAG 2.1)
- **ARIA radiogroup**: Score selectors use `role="radiogroup/radio"` with full keyboard navigation
- **Live regions**: Error messages use `role="alert"` + `aria-live="assertive"` for screen reader announcements
- **Table semantics**: Data tables have `<caption>` and `scope="col"` on headers
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

PostgreSQL 16 starts and auto-runs `backend/sql/migrations.sql` + `seed.sql` (includes `user_enrollments` sync).

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

## API Routes (54+ endpoints)

### Auth (`/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/auth/cas/login` | — | CAS SSO login redirect |
| GET | `/auth/cas/callback` | — | CAS SSO callback |
| POST | `/auth/register` | — | Local registration (dev) |
| POST | `/auth/login` | — | Local login (dev) |
| GET | `/auth/me` | ✓ | Current user info |
| PATCH | `/auth/profile` | ✓ | Update display name |
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
| GET | `/instructor/quality-flags` | ✓ | File review quality flags (identical scores, short comments) |
| GET | `/instructor/peer-review-quality-flags` | ✓ | Peer review quality flags |
| GET | `/instructor/export-csv` | ✓ | Server-side file review CSV export |
| GET | `/instructor/events` | ✓ | SSE real-time event stream |

### Peer Review (`/peer-review`)

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/peer-review/sessions` | ✓ | — | List sessions |
| GET | `/peer-review/sessions/:id/my-team` | ✓ | — | Student's team |
| POST | `/peer-review/sessions/:id/submit` | ✓ | — | Submit peer reviews |
| GET | `/peer-review/sessions/:id/team-reviews` | ✓ | — | Own reviews only (privacy-filtered) |
| GET | `/peer-review/sessions/:id/student-scores` | ✓ | student | View released scores |
| POST | `/peer-review/sessions` | ✓ | instructor | Create session (optional `deadline`) |
| PATCH | `/peer-review/sessions/:id` | ✓ | instructor | Toggle open/closed |
| PATCH | `/peer-review/sessions/:id/release-scores` | ✓ | instructor | Toggle score release |
| GET | `/peer-review/sessions/:id/results` | ✓ | instructor | Session results |
| GET | `/peer-review/sessions/:id/bias-analytics` | ✓ | instructor | Self vs peer score bias |
| GET | `/peer-review/sessions/:id/all-students` | ✓ | instructor | All students for review |
| POST | `/peer-review/sessions/:id/instructor-review` | ✓ | instructor | Submit instructor reviews |
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
| POST | `/api/ai/polish` | ✓ | Polish text (grammar + tone) |
| POST | `/api/ai/summarize` | ✓ | Summarize multiple reviews |
| GET | `/api/ai/logs` | ✓ | Recent AI activity logs |
| GET | `/api/ai/search` | ✓ | Search submissions & users |

### Notifications (`/notifications`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/notifications` | ✓ | List user's notifications |
| GET | `/notifications/unread-count` | ✓ | Get unread notification count |
| PATCH | `/notifications/read-all` | ✓ | Mark all notifications as read |
| PATCH | `/notifications/:id/read` | ✓ | Mark one notification as read |

## Project Structure

```
SDP-Team-61-integrated/
├── .github/workflows/ci.yml     # GitHub Actions: 4-job CI pipeline
├── .prettierrc                   # Shared Prettier config
├── .prettierignore
├── docker-compose.yml            # PostgreSQL + Backend + AI + Frontend
├── package.json                  # Monorepo root (concurrently, lint, format)
├── start-dev.ps1                 # One-click local dev startup script
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
│   │   ├── 009_tighten-rls-policies.sql
│   │   └── 010_ai-activity-logs.sql      # AI logs + notifications tables
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
│   │   │   └── aiController.ts          # Proxy to AI service (feedback, rewrite, polish, summarize, logs, search)
│   │   ├── routes/
│   │   │   ├── authRoutes.ts
│   │   │   ├── submissionRoutes.ts
│   │   │   ├── reviewRoutes.ts
│   │   │   ├── instructorRoutes.ts
│   │   │   ├── peerReviewRoutes.ts
│   │   │   ├── checkinRoutes.ts
│   │   │   ├── enrollmentRoutes.ts
│   │   │   ├── aiRoutes.ts
│   │   │   └── notificationRoutes.ts    # Notification CRUD (direct DB)
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
│   │       ├── mvRefresh.ts      # Materialized view refresh
│   │       └── sse.ts            # SSE channel hub (Server-Sent Events)
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
│   ├── vite.config.js            # Dev proxy to backend (11 proxy rules)
│   ├── eslint.config.js          # ESLint 9 flat config (React)
│   ├── Dockerfile
│   ├── nginx.conf                # Production reverse-proxy config
│   ├── index.html
│   ├── tailwind.config.ts        # Tailwind CSS configuration
│   ├── postcss.config.js
│   ├── public/
│   │   └── images/
│   │       ├── content.png       # Login/register background
│   │       └── background3.jpg   # Content area background
│   └── src/
│       ├── main.jsx              # App entry
│       ├── App.jsx               # Router + AppLayout (sidebar + header)
│       ├── App.css               # Component styles + sr-only utility
│       ├── index.css             # CSS variables + UConn Blue theme
│       ├── config.js             # Runtime config (API_BASE_URL)
│       ├── contexts/
│       │   └── AuthContext.jsx    # Auth state provider
│       ├── hooks/
│       │   ├── useFilteredList.js # Pagination + search + sort hook
│       │   └── useSSE.js          # SSE EventSource hook with auto-reconnect
│       ├── services/
│       │   └── api.js            # Axios instance + interceptors
│       ├── utils/
│       │   └── csvHelpers.js     # CSV parsing utilities
│       ├── components/
│       │   ├── Sidebar.jsx           # Collapsible sidebar navigation
│       │   ├── HeaderSearchBar.jsx   # Global search with dropdown results
│       │   ├── NotificationBell.jsx  # Bell icon + unread badge + dropdown
│       │   ├── ProtectedRoute.jsx
│       │   ├── InstructorRoute.jsx
│       │   ├── StudentRoute.jsx
│       │   ├── ScoreSelector.jsx     # Accessible 1–5 score radio group
│       │   ├── RubricPanel.jsx       # Collapsible rubric panels (file + peer review)
│       │   ├── SearchInput.jsx       # Debounced search input
│       │   ├── Pagination.jsx        # Page navigation
│       │   ├── ui/                   # Reusable UI primitives
│       │   │   ├── Badge.jsx
│       │   │   ├── Button.jsx
│       │   │   ├── Card.jsx
│       │   │   ├── Skeleton.jsx
│       │   │   ├── ConfirmDialog.jsx
│       │   │   └── ToastProvider.jsx
│       │   ├── InfiniteGridBackground.jsx  # Animated grid background
│       │   ├── TextReveal.jsx              # Typewriter animation
│       │   ├── AnimatedTable.jsx           # Staggered row animation
│       │   ├── ErrorBoundary.jsx           # Graceful error fallback
│       │   └── checkins/             # Check-in sub-components
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
│           ├── InstructorDashboardPage.jsx   # Stats + AI logs + SSE live events + weekly trends
│           ├── InstructorAnalyticsPage.jsx   # Score distribution + anomalies + quality flags
│           ├── InstructorPeerReviewPage.jsx
│           ├── ClassCheckinsPage.jsx         # 3-tab: Insights / Scores / Students
│           ├── UploadAssignment.jsx
│           ├── AssignedReviewsPage.jsx
│           ├── ReviewPage.jsx                # AI Feedback + AI Rewrite integration
│           ├── ViewReviewPage.jsx            # AI Summarize + AI Feedback integration
│           ├── PeerReviewSessionsPage.jsx
│           ├── PeerReviewFormPage.jsx        # AI Polish integration
│           ├── PeerReviewResultsPage.jsx     # Bias analytics + instructor review + score release
│           ├── StudentScoresPage.jsx         # Student released score viewer
│           ├── StudentCheckinsPage.jsx
│           ├── EnrollmentManagementPage.jsx  # Instructor enrollment CRUD
│           └── NotFoundPage.jsx
│
└── ai-service/
    ├── app.py                    # Flask API (OpenAI + search + logs)
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
| `npm run lint:fix` | Lint + auto-fix backend + frontend |
| `npm run format` | Format backend + frontend |
| `npm run format:check` | Check formatting without writing |

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
| `FRONTEND_URL` | `http://localhost:5173` | CORS + CAS redirect (production: `https://www.peer.review.uconn.edu`) |
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
| `DATABASE_URL` | — | PostgreSQL connection string (for logs + search) |
| `FRONTEND_URL` | `http://localhost:5173` | CORS origin (production: `https://www.peer.review.uconn.edu`) |

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
| Tailwind CSS + UConn theme | Enhanced | Utility-first styling with brand colors |
| Vite dev proxy | New | No hardcoded API URLs (11 proxy rules) |
| Framer Motion animations | New | Smooth transitions |
| Smart reviewer auto-assignment | Old | Fair distribution algorithm |
| OpenAI AI integration | Enhanced | Feedback + rewrite + polish + summarize |
| Sidebar navigation | Enhanced | Replaces top navbar, collapsible, role-aware |
| UI component library | New | Reusable Card, Button, Badge primitives |
| Global search | New | Full-text search across submissions & users |
| Notification system | New | Real-time bell with unread count + dropdown |
| AI activity logs | New | Track and display all AI usage for instructors |
| Instructor analytics | New | Score distribution, anomaly detection, export |
| Class check-ins page | Enhanced | 3-tab view: insights, weekly scores, students |
| SSE real-time streaming | anish-dev | Live event push for submissions & reviews |
| Review quality flags | anish-dev | Detect identical scores & short comments |
| Server-side CSV export | anish-dev | File review per-submission breakdown |
| Enhanced UI components | anish-dev | Skeleton, Toast, ConfirmDialog, animations |
| Error Boundary | anish-dev | Graceful error fallback with retry |

## Database Schema (10 migrations)

| Migration | Tables / Changes |
|-----------|-----------------|
| 001 | `users` + enum types (`user_role`, `submission_status`, etc.) |
| 002 | `submissions`, `assignments`, `reviews`, `ml_outputs`, `rewrite_suggestions` |
| 003 | RLS policies, views, materialized views |
| 004 | `peer_review_sessions`, `peer_review_scores`, `session_members` |
| 005 | `checkin_templates`, `checkin_scores`, unified dashboard views |
| 006 | `submissions.updated_at` column |
| 007 | `user_enrollments` table |
| 008 | CASCADE delete policies across all FK relationships |
| 009 | Tightened RLS policies |
| 010 | `ai_activity_logs`, `notifications` tables |

## License

University coursework project — see institutional guidelines.
