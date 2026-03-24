/**
 * Typed application error with HTTP status code and optional error code.
 *
 * Thrown by controller / withDb callbacks and caught by the global
 * error handler in app.ts.  Using a proper class instead of bare
 * `{ status, message }` objects enables reliable `instanceof` checks
 * and preserves stack traces.
 *
 * Response shape: `{ error: code, message, details? }`. If `code` is omitted,
 * the handler derives one from statusCode (e.g. 401 → 'unauthorized').
 */
export class AppError extends Error {
  public readonly statusCode: number;
  /** Machine-readable error code (e.g. 'unauthorized', 'not_found'). Omit to use default from status. */
  public readonly code?: string;

  constructor(statusCode: number, message: string, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
