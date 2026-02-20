/**
 * Unit tests for utility modules that do NOT require DB access.
 */
import { jest, describe, it, expect, beforeAll } from '@jest/globals';
import { AppError } from '../src/utils/AppError.js';

/* ================================================================== */
/*  AppError                                                          */
/* ================================================================== */
describe('AppError', () => {
  it('should set statusCode and message', () => {
    const err = new AppError(404, 'Not found');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Not found');
  });

  it('should produce a proper stack trace', () => {
    const err = new AppError(500, 'boom');
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('boom');
  });
});

/* ================================================================== */
/*  asyncHandler (h)                                                  */
/* ================================================================== */
describe('asyncHandler (h)', () => {
  let h: typeof import('../src/utils/asyncHandler.js').h;

  beforeAll(async () => {
    const mod = await import('../src/utils/asyncHandler.js');
    h = mod.h;
  });

  it('should call next with error when async handler rejects', async () => {
    const error = new Error('async failure');
    const handler = h(async (_req, _res) => {
      throw error;
    });

    const next = jest.fn();
    await handler({} as any, {} as any, next);
    expect(next).toHaveBeenCalledWith(error);
  });

  it('should not call next when handler resolves', async () => {
    const handler = h(async (_req, res) => {
      res.json({ ok: true });
    });

    const next = jest.fn();
    const mockRes = { json: jest.fn() } as any;
    await handler({} as any, mockRes, next);
    expect(next).not.toHaveBeenCalled();
    expect(mockRes.json).toHaveBeenCalledWith({ ok: true });
  });
});
