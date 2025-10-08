/**
 * Generic application exception
 * Supports common HTTP error status codes
 */
export class AppException extends Error {
  constructor(
    public readonly statusCode:
      | 400
      | 401
      | 403
      | 404
      | 409
      | 422
      | 429
      | 500
      | 503,
    message: string,
  ) {
    super(message);
    this.name = "AppException";
    Error.captureStackTrace(this, this.constructor);
  }
}
