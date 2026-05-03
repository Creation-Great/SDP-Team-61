# SDP Peer Review System

> AI-enhanced peer review platform for university courses. UConn CSE4939W Senior Design Project, Team 61.

A full-stack monorepo: React frontend, TypeScript/Express backend, Flask/Python AI service, PostgreSQL + Redis. Students submit work, peers review with AI assistance, instructors monitor quality and grades.

## Status

- **Version**: 3.0.0
- **Maturity**: Production-grade for course pilot; some modules (AI scoring, similarity, LMS) marked Beta — see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#module-maturity).
- **License**: not yet declared.

## Tech Stack

| Layer | Stack | Version |
|-------|-------|---------|
| Frontend | React + Vite + Tailwind + React Router | 19.2 / 7.2 / 3.4 / 7.9 |
| Frontend extras | TipTap, Recharts, Framer Motion, lucide-react, vite-plugin-pwa | — |
| Backend | TypeScript + Express + Zod + Pino | 5.4 / 5.1 / 4.3 / 10.3 |
| Backend infra | jsonwebtoken, helmet, multer, ioredis, web-push, archiver | — |
| AI Service | Python + Flask + OpenAI SDK + scikit-learn | 3.12 / 3.1 / 1.82 / ≥1.3 |
| AI runtime | Gunicorn (gevent), Flask-Limiter, psycopg2 | — |
| Database | PostgreSQL (RLS + materialized views) | 16 |
| Cache | Redis (token blacklist, rate-limit store, app cache) | 7-alpine |
| Tests | Jest, Vitest, Playwright, pytest | — |
| CI/CD | GitHub Actions (5 jobs incl. Trivy) | — |
| Container | Docker Compose (5 services) | — |

## Quickstart

### Prerequisites

- **Docker Desktop** (DB + Redis at minimum)
- **Node.js 20+** (backend + frontend)
- **Python 3.10+** (AI service, optional for non-AI work)
- A copy of `.env` based on `.env.example` with `POSTGRES_PASSWORD` and `JWT_SECRET` filled in.

### Option A — One-click (Windows PowerShell)

```powershell
.\start-dev.ps1
```

### Option B — Cross-platform Makefile

```bash
make install    # install backend + frontend + ai-service deps
make dev        # db + redis + backend + frontend (no AI)
make dev-ai     # add AI service
make stop       # stop everything
```

### Option C — Manual

```bash
docker compose up db redis -d
cd backend     && npm install && npm run dev   # :8080
cd frontend    && npm install && npm run dev   # :5173
cd ai-service  && pip install -r requirements.txt && python app.py  # :5001
```

### Option D — Full Docker stack

```bash
docker compose up --build -d   # db + redis + backend + ai-service + frontend (nginx :80/:443)
```

## Default Ports

| Service | Port | Notes |
|---------|------|-------|
| Frontend (dev) | 5173 | Vite dev server, proxies API to :8080 |
| Frontend (prod) | 80 / 443 | Nginx in Docker |
| Backend API | 8080 | Express, JWT cookie auth |
| AI Service | 5001 | Flask, requires `X-AI-API-Key` header |
| PostgreSQL | 5432 | `peerreview` database |
| Redis | 6379 | Optional; backend gracefully degrades if absent |

API docs (dev only): <http://localhost:8080/api-docs>

## Repository Layout

```
.
├── backend/         # Express + TypeScript (37 migrations, 22 routes)
├── frontend/        # React 19 + Vite + Tailwind (33 pages)
├── ai-service/      # Flask + OpenAI (10 blueprints)
├── docs/            # Architecture, API, deployment, user guide
├── tests/           # Cross-service end-to-end harness
├── docker-compose.yml
├── Makefile         # Cross-platform dev shortcuts
├── start-dev.ps1    # Windows one-click dev launcher
└── README.md
```

## Documentation

| Document | Audience | Purpose |
|----------|----------|---------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Devs | System architecture, request lifecycle, data flow |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Devs | Coding conventions, common workflows, testing |
| [docs/API.md](docs/API.md) | Devs / integrators | Human-readable API reference |
| [docs/openapi.yaml](docs/openapi.yaml) | Integrators / tools | Machine-readable OpenAPI 3.0 spec |
| [docs/DATABASE.md](docs/DATABASE.md) | Devs | Schema, RLS, ERD |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Operators | Production deployment, JWT rotation, backup |
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md) | End users | Student / instructor / admin walkthrough |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Devs / stakeholders | Future migration plan (Flask → FastAPI etc.) |

## Common Commands

```bash
# Tests
cd backend     && npm test           # Jest (14 suites)
cd frontend    && npm run test       # Vitest
cd frontend    && npm run e2e        # Playwright
cd ai-service  && pytest tests/ -v   # 11 suites

# Database migrations
cd backend && npm run migrate        # apply pending
cd backend && npm run migrate:down   # roll back last

# Lint & format (root delegates to all sub-packages)
npm run lint
npm run format
```

## CI

GitHub Actions runs five jobs on push to `main` / `integrated` and on PRs to `main`:

1. **Backend** — npm audit, `tsc --noEmit`, Jest with coverage, PostgreSQL + Redis services
2. **Frontend** — npm audit, lint, build, Vitest, Playwright (chromium)
3. **AI Service** — pytest with coverage (≥60% gate)
4. **Docker Build** — backend + frontend + ai-service images, `docker compose config` validation
5. **Security** — Trivy filesystem scan (CRITICAL/HIGH, report-only)

## Contributing

This is a coursework project. Contributions are limited to Team 61 members during the SDP cycle. After course completion, the repository may transition to read-only.

For internal contribution conventions (commit messages, branching, PR flow), see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#git-workflow).
