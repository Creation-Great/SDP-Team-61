export type UserRole = 'student' | 'instructor' | 'admin';

export interface User {
  id: string;
  netid: string | null;
  name: string | null;
  email: string;
  role: UserRole;
}

export interface Course {
  course_id: string;
  name: string;
  term: string | null;
  created_at: string;
}

export interface DefinitionStudent {
  id: string;
  team_key: string;
  full_name: string;
  first_name: string;
  last_name: string;
  netid_guess: string;
}

export interface DefinitionTeam {
  key: string;
  students: DefinitionStudent[];
}

export interface CourseDefinition {
  definition_id: string;
  teams: DefinitionTeam[];
  categories: string[];
  uploaded_at: string;
}

// New per-team definition format returned by GET /courses/:courseId/definition/current
export interface CourseDefinitionCurrent {
  teams: Array<{
    teamKey: string;
    members: Array<{ fullName: string; netidGuess: string; userId: string | null }>;
  }>;
  categories: string[];
  uploadedAt: string | null;
}

export interface Week {
  week_id: string;
  course_id: string;
  week_number: number;
  opens_at: string;
  closes_at: string;
  scope_type: 'ALL' | 'TEAM';
  scope_team_key: string | null;
  team_keys: string[];  // from week_teams junction table
  is_open: boolean;
  definition_id_at_creation?: string;
}

export interface WeekStatusRow {
  id: string;
  full_name: string;
  team_key: string;
  netid_guess: string;
  user_id: string | null;
  total_assignments: number;
  submitted_assignments: number;
}

export interface AssignedReview {
  assignment_id: string;
  status: 'PENDING' | 'SUBMITTED';
  reviewee_name: string;
  team_key: string;
  week_id: string;
  week_number: number;
  closes_at: string;
  course_id: string;
  course_name: string;
  week_is_open: boolean;
}

export interface AssignmentForm {
  assignment_id: string;
  status: 'PENDING' | 'SUBMITTED';
  reviewee_name: string;
  team_key: string;
  categories: string[];
}

export interface StudentAggregate {
  reviewee_week_student_id: string;
  full_name: string;
  team_key: string;
  avg_overall: number | null;
  per_category_json: Record<string, number>;
  n_reviews: number;
}

export interface TeamAggregate {
  team_key: string;
  avg_overall: number | null;
  per_category_json: Record<string, number>;
  n_reviews: number;
}

// Phase 3: Course with stats
export interface CourseWithStats extends Course {
  student_count: number;
  active_week_count: number;
  total_assignments: number;
  submitted_assignments: number;
  // Roster-based completion: students who fully submitted in closed weeks vs total slots
  completed_students_in_closed_weeks: number;
  total_students_in_closed_weeks: number;
}

// Phase 3b: CSV diff preview
export interface CsvDiffPreview {
  added: Array<{ team_key: string; students: string[] }>;
  removed: Array<{ team_key: string; students: string[] }>;
  unchanged: Array<{ team_key: string; count: number }>;
}

// Phase 4c: Quality flags
export interface QualityFlag {
  reviewer_name: string;
  reviewee_name: string;
  flag_reason: string;
  submitted_at: string;
}

// Phase 4d: Student review drilldown
export interface StudentReviewDetail {
  reviewer_name: string;
  scores: Record<string, number>;
  comment: string;
  submitted_at: string;
}

// Team Analytics
export interface TeamAnalyticsRow {
  team_key: string;
  week_number: number;
  week_id: string;
  avg_overall: number | null;
  per_category_json: Record<string, number>;
  n_reviews: number;
  total_students: number;
  submitted_students: number;
}

export interface CourseTeamAnalytics {
  teams: string[];
  categories: string[];
  rows: TeamAnalyticsRow[];
}

// Phase 5: Received reviews (student history)
export interface ReceivedReview {
  week_id: string;
  week_number: number;
  course_name: string;
  avg_overall: number | null;
  per_category_json: Record<string, number>;
  n_reviews: number;
}
