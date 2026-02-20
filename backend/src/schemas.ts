import { z } from 'zod';

// ── Common helpers ──────────────────────────────────────────
const score1to5 = z.number({ error: 'Score is required' }).min(1).max(5);

// ── Auth ────────────────────────────────────────────────────
export const registerSchema = z.object({
  name: z.string().min(1, 'name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['student', 'instructor', 'admin']).optional(),
  group_id: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().min(1, 'email is required'),
  password: z.string().min(1, 'password is required'),
});

// ── Submissions ─────────────────────────────────────────────
export const uploadSubmissionSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().default(''),
  reviewerCount: z.coerce.number().int().min(1).max(3).optional(),
});

// ── Reviews ─────────────────────────────────────────────────
export const submitReviewSchema = z.object({
  score: z.coerce.number({ error: 'Score is required' }).min(1, 'Score must be between 1 and 5').max(5, 'Score must be between 1 and 5'),
  comments: z.string().optional().default(''),
});

// ── Instructor ──────────────────────────────────────────────
export const assignReviewerSchema = z.object({
  submission_id: z.string().uuid('submission_id must be a UUID'),
  reviewer_id: z.string().uuid('reviewer_id must be a UUID'),
});

export const saveCurrentCheckinsSchema = z.object({
  file_name: z.string().optional().default(''),
  headers: z.array(z.unknown()),
  topics: z.array(z.unknown()),
  members: z.array(z.unknown()),
  weeks: z.array(z.unknown()),
});

// ── Peer Review ─────────────────────────────────────────────
export const createSessionSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  deadline: z.string().datetime({ offset: true }).nullish(),
});

export const toggleSessionSchema = z.object({
  is_open: z.boolean({ error: 'is_open (boolean) is required' }),
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

// ── Checkins ────────────────────────────────────────────────
export const saveStudentSelfCheckinsSchema = z.object({
  selected_member_id: z.string().min(1, 'selected_member_id is required'),
  weeks: z.array(z.unknown()),
});
