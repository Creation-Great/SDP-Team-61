import { Request, Response, NextFunction } from 'express';
export function devAuth(req: Request, _res: Response, next: NextFunction) {
  const uid = req.header('x-user-id') || '00000000-0000-0000-0000-0000000000a1';
  const role = (req.header('x-user-role') || 'student').toLowerCase();
  const course = req.header('x-user-course') || 'CSE4939W';
  const group = req.header('x-user-group') || 'G1';
  (req as any).user = { user_id: uid, role, course_id: course, group_id: group };
  next();
}
