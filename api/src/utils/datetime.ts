/**
 * Format a timestamp to ISO 8601 string.
 * Handles nullable timestamps by returning null.
 */
export function formatISODate(
  timestamp: string | Date | null | undefined,
): string | null {
  if (!timestamp) {
    return null;
  }
  return new Date(timestamp).toISOString();
}

/**
 * Format a timestamp to ISO 8601 string.
 * Returns a default value if timestamp is null/undefined.
 */
export function formatISODateRequired(
  timestamp: string | Date | null | undefined,
  defaultValue: string,
): string {
  if (!timestamp) {
    return defaultValue;
  }
  return new Date(timestamp).toISOString();
}
