/**
 * Unit tests for the Zod validation middleware.
 */
import { jest, describe, it, expect } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate, ZodValidationError } from '../src/middleware/validate.js';

function mockReqResNext(body: unknown) {
  const req = { body } as Request;
  const res = {} as Response;
  const next = jest.fn() as jest.MockedFunction<NextFunction>;
  return { req, res, next };
}

describe('validate middleware', () => {
  const schema = z.object({
    name: z.string().min(1),
    age: z.number().int().min(0),
  });

  it('should call next() with no error for valid body', () => {
    const { req, res, next } = mockReqResNext({ name: 'Alice', age: 25 });
    validate(schema)(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(); // no args = success
  });

  it('should replace req.body with parsed data', () => {
    const { req, res, next } = mockReqResNext({ name: 'Bob', age: 30, extra: true });
    validate(schema)(req, res, next);
    expect(req.body).toEqual({ name: 'Bob', age: 30 }); // extra stripped
    expect(next).toHaveBeenCalled();
  });

  it('should call next(ZodValidationError) for invalid body', () => {
    const { req, res, next } = mockReqResNext({ name: '', age: -1 });
    validate(schema)(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(ZodValidationError);
    expect((err as ZodValidationError).statusCode).toBe(400);
  });

  it('should call next(ZodValidationError) for missing fields', () => {
    const { req, res, next } = mockReqResNext({});
    validate(schema)(req, res, next);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(ZodValidationError);
  });
});

describe('ZodValidationError', () => {
  it('should include zodError property', () => {
    const schema = z.object({ x: z.string() });
    const result = schema.safeParse({ x: 123 });
    if (result.success) throw new Error('should fail');
    const err = new ZodValidationError(result.error, 'bad');
    expect(err.message).toBe('bad');
    expect(err.zodError).toBe(result.error);
    expect(err.statusCode).toBe(400);
    expect(err).toBeInstanceOf(Error);
  });
});
