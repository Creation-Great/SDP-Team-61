import { Request } from 'express';

/** A single course-group enrollment record. */
export interface Enrollment {
  enrollment_id: string;
  course_id: string;
  group_id: string | null;
  role: 'student' | 'instructor' | 'admin';
  is_primary: boolean;
  enrolled_at: string;
}

export interface AuthUser {
  user_id: string;
  email: string;
  name: string;
  role: 'student' | 'instructor' | 'admin';
  /** @deprecated Use enrollments[].course_id — kept for backward compat (primary enrollment). */
  course_id?: string;
  /** @deprecated Use enrollments[].group_id — kept for backward compat (primary enrollment). */
  group_id?: string;
  /** All enrollments for this user (empty array if none). */
  enrollments: Enrollment[];
}

export interface AuthRequest extends Request {
  user: AuthUser;
}
