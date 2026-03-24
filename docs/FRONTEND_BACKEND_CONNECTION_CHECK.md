# Frontend–Backend Connection Check Report

This document records the results of checking **all features** of the SDP-Team-61-integrated project for correct API connectivity between frontend and backend.

---

## 1. Summary

| Item | Status |
|------|--------|
| **Core business features** | All correctly connected; paths and HTTP methods match |
| **Frontend-called endpoints** | All have corresponding backend implementation |
| **Backend endpoints not called by frontend** | Mostly wired; a few admin/instructor utility endpoints are intentionally backend-only |
| **Dev/production config** | Production must set `VITE_API_URL` and Nginx proxy |

---

## 2. Backend API vs Frontend Usage

### 2.1 Auth

| Backend endpoint | Frontend usage | Status |
|------------------|----------------|--------|
| GET `/auth/cas/login` | `LoginPage.jsx` (redirect) | OK |
| GET `/auth/cas/callback` | CAS server redirect (not called by frontend) | OK (expected) |
| POST `/auth/register` | `RegisterPage.jsx` | OK |
| POST `/auth/login` | `LoginPage.jsx` | OK |
| GET `/auth/me` | `AuthContext.jsx` | OK |
| PATCH `/auth/profile` | `Sidebar.jsx` | OK |
| POST `/auth/logout` | `AuthContext.jsx` | OK |

### 2.2 Submissions

| Backend endpoint | Frontend usage | Status |
|------------------|----------------|--------|
| POST `/submissions/upload` | `UploadAssignment.jsx` | OK |
| GET `/submissions/mine` | `StudentDashboardPage.jsx` | OK |
| GET `/submissions/all` | `InstructorDashboardPage.jsx` | OK |
| PATCH `/submissions/:id` | `StudentDashboardPage.jsx` | OK |
| DELETE `/submissions/:id` | `StudentDashboardPage.jsx` | OK |
| GET `/submissions/my-grades` | `StudentGradesPage.jsx` | OK |
| GET `/submissions/reviews/my-tasks` | `AssignedReviewsPage.jsx`, `StudentDashboardPage.jsx` | OK |

### 2.3 Reviews

| Backend endpoint | Frontend usage | Status |
|------------------|----------------|--------|
| GET `/reviews/by-submission/:submissionId` | `ViewReviewPage.jsx` | OK |
| GET `/reviews/:id` | `ReviewPage.jsx` | OK |
| POST `/reviews/:id/submit` | `ReviewPage.jsx` | OK |

### 2.4 Instructor

| Backend endpoint | Frontend usage | Status |
|------------------|----------------|--------|
| GET `/instructor/overview` | `InstructorDashboardPage.jsx` | OK |
| GET `/instructor/unified-dashboard` | `InstructorDashboardPage.jsx`, `InstructorAnalyticsPage.jsx` | OK |
| POST `/instructor/assign` | `InstructorDashboardPage.jsx` | OK |
| POST `/instructor/assign/bulk` | `InstructorDashboardPage.jsx` | OK |
| POST `/instructor/peer-review/aggregate` | `InstructorDashboardPage.jsx` | OK |
| GET `/instructor/checkins/current` | `InstructorPeerReviewPage.jsx`, `ClassCheckinsPage.jsx` | OK |
| POST `/instructor/checkins/current` | `InstructorPeerReviewPage.jsx` | OK |
| GET `/instructor/checkins/students` | `InstructorDashboardPage.jsx`, `InstructorPeerReviewPage.jsx`, `ClassCheckinsPage.jsx` | OK |
| GET `/instructor/checkins/insights` | `InstructorPeerReviewPage.jsx`, `ClassCheckinsPage.jsx` | OK |
| GET `/instructor/quality-flags` | `InstructorAnalyticsPage.jsx` | OK |
| GET `/instructor/peer-review-quality-flags` | `InstructorAnalyticsPage.jsx` | OK |
| GET `/instructor/export-csv` | `InstructorAnalyticsPage.jsx` (window.open) | OK |
| GET `/instructor/events` (SSE) | `InstructorDashboardPage.jsx` (useSSE) | OK |

### 2.5 Peer-review

| Backend endpoint | Frontend usage | Status |
|------------------|----------------|--------|
| GET `/peer-review/sessions` | `PeerReviewSessionsPage.jsx` | OK |
| POST `/peer-review/sessions` | `PeerReviewSessionsPage.jsx` | OK |
| PATCH `/peer-review/sessions/:sessionId` | `PeerReviewSessionsPage.jsx` | OK |
| POST `/peer-review/sessions/:sessionId/duplicate` | `PeerReviewSessionsPage.jsx` | OK |
| PATCH `/peer-review/sessions/:sessionId/release-scores` | `PeerReviewSessionsPage.jsx`, `PeerReviewResultsPage.jsx` | OK |
| GET `/peer-review/sessions/:sessionId/my-team` | `PeerReviewFormPage.jsx` | OK |
| GET `/peer-review/sessions/:sessionId/team-reviews` | `PeerReviewFormPage.jsx` | OK |
| POST `/peer-review/sessions/:sessionId/submit` | `PeerReviewFormPage.jsx` | OK |
| GET `/peer-review/sessions/:sessionId/student-scores` | `StudentScoresPage.jsx` | OK |
| GET `/peer-review/sessions/:sessionId/results` | `PeerReviewResultsPage.jsx` | OK |
| GET `/peer-review/sessions/:sessionId/bias-analytics` | `PeerReviewResultsPage.jsx` | OK |
| GET `/peer-review/sessions/:sessionId/all-students` | `PeerReviewResultsPage.jsx` | OK |
| POST `/peer-review/sessions/:sessionId/instructor-review` | `PeerReviewResultsPage.jsx` | OK |
| GET `/peer-review/sessions/:sessionId/export-csv` | `PeerReviewResultsPage.jsx` (fetch + download) | OK |
| GET `/peer-review/appeals/mine` | `StudentScoresPage.jsx` | OK |
| POST `/peer-review/appeals` | `StudentScoresPage.jsx` | OK |
| GET `/peer-review/appeals` | `InstructorAnalyticsPage.jsx` | OK |
| PATCH `/peer-review/appeals/:appealId` | `InstructorAnalyticsPage.jsx` | OK |

### 2.11 Rubrics

| Backend endpoint | Frontend usage | Status |
|------------------|----------------|--------|
| GET `/rubrics` | `RubricPanel.jsx`, `InstructorAnalyticsPage.jsx` | OK |
| POST `/rubrics` | `InstructorAnalyticsPage.jsx` | OK |

### 2.6 Checkins

| Backend endpoint | Frontend usage | Status |
|------------------|----------------|--------|
| GET `/checkins/context` | `StudentCheckinsPage.jsx` | OK |
| POST `/checkins/self` | `StudentCheckinsPage.jsx` | OK |

### 2.7 Enrollments

| Backend endpoint | Frontend usage | Status |
|------------------|----------------|--------|
| GET `/enrollments` | `EnrollmentManagementPage.jsx` | OK |
| POST `/enrollments` | `EnrollmentManagementPage.jsx` | OK |
| PATCH `/enrollments/:enrollmentId` | `EnrollmentManagementPage.jsx` | OK |
| DELETE `/enrollments/:enrollmentId` | `EnrollmentManagementPage.jsx` | OK |
| GET `/enrollments/course/:courseId/members` | `EnrollmentManagementPage.jsx` (when filtering by course) | OK |

### 2.8 AI

| Backend endpoint | Frontend usage | Status |
|------------------|----------------|--------|
| POST `/api/ai/feedback` | `ViewReviewPage.jsx`, `ReviewPage.jsx` | OK |
| GET `/api/ai/feedback/:reviewId` | `ViewReviewPage.jsx` (preload cache), `ReviewPage.jsx` (preload cache) | OK |
| POST `/api/ai/rewrite` | `ReviewPage.jsx` | OK |
| GET `/api/ai/rewrite/:reviewId` | `ReviewPage.jsx` (preload cache) | OK |
| PATCH `/api/ai/rewrite/:reviewId/adopt` | `ReviewPage.jsx` | OK |
| POST `/api/ai/polish` | `PeerReviewFormPage.jsx` | OK |
| POST `/api/ai/summarize` | `ViewReviewPage.jsx` | OK |
| GET `/api/ai/logs` | `InstructorDashboardPage.jsx` | OK |
| GET `/api/ai/search` | `HeaderSearchBar.jsx` | OK |

### 2.9 Notifications

| Backend endpoint | Frontend usage | Status |
|------------------|----------------|--------|
| GET `/notifications` | `NotificationBell.jsx` | OK |
| GET `/notifications/unread-count` | `NotificationBell.jsx` | OK |
| PATCH `/notifications/read-all` | `NotificationBell.jsx` | OK |
| PATCH `/notifications/:id/read` | `NotificationBell.jsx` | OK |

### 2.10 Other

| Backend endpoint | Description | Status |
|------------------|-------------|--------|
| GET `/uploads/:filename` | Used indirectly via `file_url` in links/iframes | OK |
| GET `/healthz` | Health check; ops/monitoring | OK (expected) |
| GET `/api-docs/openapi.yaml` | OpenAPI spec | OK (expected) |

---

## 3. Previously “Unused” Endpoints Now Wired

The following three endpoints are now used by the frontend:

| Endpoint | Frontend usage |
|----------|----------------|
| **GET `/api/ai/feedback/:reviewId`** | **ReviewPage**: preload cached AI feedback for the review on enter; **ViewReviewPage**: after loading reviews, preload cached AI feedback per review into the feedback area. |
| **GET `/api/ai/rewrite/:reviewId`** | **ReviewPage**: preload cached AI rewrite for the review on enter; user can adopt or edit from it. |
| **GET `/enrollments/course/:courseId/members`** | **EnrollmentManagementPage**: when a course is selected in the “Filter by course” dropdown, request this endpoint for that course’s members and show them in the table (replacing client-only filter); “All Courses” still uses GET `/enrollments` for the full list. |

---

## 4. Frontend Config and Proxy

- **Development**: `API_BASE_URL` in `config.js` is empty; Vite proxy (`vite.config.js`) forwards `/auth`, `/submissions`, `/reviews`, `/instructor`, `/peer-review`, `/checkins`, `/enrollments`, `/api/ai`, `/notifications`, `/uploads`, `/healthz` to `http://localhost:8080`. Frontend–backend connection works.
- **Production**: Set `VITE_API_URL` to the backend origin (e.g. `https://api.example.com`) and ensure Nginx (or equivalent) forwards the same paths to the backend; otherwise the app may fail to reach the backend. See `DEPLOYMENT.md`.

---

## 5. Conclusion

- **All major user-facing features are correctly connected** between frontend and backend; no blocking path/method mismatch was found.
- The three previously unused endpoints (GET AI feedback/rewrite, GET course members) are now wired; see Section 3.
- For production, ensure `VITE_API_URL` and Nginx (or equivalent) proxy match the backend.

*Report based on static inspection of the codebase (updated after functional expansion).*
