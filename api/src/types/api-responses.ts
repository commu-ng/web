/**
 * Standard API response formats
 */

/**
 * Standard success response wrapper for single items or arrays
 */
export interface ApiSuccessResponse<T> {
	data: T;
}

/**
 * Standard paginated response with cursor-based pagination
 */
export interface ApiPaginatedResponse<T> {
	data: T[];
	pagination: {
		nextCursor: string | null;
		hasMore: boolean;
	};
}

/**
 * Standard error response with error code for localization
 */
export interface ApiErrorResponse {
	error: {
		code: string;
		message: string;
		details?: Record<string, unknown>;
	};
}

/**
 * Success response for operations that don't return data (e.g., DELETE)
 */
export interface ApiSuccessOperation {
	success: true;
	code: string;
	message: string;
}

/**
 * Error codes for boards API
 */
export enum BoardErrorCode {
	// Board errors
	BOARD_NOT_FOUND = "BOARD_NOT_FOUND",
	BOARD_ALREADY_EXISTS = "BOARD_ALREADY_EXISTS",
	INVALID_BOARD_SLUG = "INVALID_BOARD_SLUG",
	DUPLICATE_BOARD_SLUG = "DUPLICATE_BOARD_SLUG",

	// Board post errors
	BOARD_POST_NOT_FOUND = "BOARD_POST_NOT_FOUND",
	INVALID_IMAGE = "INVALID_IMAGE",
	INVALID_HASHTAGS = "INVALID_HASHTAGS",

	// Auth/permission errors
	UNAUTHORIZED = "UNAUTHORIZED",
	FORBIDDEN = "FORBIDDEN",
	ADMIN_ONLY = "ADMIN_ONLY",
	NOT_POST_AUTHOR = "NOT_POST_AUTHOR",

	// Validation errors
	VALIDATION_ERROR = "VALIDATION_ERROR",
	INVALID_REQUEST = "INVALID_REQUEST",

	// Server errors
	INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
	SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
}

/**
 * Success operation codes for localization
 */
export enum BoardSuccessCode {
	BOARD_CREATED = "BOARD_CREATED",
	BOARD_UPDATED = "BOARD_UPDATED",
	BOARD_DELETED = "BOARD_DELETED",
	BOARD_POST_CREATED = "BOARD_POST_CREATED",
	BOARD_POST_UPDATED = "BOARD_POST_UPDATED",
	BOARD_POST_DELETED = "BOARD_POST_DELETED",
}

/**
 * General error codes (to be used temporarily for non-board services)
 */
export const GENERAL_ERROR_CODE = "GENERAL_ERROR";
