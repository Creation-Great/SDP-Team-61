import { Request } from 'express';

export interface AuthUser {
  user_id: string;
  email: string;
  name: string;
  role: 'student' | 'instructor' | 'admin';
  course_id?: string;
  group_id?: string;
}

export interface AuthRequest extends Request {
  user: AuthUser;
}
