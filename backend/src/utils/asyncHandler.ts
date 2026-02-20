import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an Express route handler or middleware so that:
 *
 *   1. **Async safety** – rejected promises are forwarded to Express's
 *      global error handler via `next(err)`.
 *   2. **Centralised type cast** – the `Request → Req` (e.g. `AuthRequest`)
 *      cast lives here *once*, so route files never need `as any`.
 *
 * Works for both sync and async handlers / middleware.
 *
 * @example
 *   // controller:  (req: AuthRequest, res: Response) => Promise<void>
 *   router.get('/overview', h(getOverview));
 *
 *   // middleware:   (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>
 *   router.use(h(authenticate));
 *
 *   // middleware factory:
 *   router.use(h(requireRole('instructor')));
 */
export function h<Req extends Request = Request>(
  fn: (req: Req, res: Response, next: NextFunction) => Promise<void> | void,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as Req, res, next)).catch(next);
  };
}
