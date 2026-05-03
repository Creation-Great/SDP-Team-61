# User Guide

> Walkthroughs for **students**, **instructors**, **TAs**, and **admins** using the SDP Peer Review System.

This guide is structured around the 33 pages currently shipped by the frontend ([`frontend/src/App.jsx`](../frontend/src/App.jsx)). For an architectural view, read [ARCHITECTURE.md](ARCHITECTURE.md). For API access, read [API.md](API.md).

---

## 1. Getting Started

### 1.1 System requirements

- A modern desktop or mobile browser (Chrome, Firefox, Edge, Safari).
- JavaScript enabled.
- Network access to the deployment URL.

### 1.2 Sign in

| Mechanism | When to use |
|-----------|-------------|
| Email + password (`/login`) | Local development; demo accounts in [DATABASE.md §10](DATABASE.md#10-operational-notes). |
| **Sign in with UConn NetID** (CAS) | Production. Click the SSO button on `/login`. |
| Self-registration (`/register`) | Local dev only. Admin accounts cannot self-register. |

The platform issues a JWT cookie on sign-in. Sessions last 30 days unless revoked. Click the user menu → *Log out* to revoke immediately.

### 1.3 Navigation overview

After sign-in, the layout is:

```
┌────────────┬───────────────────────────────────────────────┐
│  Sidebar   │  Header (search · notification bell · user)   │
│            ├───────────────────────────────────────────────┤
│  Menu      │                                               │
│            │     Main content (per-page)                   │
│            │                                               │
└────────────┴───────────────────────────────────────────────┘
```

- **Sidebar** menu items depend on your role. Click the `☰` button on small screens to toggle.
- **Header search** (top centre) does global search across submissions and users.
- **Notification bell** polls every 30 s and shows unread count plus a dropdown.
- **User menu** displays your name and role.

Every section has its own error boundary — if one part of the page fails, the rest of the application keeps working.

---

## 2. Roles and what they can do

| Role | Sees | Can change |
|------|------|------------|
| **Student** | Own submissions, assigned reviews, released scores, calendar, grades, AI chat, notifications, preferences | Own submissions; reviews assigned to them; own self-checkins; own preferences |
| **TA** | Same reads as instructor for the courses they assist | Cannot create new peer-review sessions |
| **Instructor** | Everything inside courses they teach | Sessions, rubrics, grade weights, anonymity, deadlines, LMS config, announcements, similarity reports for their courses |
| **Admin** | All courses (bypasses course-ownership checks); audit log | Anything an instructor can plus the audit viewer and account-deletion approvals |

Course access is enforced at the API layer by `verifyCourseAccess()` and `verifySessionAccess()` ([`backend/src/utils/enrollment.ts`](../backend/src/utils/enrollment.ts)).

---

## 3. Student Walkthrough

### 3.1 Dashboard (`/dashboard` → `StudentDashboardPage`)

Lands here after sign-in (unless your primary role is instructor or admin). Shows submission counts, pending review tasks, recent activity, and the next upcoming deadline.

### 3.2 Submit work (`/upload` → `UploadAssignment`)

1. Choose a course (only courses you're enrolled in are listed).
2. (Optional) Pick an assignment template — fills in title and due date.
3. Drag-and-drop or click to upload. Default size cap is 10 MiB; oversized uploads return `413`.
4. Provide a title (required) and description (optional).
5. Click **Submit**.

Allowed file types are configured server-side and validated by magic-byte check, not just extension.

After upload, the file is stored under `UPLOAD_DIR` (or your configured object store) and an `assignments` row is created when the instructor or auto-strategy assigns reviewers.

### 3.3 Edit / replace / withdraw a submission

Open an existing submission from the dashboard. Depending on the per-course `submission_policies.allow_edit_withdraw_after_reviews` flag and whether reviews already exist, you can:

- Edit title and description (`PATCH /submissions/:id`).
- Replace the file (`PATCH /submissions/:id/replace-file`).
- Withdraw (`DELETE /submissions/:id`).

### 3.4 Assigned reviews (`/reviews` → `AssignedReviewsPage`)

Lists every assignment with status `pending`. Each row links to:

- **Review** (`/review/:id` → `ReviewPage`): score 1-5, comments, optional rich-text formatting via TipTap. Drafts auto-save with conflict detection (`draft_version`).
- **View Review** (`/view-review/:submissionId` → `ViewReviewPage`): a read-only summary if you're the submission owner.

Click **Submit** when finished. AI-powered tools available inside the review form:

| Tool | Action |
|------|--------|
| AI Feedback | Toxicity / politeness / sentiment scoring of your draft. |
| AI Polish | Tighten grammar and clarity. |
| AI Rewrite | Suggested rewrite; *Adopt* replaces your text. |

### 3.5 Peer review sessions (`/peer-review` → `PeerReviewSessionsPage`)

Lists every session in your enrolled courses. Click a session to:

| Path | Page | Purpose |
|------|------|---------|
| `/peer-review/:sessionId` | `PeerReviewFormPage` | Score each teammate (3 dimensions, 1-5) plus team-chemistry, plus optional comments. Self-review is enabled when you appear in your own team. |
| `/peer-review/:sessionId/my-scores` | `StudentScoresPage` | View released scores once the instructor releases them. |

The form auto-saves to `peer_review_drafts`. You see only your own released scores (other students filtered server-side).

### 3.6 Weekly check-ins (`/student/checkins` → `StudentCheckinsPage`)

Per-week self-evaluation across the topics your instructor configured. Each row scopes by `(course_id, group_id)`.

### 3.7 Grades (`/my-grades` → `StudentGradesPage`)

Read-only consolidation of file-review and released peer-review grades, weighted by the per-course `grade_weights`. Supports drop-lowest / drop-highest if configured.

### 3.8 Calendar (`/calendar` → `CalendarPage`)

Aggregates session deadlines, assignment-template due dates, and any individual extensions granted to you.

### 3.9 Revision history (`/submissions/:id/revisions` → `RevisionHistoryPage`)

If your submission was revised, this page shows the chain (`parent_submission_id`) and a diff between adjacent revisions.

### 3.10 AI chat (`/ai-assistant` → `AiChatPage`)

Multi-turn conversational AI with three context modes:

- **General** — open chat about coursework concepts.
- **Submission** — pinned to a specific submission for clarification questions.
- **Review** — pinned to a review for follow-up.

History is persisted to `ai_conversations`.

---

## 4. Instructor Walkthrough

### 4.1 Dashboard (`/instructor` → `InstructorDashboardPage`)

Combines stats, AI activity logs, live SSE events, and the latest submissions. The SSE stream connects to `/instructor/events` and re-establishes itself with exponential backoff on disconnect.

### 4.2 Manage peer review (`/instructor/peer-review` → `InstructorPeerReviewPage`)

Create and manage sessions:

1. **Create**: title, course, deadline (optional), open/closed flag, anonymity level (`none` / `single_blind` / `double_blind`).
2. **Edit / duplicate**: PATCH the session or POST `/duplicate` to clone as a template.
3. **Release scores**: PATCH `/release-scores` once aggregation is complete.
4. **Bulk reviewer assignment**: import a CSV or use the *Auto-assign* button which honours the configured `assignment_strategy`.

After students submit, drill into a session to see:

| Tab | Page route | Content |
|-----|------------|---------|
| Results | `/peer-review/:sessionId/results` (`PeerReviewResultsPage`) | Per-student aggregated scores, including team-chemistry deduplication. |
| Bias | (link inside Results) | Self-vs-peer flags where `|self − peer|` ≥ 1.0. |
| Quality flags | Analytics page | Identical-score patterns, suspiciously short comments. |
| Appeals | (link inside Results) | Open student appeals; reply or change status. |
| Instructor review | (button inside Results) | Score every teammate yourself in one form. |
| CSV export | (button inside Results) | Download the session CSV (formula-injection-safe). |

### 4.3 Analytics (`/instructor/analytics` → `InstructorAnalyticsPage`)

Score distribution, anomaly detection, file-review and peer-review quality flags, appeal queue, rubric editor, CSV export.

### 4.4 Advanced analytics (`/instructor/advanced-analytics` → `AdvancedAnalyticsPage`)

Heatmaps, radar charts, semester-wide activity trend, reviewer reputation breakdown.

### 4.5 Class check-ins (`/instructor/class-checkins` → `ClassCheckinsPage`)

Three tabs:

- **Insights** — aggregated metrics across teams.
- **Weekly Scores** — assign and review peer-review scores per week.
- **Students** — drill into individual students' check-in history.

### 4.6 Enrollments (`/instructor/enrollments` → `EnrollmentManagementPage`)

Add, edit, and remove enrollments. Each user can have multiple enrollments across courses; one is marked primary and synced into `users.course_id` / `users.group_id` automatically (trigger `sync_primary_enrollment`).

### 4.7 Assignment templates (`/instructor/assignment-templates` → `AssignmentTemplatesPage`)

Create reusable assignments scoped to a course (and optionally a semester). Templates are referenced by `submissions.assignment_template_id`.

### 4.8 Grade management (`/instructor/grades` → `GradeManagementPage`)

- Set per-course **weight** for file reviews / peer reviews / check-ins (default 40 / 40 / 20).
- Configure **drop-lowest / drop-highest**.
- View **final calculated grades** (`GET /grades/final/:courseId`).
- Export CSV (rate-limited 10 req/h, formula-injection-safe).

### 4.9 LMS integration (`/instructor/lms` → `LmsConfigPage`)

Mock LTI 1.3 integration. Configure consumer key / shared secret, then trigger:

- **Launch** — simulated LTI launch flow.
- **Grades** — passback final grades to the LMS.
- **Roster** — sync class roster.

In the shipped build the LMS provider is mocked; outgoing payloads are logged for inspection.

### 4.10 Semester management (`/instructor/semesters` → `SemesterManagementPage`)

CRUD over `semesters` plus a *Clone course* action that copies enrollments, sessions, and templates from a source course into a target semester.

### 4.11 Similarity dashboard (`/instructor/similarity` → `SimilarityDashboardPage`)

Course-wide TF-IDF cosine similarity and a mock Turnitin score for each pair of submissions. Per-submission report at `/similarity/report/:submissionId`.

### 4.12 Export centre (`/instructor/exports` → `ExportCenterPage`)

One-stop CSV exports: file-review, peer-review per session, grades.

---

## 5. Admin Walkthrough

### 5.1 Audit log (`/admin/audit` → `AuditLogPage`)

Filter and search the `audit` table. Every privileged action records an event row with `actor`, `action`, `entity`, `entity_id`, and a free-form `meta_json`.

### 5.2 Compliance / data export

The student-facing **Data Export** page (`/settings/data-export` → `DataExportPage`) lets any user export their own data. Admins can run exports on behalf of any user via the API. Account-deletion requests submitted via the same page appear in the admin queue and require an admin to action them.

### 5.3 Course-ownership bypass

Admins implicitly pass `verifyCourseAccess()` and `verifySessionAccess()`. There is no separate admin UI for course management — all instructor pages work for admins across every course.

---

## 6. Shared Pages (any role)

| Path | Page | Purpose |
|------|------|---------|
| `/settings/notifications` | `NotificationPreferencesPage` | Toggle in-app / email / push per notification type. |
| `/settings/preferences` | `UserPreferencesPage` | Theme (light / dark), font size, high-contrast mode. |
| `/settings/data-export` | `DataExportPage` | GDPR-style export and deletion request. |

---

## 7. AI Features

The AI service is invoked through the backend; nothing in the browser talks to it directly. All AI operations are rate-limited (300 req/min default per endpoint, tighter on heavy ones).

| Feature | Where it shows up | What it does |
|---------|-------------------|--------------|
| AI Feedback | Inside a review form | Toxicity (0-1), politeness (0-1), sentiment, identity / evidence spans |
| AI Rewrite | Inside a review form | Generates an alternative wording you can adopt |
| AI Polish | Inside a review or comment editor | Light grammar / clarity edit |
| AI Summarize | Instructor results page | Aggregated summary of a session's comments |
| AI Score Suggestion (Beta) | Inside instructor scoring | Suggests a score range with reasoning |
| AI Calibration (Beta) | Bias analytics | Flags reviewer scores deviating from peer average |
| AI Review Depth (Beta) | Quality flags | Constructiveness / specificity / actionability scores |
| AI Chat (Beta) | `/ai-assistant` | Multi-turn conversation in 3 context modes |
| Similarity (Beta, mock Turnitin available) | `/instructor/similarity` | TF-IDF cosine similarity reports |

When the AI service is not configured (`AI_API_KEY` missing), every AI button fails with a friendly error rather than a crash.

---

## 8. Notifications

| Type | Triggered by | Default channels |
|------|-------------|------------------|
| `review_assigned` | Reviewer assignment | in-app |
| `review_received` | A review is submitted on your work | in-app |
| `submission_graded` | Final grade released | in-app |
| `announcement` | Instructor posts an announcement | in-app |
| `deadline_approaching` | Reminder scheduler (configurable hours before) | in-app |
| `similarity_alert` | High-similarity report | in-app |
| `grade_released` | Instructor releases peer-review scores | in-app |
| `extension_granted` | Instructor grants an individual extension | in-app |
| `reminder` | Generic reminder | in-app |

Configure per-type channels (in-app / email / push) at `/settings/notifications`. Web Push requires you to allow notifications when prompted; the VAPID public key is fetched from `/notifications/push/public-key`.

---

## 9. Accessibility

- WCAG 2.1 *Skip to main content* link exposed when the main region is focused.
- Keyboard navigation: `Tab` cycles focus; `Esc` closes modals; tables expose horizontal scrolling for narrow viewports.
- Per-section error boundaries — a single broken widget does not take down the page.
- High-contrast and large-font modes at `/settings/preferences`.
- Light and dark themes, both designed intentionally.
- Reduced-motion is respected — animations honour the OS preference.

---

## 10. Troubleshooting

| Symptom | Probable cause | Fix |
|---------|---------------|-----|
| "Session expired" loop | JWT secret rotated or cookie domain mismatch | Sign in again |
| AI button greys out, error mentions `not_configured` | AI service is up but `AI_API_KEY` is unset | Contact your admin |
| Notifications never arrive | Browser blocked notifications, or service worker not registered | Re-enable in browser settings; reload page |
| Peer-review form will not submit | Cookie identity mismatch detected (e.g. logged in as someone else in another tab) | Reload the page; you'll be re-validated |
| Calendar shows no items | No deadlines or extensions exist for your enrolled courses | Confirm you're enrolled in the right course |
| Sidebar shows a different role's items | Stale auth context | Log out and log back in |
| Submission disappears on Internet Explorer | IE is unsupported | Use a modern browser (Chrome / Firefox / Edge / Safari) |

For deeper issues, contact your instructor (or the admin) with the `X-Request-Id` from the browser network tab — it lets the operator find your request in the server logs.

---

## 11. References

- Frontend routes: [`frontend/src/App.jsx`](../frontend/src/App.jsx)
- Sidebar menu: [`frontend/src/components/Sidebar.jsx`](../frontend/src/components/Sidebar.jsx)
- API client: [`frontend/src/services/api.js`](../frontend/src/services/api.js)
- API reference: [API.md](API.md)
- System architecture: [ARCHITECTURE.md](ARCHITECTURE.md)
