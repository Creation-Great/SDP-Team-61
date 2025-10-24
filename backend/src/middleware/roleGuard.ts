import { Request, Response, NextFunction } from 'express';
export function requireRole(role: 'instructor'|'admin') {
  return (req: Request, res: Response, next: NextFunction) => {
    const r = (req as any).user?.role;
    if (r === role || (role === 'instructor' && r === 'admin')) return next();
    return res.status(403).json({ error: 'forbidden' });
  };
}
