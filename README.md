# SDP Peer Review System – Integrated

> 整合自 `SDP-Team-61-main`（新版）和 `SDP-Team-61-old-main`（旧版），取两者之长，弃各自之短。

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 · React Router 7 · Axios · Framer Motion · CSS Variables |
| **Backend** | TypeScript · Express 5 · PostgreSQL 16 · JWT + bcrypt |
| **AI Service** | Python · Flask (stub，待接入 ML 模型) |
| **DevOps** | Docker Compose · Vite dev proxy |

## Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Frontend   │────▶│  Backend (TS)    │────▶│ PostgreSQL   │
│  React/Vite  │     │  Express 5 + JWT │     │  RLS + Audit │
│  :5173       │     │  :8080           │     │  :5432       │
└──────────────┘     └──────────────────┘     └──────────────┘
                            │
                     ┌──────▼──────┐
                     │ AI Service  │
                     │ Flask :5001 │
                     └─────────────┘
```

## Integration Decisions

| Feature | Kept From | Reason |
|---------|-----------|--------|
| TypeScript backend | Old | Type safety, better maintainability |
| PostgreSQL + RLS | Old | Row-level security per user/role |
| Audit logging | Old | Traceability for all critical actions |
| Materialized views | Old | Fast instructor dashboard queries |
| JWT authentication | New | Stateless, no external CAS dependency |
| MVC controller pattern | New | Clear separation of concerns |
| Complete peer review workflow | New | 8 pages with full feature coverage |
| CSS Variables + semantic classes | Old | Maintainable, responsive styling |
| Vite dev proxy | New design | No hardcoded API URLs |
| Drag-and-drop upload | New | Better UX |
| Framer Motion animations | New | Smooth transitions |
| Smart reviewer auto-assignment | Old | Fair distribution algorithm |

### Discarded

- CAS SSO (old) → replaced by JWT
- MongoDB (new) → replaced by PostgreSQL
- `main.js` legacy entry (old) → single TS entry point
- Inline styles (new) → CSS classes
- Hardcoded URLs (new) → Vite proxy
- S3 storage (old) → local disk with Multer (simpler dev setup)

## Quick Start

### Prerequisites

- Node.js ≥ 18
- Docker & Docker Compose
- Python ≥ 3.10 (only for AI service)

### 1. Start Database

```bash
docker compose up -d
```

This starts PostgreSQL 16 and auto-runs `backend/sql/migrations.sql` + `seed.sql`.

### 2. Setup Backend

```bash
cd backend
cp .env.example .env    # 编辑 .env 填写 JWT_SECRET 等
npm install
npm run dev
```

Backend runs on `http://localhost:8080`.

### 3. Setup Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173` with API proxy to backend.

### 4. (Optional) AI Service

```bash
cd ai-service
pip install -r requirements.txt
python app.py
```

AI service runs on `http://localhost:5001`.

### One-command (from root)

```bash
docker compose up -d
npm install        # installs backend + frontend via root package.json
npm run dev        # runs backend + frontend concurrently
```

## API Routes

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/auth/register` | ✗ | – | Register new user |
| POST | `/auth/login` | ✗ | – | Login, returns JWT |
| GET | `/auth/me` | ✓ | – | Current user info |
| POST | `/submissions/upload` | ✓ | student | Upload assignment (file + metadata) |
| GET | `/submissions/mine` | ✓ | student | My submissions with review counts |
| GET | `/submissions/all` | ✓ | instructor | All submissions overview |
| GET | `/submissions/reviews/my-tasks` | ✓ | student | Pending review assignments |
| GET | `/reviews/by-submission/:id` | ✓ | – | All reviews for a submission |
| GET | `/reviews/:id` | ✓ | – | Single review detail |
| POST | `/reviews/:id/submit` | ✓ | student | Submit a review |
| GET | `/instructor/overview` | ✓ | instructor | Cohort overview (materialized view) |
| POST | `/instructor/assign` | ✓ | instructor | Manual reviewer assignment |

## Project Structure

```
SDP-Team-61-integrated/
├── docker-compose.yml        # PostgreSQL service
├── package.json              # Monorepo root (concurrently)
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   ├── sql/
│   │   ├── migrations.sql    # Full schema with RLS
│   │   └── seed.sql
│   ├── src/
│   │   ├── app.ts            # Express app setup
│   │   ├── server.ts         # Entry point
│   │   ├── db.ts             # PG pool + RLS context
│   │   ├── types.ts          # Shared types
│   │   ├── utils/audit.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts       # JWT verify
│   │   │   ├── roleGuard.ts  # RBAC
│   │   │   └── upload.ts     # Multer config
│   │   ├── controllers/
│   │   │   ├── authController.ts
│   │   │   ├── submissionController.ts
│   │   │   ├── reviewController.ts
│   │   │   └── instructorController.ts
│   │   └── routes/
│   │       ├── authRoutes.ts
│   │       ├── submissionRoutes.ts
│   │       ├── reviewRoutes.ts
│   │       └── instructorRoutes.ts
│   └── uploads/
├── frontend/
│   ├── package.json
│   ├── vite.config.js        # Proxy to backend
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── index.css          # CSS variables
│       ├── App.css            # Component styles
│       ├── App.jsx            # Router
│       ├── config.js
│       ├── services/api.js    # Axios + JWT interceptor
│       ├── components/
│       │   ├── Navbar.jsx
│       │   ├── Navbar.css
│       │   ├── ProtectedRoute.jsx
│       │   ├── InstructorRoute.jsx
│       │   └── StudentRoute.jsx
│       └── pages/
│           ├── LoginPage.jsx
│           ├── RegisterPage.jsx
│           ├── StudentDashboardPage.jsx
│           ├── InstructorDashboardPage.jsx
│           ├── UploadAssignment.jsx
│           ├── AssignedReviewsPage.jsx
│           ├── ReviewPage.jsx
│           └── ViewReviewPage.jsx
└── ai-service/
    ├── app.py                # Flask AI stub
    └── requirements.txt
```

## Security Features

- **Row-Level Security (RLS)**: PostgreSQL policies enforce data isolation per user
- **JWT Authentication**: Stateless token-based auth with configurable expiry
- **RBAC Middleware**: `requireRole()` guards protect instructor-only routes
- **Audit Trail**: All critical operations logged to `audit` table
- **bcrypt**: Passwords hashed with bcrypt (12 rounds)
- **Helmet**: HTTP security headers
- **CORS**: Configurable origin whitelist
- **File Validation**: Upload type/size limits enforced server-side

## Default Accounts (from seed.sql)

| Email | Role | Password |
|-------|------|----------|
| instructor@test.com | instructor | (set your own hash) |
| alice@test.com | student | (set your own hash) |
| bob@test.com | student | (set your own hash) |

> ⚠️ Seed file uses placeholder password hashes. Generate real bcrypt hashes before use.
