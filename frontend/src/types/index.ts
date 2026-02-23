// ─── User & Auth ──────────────────────────────────────────────────────────────
export type UserRole = 'student' | 'instructor' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

// ─── Submissions ──────────────────────────────────────────────────────────────
export type SubmissionStatus = 'submitted' | 'reviewed';

export interface ReviewSummary {
  review_id: string | null;
  reviewer_name?: string;
}

export interface Submission {
  submission_id: string;
  title: string;
  description?: string;
  status: SubmissionStatus;
  created_at: string;
  file_url?: string;
  reviews?: ReviewSummary[];
  // instructor-only fields
  student_name?: string;
  student_email?: string;
  assigned_count?: number;
  completed_count?: number;
}

// ─── Reviews ──────────────────────────────────────────────────────────────────
export interface Review {
  review_id?: string;
  title: string;
  student_name: string;
  file_url?: string;
  score?: number;
  comments?: string;
}

export interface ReviewTask {
  assignment_id: string;
  title: string;
  student_name: string;
  assigned_at: string;
}

export interface ReceivedReview {
  review_id: string;
  reviewer_name: string;
  score: number;
  comments: string;
  created_at: string;
}

export interface ViewReviewData {
  submission: {
    title: string;
    file_url?: string;
  };
  reviews: ReceivedReview[];
}

// ─── Check-ins ────────────────────────────────────────────────────────────────
export interface CheckinMember {
  id: string;
  team: string;
  name: string;
  self?: string;
  base_comment?: string;
  mapped_user_id?: string | null;
}

export interface WeekScores {
  [memberId: string]: {
    [topic: string]: string | number;
  };
}

export interface WeekComments {
  [memberId: string]: string;
}

export interface CheckinWeek {
  id: string;
  label: string;
  scores: WeekScores;
  comments: WeekComments;
  additional_comments: string;
}

export interface StudentCheckinWeek {
  id: string;
  label: string;
  self_score: string;
  peer_scores: {
    [memberId: string]: {
      [topic: string]: string;
    };
  };
}

export interface StudentCheckinContext {
  instructor: {
    topics: string[];
    members: CheckinMember[];
    weeks: { id: string; label: string }[];
  };
  self?: {
    selected_member_id: string;
    weeks: StudentCheckinWeek[];
  };
}

// ─── Instructor Insights ─────────────────────────────────────────────────────
export interface InsightRow {
  member_id: string;
  team: string;
  name: string;
  self_average: number | null;
  peer_average: number | null;
  instructor_average: number | null;
}

export interface HandedOutWeek {
  id: string;
  self_score?: string;
  peer_scores?: {
    [targetId: string]: {
      [topic: string]: string;
    };
  };
}

export interface HandedOutEntry {
  rater_member_id: string;
  weeks: HandedOutWeek[];
}

export interface StudentOption {
  user_id: string;
  display_name: string;
  email?: string;
}

// ─── Weekly Feedback ─────────────────────────────────────────────────────────
export type LikertValue =
  | 'extremely_disagree'
  | 'somewhat_disagree'
  | 'neutral'
  | 'somewhat_agree'
  | 'extremely_agree';

export interface WeeklyFeedbackForm {
  week: string;
  morale: string;
  blockers: string;
  wins: string;
  helpNeeded: string;
  peerRatings: Record<string, LikertValue>;
}
