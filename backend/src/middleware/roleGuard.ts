import { Request, Response, NextFunction } from 'express';
import { pool } from '../db';

/**
 * RBAC Middleware - Database & Security Module
 * Owner: Yanxiao Zheng
 * 
 * Provides role-based access control for the peer review system.
 * Supports: student, instructor, admin roles with course-level isolation.
 */

export type UserRole = 'student' | 'instructor' | 'admin';

/**
 * Require user to have a specific role (instructor or admin).
 * Admin role inherits instructor permissions.
 */
export function requireRole(role: 'instructor' | 'admin') {
  return (req: Request, res: Response, next: NextFunction) => {
    const r = (req as any).user?.role as UserRole;
    if (r === role || (role === 'instructor' && r === 'admin')) {
      return next();
    }
    return res.status(403).json({ 
      error: 'forbidden', 
      detail: `Required role: ${role}` 
    });
  };
}

/**
 * Require user to be authenticated (any role).
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user || !user.user_id) {
    return res.status(401).json({ 
      error: 'unauthorized', 
      detail: 'Authentication required' 
    });
  }
  next();
}

/**
 * Require user to have a specific role within a specific course.
 * Validates that the user belongs to the course specified in the request.
 * 
 * @param role - Required role (instructor or admin)
 * @param courseIdExtractor - Function to extract course_id from request
 *                             Default: reads from req.query.course or req.body.course_id
 */
export function requireCourseRole(
  role: 'instructor' | 'admin',
  courseIdExtractor?: (req: Request) => string | undefined
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const userRole = user?.role as UserRole;
      
      // Check if user has the required role
      if (userRole !== role && !(role === 'instructor' && userRole === 'admin')) {
        return res.status(403).json({ 
          error: 'forbidden', 
          detail: `Required role: ${role}` 
        });
      }
      
      // Extract course_id from request
      const targetCourseId = courseIdExtractor 
        ? courseIdExtractor(req)
        : (req.query.course as string || req.body?.course_id || req.params?.courseId);
      
      if (!targetCourseId) {
        return res.status(400).json({ 
          error: 'bad_request', 
          detail: 'course_id parameter required' 
        });
      }
      
      // Admin role can access all courses
      if (userRole === 'admin') {
        return next();
      }
      
      // Verify user belongs to this course
      const userCourseId = user.course_id;
      if (userCourseId !== targetCourseId) {
        return res.status(403).json({ 
          error: 'forbidden', 
          detail: 'Access denied: not authorized for this course' 
        });
      }
      
      next();
    } catch (error) {
      console.error('Course role check error:', error);
      res.status(500).json({ 
        error: 'internal_error', 
        detail: 'Failed to verify course access' 
      });
    }
  };
}

/**
 * Require user to own a specific resource (e.g., submission, review).
 * Instructors and admins can access all resources in their course.
 * 
 * @param resourceType - Type of resource (submission, review, assignment)
 * @param resourceIdExtractor - Function to extract resource_id from request
 */
export function requireResourceOwnership(
  resourceType: 'submission' | 'review' | 'assignment',
  resourceIdExtractor: (req: Request) => string | undefined
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const resourceId = resourceIdExtractor(req);
      
      if (!resourceId) {
        return res.status(400).json({ 
          error: 'bad_request', 
          detail: `${resourceType}_id parameter required` 
        });
      }
      
      // Instructors and admins bypass ownership check (handled by RLS)
      if (user.role === 'instructor' || user.role === 'admin') {
        return next();
      }
      
      // Verify ownership based on resource type
      let isOwner = false;
      
      switch (resourceType) {
        case 'submission':
          const subResult = await pool.query(
            'SELECT user_id FROM submissions WHERE submission_id = $1',
            [resourceId]
          );
          isOwner = subResult.rows.length > 0 && subResult.rows[0].user_id === user.user_id;
          break;
          
        case 'review':
          const revResult = await pool.query(
            'SELECT reviewer_id FROM reviews WHERE review_id = $1',
            [resourceId]
          );
          isOwner = revResult.rows.length > 0 && revResult.rows[0].reviewer_id === user.user_id;
          break;
          
        case 'assignment':
          const assResult = await pool.query(
            'SELECT reviewer_id FROM assignments WHERE assignment_id = $1',
            [resourceId]
          );
          isOwner = assResult.rows.length > 0 && assResult.rows[0].reviewer_id === user.user_id;
          break;
      }
      
      if (!isOwner) {
        return res.status(403).json({ 
          error: 'forbidden', 
          detail: `Access denied: not owner of this ${resourceType}` 
        });
      }
      
      next();
    } catch (error) {
      console.error('Resource ownership check error:', error);
      res.status(500).json({ 
        error: 'internal_error', 
        detail: 'Failed to verify resource ownership' 
      });
    }
  };
}

/**
 * Middleware to enforce that students can only access their assigned reviews.
 * Used on endpoints where students should only see submissions they're assigned to review.
 */
export function requireReviewerAssignment(submissionIdExtractor: (req: Request) => string | undefined) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const submissionId = submissionIdExtractor(req);
      
      if (!submissionId) {
        return res.status(400).json({ 
          error: 'bad_request', 
          detail: 'submission_id parameter required' 
        });
      }
      
      // Instructors and admins can access all submissions
      if (user.role === 'instructor' || user.role === 'admin') {
        return next();
      }
      
      // Check if student is assigned to review this submission
      const result = await pool.query(
        `SELECT 1 FROM assignments 
         WHERE submission_id = $1 
           AND reviewer_id = $2 
           AND status <> 'canceled'
         LIMIT 1`,
        [submissionId, user.user_id]
      );
      
      if (result.rows.length === 0) {
        return res.status(403).json({ 
          error: 'forbidden', 
          detail: 'Not assigned to review this submission' 
        });
      }
      
      next();
    } catch (error) {
      console.error('Reviewer assignment check error:', error);
      res.status(500).json({ 
        error: 'internal_error', 
        detail: 'Failed to verify reviewer assignment' 
      });
    }
  };
}
