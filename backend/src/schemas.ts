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
