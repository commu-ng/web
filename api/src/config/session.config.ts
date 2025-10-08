/**
 * Session and authentication configuration
 */

export const SESSION_CONFIG = {
  /**
   * Session token validity duration (in days)
   * Default: 30 days
   */
  SESSION_DURATION_DAYS: 30,

  /**
   * Exchange token validity duration (in minutes)
   * Used for one-time authentication tokens
   * Default: 5 minutes
   */
  EXCHANGE_TOKEN_DURATION_MINUTES: 5,

  /**
   * Minimum password length
   */
  MIN_PASSWORD_LENGTH: 8,

  /**
   * Maximum login name length
   */
  MAX_LOGIN_NAME_LENGTH: 100,

  /**
   * Minimum login name length
   */
  MIN_LOGIN_NAME_LENGTH: 1,

  /**
   * Bcrypt salt rounds for password hashing
   * Higher values = more secure but slower
   */
  BCRYPT_SALT_ROUNDS: 10,
} as const;

/**
 * Helper function to get SQL interval for session expiration
 */
export function getSessionExpirationInterval(): string {
  return `NOW() + INTERVAL '${SESSION_CONFIG.SESSION_DURATION_DAYS} days'`;
}

/**
 * Helper function to get SQL interval for exchange token expiration
 */
export function getExchangeTokenExpirationInterval(): string {
  return `NOW() + INTERVAL '${SESSION_CONFIG.EXCHANGE_TOKEN_DURATION_MINUTES} minutes'`;
}
