# Database

> Schema reference for PostgreSQL 16. Contains 41 tables managed by 37 sequential migrations, with row-level security enforced via session variables.

This document supersedes the older `database-erd.md`. For the JS-side data flow, see [ARCHITECTURE.md §5](ARCHITECTURE.md#5-data-layer).

---

## 1. Conventions

| Aspect | Convention |
|--------|-----------|
| Primary keys | `UUID DEFAULT gen_random_uuid()` (requires `pgcrypto` extension, enabled by migration 001). Two tables (`ai_activity_logs`, `notifications`) use `SERIAL` for historical reasons. |
| Naming | `snake_case`. Tables plural (`reviews`, `submissions`); columns descriptive (`reviewer_id`, `created_at`). |
| Timestamps | `TIMESTAMPTZ NOT NULL DEFAULT now()`. Mutable rows have `updated_at` paired with a `BEFORE UPDATE` trigger (`trg_set_updated_at`). |
| Foreign keys | Cascade strategy fixed in migration 008: user-owned rows `ON DELETE CASCADE`, audit and `peer_review_sessions.created_by` use `ON DELETE SET NULL`. |
| Soft delete | Not used. Deletion is hard but cascades. |
| Course identifier | `course_id` is `TEXT` (e.g. `'CSE4939W'`), **not** UUID. |

### RLS context variables

Sensitive queries run via [`withDb(userId, role, cb)`](../backend/src/db.ts#L22) which sets:

```sql
SELECT set_config('app.current_user_id', $1, true);
SELECT set_config('app.current_role',    $2, true);
```

All policies read these via `current_setting('app.current_user_id', true)::uuid` (with a zero-UUID `COALESCE` fallback to avoid SQL errors when the variable is unset).

---

## 2. Enumerations

| Type | Values | Defined in |
|------|--------|-----------|
| `assignment_status` | `pending` · `completed` · `canceled` | 001 |
| `user_role` | `student` · `instructor` · `admin` · `ta` | 001 (`ta` added in 022) |
| `submission_status` | `submitted` · `reviewed` | 001 |
| `anonymity_level` | `none` · `single_blind` · `double_blind` | 023 |
| `assignment_strategy` | `random` · `load_balanced` · `reciprocal` · `manual_only` | 025 |

---

## 3. Tables by Domain

### 3.1 Identity, enrollment, audit

| Table | PK | Purpose | Notable columns |
|-------|----|---------|-----------------|
| `users` | `user_id` UUID | Account record | `email` UNIQUE · `password_hash` (bcrypt 10 rounds) · `role` (`user_role`) · denormalised `course_id`/`group_id` synced from primary enrollment |
| `audit` | `event_id` UUID | Event log | `actor` UUID FK SET NULL · `action` · `entity` · `entity_id` · `meta_json` |
| `user_enrollments` | `enrollment_id` UUID | Many-to-many user↔course | `(user_id, course_id)` UNIQUE · partial unique on `(user_id) WHERE is_primary=true` · trigger `sync_primary_enrollment` keeps `users.course_id`/`group_id` in sync |
| `semesters` | `semester_id` UUID | Academic terms | `start_date` · `end_date` · `is_active` |
| `announcements` | `announcement_id` UUID | Course-scoped notices | `is_pinned` · `scheduled_at` · `attachment_url` |
| `notification_preferences` | `preference_id` UUID | Per-user channel selection | `(user_id, type)` UNIQUE · booleans for `in_app` / `email` / `push` |
| `push_subscriptions` | `subscription_id` UUID | Web Push (VAPID) | `(user_id, endpoint)` UNIQUE · `p256dh` · `auth` |
| `user_preferences` | `user_id` UUID (PK = FK) | Theme/font/contrast | `theme` · `font_size` · `high_contrast` · free-form `preferences` JSONB |
| `data_deletion_requests` | `id` UUID | GDPR account deletion | `status` · `requested_at` · `completed_at` · `deleted_by` |

### 3.2 File submission and review

| Table | PK | Purpose | Notable columns |
|-------|----|---------|-----------------|
| `submissions` | `submission_id` UUID | Student-uploaded assignment | `user_id` FK CASCADE · `title` · `description` · `filename` · `file_url` · `status` (`submission_status`) · `course_id` (added in 011) · `revision_number` + `parent_submission_id` (024) · `anonymity` (023) · `assignment_strategy` + `min_reviews_required` (025) · `assignment_template_id` (018) · `updated_at` (006) |
| `assignments` | `assignment_id` UUID | Reviewer assignment | `(submission_id, reviewer_id)` UNIQUE · `status` (`assignment_status`) |
| `reviews` | `review_id` UUID | File review record | `score` 1-5 · `comments` · `comments_html` (032) · `review_round` (024) · `review_hash` (035) |
| `ml_outputs` | `review_id` UUID PK FK | AI feedback per review | `toxicity` · `politeness` · `sentiment` · `identity_spans` · `evidence_spans` · `model_version` |
| `rewrite_suggestions` | `review_id` UUID PK FK | AI rewrite per review | `revised_text` · `edits` · `preserved` · `reasoning` · `adopted` |
| `file_review_drafts` | `draft_id` UUID | Reviewer's WIP | `(assignment_id, reviewer_id)` UNIQUE · `draft_version` + `last_saved_at` (034) for conflict detection |
| `submission_policies` | `policy_id` UUID | Per-course edit/withdraw policy | `course_id` UNIQUE · `allow_edit_withdraw_after_reviews` |
| `assignment_templates` | `template_id` UUID | Reusable assignment definition | `course_id` · `due_at` · `is_active` · `semester_id` (022) · `grace_period_hours` (031) |
| `review_attachments` | `id` UUID | File attached to a review | exclusive FK to either `review_id` or `peer_review_id` (CHECK constraint) · `mime_type` · `file_size` |

### 3.3 Peer review

| Table | PK | Purpose | Notable columns |
|-------|----|---------|-----------------|
| `peer_review_sessions` | `session_id` UUID | Session container | `created_by` FK SET NULL · `course_id` · `is_open` · `closed_at` · `anonymity` (023) · `semester_id` (022) · `grace_period_hours` (031) |
| `peer_reviews` | `peer_review_id` UUID | Reviewer × reviewee scores | UNIQUE `(session_id, reviewer_id, reviewee_id)` · three sub-scores 1-5 (`technical_contributions`, `team_interactions`, `project_management`) · `is_self` flag · `review_round` (024) · `individual_comments_html` (032) · `review_hash` (035) |
| `peer_review_team_chemistry` | `id` UUID | Per-reviewer group score | UNIQUE `(session_id, reviewer_id)` |
| `peer_review_drafts` | `draft_id` UUID | Reviewer's WIP form | UNIQUE `(session_id, reviewer_id)` · `payload` JSONB · `draft_version` + `last_saved_at` (034) |
| `peer_review_appeals` | `appeal_id` UUID | Clarification / appeal request | `target_type` (session/review/comment) · `status` (open/resolved/rejected) · `instructor_reply` |

### 3.4 Anonymity and assignment strategy

| Table | PK | Purpose |
|-------|----|---------|
| `anonymous_reviewer_map` | `id` UUID | Stable per-session/submission pseudonym. `(session_id, user_id)` UNIQUE and `(submission_id, user_id)` UNIQUE. Inserted with `WHERE NOT EXISTS` + retry to prevent collisions. |
| `review_exclusions` | `id` UUID | Conflict-of-interest pairs. `(course_id, user_a, user_b)` UNIQUE. Reviewer assignment honours these. |

### 3.5 Quality and scoring

| Table | PK | Purpose | Notable |
|-------|----|---------|---------|
| `rubrics` | `rubric_id` UUID | Configurable scoring rubric | `rubric_type` (`file_review`, `peer_technical`, `peer_interactions`, `peer_management`) · scope by `course_id`/`session_id` |
| `review_helpfulness` | `id` UUID | Student vote on a review | `(review_id, voter_id)` UNIQUE · `is_helpful` BOOL |
| `reviewer_reputation` | `user_id` UUID PK FK | Aggregate per reviewer | `helpfulness_score` · `consistency_score` · counts |
| `review_depth_scores` | `id` UUID | AI-computed per-review metrics | `constructiveness` · `specificity` · `actionability` (each NUMERIC(3,2)) |
| `ai_score_suggestions` | `id` UUID | AI suggested score range | `suggested_min`/`max` · `reasoning` |
| `ai_calibration_results` | `id` UUID | Reviewer self-vs-peer deviation | `reviewer_score` · `peer_avg_score` · `deviation` · `suggestion` |

### 3.6 Check-ins

| Table | PK | Purpose |
|-------|----|---------|
| `student_checkins` | `checkin_id` UUID | Instructor-managed weekly evaluation. `(instructor_id, course_id, group_id)` UNIQUE; payload columns `headers`, `topics`, `members`, `weeks` are JSONB. |
| `student_self_checkins` | `self_checkin_id` UUID | Student self-evaluation. `(student_id, course_id, group_id)` UNIQUE. |

### 3.7 AI logs and conversations

| Table | PK | Purpose | Note |
|-------|----|---------|------|
| `ai_activity_logs` | `id` SERIAL | Polish / summarize call log | `user_id` is **VARCHAR**, not a UUID FK — may be `'unknown'` for anonymous calls. Frontend joins `users` to render names; falls back to `'A user'` when no match. |
| `ai_conversations` | `id` UUID | Multi-turn AI chat history | `messages` JSONB · `context_type` + `context_id` for the 3 context modes |

### 3.8 Notifications, deadlines, integration

| Table | PK | Purpose |
|-------|----|---------|
| `notifications` | `id` SERIAL | Per-user notification | `type` strings: `review_assigned`, `review_received`, `submission_graded`, `announcement`, `deadline_approaching`, `similarity_alert`, `grade_released`, `extension_granted`, `reminder` (9 types — see `aiController` and `notificationController`) |
| `deadline_reminders` | `id` UUID | Scheduler tracking | `(entity_type, entity_id, reminder_hours)` keyed by `sent_at` |
| `deadline_extensions` | `id` UUID | Per-user deadline extension | `(user_id, entity_type, entity_id)` UNIQUE |
| `grade_weights` | `id` UUID | Course grade weighting | `course_id` UNIQUE · file/peer/checkin weights default 40/40/20 · `drop_lowest`/`drop_highest` |
| `lms_config` | `id` UUID | LMS integration (mock LTI) | `course_id` UNIQUE · `provider` · `lti_consumer_key`/`lti_secret` |
| `similarity_reports` | `id` UUID | Plagiarism detection result | `(submission_id_a, submission_id_b, method)` UNIQUE · `method` defaults `'tfidf_cosine'` |

---

## 4. Views and Materialized Views

| Object | Defined in | Purpose |
|--------|-----------|---------|
| `v_submission_counts` | 003 | Per-submission assigned vs completed counts |
| `v_reviewer_todo` | 003 | Pending assignments without a review |
| `mv_instructor_cohort` | 003 | Weekly per-course/group activity (refreshed by [`utils/mvRefresh.ts`](../backend/src/utils/mvRefresh.ts)) |
| `v_peer_review_averages` | 004 | Per-student per-session averages, with `team_chemistry` deduplicated to a single group-level average |
| `v_unified_review_activity` | 005 | UNION of file reviews and peer reviews into a single feed |
| `v_student_review_participation` | 005 | Per-student counts and average scores given/received across both review types |
| `v_course_team_roster` | 007 | Roster of users by course/group |

---

## 5. Row-Level Security

Tables with RLS enabled (3 — all in migration 003): `submissions`, `assignments`, `reviews`.

Other tables enforce access at the application layer through `verifyCourseAccess()` / `verifySessionAccess()` (see [`backend/src/utils/enrollment.ts`](../backend/src/utils/enrollment.ts)).

Migration 003 created broad `USING` policies. Migration 009 split them into per-command policies for least-privilege:

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `submissions` | owner + assigned reviewer + instructor/admin | owner only | owner only | owner + admin only |
| `assignments` | reviewer + submission owner + instructor/admin | instructor/admin/student | reviewer + instructor/admin | admin only |
| `reviews` | reviewer + submission owner + instructor/admin | reviewer only | reviewer only | reviewer + admin only |

Total 20 policies (3 ENABLE + 8 in migration 003, 12 fine-grained in 009 — note: migration 009 drops and re-creates policies, so the live count is 12 active policies plus the still-valid `p_submissions_reviewer_read` from 003).

---

## 6. Functions and Triggers

| Object | Type | Purpose |
|--------|------|---------|
| `trg_set_updated_at()` | Function | Sets `NEW.updated_at = now()`. Used by `submissions_updated_at` trigger (006). |
| `submissions_updated_at` | Trigger | `BEFORE UPDATE ON submissions FOR EACH ROW`. |
| `sync_primary_enrollment()` | Function | When a `user_enrollments` row becomes primary, demotes other primaries and updates `users.course_id`/`group_id`. (007) |
| `trg_sync_primary_enrollment` | Trigger | `AFTER INSERT OR UPDATE OF is_primary, course_id, group_id ON user_enrollments`. |
| `refresh_mv_instructor_cohort()` | Function | `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_instructor_cohort`. SECURITY DEFINER. (003) |
| `cleanup_old_drafts()` | Function | Deletes `file_review_drafts` and `peer_review_drafts` older than 30 days. Returns deleted count. (020) |
| `cleanup_old_notifications()` | Function | Deletes read notifications older than 90 days. (020) |
| `cleanup_old_ai_logs()` | Function | Deletes `ai_activity_logs` older than 90 days. (020) |

The three `cleanup_*` functions are invoked daily by `startDataCleanup()` in [`backend/src/server.ts`](../backend/src/server.ts#L75).

---

## 7. Migration Index

All migrations live in `backend/migrations/` and run automatically at backend startup via [`migrateUp()`](../backend/src/migrate.ts). Each migration is idempotent (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE … ADD COLUMN IF NOT EXISTS`, `DO $$ BEGIN … EXCEPTION WHEN duplicate_object` for enums).

| # | Name | Adds |
|---|------|------|
| 001 | initial-enums-users | `pgcrypto`, 3 enums, `users`, `audit` |
| 002 | file-review-system | `submissions`, `assignments`, `reviews`, `ml_outputs`, `rewrite_suggestions` + indexes |
| 003 | rls-views-mv | RLS on 3 tables + 8 policies + 2 views + materialized view |
| 004 | peer-review-system | `peer_review_sessions`, `peer_reviews`, `peer_review_team_chemistry` + `v_peer_review_averages` |
| 005 | checkins-unified-views | `student_checkins`, `student_self_checkins` + 2 unified views |
| 006 | submissions-updated-at | `updated_at` column + trigger |
| 007 | user-enrollments | `user_enrollments` + trigger + `v_course_team_roster` |
| 008 | cascade-delete-policies | 14 FK rewrites for cascade behaviour |
| 009 | tighten-rls-policies | 12 fine-grained per-command policies |
| 010 | ai-activity-logs | `ai_activity_logs`, `notifications` |
| 011 | submissions-course-id | `submissions.course_id` + backfill |
| 012 | rubrics | `rubrics` |
| 013 | peer-review-appeals | `peer_review_appeals` |
| 014 | notification-preferences | `notification_preferences` |
| 015 | push-subscriptions | `push_subscriptions` |
| 016 | review-drafts | `file_review_drafts`, `peer_review_drafts` |
| 017 | submission-policies | `submission_policies` |
| 018 | assignment-templates | `assignment_templates` + `submissions.assignment_template_id` |
| 019 | add-missing-indexes | indexes only |
| 020 | data-cleanup-functions | 3 cleanup functions |
| 021 | performance-indexes | indexes only |
| 022 | semesters-ta-announcements | `semesters`, `announcements` + TA role + ALTERs |
| 023 | anonymous-reviews | `anonymity_level` enum + `anonymous_reviewer_map` + ALTERs |
| 024 | multi-round-review | revision and review-round columns |
| 025 | assignment-strategy | `assignment_strategy` enum + `review_exclusions` + ALTERs |
| 026 | review-quality | `review_helpfulness`, `reviewer_reputation`, `review_depth_scores` |
| 027 | grade-weights | `grade_weights` |
| 028 | similarity-reports | `similarity_reports` |
| 029 | ai-conversations | `ai_conversations` |
| 030 | lms-config | `lms_config` |
| 031 | deadlines-reminders | `deadline_reminders`, `deadline_extensions` + `grace_period_hours` ALTERs |
| 032 | review-attachments | `review_attachments` + HTML comment columns |
| 033 | user-preferences | `user_preferences` |
| 034 | draft-versioning | `draft_version` + `last_saved_at` on both draft tables |
| 035 | audit-compliance | `review_hash` columns + `data_deletion_requests` |
| 036 | ai-scoring | `ai_score_suggestions`, `ai_calibration_results` |
| 037 | performance-indexes | indexes only |

The next available slot is **`038_*.sql`**. Never edit an applied migration — add a new one.

---

## 8. ER Diagram (high level)

```
                       ┌──────────┐
                       │  users   │◀──┐
                       └─────┬────┘   │
            ┌────────────────┼────────┼────────────────────────────┐
            │                │        │                            │
            ▼                ▼        │                            ▼
   ┌────────────────┐  ┌─────────────┴────┐               ┌────────────────────┐
   │ user_          │  │ user_            │               │ peer_review_       │
   │ enrollments    │  │ preferences      │               │ sessions           │
   └────────────────┘  └──────────────────┘               └─────────┬──────────┘
                                                                    │
                          ┌──────────────────────────────────────┐  │
                          │ submissions ─┐ assignments ─┐ reviews │  │
                          │     ▲        │      ▲       │   ▲     │  │
                          │     │ FK     │      │ FK    │   │     │  │
                          │ ml_outputs   │ file_review_ │ rewrite_│  │
                          │ rewrite_susg │  drafts      │ suggest.│  │
                          │ similarity_  │              │         │  │
                          │  reports     │              │         │  │
                          └──────────────┴──────────────┴─────────┘  │
                                                                     │
                                              ┌──────────────────────┴─┐
                                              │ peer_reviews            │
                                              │ peer_review_team_       │
                                              │   chemistry             │
                                              │ peer_review_drafts      │
                                              │ peer_review_appeals     │
                                              │ anonymous_reviewer_map  │
                                              └─────────────────────────┘
```

This diagram is intentionally lossy — it focuses on the busiest hubs (`users`, `submissions`, `peer_review_sessions`) and groups orbiting tables. For exact column-level structure consult the migration files directly.

---

## 9. Common Query Patterns

### Look up a user's pending file-review assignments

```sql
SELECT a.assignment_id, s.submission_id, s.title, u.name AS author
FROM assignments a
JOIN submissions s ON s.submission_id = a.submission_id
JOIN users u       ON u.user_id       = s.user_id
WHERE a.reviewer_id = $1                          -- session user
  AND a.status      = 'pending'
ORDER BY a.created_at DESC;
```

### Aggregate peer-review averages for a session

Use the view; it already deduplicates `team_chemistry`:

```sql
SELECT * FROM v_peer_review_averages WHERE session_id = $1;
```

### Refresh the instructor cohort materialized view manually

```sql
SELECT refresh_mv_instructor_cohort();
```

### Run cleanup ad-hoc

```sql
SELECT cleanup_old_drafts();
SELECT cleanup_old_notifications();
SELECT cleanup_old_ai_logs();
```

---

## 10. Operational Notes

- **Bootstrap order in Docker.** PostgreSQL's `docker-entrypoint-initdb.d` runs `backend/sql/migrations.sql` (legacy full schema) and `backend/sql/seed.sql` (demo accounts) on first start of an empty volume. The numbered migrations 001-037 then apply on top via the backend at boot. The legacy file is the source of truth for fresh containers; the numbered migrations are the source of truth for schema evolution. **Do not rely on the legacy file having the latest schema** — always re-derive from numbered migrations.
- **Demo seed.** `backend/sql/seed.sql` creates `instructor@example.com`, `alice@example.com`, `bob@example.com`, `carol@example.com`, all with password `password123`. **Never run in production.** See [DEPLOYMENT.md §3.2](DEPLOYMENT.md#32-without-seed-data).
- **Connection limit.** Default pool max is 20 (`PG_POOL_MAX`). PostgreSQL's `max_connections` (default 100) must accommodate this multiplied by the number of backend workers.
- **Backups.** Logical dumps and `backend_uploads` volume — see [DEPLOYMENT.md §5](DEPLOYMENT.md#5-database-backup-and-recovery).

---

## 11. References

- Migration files: [`backend/migrations/`](../backend/migrations/)
- Legacy bootstrap: [`backend/sql/migrations.sql`](../backend/sql/migrations.sql)
- Seed data: [`backend/sql/seed.sql`](../backend/sql/seed.sql)
- Pool / RLS wrappers: [`backend/src/db.ts`](../backend/src/db.ts)
- Migration runner: [`backend/src/migrate.ts`](../backend/src/migrate.ts)
- Authorization helpers: [`backend/src/utils/enrollment.ts`](../backend/src/utils/enrollment.ts)
