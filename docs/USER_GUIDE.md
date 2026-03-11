# SDP Peer Review System — User Guide

> A comprehensive guide for **students**, **instructors**, and **administrators** using the AI-enhanced Peer Review platform.

---

## Table of Contents

1. [Getting Started](#1-getting-started)
   - [System Requirements](#system-requirements)
   - [Logging In](#logging-in)
   - [Navigation Overview](#navigation-overview)
2. [Student Guide](#2-student-guide)
   - [Dashboard](#student-dashboard)
   - [Submitting Assignments](#submitting-assignments)
   - [Completing Assigned Reviews](#completing-assigned-reviews)
   - [Peer Review Sessions](#peer-review-sessions-student)
   - [Self-Review](#self-review)
   - [Viewing Your Released Scores](#viewing-your-released-scores)
   - [Weekly Check-ins](#weekly-check-ins-student)
   - [Using AI Tools](#using-ai-tools-student)
   - [Notifications](#notifications)
3. [Instructor Guide](#3-instructor-guide)
   - [Dashboard & Real-Time Events](#instructor-dashboard)
   - [Managing Peer Review Sessions](#managing-peer-review-sessions)
   - [Reviewing Session Results](#reviewing-session-results)
   - [Releasing Scores](#releasing-scores)
   - [Self-Score Bias Analytics](#self-score-bias-analytics)
   - [Instructor Review (All Students)](#instructor-review-all-students)
   - [Review Quality Flags](#review-quality-flags)
   - [Analytics & CSV Export](#analytics--csv-export)
   - [Class Check-ins Management](#class-check-ins-management)
   - [Enrollment Management](#enrollment-management)
   - [Weekly Scoring & CSV Import](#weekly-scoring--csv-import)
   - [AI Activity Logs](#ai-activity-logs)
4. [AI Features](#4-ai-features)
   - [AI Feedback](#ai-feedback)
   - [AI Rewrite](#ai-rewrite)
   - [AI Polish](#ai-polish)
   - [AI Summarize](#ai-summarize)
5. [Accessibility](#5-accessibility)
6. [Troubleshooting](#6-troubleshooting)

---

## 1. Getting Started

### System Requirements

- A modern web browser (Chrome, Firefox, Edge, or Safari)
- JavaScript enabled
- Internet connection (or local network access if self-hosted)

### Logging In

1. Navigate to the application URL (e.g., `http://localhost:5173` for local development).
2. You will see the **Login** page with the UConn Blue themed interface.
3. Enter your **email** and **password**, then click **Sign In**.
   - For university deployments, click **Sign in with UConn NetID** to use CAS single sign-on (SSO).
   - For local development, use the seed accounts:
     | Email | Role | Password |
     |-------|------|----------|
     | `instructor@example.com` | Instructor | `password123` |
     | `alice@example.com` | Student | `password123` |
     | `bob@example.com` | Student | `password123` |
     | `carol@example.com` | Student | `password123` |

4. If you don't have an account, click **Create an account** to register (local development only; production uses CAS SSO).

### Navigation Overview

After logging in, the application displays a **collapsible sidebar** on the left and a **header bar** at the top.

#### Sidebar Menu — Student View
| Menu Item | Description |
|-----------|-------------|
| **Dashboard** | Overview of your submissions and review stats |
| **Submit Work** | Upload new assignments for review |
| **Assigned Reviews** | View and complete review tasks assigned to you |
| **Peer Review** | Participate in peer review sessions |
| **Weekly Check-ins** | Submit weekly self and team check-ins |

#### Sidebar Menu — Instructor View
| Menu Item | Description |
|-----------|-------------|
| **Overview** | Dashboard with stats, live events, AI activity |
| **Manage Sessions** | Create and manage peer review sessions |
| **Weekly Scoring** | Manage weekly peer review scores and CSV import |
| **Review Analytics** | Score distributions, quality flags, anomaly detection |
| **Student Check-ins** | View and manage student weekly check-ins |
| **Enrollments** | Manage course enrollments and team assignments |

#### Header Bar
- **Search bar** (magnifying glass icon): Full-text search across submissions and users
- **Notification bell**: Shows unread notification count; click to see recent notifications
- **User menu**: Displays your name and role; click to log out

> **Tip:** Click the hamburger icon (☰) at the top of the sidebar to collapse/expand it.

---

## 2. Student Guide

### Student Dashboard

After logging in as a student, you land on the **Dashboard** page, which shows:

- **Your Submissions**: A list of all assignments you've submitted, with status indicators (reviewed, pending, etc.)
- **Average Score**: Your average file review score across all reviewed submissions
- **Review Tasks**: The number of assigned reviews you still need to complete
- **Recent Activity**: Your latest submissions and reviews

### Submitting Assignments

1. Click **Submit Work** in the sidebar.
2. Fill in the assignment details:
   - **Title**: A descriptive title for your submission
   - **Course**: Your enrolled course (auto-filled if you have one enrollment)
   - **File**: Click **Choose File** to select your assignment file (accepted formats: PDF, ZIP, TXT, etc.)
3. Click **Upload** to submit.
4. You'll see a success message, and the submission will appear on your Dashboard.

> **File size limit**: Files must not exceed the configured maximum (typically 10 MB). Only valid file types are accepted (the server verifies via magic-byte checks).

### Completing Assigned Reviews

1. Click **Assigned Reviews** in the sidebar.
2. You'll see a list of review tasks assigned to you, each showing the submission title, author, and due status.
3. Click a review task to open the **Review Page**.
4. On the Review Page:
   - **View the submission**: The submitted file is displayed or available for download.
   - **Score selector**: Rate the submission from 1–5 using the accessible score buttons.
     - A **Rubric Panel** is available next to the score selector — click **Show Rubric** to expand detailed scoring criteria:
       | Score | Level | Description |
       |-------|-------|-------------|
       | 5 | Excellent | Exceeds expectations in all areas |
       | 4 | Good | Meets expectations with minor issues |
       | 3 | Satisfactory | Meets basic requirements |
       | 2 | Needs Improvement | Below expectations in several areas |
       | 1 | Poor | Does not meet minimum requirements |
   - **Comments**: Write detailed review comments in the text area.
   - **AI Tools** (if enabled): Use AI Feedback, AI Rewrite, or AI Polish to improve your review (see [AI Features](#4-ai-features)).
5. Click **Submit Review** to finalize.

> **Keyboard accessibility**: Use arrow keys to navigate between score options, and Enter/Space to select.

### Peer Review Sessions (Student)

1. Click **Peer Review** in the sidebar.
2. You'll see a list of active peer review sessions created by your instructor.
3. Each session shows:
   - **Session title** and creator
   - **Status**: Open (accepting submissions) or Closed
   - **Deadline**: If set, a live countdown timer shows remaining time
   - **Your status**: Whether you've already submitted reviews
   - **Scores Released**: If the instructor has released scores, a **View Scores** button appears
4. Click a session to open the **Peer Review Form**.
5. On the Peer Review Form page:
   - Your **teammates** are listed (determined by your team/group enrollment).
   - **Including yourself** — you can (and should) review yourself (see [Self-Review](#self-review)).
   - For each teammate (and yourself), rate three categories on a 1–5 scale:
     - **Technical Contributions**: Quality and quantity of technical work
     - **Team Interactions**: Communication, collaboration, and responsiveness
     - **Project Management**: Task planning, time management, and organization
   - Each category has a **Rubric Panel** — click **Show Rubric** to see detailed level descriptions.
   - **Individual Comments**: Write specific comments for each person.
   - **Team Chemistry**: Rate your overall team's collaboration on a 1–5 scale.
6. Click **Submit Peer Reviews** to finalize all reviews at once.

> **Important**: You can re-submit to update your reviews while the session is open. Once the session closes (manually or via deadline), no further changes are accepted.

### Self-Review

- When completing peer reviews, **you will see your own name** in the teammate list.
- Your self-review is automatically tagged with a blue **"Self"** badge.
- Rate yourself honestly using the same 1–5 scale for all three categories.
- The `is_self` flag is set automatically — you don't need to do anything special.
- Your instructor can view self-review data separately and compare it with how your peers rated you via the **Bias Analytics** feature.

### Viewing Your Released Scores

Once your instructor releases scores for a session:

1. Go to **Peer Review** in the sidebar.
2. Sessions with released scores show a green **"View Scores"** button.
3. Click **View Scores** to open the **Student Scores Page**, which displays:
   - **Technical Contributions** average (out of 5.0)
   - **Team Interactions** average (out of 5.0)
   - **Project Management** average (out of 5.0)
   - **Team Chemistry** average (out of 5.0)
   - **Total reviews received** (including self-review count)
4. If scores are **not yet released**, you'll see a lock icon with the message: *"Your instructor has not released scores for this session yet. Check back later."*

> **Privacy**: You can only see your own aggregated scores. Individual reviewer identities and other students' scores are never visible to you.

### Weekly Check-ins (Student)

1. Click **Weekly Check-ins** in the sidebar.
2. You'll see a form to rate yourself and your teammates for the current week.
3. For each person (including yourself):
   - Rate their contribution on a 1–5 scale
   - Add optional comments
4. Click **Save Check-in** to submit.

### Using AI Tools (Student)

See the [AI Features](#4-ai-features) section for detailed instructions on:
- Getting AI feedback on your review writing
- Using AI to rewrite your comments
- Polishing your review text for grammar and clarity

### Notifications

- The **bell icon** in the header shows your unread notification count.
- Click the bell to open the **Notification Panel**, which lists:
  - **Review received**: Someone has reviewed your submission
  - **Review assigned**: A new review task has been assigned to you
  - **Deadline reminders**: Upcoming session deadlines
  - **AI complete**: Your AI analysis is ready
  - **System messages**: Announcements and system-level notifications
- Click a notification to mark it as read.
- Click **Mark all as read** to clear all unread notifications.
- Notifications refresh automatically every 30 seconds.

---

## 3. Instructor Guide

### Instructor Dashboard

After logging in as an instructor, you land on the **Overview** dashboard, which shows:

- **Stats Cards**: Total submissions, reviews, students, and active sessions
- **Weekly Trends**: Submissions and review activity trend chart
- **AI Activity Logs**: Recent AI usage (feedback, rewrite, polish, summarize) with user names and timestamps
- **Live Events Feed** (SSE):
  - A green **"Live"** badge with pulse animation indicates the real-time connection is active.
  - Events scroll in automatically as they occur:
    - 🟢 `submission_created` — A student uploaded an assignment
    - 🔵 `review_submitted` — A file review was submitted
    - 🟣 `peer_review_submitted` — A peer review was submitted
  - Each event shows the student name, action, and timestamp.

> **Real-time**: The dashboard uses Server-Sent Events (SSE). No need to refresh — new events appear instantly.

### Managing Peer Review Sessions

#### Creating a Session

1. Go to **Manage Sessions** in the sidebar or click **Peer Review** in the header.
2. Click **Create New Session**.
3. Fill in:
   - **Title**: e.g., "Sprint 3 Peer Review"
   - **Course**: Select the course (auto-filled if only one)
   - **Deadline** (optional): Set a date and time after which the session will auto-close
4. Click **Create**.
5. The session appears in the sessions list with status **Open**.

#### Opening / Closing a Session

- In the sessions list, use the **toggle button** to open or close a session.
- **Open**: Students can submit and update their peer reviews.
- **Closed**: No further peer review submissions are accepted.
- Sessions with a deadline will **auto-close** when the deadline passes (checked lazily on the next API access).

#### Session Table Columns

| Column | Description |
|--------|-------------|
| Title | Session name |
| Created By | Instructor who created the session |
| Status | Open / Closed badge |
| Progress | X/Y reviews submitted (e.g., "2/3") |
| Scores | Release/hide toggle button (instructor only) |
| Deadline | Countdown timer or "No deadline" |
| Actions | View Results, Open/Close toggle |

### Reviewing Session Results

1. From the sessions list, click **View Results** on a session.
2. The **Results Page** has multiple sections:

#### Submission Progress
- Shows which students have submitted reviews and which haven't.
- Completion percentage bar.

#### Averages per Student
- Table showing each student's aggregated scores:
  | Column | Description |
  |--------|-------------|
  | Team | Student's team/group |
  | Name | Student name |
  | Technical | Avg technical contributions score |
  | Interactions | Avg team interactions score |
  | Management | Avg project management score |
  | Chemistry | Avg team chemistry score |
  | Reviews | Number of reviews received |
- Supports **search** (by name or team) and **pagination**.

#### Raw Review Details (Collapsible)
- Click to expand the **Raw Review Details** section.
- Shows every individual review record:
  | Column | Description |
  |--------|-------------|
  | Team | Reviewer's team |
  | Reviewer | Who wrote the review |
  | Reviewee | Who was reviewed |
  | Self? | Y/N — indicates self-reviews |
  | Technical / Interactions / Management / Chemistry | Individual scores |
  | Comments | The reviewer's comments |
- Filter by team, search by name, or toggle **"Self-reviews only"** checkbox.

#### Export CSV
- Click **Export CSV** in the header to download all session data as a CSV file.

### Releasing Scores

This feature controls when students can see their peer review scores. By default, scores are **hidden**.

#### From the Sessions List Page
1. In the **Scores** column, click the **Release Scores** button (eye icon).
2. The button toggles to **Hide Scores** (eye-off icon) — click again to revoke access.
3. Students will see a **"View Scores"** button on their Peer Review page only when scores are released.

#### From the Results Page
1. Open a session's results.
2. At the top right, click the **Release Scores** button.
3. When released: button shows "Scores Released ✓" with a checkmark.
4. When hidden: button shows "Release Scores" — students see a lock icon.

> **Toggle behavior**: You can release and hide scores any number of times. Hiding scores immediately blocks student access, even if they previously viewed them.

### Self-Score Bias Analytics

This feature helps instructors identify students who score themselves significantly higher or lower than their peers rate them.

1. On the **Results Page**, scroll to the **Self-Score Bias Analytics** section (collapsible — click to expand).
2. The analytics table shows:

| Column | Description |
|--------|-------------|
| Team | Student's team |
| Student | Student name |
| Self Avg | Average score the student gave themselves |
| Peer Avg | Average score peers gave this student |
| Bias | Self Avg − Peer Avg (positive = inflated, negative = deflated) |
| Flag | Warning badge if \|bias\| ≥ 1.0 |

3. **Color coding**:
   - **Red text (+)**: Bias > +0.5 — student may be over-rating themselves
   - **Blue text (−)**: Bias < −0.5 — student may be under-rating themselves
   - **Amber highlight row**: |Bias| ≥ 1.0 — flagged for instructor attention
   - **⬆ Inflated** badge: Self-score significantly higher than peer score
   - **⬇ Deflated** badge: Self-score significantly lower than peer score
   - **"—"**: Displayed when the student did not submit a self-review

4. Students who didn't submit a self-review show "—" for Self Avg and Bias (no false 0.00 values).

> **Use case**: If Bob gives himself 5/5/5 but his peers rate him 3/4/3, the bias will be +1.67 and flagged with "⬆ Inflated", alerting you to a potential disconnect.

### Instructor Review (All Students)

This feature lets you (the instructor) review any and all students on a single page — not limited to team boundaries.

1. On the **Results Page**, scroll to the **Instructor Review (All Students)** section (collapsible — click to expand).
2. You'll see every student in the course listed, organized by team.
3. For each student:
   - Set scores (1–5) for **Technical Contributions**, **Team Interactions**, and **Project Management** using clickable numbered buttons.
   - Add optional **Comments** in the text field.
   - Active selections are highlighted in UConn Blue.
4. If you previously submitted instructor reviews, your existing scores and comments are **pre-filled automatically**.
5. Click **Submit Instructor Reviews** at the bottom to save.
6. Only students with at least one score filled in will be submitted.
7. Instructor reviews are included in the student's average scores (visible on the Student Scores page once released).

> **Note**: Instructor reviews use `is_self = false` and do not affect the bias analytics self-score calculation.

### Review Quality Flags

Quality flags help identify potentially low-effort reviews.

#### File Review Quality Flags
Navigate to **Review Analytics** → scroll to the **Quality Flags** section.

| Flag | Description |
|------|-------------|
| **Identical Scores** | A reviewer gave the same score to multiple different submissions |
| **Short Comments** | A review comment is less than 20 characters long |

#### Peer Review Quality Flags
Navigate to **Review Analytics** → scroll to the **Peer Review Quality Flags** section.

| Flag | Description |
|------|-------------|
| **Identical Likert Scores** | A reviewer gave the same score (e.g., all 5s) across all three categories (technical, teamwork, management) for a reviewee |
| **Short Individual Comments** | A peer review comment is less than 20 characters |

Each flag shows the reviewer name, reviewee name, and the specific issue. Use these to follow up with students about review quality.

### Analytics & CSV Export

Navigate to **Review Analytics** in the sidebar:

- **Score Distribution**: Histogram of all file review scores
- **Anomaly Detection**: Statistical outliers in scoring patterns
- **Roster CSV Export**: Download the full student roster as CSV
- **File Review CSV Export**: Download a per-submission breakdown of all file review scores as CSV (server-side generated)

### Class Check-ins Management

Navigate to **Student Check-ins** in the sidebar. This page has **3 tabs**:

| Tab | Description |
|-----|-------------|
| **Insights** | Comparison view of self vs. peer ratings with trends |
| **Weekly Scores** | Matrix view of all students' weekly scores with inline editing |
| **Students** | Student list with individual score history |

- **CSV Upload**: Click the upload area to import a CSV file of weekly scores. The system:
  - Auto-detects column mappings
  - Pre-fills scores for all students
  - If an **Individual Comments** column is present, automatically opens the Comments panel
- **Manual Entry**: Use the inline score editors to set or update individual scores

### Enrollment Management

Navigate to **Enrollments** in the sidebar:

1. View all enrolled students organized by course and team.
2. **Add Enrollment**: Click **Add** to enroll a student in a course with a specific team.
3. **Edit**: Change a student's team assignment or set a primary enrollment.
4. **Remove**: Delete an enrollment (with confirmation dialog).
5. Students automatically see teammates in peer review sessions based on their enrolled team.

### Weekly Scoring & CSV Import

Navigate to **Weekly Scoring** in the sidebar:

1. Upload **CSV files** with peer review scores from external sources.
2. The system aggregates the data with per-student and per-category breakdowns.
3. If the CSV contains an **Individual Comments** column, those comments are:
   - Extracted and displayed alongside scores
   - Included in the aggregate CSV export
4. Click **Download Aggregate CSV** to export the combined results.

### AI Activity Logs

On the **Overview** dashboard, the **AI Activity Logs** section shows:
- All recent AI tool usage across students
- Each entry shows: user name, action type (feedback / rewrite / polish / summarize), timestamp
- Use this to monitor how students are leveraging AI assistance

---

## 4. AI Features

The platform integrates OpenAI GPT-4o-mini to enhance review quality. These features are optional and require the AI service to be running.

### AI Feedback

**Available on**: File Review Page

1. After writing your review, click the **AI Feedback** button.
2. The system analyzes your review for:
   - **Toxicity**: Whether the language is respectful
   - **Politeness**: Tone and courtesy level
   - **Sentiment**: Overall positive/negative/neutral tone
   - **Constructiveness**: How actionable and helpful the feedback is
3. Results appear as a card below your review with scores and suggestions.

### AI Rewrite

**Available on**: File Review Page

1. Click the **AI Rewrite** button to get a suggested rewrite of your review.
2. The AI generates an improved version with:
   - Better grammar and clarity
   - More constructive and professional tone
   - Maintained factual content
3. You can **Adopt** the rewrite (replaces your review text) or dismiss it.

### AI Polish

**Available on**: Peer Review Form Page

1. After writing individual comments for a teammate, click the **Polish** button.
2. The AI improves your comment for:
   - Grammar and spelling
   - Professional tone
   - Clarity and conciseness
3. The polished text replaces your original comment automatically.

### AI Summarize

**Available on**: View Review Page (instructor view)

1. When viewing a submission that has multiple reviews, click the **Summarize** button.
2. The AI generates a concise summary of all reviews, identifying:
   - Common themes across reviewers
   - Key strengths mentioned
   - Areas for improvement
   - Conflicting opinions between reviewers

---

## 5. Accessibility

The application is built with **WCAG 2.1** compliance in mind:

| Feature | Implementation |
|---------|---------------|
| **Score selectors** | ARIA `role="radiogroup"` and `role="radio"` with full keyboard navigation (arrow keys, Enter/Space) |
| **Error messages** | `role="alert"` + `aria-live="assertive"` for screen reader announcements |
| **Data tables** | Semantic `<caption>` elements and `scope="col"` on all header cells |
| **Form labels** | All inputs have associated `<label>` elements (visually hidden when placeholders are used) |
| **Keyboard navigation** | All interactive elements (buttons, links, score selectors) support keyboard operation |
| **Color contrast** | UConn Blue (#000E2F) on white backgrounds meets WCAG AAA contrast ratio |
| **Focus indicators** | Visible focus rings on all interactive elements |

---

## 6. Troubleshooting

### Cannot Log In

- **Wrong credentials**: Verify your email and password. For development, use the seed accounts listed in [Logging In](#logging-in).
- **Account not registered**: If using local auth, ensure you've registered first. If using CAS SSO, contact your administrator.
- **Cookies blocked**: The system uses httpOnly cookies for authentication. Ensure third-party cookies are not blocked for the application domain.

### Peer Review Session Not Visible

- **Session may be closed**: Students only see sessions that are **open** or have **released scores**. Contact your instructor.
- **Wrong course**: You must be enrolled in the same course as the session. Check your enrollment.

### Cannot Submit Peer Reviews

- **Session closed**: The session may have been closed by the instructor or the deadline has passed.
- **Session mismatch**: If you see a warning banner about session mismatch, log out and log back in — this can happen when switching between accounts in the same browser.
- **Not in a team**: You must be assigned to a team via enrollment to submit peer reviews.

### Scores Show "Not Yet Released"

- This is expected behavior. Your instructor controls when scores become visible.
- Check back after your instructor announces that scores have been released.
- The **View Scores** button only appears on the Peer Review page when scores are released.

### AI Features Not Working

- The AI service must be running separately (Flask on port 5001).
- An OpenAI API key must be configured in the AI service's environment variables.
- If you see "AI unavailable" messages, contact your instructor or system administrator.

### Real-Time Events Not Updating

- The green **"Live"** indicator on the instructor dashboard shows the SSE connection status.
- If the indicator is not green, the connection is retrying automatically (with exponential backoff up to 30 seconds).
- Hard-refresh the page (Ctrl+Shift+R) if events are persistently not updating.

### CSV Upload Errors

- Ensure your CSV file uses proper column headers matching the expected format.
- The system auto-detects column mappings, but ambiguous headers may need manual mapping.
- Maximum file size limits apply — check with your administrator if large files fail to upload.

---

## Quick Reference — Keyboard Shortcuts

| Context | Key | Action |
|---------|-----|--------|
| Score selector | ← → | Move between score options |
| Score selector | Enter / Space | Select the focused score |
| Sidebar | Click ☰ | Toggle sidebar collapse |
| Any page | Ctrl + K | Focus global search bar |
| Notifications | Click bell | Toggle notification panel |

---

## Quick Reference — User Roles

| Capability | Student | Instructor |
|------------|---------|------------|
| Submit assignments | ✅ | ❌ |
| Complete assigned file reviews | ✅ | ❌ |
| Participate in peer review sessions | ✅ | ❌ |
| Submit self-review | ✅ | ❌ |
| View released peer review scores | ✅ | ❌ |
| Weekly check-ins | ✅ | ❌ |
| Use AI feedback / rewrite / polish | ✅ | ✅ |
| Create / manage peer review sessions | ❌ | ✅ |
| Release / hide scores | ❌ | ✅ |
| View bias analytics | ❌ | ✅ |
| Review all students (instructor review) | ❌ | ✅ |
| View quality flags | ❌ | ✅ |
| Export CSV reports | ❌ | ✅ |
| Manage enrollments | ❌ | ✅ |
| View AI activity logs | ❌ | ✅ |
| View real-time SSE events | ❌ | ✅ |
| Manage class check-ins | ❌ | ✅ |

---

*Document version: 1.0 — Last updated: March 2026*
