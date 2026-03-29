# SDP Peer Review System – Integrated

> AI-enhanced peer review platform for university courses. Built with **UConn Blue (#000E2F)** theme, featuring **SSE real-time streaming**, review quality flags, global search, AI-powered writing tools, and instructor analytics. Integrated from `SDP-Team-61-main`, `SDP-Team-61-old-main`, and `SDP-Team-61-anish-dev`, keeping the strengths of each. **v3.0** adds anonymous reviews, multi-round revisions, 4 assignment strategies, AI scoring/calibration/similarity detection, grade management, semesters, dark mode, PWA, Redis caching, and GDPR compliance.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 · React Router 7 · Vite 7 · Axios · Tailwind CSS · Lucide Icons · Framer Motion · Recharts · PWA (vite-plugin-pwa) |
| **Backend** | TypeScript (ES2022) · Express 5 · PostgreSQL 16 · JWT httpOnly cookies · Zod 4 · Pino · Redis 7 · ioredis |
| **AI Service** | Python · Flask · OpenAI GPT-4o-mini · psycopg2 · scikit-learn (TF-IDF) |
| **DevOps** | Docker Compose (5 services) · GitHub Actions CI · ESLint 9 · Prettier · Redis 7-alpine |
| **Testing** | Backend: Jest 29 · ts-jest · Supertest · Frontend: Vitest · @testing-library/react · Playwright E2E |

## Architecture

```
┌──────────────────────┐       ┌──────────────────────┐      ┌──────────────┐
│    Frontend          │────▶ │  Backend (TS)        │────▶│ PostgreSQL   │
│  React 19 / Vite     │       │  Express 5 + JWT     │      │  RLS + Audit │
│  Tailwind + UConn    │◀─SSE─│  Pino + Zod + Helmet │      │  :5432       │
│  :5173 (dev)         │       │  :8080               │      └──────────────┘
│  :80  (prod/nginx)   │       └──────────┬───────────┘             │
└──────────────────────┘                  │                  ┌──────┴───────┐
         │                        ┌───────▼────────┐       │  Redis 7     │
         │  Notifications         │  AI Service    │       │  Cache + BL  │
         │  Search / SSE          │  Flask + OpenAI│       │  :6379       │
         │  Feedback / Rewrite    │  + scikit-learn│       └──────────────┘
         │  Polish / Summarize    │  :5001         │
         └───────proxy─────────▶ └────────────────┘
```

## Features

### Core Functionality
- **File Submission & Review**: Students upload assignments; reviewers assigned automatically or manually
- **Submission Edit/Withdraw**: Students can edit title/description or withdraw before reviews are submitted
- **Submission File Replacement + Policy Controls**: Students can replace files; instructors can configure post-review edit/withdraw policy per course
- **Peer Review Sessions**: Instructor creates sessions with team chemistry + technical contribution scores
- **Session Edit & Duplicate**: Instructors can edit title/deadline/open-state and duplicate an existing session as a template
- **Self-Review Support**: Students can review themselves as part of peer review — `is_self` flag is automatically set and displayed with an info badge
- **Grading Rubric Panels**: Collapsible rubric descriptions shown alongside score selectors for both file reviews (5-level Excellent→Poor) and peer reviews (3 categories × 5 levels)
- **Configurable Rubrics**: Rubrics can be configured by instructor (global/course/session scope) and loaded dynamically by the frontend
- **Session Deadline**: Instructor can set an optional deadline when creating a session; expired sessions auto-close lazily on next access, and students see a live countdown timer
- **Privacy-Isolated Reviews**: Students can only view their own peer review scores — other team members' data is filtered server-side
- **Score Release Control**: Instructor can release/hide aggregated peer review scores — students cannot see their scores until explicitly released after the assignment is completed
- **Student Score Viewing**: Dedicated page where students view their released peer review scores (technical, interactions, management, chemistry)
- **Student Clarification/Appeal**: Students can submit appeal/clarification requests after score release; instructors can respond and update status
- **My Grades Summary**: Dedicated student page consolidating file-review averages and released peer-review results
- **Assignment Templates**: Instructors define reusable course assignment templates; students can select template when uploading
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
- **Multi-channel Notifications**: Per-type notification preferences with in-app/email/push channels, plus browser push subscription support

### UI / UX
- **UConn Blue Theme**: Primary color `#000E2F` applied throughout the application
- **Sidebar Navigation**: Collapsible sidebar with role-based menu items (replaces top navbar)
- **UI Component Library**: Reusable `Card`, `Button` (with `asChild` prop for link styling), `Badge` (with `className` support), `Skeleton`, `ConfirmDialog`, `ToastProvider` components
- **Background Images**: Login/register use `content.webp` with gradient overlay; main content area uses `background3.jpg` with animated grid overlay
- **Text Reveal Animation**: Typewriter-style text reveal component
- **Animated Table**: Row-by-row staggered table animation component
- **Error Boundary**: Graceful error fallback UI with retry option
- **Responsive Design**: Mobile-friendly layout with hidden sidebar and mobile header

### Instructor Tools
- **Unified Dashboard**: Overview stats, active sessions, AI activity logs, weekly trends, and SSE live events feed
- **Analytics Page**: Score distribution, anomaly detection, **file review quality flags**, **peer review quality flags**, roster CSV export, server-side exports, rubric management, and appeals processing
- **Bulk Reviewer Assignment**: Multi-select submissions and assign N reviewers per submission in one action
- **Quality Flags — File Reviews**: Detects identical scores across multiple reviews by the same reviewer and short comments (<20 chars)
- **Quality Flags — Peer Reviews**: Detects identical Likert scores across 3 categories (technical, teamwork, project management) and short individual comments
- **Class Check-ins**: 3-tab page (Insights comparison, Weekly Scores matrix, Students list); CSV upload pre-fills scores and auto-shows comments panel when Individual Comments column is present

### Security
- **SSE authentication**: Instructor live events (`GET /instructor/events`) use Server-Sent Events. In **same-origin** production (frontend and API under one domain, e.g. nginx proxy), the browser sends the httpOnly cookie automatically; ensure nginx forwards the `Cookie` header to the backend (default with `proxy_pass`). For **cross-origin** setups, the backend accepts JWT via query param `?token=…` (EventSource cannot set headers); the frontend hook `useSSE` supports an optional `getToken` callback to append the token to the URL when provided.
- **Row-Level Security (RLS)**: PostgreSQL policies enforce data isolation per user
- **JWT httpOnly Cookies**: Stateless auth with secure, httpOnly, SameSite cookies
- **Cookie Identity Auto-Sync**: On tab focus/visibility change, frontend re-verifies the cookie identity and updates React state — prevents stale-session issues when multiple accounts are used in the same browser
- **Session Mismatch Detection**: Peer review form detects when the logged-in cookie no longer matches the React user state and blocks submission with a warning banner
- **CAS SSO**: University single sign-on integration (production)
- **RBAC Middleware**: `requireRole()` guards protect instructor/student-only routes
- **Zod Validation**: All request bodies validated with Zod schemas; admin role blocked from self-registration
- **Rate Limiting**: Global (100/min), auth (20/5 min), upload (100/10 min), write operations (30/10 min), and AI-specific rate limiters
- **Content Security Policy**: Strict CSP via Helmet (script-src, img-src, style-src, connect-src, font-src)
- **Audit Trail**: All critical operations logged to `audit` table
- **bcrypt**: Passwords hashed (10 rounds)
- **Helmet**: HTTP security headers
- **CORS**: Configurable origin whitelist
- **File Validation**: Upload magic-byte checks + type/size limits
- **SSL Keys Excluded**: `.gitignore` blocks `ssl/` and `*.pem` files from version control
- **JWT_SECRET**: Required via `.env` — no hardcoded fallback in docker-compose

### v3.0 — New Features

#### Anonymous Review System
- **Single-blind**: Reviewer identity hidden from author (Author sees "Anonymous Reviewer #N")
- **Double-blind**: Both reviewer and author identities hidden from each other
- **Per-session configuration**: Instructor selects anonymity level when creating peer review sessions
- Stable pseudonyms via `anonymous_reviewer_map` table

#### Multi-Round Review (Revision Cycle)
- **Revision submissions**: Students create new revisions linked to parent submissions via `parent_submission_id`
- **Auto-reassignment**: Original reviewers automatically assigned to review new revisions
- **Version history**: Recursive CTE walks the revision chain; `RevisionHistoryPage` displays all versions
- **Diff view**: Line-by-line comparison between current and previous revision metadata

#### Assignment Strategy Optimization
- **4 strategies**: `random` (default), `load_balanced` (fewest pending tasks first), `reciprocal` (mutual A↔B reviews), `manual_only` (no auto-assign)
- **Exclusion rules**: `review_exclusions` table prevents specific student pairs from reviewing each other
- **Min review guarantee**: `min_reviews_required` ensures each submission gets N reviews

#### Review Quality Assessment
- **Helpfulness voting**: Students vote thumbs-up/down on received reviews (`review_helpfulness` table)
- **Consistency alerts**: Flags submissions where reviewer scores differ by >2 points
- **AI depth scoring**: Constructiveness, specificity, actionability scores via `/api/ai/review-depth`
- **Reviewer reputation**: Aggregate metrics in `reviewer_reputation` table

#### AI Scoring & Calibration
- **Score suggestion**: AI suggests score range based on rubric + submission content (`/api/ai/score-suggestion`)
- **Calibration**: Compares reviewer's score with peer average, provides adjustment advice (`/api/ai/calibration`)
- **Score reasoning**: AI generates explanation text for a given score (`/api/ai/score-reasoning`)

#### Plagiarism / Similarity Detection
- **TF-IDF cosine similarity**: Pairwise comparison between submissions using scikit-learn
- **Mock Turnitin**: Simulated external plagiarism check (`/api/ai/similarity/turnitin`)
- **Similarity dashboard**: Instructor view of all similarity reports with color-coded scores
- Results stored in `similarity_reports` table

#### AI Conversational Assistant
- **3 context modes**: `writing_review` (help write reviews), `reading_review` (interpret feedback), `teacher_summary` (aggregate analysis)
- **Multi-turn conversations**: Persisted in `ai_conversations` table with full message history
- **Floating widget**: `AiChatWidget` embedded in ReviewPage and PeerReviewFormPage
- **Standalone page**: Full chat interface at `/ai-assistant`

#### Grade Management
- **Weight configuration**: Per-course weights for file review, peer review, and check-in components
- **Drop lowest/highest**: Configurable extremes removal before averaging
- **Weighted final grade**: Auto-calculated with normalized percentages
- **CSV export**: Download final grades as CSV file

#### LMS Integration (Mock)
- **Mock LTI 1.3**: Simulated launch, grade passback, and roster import endpoints
- **Provider configuration**: Per-course LMS config stored in `lms_config` table
- **Mock Canvas/Blackboard/Moodle**: Returns realistic mock responses for testing

#### Course Management Enhancements
- **Semesters**: CRUD for academic semesters with active/inactive toggle
- **Course cloning**: Copy rubrics, templates, and policies from one course to another
- **TA role**: New `ta` role with instructor-level read access but restricted write permissions
- **Enhanced announcements**: Support for pinned, scheduled, and attachment-enabled announcements

#### Deadline & Reminder System
- **Automated reminders**: Scheduler checks every 15 minutes for upcoming deadlines
- **Grace periods**: Configurable `grace_period_hours` per session/template
- **Individual extensions**: Instructor can extend deadlines for specific students
- **Calendar API**: `GET /deadlines/calendar` returns all upcoming deadlines for the current user
- **Calendar page**: Monthly grid view with color-coded deadline types

#### Dashboard Data Visualization
- **Score distribution**: Bar chart histogram of review scores (1-5)
- **Activity trends**: SVG line chart showing weekly submissions and reviews
- **Peer review radar**: 3-axis radar chart (technical, interactions, management)
- **Completion heatmap**: Student × assignment grid with color-coded completion status

#### Rich Text Review Editor
- **Markdown toolbar**: Bold, italic, list, code formatting via `RichTextEditor` component
- **PDF viewer**: In-system PDF display via `PdfViewer` component (replaces raw iframe)
- **Inline annotations**: `InlinePdfAnnotator` for position-based PDF comments
- **File attachments**: `AttachmentUpload` component with drag-and-drop support

#### PWA & Mobile
- **Service Worker**: Generated by vite-plugin-pwa with Workbox precaching
- **Offline caching**: NetworkFirst strategy for API calls (5-minute TTL)
- **Swipe gestures**: `useSwipeToDismiss` hook for notification items
- **Responsive design**: Tailwind mobile-first with sidebar drawer

#### Accessibility
- **Dark mode**: Toggle via `DarkModeToggle` component; CSS variables in `.dark` class
- **Font size control**: S/M/L selector via `FontSizeSelector` component
- **ARIA labels**: On all interactive components (buttons, score selectors, toggles)
- **Keyboard navigation**: Arrow keys + Space/Enter for score selection, radio groups
- **User preferences page**: Centralized settings at `/settings/preferences`

#### Offline & Collaborative Editing
- **Auto-save**: `useAutoSave` hook saves drafts to server every 30 seconds
- **Version conflict detection**: Returns HTTP 409 if draft version is stale
- **Offline queue**: `useOfflineQueue` hook stores failed requests in IndexedDB, syncs on reconnect

#### Audit & Compliance
- **Review integrity**: SHA-256 hashes stored in `review_hash` column on both review tables
- **GDPR data export**: Download all personal data as JSON via `/compliance/export/:userId`
- **Account deletion**: Request deletion via `/compliance/deletion-request`
- **Audit log viewer**: Admin page at `/admin/audit` with paginated event history

#### Performance & Infrastructure
- **Redis 7**: Docker service for caching, token blacklist, and rate limiting
- **Token blacklist persistence**: Redis SETEX with TTL auto-expiry; in-memory fallback
- **Object storage abstraction**: `LocalStorageAdapter` + `MockS3Adapter` for file uploads
- **Virtual scrolling**: `react-virtuoso` on AuditLogPage and FinalGradeTable
- **Rate limiting**: Redis-backed rate limits across all API endpoints

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
- **Backend Tests**: Jest — 14 suites / 67 tests (utils, middleware, auth, submissions, peer review, instructor, AI controller, review, rubric, enrollment, assignment template). Test counts are for the v2.0 baseline; v3.0 controllers added but tests pending.
- **AI Service Tests**: pytest — 7 tests (healthz, feedback, polish, search)
- **Frontend Unit Tests**: Vitest — 6 suites / 38 tests (`useFilteredList`, `useSSE`, `csvHelpers`, EmptyState, Button, OfflineBanner)
- **E2E**: Playwright — login, submission, instructor dashboard, peer review flows (runs Chromium in CI)
- **GitHub Actions CI**: 5-job pipeline (backend with coverage / frontend / AI service with pytest / Docker / security scan via Trivy)
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
docker compose up -d            # All 5 services
# or for dev:
npm run install:all             # installs backend + frontend
npm run dev                     # runs backend + frontend concurrently
```

## Documentation

- **API (OpenAPI 3.0)**: [docs/openapi.yaml](docs/openapi.yaml) — main routes, request/response shapes, and security (cookie/Bearer). View with [Swagger Editor](https://editor.swagger.io/) or any OpenAPI viewer.
- **Swagger UI**: When the backend runs from the repo root (e.g. `cd backend && npm run dev`) and `docs/openapi.yaml` exists, open **http://localhost:8080/api-docs** in a browser for an interactive API explorer. (Docker builds that do not include `docs/` will not expose `/api-docs`.)
- **Full doc index**: [docs/README.md](docs/README.md) — deployment ([DEPLOYMENT.md](docs/DEPLOYMENT.md)), user guide ([USER_GUIDE.md](docs/USER_GUIDE.md)), and archived historical documents.

## API Routes (expanded)

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
| PATCH | `/submissions/:id` | ✓ | student | Edit own submission (before reviews) |
| PATCH | `/submissions/:id/replace-file` | ✓ | student | Replace own submission file |
| DELETE | `/submissions/:id` | ✓ | student | Withdraw own submission (before reviews) |
| GET | `/submissions/my-grades` | ✓ | student | Consolidated grade summary |
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
| POST | `/instructor/assign/bulk` | ✓ | Bulk reviewer assignment |
| GET | `/instructor/submission-policy` | ✓ | Get course submission edit/withdraw policy |
| PUT | `/instructor/submission-policy` | ✓ | Upsert course submission edit/withdraw policy |
| POST | `/instructor/announcements` | ✓ | Publish class-scoped system announcement |
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
| GET | `/peer-review/sessions/:id/draft` | ✓ | — | Load peer-review draft |
| PATCH | `/peer-review/sessions/:id/draft` | ✓ | — | Save peer-review draft |
| GET | `/peer-review/sessions/:id/team-reviews` | ✓ | — | Own reviews only (privacy-filtered) |
| GET | `/peer-review/sessions/:id/student-scores` | ✓ | student | View released scores |
| POST | `/peer-review/sessions` | ✓ | instructor | Create session (optional `deadline`) |
| PATCH | `/peer-review/sessions/:id` | ✓ | instructor | Update open state / title / deadline |
| POST | `/peer-review/sessions/:id/duplicate` | ✓ | instructor | Duplicate session metadata |
| PATCH | `/peer-review/sessions/:id/release-scores` | ✓ | instructor | Toggle score release |
| GET | `/peer-review/sessions/:id/results` | ✓ | instructor | Session results |
| GET | `/peer-review/sessions/:id/bias-analytics` | ✓ | instructor | Self vs peer score bias |
| GET | `/peer-review/sessions/:id/all-students` | ✓ | instructor | All students for review |
| POST | `/peer-review/sessions/:id/instructor-review` | ✓ | instructor | Submit instructor reviews |
| GET | `/peer-review/sessions/:id/export-csv` | ✓ | instructor | Export CSV |
| GET | `/peer-review/appeals/mine` | ✓ | student | List my clarification/appeal requests |
| POST | `/peer-review/appeals` | ✓ | student | Create clarification/appeal request |
| GET | `/peer-review/appeals` | ✓ | instructor | List appeals in instructor sessions |
| PATCH | `/peer-review/appeals/:appealId` | ✓ | instructor | Resolve/reject and reply |

### Rubrics (`/rubrics`)

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/rubrics` | ✓ | — | Load best-match rubric by type/scope |
| POST | `/rubrics` | ✓ | instructor | Create/update rubric configuration |

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
| GET | `/notifications/preferences` | ✓ | Get per-type channel preferences |
| PATCH | `/notifications/preferences` | ✓ | Update per-type channel preference |
| GET | `/notifications/push/public-key` | ✓ | Get VAPID public key |
| GET | `/notifications/push/subscriptions` | ✓ | List push subscriptions |
| POST | `/notifications/push/subscriptions` | ✓ | Upsert push subscription |
| DELETE | `/notifications/push/subscriptions` | ✓ | Remove push subscription(s) |
| PATCH | `/notifications/read-all` | ✓ | Mark all notifications as read |
| PATCH | `/notifications/:id/read` | ✓ | Mark one notification as read |

### Assignment Templates (`/assignment-templates`)

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/assignment-templates` | ✓ | — | List assignment templates |
| POST | `/assignment-templates` | ✓ | instructor | Create assignment template |
| PATCH | `/assignment-templates/:id` | ✓ | instructor | Update assignment template |

## Project Structure

```
SDP-Team-61-integrated/
├── .github/workflows/ci.yml     # GitHub Actions: 4-job CI pipeline
├── .prettierrc                   # Shared Prettier config
├── .prettierignore
├── docker-compose.yml            # PostgreSQL + Backend + AI + Frontend + Redis
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
│   │       ├── content.webp       # Login/register background
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
| `npm test` | Jest test suite (14 suites, 67 tests; v3.0 tests pending) |
| `npm run lint` | ESLint check |
| `npm run format` | Prettier format |
| `npm run migrate` | Run DB migrations (up) |
| `npm run migrate:down` | Rollback last migration |

### Frontend

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production build |
| `npm run test` | Vitest unit tests (src only; E2E excluded) |
| `npm run e2e` | Playwright E2E tests (requires `npm run preview` or dev server) |
| `npm run lint` | ESLint check |
| `npm run format` | Prettier format |

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) runs on push to `main`/`integrated` and PRs to `main`:

| Job | Steps |
|-----|-------|
| **Backend CI** | `npm ci` → Dependency audit (high/critical) → TypeScript type-check → Jest tests (PostgreSQL service) |
| **Frontend CI** | `npm ci` → Dependency audit → Lint → Build → Unit tests (Vitest) → Playwright E2E (Chromium) → Upload artifact |
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

> **Development only.** All seed accounts use real bcrypt hashes. **For production or any non-local deployment:** change these passwords immediately or do not run `seed.sql` (see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)).

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

## Database Schema (36 migrations)

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
| 011 | `submissions.course_id` (explicit course scoping) |
| 012 | `rubrics` table (configurable rubric definitions) |
| 013 | `peer_review_appeals` table (clarification/appeal workflow) |
| 014 | `notification_preferences` table (in-app/email/push per type) |
| 015 | `push_subscriptions` table (browser push subscription storage) |
| 016 | `file_review_drafts`, `peer_review_drafts` (backend draft persistence) |
| 017 | `submission_policies` table (course-level edit/withdraw policy) |
| 018 | `assignment_templates` + `submissions.assignment_template_id` |
| 019 | Performance indexes (`submissions`, `peer_reviews`, `rewrite_suggestions`, `peer_review_sessions`, `team_chemistry`) |
| 020 | Data lifecycle cleanup functions (`cleanup_old_drafts`, `cleanup_old_notifications`, `cleanup_old_ai_logs`) |
| 021 | `anonymous_reviewer_map`, `anonymity_level` enum, session/submission anonymity columns |
| 022 | `revision_number`, `parent_submission_id` on submissions; `review_round` on reviews |
| 023 | `assignment_strategy` enum, `review_exclusions` table, `min_reviews_required` column |
| 024 | `review_helpfulness` table, `reviewer_reputation` table |
| 025 | AI scoring tables: `score_suggestions`, `calibration_results` |
| 026 | `similarity_reports` table (TF-IDF + mock Turnitin results) |
| 027 | `ai_conversations` table (multi-turn AI assistant history) |
| 028 | `grade_weights` table, `final_grades` view |
| 029 | `lms_config` table (mock LTI 1.3 configuration) |
| 030 | `semesters` table, `courses.semester_id` FK |
| 031 | Enhanced `announcements` (pinned, scheduled_at, attachment columns) |
| 032 | `deadline_reminders`, `deadline_extensions` tables, `grace_period_hours` column |
| 033 | `review_hash` column on reviews + peer_review_scores |
| 034 | `compliance_requests` table (GDPR export/deletion) |
| 035 | `user_preferences` table (theme, font_size, contrast) |
| 036 | Performance indexes for v3.0 tables |

## License

University coursework project — see institutional guidelines.
