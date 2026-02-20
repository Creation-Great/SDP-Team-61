/**
 * Unit tests for roleGuard middleware.
 */
import { jest, describe, it, expect } from '@jest/globals';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../src/types.js';
import { requireRole } from '../src/middleware/roleGuard.js';

function mockContext(role?: string) {
  const req = { user: role ? { role } : undefined } as unknown as AuthRequest;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  const next = jest.fn() as unknown as NextFunction;
  return { req, res, next };
}

describe('requireRole', () => {
  it('should call next() if user has the required role', () => {
    const { req, res, next } = mockContext('instructor');
    requireRole('instructor')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should call next() if user is admin (bypass)', () => {
    const { req, res, next } = mockContext('admin');
    requireRole('instructor')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should return 403 if role does not match', () => {
    const { req, res, next } = mockContext('student');
    requireRole('instructor')(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'forbidden' }),
    );
  });

  it('should return 401 if no user is present', () => {
    const { req, res, next } = mockContext(undefined);
    requireRole('student')(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('should accept multiple allowed roles', () => {
    const { req, res, next } = mockContext('student');
    requireRole('student', 'instructor')(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
