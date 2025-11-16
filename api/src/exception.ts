/**
 * Generic application exception
 * Supports common HTTP error status codes with error codes for localization
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
		public readonly code: string,
		message: string,
		public readonly details?: Record<string, unknown>,
	) {
		super(message);
		this.name = "AppException";
		Error.captureStackTrace(this, this.constructor);
	}
}
