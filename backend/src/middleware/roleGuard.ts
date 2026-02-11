import { Response, NextFunction } from 'express';
import type { AuthRequest } from '../types.js';

/**
 * Role-based access control middleware.
 * Restricts route access to users with specified roles.
 */
export function requireRole(...roles: Array<'student' | 'instructor' | 'admin'>) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const userRole = req.user?.role;
    if (!userRole) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    // Admin can access anything
    if (userRole === 'admin' || roles.includes(userRole)) {
      return next();
    }
    res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions' });
  };
}
