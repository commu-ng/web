import type { AppType } from "@commu-ng/api";
import { hc } from "hono/client";
import { env } from "./env";

// API response types
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface ApiSuccessResponse<T> {
  data: T;
}

// Helper function to extract error message from API response
export function getErrorMessage(errorData: unknown, fallback: string): string {
  const data = errorData as { error?: { message?: string } | string };
  if (typeof data.error === "object" && data.error?.message) {
    return data.error.message;
  }
  if (typeof data.error === "string") {
    return data.error;
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
