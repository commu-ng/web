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
    next_cursor: string | null;
    has_more: boolean;
    total_count: number;
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
 * General error codes for API responses
 */
export enum GeneralErrorCode {
  // Validation errors
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INVALID_REQUEST = "INVALID_REQUEST",
  MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD",
  INVALID_CONTENT_TYPE = "INVALID_CONTENT_TYPE",

  // Auth/permission errors
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  SESSION_REQUIRED = "SESSION_REQUIRED",
  NOT_OWNER = "NOT_OWNER",
  NOT_AUTHOR = "NOT_AUTHOR",

  // Resource errors
  NOT_FOUND = "NOT_FOUND",
  PROFILE_NOT_FOUND = "PROFILE_NOT_FOUND",
  POST_NOT_FOUND = "POST_NOT_FOUND",
  MESSAGE_NOT_FOUND = "MESSAGE_NOT_FOUND",
  CONVERSATION_NOT_FOUND = "CONVERSATION_NOT_FOUND",
  FILE_NOT_FOUND = "FILE_NOT_FOUND",
  APPLICATION_NOT_FOUND = "APPLICATION_NOT_FOUND",
  NOTIFICATION_NOT_FOUND = "NOTIFICATION_NOT_FOUND",
  COMMUNITY_NOT_FOUND = "COMMUNITY_NOT_FOUND",
  MEMBER_NOT_FOUND = "MEMBER_NOT_FOUND",
  OWNERSHIP_NOT_FOUND = "OWNERSHIP_NOT_FOUND",

  // Conflict errors
  USERNAME_TAKEN = "USERNAME_TAKEN",
  EMAIL_TAKEN = "EMAIL_TAKEN",
  RESOURCE_CONFLICT = "RESOURCE_CONFLICT",
  DUPLICATE_ENTRY = "DUPLICATE_ENTRY",

  // File upload errors
  NO_FILE_UPLOADED = "NO_FILE_UPLOADED",
  INVALID_FILE = "INVALID_FILE",
  INVALID_FILE_TYPE = "INVALID_FILE_TYPE",
  FILE_TOO_LARGE = "FILE_TOO_LARGE",
  INVALID_PROFILE_PICTURE = "INVALID_PROFILE_PICTURE",

  // Account errors
  CANNOT_DELETE_WHILE_TRANSITIONING = "CANNOT_DELETE_WHILE_TRANSITIONING",
  INVALID_PASSWORD = "INVALID_PASSWORD",

  // Operation errors
  OPERATION_NOT_ALLOWED = "OPERATION_NOT_ALLOWED",
  SELF_ACTION_NOT_ALLOWED = "SELF_ACTION_NOT_ALLOWED",

  // Server errors
  INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  SESSION_CREATION_FAILED = "SESSION_CREATION_FAILED",
}

/**
 * Helper function to create standardized error response
 */
export function createErrorResponse(
  code: string,
  message: string,
  details?: Record<string, unknown>,
): ApiErrorResponse {
  return {
    error: {
      code,
      message,
      ...(details && { details }),
    },
  };
}

/**
 * @deprecated Use GeneralErrorCode enum instead
 */
export const GENERAL_ERROR_CODE = "GENERAL_ERROR";
