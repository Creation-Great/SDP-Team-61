import { z } from 'zod';

// ── Common helpers ──────────────────────────────────────────
const score1to5 = z.number({ error: 'Score is required' }).min(1).max(5);

// ── Route parameter schemas ────────────────────────────────
export const uuidParamSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});

export const sessionIdParamSchema = z.object({
  sessionId: z.string().uuid('sessionId must be a valid UUID'),
});

export const submissionIdParamSchema = z.object({
  submissionId: z.string().uuid('submissionId must be a valid UUID'),
});

export const appealIdParamSchema = z.object({
  appealId: z.string().uuid('appealId must be a valid UUID'),
});

export const reviewIdParamSchema = z.object({
  reviewId: z.string().uuid('reviewId must be a valid UUID'),
});

// ── AI Service ─────────────────────────────────────────────
export const aiFeedbackSchema = z.object({
  review_id: z.string().uuid('review_id must be a UUID'),
  text: z.string().min(1, 'text is required'),
});

export const aiRewriteSchema = z.object({
  review_id: z.string().uuid('review_id must be a UUID'),
  text: z.string().min(1, 'text is required'),
  context: z.string().optional().default(''),
});

export const aiPolishSchema = z.object({
  text: z.string().min(1, 'text is required'),
});

export const aiSummarizeSchema = z.object({
  reviews: z.array(z.object({
    score: z.coerce.number().optional(),
    comments: z.string().optional().default(''),
    reviewer_name: z.string().optional().default('Anonymous'),
  })).nonempty('reviews array is required'),
});

// ── Auth ────────────────────────────────────────────────────
export const registerSchema = z.object({
  name: z.string().min(1, 'name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['student', 'instructor']).optional(),
  group_id: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().min(1, 'email is required'),
  password: z.string().min(1, 'password is required'),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1, 'name is required').max(100, 'name is too long'),
});

// ── Submissions ─────────────────────────────────────────────
export const uploadSubmissionSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().default(''),
  reviewerCount: z.coerce.number().int().min(1).max(3).optional(),
  course_id: z.string().optional(),
  assignment_template_id: z.string().uuid().optional().nullable(),
});

export const updateSubmissionSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  description: z.string().optional(),
}).refine((data) => data.title !== undefined || data.description !== undefined, {
  message: 'At least one of title or description is required',
});

// ── Reviews ─────────────────────────────────────────────────
export const submitReviewSchema = z.object({
  score: z.coerce.number({ error: 'Score is required' }).min(1, 'Score must be between 1 and 5').max(5, 'Score must be between 1 and 5'),
  comments: z.string().optional().default(''),
});

export const upsertReviewDraftSchema = z.object({
  score: z.coerce.number().int().min(1).max(5).optional().nullable(),
  comments: z.string().optional().default(''),
});

// ── Instructor ──────────────────────────────────────────────
export const assignReviewerSchema = z.object({
  submission_id: z.string().uuid('submission_id must be a UUID'),
  reviewer_id: z.string().uuid('reviewer_id must be a UUID'),
});

export const bulkAssignReviewersSchema = z.object({
  submission_ids: z.array(z.string().uuid('submission id must be a UUID')).min(1, 'At least one submission is required'),
  reviewer_count: z.coerce.number().int().min(1).max(3).optional().default(1),
});

export const createAnnouncementSchema = z.object({
  title: z.string().min(1, 'title is required'),
  body: z.string().min(1, 'body is required'),
  link: z.string().optional().default(''),
  course_id: z.string().optional().nullable(),
  group_id: z.string().optional().nullable(),
});

export const saveCurrentCheckinsSchema = z.object({
  file_name: z.string().optional().default(''),
  headers: z.array(z.unknown()),
  topics: z.array(z.unknown()),
  members: z.array(z.unknown()),
  weeks: z.array(z.unknown()),
});

export const upsertSubmissionPolicySchema = z.object({
  course_id: z.string().min(1, 'course_id is required'),
  allow_edit_withdraw_after_reviews: z.boolean(),
});

export const createAssignmentTemplateSchema = z.object({
  course_id: z.string().min(1, 'course_id is required'),
  title: z.string().min(1, 'title is required'),
  description: z.string().optional().default(''),
  due_at: z.string().datetime({ offset: true }).optional().nullable(),
  is_active: z.boolean().optional().default(true),
});

export const upsertRubricSchema = z.object({
  rubric_type: z.enum(['file_review', 'peer_technical', 'peer_interactions', 'peer_management']),
  course_id: z.string().optional().nullable(),
  session_id: z.string().uuid().optional().nullable(),
  levels: z.array(z.object({
    score: z.coerce.number().int().min(1).max(5),
    label: z.string().min(1),
    desc: z.string().min(1),
  })).length(5),
});

// ── Peer Review ─────────────────────────────────────────────
export const createSessionSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  deadline: z.string().datetime({ offset: true }).nullish(),
  course_id: z.string().min(1).nullish(),
});

export const toggleSessionSchema = z.object({
  is_open: z.boolean().optional(),
  title: z.string().min(1, 'Title cannot be empty').optional(),
  deadline: z.string().datetime({ offset: true }).nullable().optional(),
}).refine((data) => data.is_open !== undefined || data.title !== undefined || data.deadline !== undefined, {
  message: 'At least one of is_open, title, deadline is required',
});

export const releaseScoresSchema = z.object({
  scores_released: z.boolean({ error: 'scores_released (boolean) is required' }),
});

const peerReviewEntrySchema = z.object({
  reviewee_id: z.string().min(1, 'Each review must have a reviewee_id'),
  technical_contributions: score1to5,
  team_interactions: score1to5,
  project_management: score1to5,
  individual_comments: z.string().optional().default(''),
});

export const submitPeerReviewsSchema = z.object({
  reviews: z.array(peerReviewEntrySchema).nonempty('Reviews array is required'),
  teamChemistry: z.number().min(1, 'Team chemistry must be between 1 and 5').max(5, 'Team chemistry must be between 1 and 5').nullish(),
});

export const upsertPeerReviewDraftSchema = z.object({
  reviews: z.record(z.string(), z.object({
    technical_contributions: z.number().int().min(1).max(5).nullable().optional(),
    team_interactions: z.number().int().min(1).max(5).nullable().optional(),
    project_management: z.number().int().min(1).max(5).nullable().optional(),
    individual_comments: z.string().optional().default(''),
  })).optional().default({}),
  teamChemistry: z.number().int().min(1).max(5).nullable().optional(),
});

export const instructorSubmitReviewsSchema = z.object({
  reviews: z.array(peerReviewEntrySchema).nonempty('Reviews array is required'),
});

export const createPeerReviewAppealSchema = z.object({
  session_id: z.string().uuid('session_id must be a UUID'),
  target_type: z.enum(['session', 'review', 'comment']).optional().default('session'),
  target_id: z.string().optional().nullable(),
  message: z.string().min(1, 'message is required'),
});

export const updatePeerReviewAppealSchema = z.object({
  status: z.enum(['open', 'resolved', 'rejected']),
  instructor_reply: z.string().optional().default(''),
});

// ── Checkins ────────────────────────────────────────────────
export const saveStudentSelfCheckinsSchema = z.object({
  selected_member_id: z.string().min(1, 'selected_member_id is required'),
  weeks: z.array(z.unknown()),
});

// ── Semesters ──────────────────────────────────────────────
export const createSemesterSchema = z.object({
  name: z.string().min(1),
  start_date: z.string().min(1),
  end_date: z.string().min(1),
});

// ── Grades ─────────────────────────────────────────────────
export const gradeWeightsSchema = z.object({
  file_review_weight: z.number().min(0).max(100),
  peer_review_weight: z.number().min(0).max(100),
  checkin_weight: z.number().min(0).max(100),
  drop_lowest: z.number().int().min(0).default(0),
  drop_highest: z.number().int().min(0).default(0),
});

// ── Anonymity ──────────────────────────────────────────────
export const anonymityConfigSchema = z.object({
  anonymity: z.enum(['none', 'single_blind', 'double_blind']),
});

// ── Deadlines ──────────────────────────────────────────────
export const deadlineExtensionSchema = z.object({
  user_id: z.string().uuid(),
  entity_type: z.string().min(1),
  entity_id: z.string().uuid(),
  extended_to: z.string().min(1),
  reason: z.string().optional(),
});

export const reminderConfigSchema = z.object({
  entity_type: z.string().min(1),
  entity_id: z.string().uuid(),
  reminder_hours: z.array(z.number().int().min(1)),
});

// ── Reviews (helpfulness) ──────────────────────────────────
export const helpfulnessVoteSchema = z.object({
  review_id: z.string().uuid(),
  is_helpful: z.boolean(),
});

// ── LMS ────────────────────────────────────────────────────
export const lmsConfigSchema = z.object({
  provider: z.string().min(1),
  api_url: z.preprocess(v => (v === '' ? undefined : v), z.string().url().optional()),
  api_key: z.string().optional(),
  config_json: z.record(z.string(), z.unknown()).optional(),
});

// ── User Preferences ───────────────────────────────────────
export const userPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark']).optional(),
  font_size: z.enum(['small', 'medium', 'large']).optional(),
  high_contrast: z.boolean().optional(),
  preferences: z.record(z.string(), z.unknown()).optional(),
});

// ── Review Exclusion ───────────────────────────────────────
export const reviewExclusionSchema = z.object({
  course_id: z.string().min(1),
  user_a: z.string().uuid(),
  user_b: z.string().uuid(),
  reason: z.string().optional(),
});

// ── Assignment Strategy ────────────────────────────────────
export const assignmentStrategySchema = z.object({
  course_id: z.string().min(1),
  assignment_strategy: z.enum(['random', 'load_balanced', 'reciprocal', 'manual_only']),
  min_reviews_required: z.number().int().min(1).max(5).optional(),
});

// ── Clone Course ───────────────────────────────────────────
export const cloneCourseSchema = z.object({
  source_course_id: z.string().min(1),
  target_course_id: z.string().min(1),
  semester_id: z.string().uuid().optional(),
});

// ── Revisions ──────────────────────────────────────────────
export const createRevisionSchema = z.object({
  parent_submission_id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
});

// ── AI Chat ────────────────────────────────────────────────
export const aiChatSchema = z.object({
  message: z.string().min(1),
  context_type: z.enum(['writing_review', 'reading_review', 'teacher_summary']),
  context_id: z.string().uuid().optional(),
  conversation_id: z.string().uuid().optional(),
});
