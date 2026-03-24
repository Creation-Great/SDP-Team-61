import { Response, NextFunction } from 'express';
import type { AuthRequest } from '../types.js';
import { logger } from '../utils/logger.js';

/**
 * Role-based access control middleware.
 * Restricts route access to users with specified roles.
 */
export function requireRole(...roles: Array<'student' | 'instructor' | 'admin'>) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const userRole = req.user?.role;
    if (!userRole) {
      res.status(401).json({ error: 'unauthorized', message: 'Authentication required' });
      return;
    }
    // Admin can access anything
    if (userRole === 'admin' || roles.includes(userRole)) {
      return next();
    }
    logger.warn(
      { action: 'permission_denied', userId: req.user?.user_id, role: userRole, requiredRoles: roles },
      'Insufficient permissions'
    );
    res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions' });
  };
}
