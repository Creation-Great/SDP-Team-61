/**
 * Typed application error with HTTP status code.
 *
 * Thrown by controller / withDb callbacks and caught by the global
 * error handler in app.ts.  Using a proper class instead of bare
 * `{ status, message }` objects enables reliable `instanceof` checks
 * and preserves stack traces.
 */
export class AppError extends Error {
  public readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    // Restore prototype chain so `instanceof` works after TS transpilation
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
