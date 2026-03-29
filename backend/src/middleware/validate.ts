import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Express middleware factory that validates `req.body` against a Zod schema.
 * On success the parsed (and coerced) body replaces `req.body`.
 * On failure a 400 JSON response is returned with structured error details.
 */
export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const err = new ZodValidationError(result.error, firstIssue?.message ?? 'Invalid input');
      return next(err);
    }
    // Replace body with parsed + coerced data
    req.body = result.data;
    next();
  };
}

/**
 * Express middleware factory that validates `req.params` against a Zod schema.
 * Returns 400 with structured error details on failure.
 */
export function validateParams(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const err = new ZodValidationError(result.error, firstIssue?.message ?? 'Invalid parameter');
      return next(err);
    }
    next();
  };
}

/**
 * Express middleware factory that validates `req.query` against a Zod schema.
 * Returns 400 with structured error details on failure.
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const err = new ZodValidationError(result.error, firstIssue?.message ?? 'Invalid query parameter');
      return next(err);
    }
    // Parsed data is available via result.data; keep original req.query for Express compatibility
    next();
  };
}

/**
 * Thin wrapper so the global error handler can detect zod validation failures.
 */
export class ZodValidationError extends Error {
  public readonly statusCode = 400;
  public readonly zodError: ZodError;

  constructor(zodError: ZodError, message: string) {
    super(message);
    this.zodError = zodError;
    Object.setPrototypeOf(this, ZodValidationError.prototype);
  }
}
