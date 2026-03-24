# Functional Improvements and Optimization Analysis

> This document analyzes the SDP Peer Review System from a **functional** perspective only: what can be improved, optimized, or added. It does not cover code quality, performance, or security, which are addressed in `IMPROVEMENT_AND_OPTIMIZATION_PLAN.md`.

---

## I. Functional Gap and Status Matrix (Updated)

| Item | Title | Status | Notes |
|------|-------|--------|-------|
| 1 | In-App Notification Creation Logic | **Done** | `review_received` / `review_assigned` / `deadline` / `ai_complete` and instructor announcement-based `system` notifications are implemented. |
| 2 | Student Submission Edit and Withdraw | **Done** | Student edit/withdraw implemented; file replacement endpoint added; course-level policy toggle supports edit/withdraw after reviews. |
| 3 | Peer Review Session Edit (Title, Deadline) | **Done** | `PATCH /peer-review/sessions/:sessionId` supports `title`, `deadline`, and `is_open` updates with validation. |
| 4 | Review Draft / Progress Save | **Done** | Local draft plus backend draft persistence implemented for file-review and peer-review forms. |
| 5 | Bulk Assign Reviews (Instructor) | **Done** | Bulk assign API and instructor dashboard multi-select workflow implemented. |
| 6 | Duplicate / Clone Peer Review Session | **Done** | Session duplicate endpoint + UI action implemented. |
| 7 | Associate Submission with Course / Assignment | **Done** | Course dropdown + assignment template entity implemented; submissions can link to `assignment_template_id`. |
| 8 | Instructor Dashboard and Analytics Filters | **Done** | Course/group/date-range filter UI wired to instructor APIs and exports. |
| 9 | Anonymous Review Option | **Done** | Anonymous view/export option available in peer-review results/export flows. |
| 10 | Configurable Rubric | **Done** | Rubric API + instructor management UI + frontend dynamic rubric loading implemented. |
| 11 | Clarification / Appeal After Score Release | **Done** | Appeal table, student submit/list, instructor processing and reply workflow implemented. |
| 12 | Data Export Enhancements | **Done** | Filtered and anonymized exports plus unified Export Center page are implemented. |
| 13 | Email / Browser Push (Optional) | **Done** | Notification preferences, SMTP email channel, browser push subscription, and push delivery pipeline are implemented. |
| 14 | Student “My Grades” Summary | **Done** | `/submissions/my-grades` + dedicated student page and sidebar entry implemented. |

---

## II. Functional Backlog Details (Still Useful for Next Iterations)

> Note: The detailed sections below keep the original recommendation wording for context. Use the status matrix in Section I as the source of truth for what is already implemented vs. still pending.

### 1. In-App Notification Creation Logic

**Current state**: The `notifications` table exists and the API supports listing, unread count, and mark-as-read. However, **the backend never inserts rows into this table when business events occur**.

**Impact**: The notification types described in the user guide and README (`review_received`, `review_assigned`, `deadline`, `ai_complete`, `system`) never produce new notifications; the bell stays empty unless data is inserted manually or via seed.

**Recommendations**: Insert notifications at key business points, for example:

- **Review received**: When someone submits a review for a submission, insert `review_received` for the submission author.
- **Review assigned**: When an instructor manually assigns or the system auto-assigns a reviewer, insert `review_assigned` for the assigned reviewer.
- **Deadline reminder**: Via a scheduled job or lazy check, insert a `deadline`-type notification for students who have not yet submitted peer reviews 24h or 1h before the session deadline.
- **AI complete**: When async AI feedback/rewrite/summarize results are ready, insert `ai_complete` for the user (can be skipped if the flow is currently synchronous).
- **System announcement**: Reserve the `system` type for admin or instructor announcements to the class or site.

Keep notification insertion in a small set of helpers for easier maintenance and access control.

---

### 2. Student Submission Edit and Withdraw

**Current state**: Once a submission is uploaded, it cannot be modified or deleted. There is no `PATCH /submissions/:id` or `DELETE /submissions/:id` from the student’s perspective.

**Impact**: If a student uploads the wrong file, mistypes the title, or wants to withdraw and resubmit, they must contact the instructor or rely on unimplemented “delete” behavior.

**Recommendations**:

- **Edit**: Allow students to update title and description (and optionally replace the file, with type/size checks) when there are no associated reviews yet, or when the instructor allows “editable before deadline”.
- **Withdraw**: Allow students to withdraw a submission when “not yet reviewed” or when “instructor allows withdraw”. Backend can soft-delete or set status to withdrawn and handle existing assignments (cancel or keep per policy).

This can be optional and controlled by the instructor in “course/assignment settings” (e.g. “Allow students to edit/withdraw”).

---

### 3. Peer Review Session Edit (Title, Deadline)

**Current state**: After creating a session, only the existing PATCH endpoints can **toggle** `is_open` and **release/hide** `scores_released`. The `title` and `deadline` cannot be updated.

**Impact**: If the instructor mistypes the session name or needs to extend the deadline, they must create a new session or live with the mistake.

**Recommendations**: Add or extend `PATCH /peer-review/sessions/:sessionId` so instructors can update `title` and `deadline` (optional). Suggested rules:

- If the session is already closed or has submissions, allow only extending `deadline` (not shortening) or only changing the title.
- Add an “Edit” entry in the “Manage Sessions” list (modal or inline) for title and deadline.

---

### 4. Review Draft / Progress Save

**Current state**: File review (ReviewPage) and the Peer Review form (PeerReviewFormPage) are both one-shot submit flows with no “Save draft” or “Finish later”.

**Impact**: If a student leaves midway (network loss, closed tab, accidental back), their input is lost and must be re-entered, hurting experience and completion rates.

**Recommendations**:

- **File review**: Either (1) add a draft field or draft table for the assignment and POST draft from the frontend periodically or on blur, or (2) persist draft only in frontend localStorage so the same device can restore on refresh (no cross-device).
- **Peer review form**: The backend already supports upsert (resubmit to overwrite). Add a “Save draft” flow: save current scores and comments to a backend draft store; the student can save multiple times before the session closes, then click “Submit” to finalize. Clearly distinguish “draft” vs “submitted” so incomplete submissions are not treated as submitted after the deadline.

---

## III. Feature Enhancements (Strengthen Existing Features)

### 5. Bulk Assign Reviews (Instructor)

**Current state**: Instructors can only assign **one** reviewer to **one** submission at a time in the Dashboard Submissions table. The backend already auto-assigns on upload (by course, cross-group preferred, load-balanced).

**Impact**: With many submissions, assigning one-by-one is slow; there is no way to “assign N reviewers to each of the selected submissions” in one action.

**Recommendations**:

- **Bulk assign**: Allow selecting multiple submissions and an action like “Assign 1 (or 2) reviewer(s) to each selected submission”. Backend runs the existing assignment policy for each and returns success/failure per row.
- **One-click fill**: A button “Auto-assign reviewers for all submissions that do not yet meet the target count”, reusing the current auto-assign logic only for under-assigned submissions.
- Keep the current per-row “Assign” UI and add multi-select plus a bulk actions bar.

---

### 6. Duplicate / Clone Peer Review Session

**Current state**: Each new term or round requires re-entering session name, deadline, course, etc.; there is no way to copy from an existing session.

**Recommendation**: Add a “Duplicate session” action that copies only metadata (title, course_id, deadline, etc.), not submitted peer review data. The new session is created closed; the instructor can adjust title and deadline and then open it. This allows reusing a previous round as a template.

---

### 7. Associate Submission with “Course / Assignment”

**Current state**: Upload uses the current user’s `course_id` (and enrollment) for auto-assign and visibility, but the upload form does **not** let the student choose “which course/assignment this submission is for”. In multi-course setups, instructor filtering relies on enrollment and submission indirectly.

**Impact**: A student in multiple courses cannot explicitly choose “Assignment A” vs “Assignment B”; instructors cannot cleanly filter or report by assignment without extra fields or title conventions.

**Recommendations**:

- If the system introduces an “assignment (template)” entity: let the student choose “Course + Assignment” on upload and link the submission to that assignment in the backend.
- If not: at least add a “Course” dropdown on the upload form (from the user’s enrollments), send `course_id` with the submission, and persist it (submission table or join). Backend already has course-scoped logic; this mainly adds frontend and schema (migration if `submissions` has no `course_id`).

---

### 8. Instructor Dashboard and Analytics Filters

**Current state**: Dashboard, Overview, and Analytics already support query params like `course` and `group`, but the frontend may not expose them as filters everywhere.

**Recommendation**: Add a consistent filter UI (course, group, date range) on the instructor side so all lists and charts respect the same filters for “this course / this group / this week” analysis and export. Together with item 7, this can support “by assignment” filtering when that dimension exists.

---

## IV. New Feature Suggestions (Experience or Pedagogical Value)

### 9. Anonymous Review Option

**Current state**: Peer review results are privacy-isolated for students (they see only their own aggregate scores), but instructors see who gave which score. Some courses want fully anonymous peer review.

**Recommendation**: Add an “Anonymous peer review” option at session or system level. When enabled, the instructor view (results/raw data) anonymizes reviewers (e.g. “Reviewer #1”). CSV export can offer an anonymous option. This does not change RLS or aggregation, only display and export.

---

### 10. Configurable Rubric

**Current state**: File review and peer review score levels (e.g. 1–5, Excellent→Poor) and descriptions are mostly hardcoded or fixed constants in the frontend.

**Recommendation**: Allow instructors to define rubrics (labels and descriptions per level), bound to a course or session. The frontend loads the rubric from the API and renders it so different courses can have different criteria aligned with the syllabus.

---

### 11. Clarification / Appeal After Score Release

**Current state**: Students can only view released aggregate scores and comments on “View Scores”; they cannot ask for clarification or appeal a specific comment or score.

**Recommendation**: Optional feature — students can submit a “Request clarification” or “Appeal” for a peer review or comment. Instructors see a list and can reply or mark “Resolved”. Implementation can be a simple table (appeal id, session, submitter, target review/comment, status, instructor reply). Add a “Request clarification” entry on “View Scores” or a dedicated page. This does not change score computation, only adds communication and traceability.

---

### 12. Data Export Enhancements

**Current state**: Roster CSV, file review CSV, and peer review aggregate CSV exports exist.

**Recommendations**:

- **Export by time range / course / session**: All export entry points support filters for time range, course, and single session for archiving or term-level reports.
- **Anonymized export**: For research or external reporting, support “anonymized export” (remove names, IDs, etc.; keep IDs or random codes) to meet common ethics requirements.
- **Unified “Export center”**: A single “Export / Reports” page for instructors listing all export types and options to reduce cognitive load.

---

### 13. Email / Browser Push (Optional)

**Current state**: Notifications are in-app only (bell + list); no email or push.

**Recommendation**: After in-app notifications are implemented (item 1), optionally add:

- **Email**: For key types (e.g. review_assigned, deadline reminder, scores_released), send a short email with a link back to the app if the user has a verified email and has opted in. Requires SMTP or a third-party email service.
- **Browser push**: Use the Web Push API so that, after user consent, important notifications can be delivered even when the tab is closed. Backend maintains VAPID and subscription table; frontend requests permission and uploads subscription on a settings page.

Both can be controlled via a “Notification preferences” page (per-type: in-app / email / push).

---

### 14. Student “My Grades” Summary

**Current state**: Students have “View Scores” for a single peer review session and an average file review score on the Dashboard, but no **summary page** listing all released peer review scores and file review grades for the course (or all courses) in a list or timeline.

**Recommendation**: Add a “My Grades” or “Grade History” page that lists released peer review results and file review averages by time or session so students can review and archive.

---

## V. Priority Suggestions (Functional Dimension, Updated)

| Priority | Remaining Item | Notes |
|----------|----------------|-------|
| Medium | Notification reliability hardening | Add queue/retry/dead-letter/metrics for email/push delivery |
| Medium | Assignment template lifecycle UX | Add richer template editing and archival workflow |
| Low | Policy granularity | Extend submission policy to assignment-template scope (not only course scope) |

---

## VI. Relation to Other Docs

- **IMPROVEMENT_AND_OPTIMIZATION_PLAN.md**: Focuses on bugs, security, performance, code quality, testing, CI, and documentation; this analysis **only** adds functional recommendations.
- **USER_GUIDE.md**: Describes current usage; once any recommendation here is implemented, update the user guide and README Features list accordingly.

This document is now both a functional recommendation list and a progress ledger. Keep the status matrix updated when related backend/frontend features change.
