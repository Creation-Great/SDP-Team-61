# API Reference

> Human-readable HTTP API for the SDP Peer Review System. For machine consumption use [openapi.yaml](openapi.yaml). For deeper conventions read [ARCHITECTURE.md](ARCHITECTURE.md).

The backend exposes 22 route prefixes mounted in [`backend/src/app.ts:265-286`](../backend/src/app.ts#L265-L286). Behind `/api/ai`, the backend forwards to the Flask AI service which exposes 10 Blueprints.

---

## 1. Base URL and Versioning

| Environment | Base URL |
|-------------|----------|
| Local dev (Vite) | `http://localhost:5173` (proxied to backend `:8080`) |
| Local backend direct | `http://localhost:8080` |
| Production | `https://www.peer.review.uconn.edu` (or whatever `FRONTEND_URL` resolves to) |

The API has no version prefix in the URL. Breaking changes are rolled out per route; the schema lives in `docs/openapi.yaml` (`info.version` aligns with `package.json`).

---

## 2. Authentication

All routes except the public auth endpoints below require authentication ([`middleware/auth.ts`](../backend/src/middleware/auth.ts#L19)).

Token resolution order:

1. `token` httpOnly cookie (preferred for browser sessions).
2. `Authorization: Bearer <jwt>` header (API clients / scripts).

Query-parameter tokens are no longer accepted.

| Code | Meaning |
|------|---------|
| `401 unauthorized` | No token, malformed, or invalid signature |
| `401 token_expired` | JWT `exp` passed |
| `401 token_revoked` | JWT `jti` is in the blacklist (logout, rotation) |

### 2.1 Obtaining a token

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/auth/register` | `{ email, password, name }` | `200 { token, user }` |
| POST | `/auth/login` | `{ email, password }` | `200 { token, user }` (also sets `token` cookie) |
| POST | `/auth/logout` | — | `200 { ok: true }` (revokes JWT `jti` via Redis) |
| GET | `/auth/me` | — | `200 { user }` (current authenticated user) |
| PATCH | `/auth/profile` | `{ name?, password? }` | `200 { user }` |
| GET | `/auth/cas/login` | — | Redirect to UConn CAS |
| GET | `/auth/cas/callback` | `?ticket=…` | Sets cookie, redirects to frontend |

---

## 3. Common Patterns

### 3.1 Response shape

Success:

```json
{ "field": "value", "another_field": 42 }
```

Most endpoints return the entity directly. Some collection endpoints return an envelope (e.g. search returns `{ submissions: [...], students: [...] }`).

### 3.2 Error shape

```json
{
  "error": "bad_request",
  "message": "Title is required",
  "details": [ { "path": "title", "message": "Required" } ]
}
```

`details` is present only for `error: "validation"` responses (Zod failures).

| Status | `error` codes |
|--------|--------------|
| 400 | `bad_request`, `validation` |
| 401 | `unauthorized`, `token_expired`, `token_revoked` |
| 403 | `forbidden` |
| 404 | `not_found` |
| 409 | `conflict` |
| 429 | `too_many_requests` |
| 500 | `internal_error` |
| 503 | `not_configured` (AI service when key unset) |

### 3.3 Rate limits (HTTP headers)

`express-rate-limit` adds `RateLimit-*` standard headers. For tier numbers, see [DEPLOYMENT.md §6](DEPLOYMENT.md#6-rate-limiting-reference).

### 3.4 Pagination

Most list endpoints return everything matching the filter (this is a coursework-scale platform, ≤ a few hundred records per query). Where pagination exists, it uses `?page=` + `?limit=` query parameters.

### 3.5 Correlation ID

Every request carries an `X-Request-Id` (echoed back if you provide one, otherwise auto-generated). The same value appears in backend Pino logs as `correlationId` for tracing.

---

## 4. Endpoint Reference

Each table column:
- **Method** — HTTP verb
- **Path** — relative to the prefix shown in the section heading
- **Description** — what it does
- **Auth** — `+role` means an additional `requireRole(...)` check beyond `authenticate`
- **Rate-limit tier** — applies in addition to the global limiter; see [DEPLOYMENT.md §6](DEPLOYMENT.md#6-rate-limiting-reference)

### 4.1 `/auth` — Authentication (`authLimiter`)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/register` | Register a new student account | public |
| POST | `/login` | Email + password login | public |
| POST | `/logout` | Revoke current JWT | authenticated |
| GET | `/me` | Return current user (with enrollments) | authenticated |
| PATCH | `/profile` | Update name / password | authenticated |
| GET | `/cas/login` | Begin CAS SSO flow | public |
| GET | `/cas/callback` | CAS ticket callback | public |

### 4.2 `/submissions` — File Submissions (`uploadLimiter`)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/upload` | Upload a new submission (multipart) | authenticated |
| GET | `/mine` | List current user's submissions | authenticated |
| GET | `/all` | All submissions in instructor's courses | +instructor |
| GET | `/reviews/my-tasks` | Pending review tasks for current user | authenticated |
| GET | `/my-grades` | Current user's per-submission grade summary | +student |
| PATCH | `/:id` | Edit title/description | +student (owner) |
| PATCH | `/:id/replace-file` | Upload a replacement file | +student (owner) |
| DELETE | `/:id` | Withdraw a submission | +student (owner) |

### 4.3 `/reviews` — File Reviews

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/by-submission/:submissionId` | List reviews for a submission | authenticated |
| GET | `/:id` | Fetch a review | authenticated |
| GET | `/:id/draft` | Fetch reviewer's WIP draft | authenticated |
| PATCH | `/:id/draft` | Save / update draft | authenticated |
| POST | `/:id/submit` | Submit final review | authenticated |

### 4.4 `/instructor` — Instructor Tools (`writeLimiter`)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/overview` | Aggregated instructor dashboard data | +instructor |
| GET | `/unified-dashboard` | Combined stats + AI logs + activity | +instructor |
| POST | `/assign` | Assign a single reviewer | +instructor |
| POST | `/assign/bulk` | Bulk reviewer assignment | +instructor |
| POST | `/announcements` | Post a course announcement | +instructor |
| POST | `/peer-review/aggregate` | Upload up to 30 CSV files | +instructor |
| GET | `/checkins/current` | Active check-in worksheet | +instructor |
| POST | `/checkins/current` | Save check-in worksheet | +instructor |
| GET | `/checkins/students` | Students for check-in dropdown | +instructor |
| GET | `/checkins/insights` | Aggregated check-in metrics | +instructor |
| GET | `/quality-flags` | File-review quality flags | +instructor |
| GET | `/peer-review-quality-flags` | Peer-review quality flags | +instructor |
| GET | `/export-csv` | File-review CSV export | +instructor |
| **GET** | **`/events`** | **Server-Sent Events stream (SSE)** | +instructor (cookie-only) |
| GET | `/submission-policy` | Read course's edit/withdraw policy | +instructor |
| PUT | `/submission-policy` | Update edit/withdraw policy | +instructor |

### 4.5 `/peer-review` — Peer Review Sessions (`writeLimiter`)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/sessions` | List sessions (scope depends on role) | authenticated |
| GET | `/sessions/:sessionId/my-team` | The team current user is reviewing | authenticated |
| GET | `/sessions/:sessionId/draft` | Get draft form state | authenticated |
| PATCH | `/sessions/:sessionId/draft` | Save draft form state | authenticated |
| POST | `/sessions/:sessionId/submit` | Submit team peer reviews | authenticated |
| GET | `/sessions/:sessionId/team-reviews` | Reviews submitted for current user's team | authenticated |
| GET | `/sessions/:sessionId/student-scores` | Released student scores | authenticated |
| GET | `/appeals/mine` | Current user's appeals | +student |
| POST | `/appeals` | Create an appeal | +student |
| POST | `/sessions` | Create a session | +instructor |
| POST | `/sessions/:sessionId/duplicate` | Duplicate a session as template | +instructor |
| PATCH | `/sessions/:sessionId` | Edit title / open-state | +instructor |
| PATCH | `/sessions/:sessionId/release-scores` | Release scores to students | +instructor |
| GET | `/sessions/:sessionId/results` | Aggregated session results | +instructor |
| GET | `/sessions/:sessionId/bias-analytics` | Self-vs-peer bias metrics | +instructor |
| GET | `/sessions/:sessionId/all-students` | All students in the session | +instructor |
| POST | `/sessions/:sessionId/instructor-review` | Instructor scores all teammates | +instructor |
| GET | `/sessions/:sessionId/export-csv` | CSV export | +instructor |
| GET | `/appeals` | List session appeals | +instructor |
| PATCH | `/appeals/:appealId` | Update appeal status / reply | +instructor |

### 4.6 `/checkins` — Student Check-ins

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/context` | Available courses/groups for check-in | authenticated |
| POST | `/self` | Save self check-in | authenticated |

### 4.7 `/enrollments` — Enrollment Management (`writeLimiter`)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/` | List enrollments visible to current user | authenticated |
| POST | `/` | Add an enrollment | authenticated |
| PATCH | `/:enrollmentId` | Edit enrollment | authenticated |
| DELETE | `/:enrollmentId` | Remove enrollment | authenticated |
| GET | `/course/:courseId/members` | Roster for a course | authenticated |

### 4.8 `/api/ai` — AI Features (proxied)

These endpoints are validated by Zod on the backend and forwarded to the Flask AI service.

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/feedback` | Toxicity / politeness / sentiment for a comment | authenticated |
| GET | `/feedback/:reviewId` | Fetch persisted AI feedback | authenticated |
| POST | `/rewrite` | AI rewrite of a review comment | authenticated |
| GET | `/rewrite/:reviewId` | Fetch persisted rewrite | authenticated |
| PATCH | `/rewrite/:reviewId/adopt` | Adopt suggested rewrite | authenticated |
| POST | `/polish` | Polish text (grammar/clarity) | authenticated |
| POST | `/summarize` | Summarise multiple reviews | authenticated |
| GET | `/logs` | AI activity log for instructor dashboard | authenticated |
| GET | `/search` | Global search across submissions and users | authenticated |
| POST | `/review-depth` | Score constructiveness/specificity/actionability | authenticated |
| POST | `/score-suggestion` | Suggest score range for a submission | authenticated |
| POST | `/calibration` | Compare reviewer score to peer average | authenticated |
| POST | `/score-reasoning` | Explain a suggested score | authenticated |
| POST | `/similarity` | TF-IDF cosine similarity between submissions | authenticated |
| POST | `/similarity/turnitin` | Mock Turnitin score (for development) | authenticated |
| POST | `/chat` | Multi-turn AI chat (3 context modes) | authenticated |

### 4.9 `/notifications`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/` | List user's notifications | authenticated |
| GET | `/unread-count` | Count of unread notifications | authenticated |
| GET | `/preferences` | Per-type notification channel preferences | authenticated |
| PATCH | `/preferences` | Update channel preferences | authenticated |
| GET | `/push/public-key` | Web Push VAPID public key | authenticated |
| GET | `/push/subscriptions` | List user's push subscriptions | authenticated |
| POST | `/push/subscriptions` | Register a push subscription | authenticated |
| DELETE | `/push/subscriptions` | Remove a push subscription | authenticated |
| PATCH | `/read-all` | Mark all notifications read | authenticated |
| PATCH | `/:id/read` | Mark one notification read | authenticated |

> **Express route order**: `/read-all` is registered **before** `/:id/read` so the static route is not swallowed by the param route.

### 4.10 `/rubrics`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/` | Get rubric for a (type, course/session) tuple | authenticated |
| POST | `/` | Upsert a rubric | +instructor |

### 4.11 `/assignment-templates`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/` | List templates for current user's courses | authenticated |
| POST | `/` | Create a template | +instructor |
| PATCH | `/:id` | Update a template | +instructor |

### 4.12 `/semesters` (`writeLimiter`)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/` | List semesters | +instructor / +ta |
| POST | `/` | Create a semester | +instructor |
| PATCH | `/:id` | Update a semester | +instructor |
| POST | `/clone` | Clone a course into a new semester | +instructor |

### 4.13 `/revisions` (`uploadLimiter`)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/` | Create a new revision (with file upload) | authenticated |
| GET | `/:submissionId/history` | List revision history | authenticated |
| GET | `/:submissionId/diff` | Diff vs previous revision | authenticated |

### 4.14 `/grades`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/weights/:courseId` | Read grade weights | authenticated |
| PUT | `/weights/:courseId` | Update grade weights | +instructor |
| GET | `/final/:courseId` | Computed final grades | +instructor |
| GET | `/export/:courseId` | CSV export (formula-injection-safe) | +instructor (`exportLimiter`) |

### 4.15 `/lms` (`writeLimiter`)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/lti/launch` | Mock LTI launch | +instructor |
| POST | `/lti/grades` | Mock LTI grade passback | +instructor |
| POST | `/lti/roster` | Mock LTI roster sync | +instructor |
| GET | `/:courseId` | Read LMS config | +instructor |
| PUT | `/:courseId` | Update LMS config | +instructor |

### 4.16 `/deadlines`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/calendar` | Calendar feed (deadlines, sessions, extensions) | authenticated |
| POST | `/extensions` | Grant an individual extension | +instructor |
| GET | `/extensions` | List extensions | authenticated |
| POST | `/reminders` | Configure reminder hours for an entity | +instructor |

### 4.17 `/preferences`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/` | Read user preferences | authenticated |
| PATCH | `/` | Update user preferences | authenticated |

### 4.18 `/compliance`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/export/:userId` | GDPR export (`exportLimiter`) | authenticated (self or admin) |
| POST | `/deletion-request` | Request account deletion | authenticated |
| GET | `/audit` | Audit log viewer | +admin |

### 4.19 `/similarity`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/report/:submissionId` | Similarity report for one submission | +instructor |
| GET | `/dashboard` | Course-wide similarity dashboard | +instructor |

### 4.20 `/anonymity`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/sessions/:sessionId/anonymity` | Read session anonymity config | authenticated |
| PATCH | `/sessions/:sessionId/anonymity` | Update session anonymity config | +instructor / +admin |

### 4.21 `/assignment-strategy` (`writeLimiter`)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| PATCH | `/strategy` | Update reviewer assignment strategy | +instructor / +admin |
| GET | `/exclusions` | List conflict-of-interest exclusions | authenticated |
| POST | `/exclusions` | Add an exclusion pair | +instructor / +admin |
| DELETE | `/exclusions/:id` | Remove an exclusion | +instructor / +admin |

### 4.22 `/quality`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/helpfulness` | Vote on a review's helpfulness | authenticated |
| GET | `/reputation/:userId` | Reviewer reputation summary | authenticated |
| GET | `/consistency` | Consistency alert list | +instructor / +admin |

---

## 5. Other Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/healthz` | Liveness + DB check (`200 { ok, db }` or `503`) | public |
| GET | `/uploads/:filename` | Authenticated file download (path-traversal safe) | authenticated; instructor/admin bypass; otherwise must be submitter or assigned reviewer |
| GET | `/api-docs` | Swagger UI (development only) | public |
| GET | `/api-docs/openapi.yaml` | Raw OpenAPI spec | public |

---

## 6. AI Service (Internal)

The Flask AI service is **not** exposed publicly — all calls flow through the backend at `/api/ai/*`. Each backend forwarder adds the shared-secret `X-AI-API-Key` header.

Direct Flask routes (for reference only — not part of the public API):

| Blueprint | Path | Method | Backend forwarder |
|-----------|------|--------|------|
| `health` | `/healthz` | GET | n/a (used for container health probe) |
| `feedback` | `/feedback` | POST | `/api/ai/feedback` |
| `feedback` | `/feedback/<review_id>` | GET | `/api/ai/feedback/:reviewId` |
| `rewrite` | `/rewrite` | POST | `/api/ai/rewrite` |
| `rewrite` | `/rewrite/<review_id>` | GET | `/api/ai/rewrite/:reviewId` |
| `rewrite` | `/rewrite/<review_id>/adopt` | PATCH | `/api/ai/rewrite/:reviewId/adopt` |
| `polish` | `/polish` | POST | `/api/ai/polish` |
| `summarize` | `/summarize` | POST | `/api/ai/summarize` |
| `scoring` | `/review-depth` | POST | `/api/ai/review-depth` |
| `scoring` | `/score-suggestion` | POST | `/api/ai/score-suggestion` |
| `scoring` | `/calibration` | POST | `/api/ai/calibration` |
| `scoring` | `/score-reasoning` | POST | `/api/ai/score-reasoning` |
| `similarity` | `/similarity` | POST | `/api/ai/similarity` |
| `similarity` | `/similarity/turnitin` | POST | `/api/ai/similarity/turnitin` |
| `chat` | `/chat` | POST | `/api/ai/chat` |
| `logs` | `/logs` | GET | `/api/ai/logs` |
| `search` | `/api/search` | GET | `/api/ai/search` (note: Flask path is `/api/search`, not `/api/ai/search`) |

The AI service requires `X-AI-API-Key` on all routes via [`@require_api_key`](../ai-service/extensions.py#L241). When `AI_API_KEY` is unset, every request is rejected with `503 not_configured` (fail-closed). All endpoints have additional Flask-Limiter rate limits (default 300/min, tighter per route).

---

## 7. Inter-Service Headers

| Header | Set by | Used by |
|--------|--------|---------|
| `X-AI-API-Key` | Backend `aiController` | AI service `@require_api_key` |
| `X-Request-Id` | Caller (optional) or backend (auto-generated) | Backend Pino logger as `correlationId` |
| `Authorization: Bearer <jwt>` | API clients | Backend `authenticate` middleware |

---

## 8. References

- Route mounts: [`backend/src/app.ts:265-286`](../backend/src/app.ts#L265-L286)
- Route definitions: [`backend/src/routes/*.ts`](../backend/src/routes/)
- Zod schemas: [`backend/src/schemas.ts`](../backend/src/schemas.ts)
- AI Blueprints: [`ai-service/routes/*.py`](../ai-service/routes/)
- OpenAPI: [`docs/openapi.yaml`](openapi.yaml)
- Auth middleware: [`backend/src/middleware/auth.ts`](../backend/src/middleware/auth.ts)
