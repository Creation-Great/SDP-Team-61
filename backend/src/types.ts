import { Request } from 'express';

export interface AuthUser {
  user_id: string;
  email: string;
  name: string | null;
  role: 'student' | 'instructor' | 'admin';
  netid: string | null;
}

export interface AuthRequest extends Request {
  user: AuthUser;
}
