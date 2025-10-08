/**
 * Safely extracts error message from API response
 */
export async function getErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const errorData = await response.json();
    return errorData.detail || fallback;
  } catch {
    // If JSON parsing fails, return fallback message
    return fallback;
  }
}

/**
 * Safely extracts error message from any error object
 */
export function formatError(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  // For any other type (including objects), return fallback
  return fallback;
}
