import type { AppType } from "@commu-ng/api";
import { hc } from "hono/client";
import { env } from "./env";

// API response types
export interface ApiErrorResponse {
  error?: string;
  message?: string;
}

export interface ApiSuccessResponse {
  message?: string;
}

// Helper function to extract error message from API response
export function getErrorMessage(errorData: unknown, fallback: string): string {
  if (
    typeof errorData === "object" &&
    errorData !== null &&
    ("error" in errorData || "message" in errorData)
  ) {
    const error =
      "error" in errorData && typeof errorData.error === "string"
        ? errorData.error
        : undefined;
    const message =
      "message" in errorData && typeof errorData.message === "string"
        ? errorData.message
        : undefined;
    return error || message || fallback;
  }
  return fallback;
}

export const client = hc<AppType>(env.apiBaseUrl, {
  headers: () => {
    const sessionToken =
      typeof window !== "undefined"
        ? localStorage.getItem("session_token")
        : null;

    const headers: Record<string, string> = {};
    if (sessionToken) {
      headers.Authorization = `Bearer ${sessionToken}`;
    }
    return headers;
  },
});
