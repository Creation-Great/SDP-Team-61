# SDP-Team-61-integrated Improvement and Optimization Plan

> A comprehensive set of improvement and optimization recommendations after reading through the project, organized by priority and category.

> Maintenance note (2026-03): Functional feature completion status is tracked in `FUNCTIONAL_IMPROVEMENTS_ANALYSIS.md`. This document remains focused on non-functional dimensions (quality, ops, performance, testing, CI, docs).

---

## I. Critical Bug Fixes

### 1.1 Instructor Dashboard: SSE event callback parameters and display (high priority)

**Location**: `frontend/src/pages/InstructorDashboardPage.jsx`

**Issue**:
- The `useSSE` `onEvent` callback signature is `(eventName, parsedData)`: the first argument is the event name string (e.g. `'submission_created'`), the second is the `data` object from the server.
- The code was treating the first argument as an "event object": `event.type`, `setLiveEvents((prev) => [event, ...prev])`, which led to:
  - `event.type` effectively being the first character of the string, so the condition `event.type === 'submission_created'` almost never held and the submission list did not auto-refresh.
  - `liveEvents` storing strings instead of `{ type, data, timestamp }`, so `evt.type`, `evt.data` were undefined in the UI and the Live Events list looked wrong.

**Fix**:

```javascript
// Use (eventName, data) correctly and build a full event object
const { connected } = useSSE('/instructor/events', {
  onEvent: useCallback((eventName, data) => {
    setLiveEvents((prev) => [
      { type: eventName, data: data || {}, timestamp: new Date().toISOString() },
      ...prev
    ].slice(0, 20));
    if (eventName === 'submission_created') {
      API.get('/submissions/all').then((r) => setSubmissions(r.data)).catch(() => {});
    }
  }, []),
});
```

Ensure the Live Events render uses fields consistent with the backend (e.g. `data.student_name`, `data.title`); if the backend does not send `timestamp`, the locally generated one above is sufficient.

---

### 1.2 Production Nginx: SSE endpoint `/instructor/events` buffering not disabled (high priority)

**Location**: `frontend/nginx.conf`

**Issue**:
- Only `location /notifications` had SSE-related settings like `proxy_buffering off`.
- The instructor real-time stream uses `GET /instructor/events`, which was handled by the generic `location /instructor` proxy without buffering disabled, so SSE could be buffered at nginx and cause lag or connection issues.

**Fix**:
- Add a dedicated location in `nginx.conf` for SSE that matches `/instructor/events` first, reuse the same SSE settings as for `/notifications` (e.g. `proxy_buffering off`, `proxy_cache off`, `proxy_read_timeout`, `Connection ''`, `proxy_http_version 1.1`), and keep the existing `location /instructor` for other instructor endpoints.

---

### 1.3 SSE authentication in production (medium–high priority)

**Location**: `frontend/src/hooks/useSSE.js`, backend `streamEvents`, and nginx

**Issue**:
- `EventSource` cannot set custom headers; with same-origin and cookie it works, but if production is cross-origin or nginx does not forward the cookie, SSE may get 401.
- README mentions passing JWT via `?token=`, but the frontend `useSSE` did not append the token to the URL.

**Fix**:
- For same-origin production (frontend and API under one domain via nginx), ensure nginx forwards `Cookie` and `Host` for both `location /instructor/events` and `location /instructor`.
- For cross-origin or when passing token explicitly: in `useSSE`, build the URL with `?token=xxx` from the current auth state (e.g. from AuthContext or cookie); the backend already supports reading and validating JWT from `req.query.token`.

---

## II. Code Quality and Consistency

### 2.1 Frontend: TypeScript or at least JSDoc types (medium priority)

**Current**: Frontend is plain JavaScript (`.jsx`/`.js`) with no type constraints, which can lead to wrong arguments (e.g. the SSE callback above).

**Recommendation**:
- Short term: Add JSDoc (`@param`, `@returns`, `@typedef`) for core modules (e.g. `useSSE`, `api.js`, `AuthContext`, routes and main pages) and enable `checkJs` in the IDE.
- Longer term: Consider migrating to TypeScript (or enabling TS for part of the codebase) so that interfaces like `onEvent(eventName, data)` are enforced by types.

---

### 2.2 Backend: Unified error codes and response shape (medium priority)

**Location**: `backend/src/app.ts`, controllers

**Current**: There are `AppError`, Zod validation errors, etc., but some endpoints may still use `res.status(xxx).json({ message })` directly without a consistent `error`, `message`, `details` shape.

**Recommendation**:
- In the global error handler, use a single response shape, e.g. `{ error: string, message: string, details?: unknown }`.
- In controllers, prefer `throw new AppError(statusCode, message)` or validation middleware instead of hand-written `res.status().json()`.

---

### 2.3 Environment variables and config (low–medium priority)

**Location**: Root `.env.example`, `backend/.env.example`, `ai-service/.env.example`

**Current**: Root `.env.example` is minimal; README lists variables like `DATABASE_URL`, `PORT`, `FRONTEND_URL`, `CORS_ORIGINS`, `AI_SERVICE_URL` that are mainly used in backend/ai-service.

**Recommendation**:
- In `backend/.env.example`, list all backend variables with short descriptions (required/optional).
- In `ai-service/.env.example`, list `OPENAI_API_KEY`, `DATABASE_URL`, `AI_API_KEY`, `FRONTEND_URL`, etc.
- In the root `.env.example`, briefly state that it is for docker-compose and root-level config and point to the subdirectory examples to avoid confusion with backend/ai-service.

---

## III. Security and Operations

### 3.1 Sensitive defaults in production (high priority)

**Location**: `backend/sql/seed.sql`, docs and deployment notes

**Current**: Seed accounts all use password `password123`, and README lists them in plain text.

**Recommendation**:
- In README or deployment docs, state clearly that production/non-local must change seed passwords or disable seed data.
- If the deployment runs seed, control it via an env var (e.g. `RUN_SEED=false`) and default to not running seed in production.

---

### 3.2 Dependencies and vulnerabilities (medium priority)

**Recommendation**:
- Run `npm audit` (backend, frontend) and `pip audit` or a security scan (ai-service) regularly and address medium/high issues.
- In CI, add a step that fails the pipeline on `npm audit --audit-level=high` (or equivalent) to avoid shipping known high-severity issues.

---

### 3.3 Logging and monitoring (medium priority)

**Location**: `backend` (Pino), `ai-service` (logging)

**Recommendation**:
- In production, avoid logging sensitive fields (tokens, passwords, full cookies).
- Use structured fields (e.g. `userId`, `action`, `resourceId`) for important operations (login failure, permission denied, upload/review/score release) to support log aggregation and alerting.
- Optionally add a simple dependency check to `/healthz` (e.g. DB connectivity) for K8s/Docker health probes and auto-restart.

---

## IV. Performance and Scalability

### 4.1 Database connections and RLS (medium priority)

**Location**: `backend/src/db.ts`

**Current**: `withDb` gets a connection, sets RLS, and runs in a transaction per request; at high concurrency the pool can become a bottleneck.

**Recommendation**:
- Tune `PG_POOL_MAX` (and optionally `idleTimeoutMillis`, `connectionTimeoutMillis`) for load and document recommended values.
- For read-only queries that do not depend on the current user (e.g. some instructor aggregates), consider a read replica or a read-only connection that bypasses RLS (only in trusted code paths).

---

### 4.2 Frontend: list virtualization and pagination (low–medium priority)

**Location**: `InstructorDashboardPage.jsx`, `PeerReviewResultsPage.jsx`, and other large-list pages

**Current**: Some lists fetch everything and paginate/filter on the client, which can be slow with large data.

**Recommendation**:
- For endpoints like “all submissions” and “all students”, support server-side pagination (e.g. `?page=1&pageSize=20`) and return total count; frontend only requests the current page.
- For very long lists (e.g. Analytics, Raw Review Details), consider virtual scrolling (e.g. `react-window`/`react-virtuoso`) to reduce DOM size.

---

### 4.3 SSE heartbeat and reconnection (low priority)

**Location**: `frontend/src/hooks/useSSE.js`, backend `streamEvents`

**Current**: Backend has a 30s heartbeat; frontend has exponential backoff reconnect (max 30s).

**Recommendation**:
- On `onerror` or when no message is received for a long time, close and reconnect to avoid “half-dead” connections.
- Keep the current heartbeat and backoff; if the proxy times out (e.g. 60s), increase nginx `proxy_read_timeout` and align with the heartbeat interval.

---

## V. Testing and CI

### 5.1 Frontend unit and E2E tests (medium priority)

**Current**: Backend has Jest tests; frontend has ESLint and build only, no unit/component/E2E tests.

**Recommendation**:
- Add unit tests for core hooks (e.g. `useSSE`, `useFilteredList`) and utilities (Vitest or Jest).
- Add a small set of E2E tests for critical flows (login, submit, review, instructor score release) (e.g. Playwright/Cypress) and run them in CI to prevent regressions.

---

### 5.2 CI and branch strategy (low priority)

**Location**: `.github/workflows/ci.yml`

**Current**: Runs on push to `main`/`integrated` and on PRs to `main`; frontend lint uses `continue-on-error: true`.

**Recommendation**:
- Make frontend lint fail the job (remove `continue-on-error`) and fix existing lint issues for consistent style.
- If `integrated` is a long-lived branch, document its merge and release strategy with `main`.

---

## VI. Features and UX

### 6.1 Accessibility and i18n (low–medium priority)

**Current**: README mentions WCAG 2.1, ARIA, keyboard navigation; overall in good shape.

**Recommendation**:
- For new pages and components, spot-check keyboard and screen reader: focus order, focus visibility, form errors and dynamic content (e.g. `aria-live`).
- If multi-language is planned, centralize copy in a small set of modules or keys to make i18n easier later.

---

### 6.2 Loading and error states (low priority)

**Location**: All pages

**Recommendation**:
- Use Skeleton or explicit loading state on first paint for list/dashboard pages to avoid blank layout or jump.
- On API failure, besides toast, provide a “Retry” button or clear message for critical actions (e.g. submit review, release scores).

---

### 6.3 Mobile and responsive (low priority)

**Current**: Sidebar collapse and mobile header are in place.

**Recommendation**:
- Test on device or emulator: table horizontal scroll, modals/drawers on small screens, form inputs and button touch targets.
- For complex tables, consider a card-style mobile layout or fewer columns for readability.

---

## VII. Documentation and Maintainability

### 7.1 API documentation (medium priority)

**Current**: README has a route table and descriptions but no machine-readable OpenAPI/Swagger.

**Recommendation**:
- Generate OpenAPI 3.0 from routes and schemas (JSDoc/TS or middleware such as swagger-ui-express) and expose an `/api-docs` page in dev/staging for frontend–backend alignment.

---

### 7.2 Architecture and deployment (low priority)

**Recommendation**:
- In `docs/`, keep or add: architecture diagram (frontend–backend–DB–AI), production deployment checklist (env vars, ports, HTTPS, domain), FAQ (e.g. CAS, cookie domain, SSE proxy), and troubleshooting steps.

---

## VIII. Priority Summary

| Category      | Item                          | Priority |
|---------------|--------------------------------|----------|
| Bug           | SSE callback and Live Events   | High     |
| Bug           | Nginx SSE /instructor/events   | High     |
| Security      | Production seed password and RUN_SEED | High |
| Security/Ops  | Dependency audit and CI        | Medium   |
| Code quality  | Frontend types/JSDoc, unified error body | Medium |
| Config        | .env.example completeness      | Medium   |
| Testing       | Frontend unit tests, E2E       | Medium   |
| Performance   | DB pool, server-side pagination| Medium   |
| Ops           | Logging and health dependency check | Medium |
| CI            | Lint without continue-on-error | Low      |
| UX            | Loading/error/mobile/a11y     | Low      |
| Docs          | OpenAPI, deployment, troubleshooting | Low  |

---

## IX. Suggested Implementation Order

1. **Immediate**: Fix 1.1 (SSE event callback and display), 1.2 (Nginx SSE config); confirm 1.3 (production SSE auth) for the current deployment.
2. **Short term**: Complete backend/ai-service `.env.example`; document seed accounts and RUN_SEED in deployment; unify error response shape; add JSDoc for useSSE, etc.
3. **Medium term**: Enable frontend lint to fail the job and fix issues; add API docs (OpenAPI); evaluate server-side pagination and frontend virtual lists for key endpoints.
4. **Long term**: Frontend TypeScript or full JSDoc; frontend unit tests and a small E2E suite; standardize logging and monitoring; make dependency audit part of CI.

---

## X. Implementation Status (Completed Items)

The following items have been implemented and verified; they are listed for maintenance reference.

| Category   | Item | Status | Notes |
|------------|------|--------|-------|
| Bug        | 1.1 SSE callback and Live Events | Done | `InstructorDashboardPage.jsx` uses `(eventName, data)` and builds `{ type, data, timestamp }` |
| Bug        | 1.2 Nginx SSE `/instructor/events` | Done | Dedicated location in `frontend/nginx.conf`, buffering off |
| Security   | Production seed password and RUN_SEED | Documented | `docs/DEPLOYMENT.md` and README |
| Config     | .env.example completeness | Done | Backend, ai-service, root all updated |
| Docs       | Deployment and troubleshooting | Done | `docs/DEPLOYMENT.md` covers SSE, health check, troubleshooting |
| Error resp | Unified message for 401 etc. | Done | notificationRoutes, roleGuard, etc. |
| Code quality | useSSE/api/AuthContext/Route JSDoc | Done | Core modules have JSDoc; `useSSE` supports optional `getToken` |
| CI         | Lint without continue-on-error | Done | Frontend lint fails the job |
| CI         | Dependency audit | Done | backend/frontend CI run `npm audit --audit-level=high` |
| Testing    | Frontend unit tests Vitest | Done | useFilteredList, useSSE tests; Vitest runs `src/**/*.test.*` only |
| Testing    | E2E with Playwright | Done | `e2e/login.spec.js`; CI runs Chromium E2E |
| Ops        | /healthz dependency check | Done | When DATABASE_URL is set, runs `SELECT 1`; returns 503 on failure |
| Code quality | jsconfig checkJs + route JSDoc | Done | `frontend/jsconfig.json` checkJs; ProtectedRoute/InstructorRoute/StudentRoute JSDoc |
| Code quality | 2.2 Unified error response | Done | AppError supports optional `code`; global handler uses `error`/`message`/`details` |
| Perf/Docs  | 4.1 DB connection pool | Done | DEPLOYMENT has “Database connection pool” section (PG_POOL_MAX, etc.) |
| Docs       | 7.1 API docs /api-docs | Done | Backend serves Swagger UI when `docs/openapi.yaml` exists |
| Ops        | 3.3 Structured logging | Done | Login failure, CAS failure, permission denied, review submit, score release use action/userId/resourceId |
| Performance| 4.3 SSE heartbeat and reconnect | Done | Backend sends named `heartbeat`; frontend listens, closes and reconnects after 90s silence, clears timer on onerror |
| UX         | 6.2 Loading state | Done | Instructor Dashboard first paint uses Skeleton (title/tabs/stats/table) + bottom Loading text |
| Performance| 4.2 Server-side pagination | Done | GET /submissions/all supports ?page=&pageSize=, returns { submissions, total }; frontend Submissions tab paginates |
| CI/Docs    | 5.2 Branch strategy | Documented | DEPLOYMENT “Branches and release”: main/integrated, merge and release |
| UX         | 6.2 Retry for key actions | Done | Instructor Dashboard assign-review failure shows error and Retry button |
| A11y       | 6.1 Key dynamic and form | Done | Assign result uses role=alert/status + aria-live; login error uses id + aria-describedby; Retry aria-label |
| Docs       | 7.2 Architecture and deployment checklist | Done | DEPLOYMENT has architecture/ports table and mobile/responsive; USER_GUIDE troubleshooting has Mobile/Small Screen |
| Performance| 4.2 More server-side pagination | Done | GET /instructor/checkins/students supports ?page=&pageSize=, returns { students, total }; frontend supports both response shapes |
| Testing    | 5.1 E2E extension | Done | Login flow: fill seed account, submit, assert redirect to /instructor or /dashboard or error alert |
| Ops        | LOG_LEVEL | Documented | backend/.env.example LOG_LEVEL comment for production (info/warn) |
| Bug/Ops    | 1.3 SSE auth (getToken) | Supported | useSSE optional getToken, URL gets ?token=; DEPLOYMENT §3 same-origin cookie / cross-origin token |
| Performance| 4.2 Virtual list Raw Review Details | Done | PeerReviewResultsPage Raw Review Details uses react-virtuoso TableVirtuoso, fixed height, “Showing N of M reviews” |
| Docs       | 7.1 OpenAPI key routes | Done | openapi.yaml: my-tasks, checkins/context, checkins/self, peer-review sessions results/my-team, instructor/assign |
| Code quality | More page JSDoc | Done | StudentDashboardPage, AssignedReviewsPage file-level JSDoc |
| A11y       | 6.1 Student Dashboard/Reviews | Done | StudentDashboardPage loading aria-busy/aria-live; clickable cards role=button, tabIndex, keyboard, aria-label; AssignedReviewsPage region/caption, Evaluate aria-label |
| Testing    | 5.1 E2E post-login Dashboard | Done | login.spec.js: instructor asserts h1 “Instructor Dashboard”; student asserts “Student Dashboard” |
| Code quality | More page JSDoc (forms/Check-ins) | Done | PeerReviewFormPage, ClassCheckinsPage file-level JSDoc |
| UX         | 6.2 Results page Skeleton | Done | PeerReviewResultsPage first paint Skeleton (title/buttons/progress/table) + aria and bottom text |
| i18n       | 6.1 Copy centralization | Ready | frontend/src/i18n/strings.js; PeerReviewResultsPage uses strings.results and strings.common |
| Code quality | More page JSDoc (Analytics/Sessions/Enrollments) | Done | InstructorAnalyticsPage, PeerReviewSessionsPage, EnrollmentManagementPage JSDoc |
| Docs       | 7.1 OpenAPI auth/profile, enrollments | Done | openapi.yaml: PATCH /auth/profile; GET/POST /enrollments, PATCH/DELETE /enrollments/{id}, GET /enrollments/course/{id}/members |
| Code quality | More page JSDoc (Review/Login/Upload/Checkins) | Done | ReviewPage, LoginPage, UploadAssignment, StudentCheckinsPage JSDoc |
| Code quality | Page JSDoc full coverage | Done | InstructorDashboardPage, InstructorPeerReviewPage, StudentScoresPage, ViewReviewPage, RegisterPage, NotFoundPage, PeerReviewResultsPage; all pages covered |
| Docs       | 7.1 OpenAPI notifications PATCH | Done | openapi.yaml: PATCH /notifications/read-all, PATCH /notifications/{id}/read |
| Testing    | 5.1 Utility unit tests | Done | src/utils/csvHelpers.test.js: parseCsvLine, parseCsv, toScore, csvEscape, buildDefaultWeek, RESERVED_HEADERS, 15 cases |
| UX         | 6.2 Results page retry | Done | PeerReviewResultsPage: release/hide score failure shows releaseError + Retry; instructor review submit failure shows submitReviewError + Retry, role=alert, aria-label |
| Docs       | XI. Optional follow-up | Added | New “XI. Optional follow-up” at end: TypeScript, more virtual lists, mobile, more E2E/unit tests, i18n rollout |
| i18n       | 6.1 i18n on login page | Done | strings.login: signIn, signInWithNetId, signInWithEmail, placeholders, errors, register success; LoginPage uses strings.login |

Items not in the table above (e.g. full TypeScript, virtual lists on other pages) remain recommendations and can be scheduled as needed.

---

## XI. Optional Follow-up (Not in Implementation Status Table)

The following are not yet implemented; they can be scheduled or done in a later iteration:

- **Full TypeScript**: Gradually migrate the frontend to TypeScript or enable TS for key directories to enforce interface consistency.
- **Virtual lists on other pages**: Evaluate and add react-virtuoso/react-window for long lists (e.g. Averages table, ClassCheckins student list).
- **6.3 Mobile**: Add card-style mobile layout or simplified columns for complex tables; run a full pass on device/emulator.
- **More E2E**: Add E2E cases for key flows (student submit, student/instructor review, instructor release scores) (requires backend or mocks).
- **More unit tests**: Add unit or component tests for api.js request/interceptors and core UI components.
- **i18n rollout**: Integrate react-i18next (or similar), replace `strings` with `t(key)`, and add language switching.

---

*Document version: 1.2 — Based on a full read of SDP-Team-61-integrated; implementation status section maintained*
