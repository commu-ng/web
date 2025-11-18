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
  const data = errorData as { error?: string };
  return data.error || fallback;
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
