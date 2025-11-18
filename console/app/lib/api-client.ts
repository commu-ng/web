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

// Since the type resolution is causing issues, let's use a runtime solution
// where we still get the type safety at compile time but avoid the complex type inference
export const client = hc<AppType>(env.apiBaseUrl, {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => {
    return fetch(input, {
      ...init,
      credentials: "include",
    });
  },
});

// Export single unified API client
export const api = client;

// Upload image helper - uses raw fetch because FormData with Hono RPC client
// has issues with Content-Type headers
export async function uploadImage(
  file: File,
): Promise<{ id: string; url: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${env.apiBaseUrl}/console/upload/file`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(getErrorMessage(errorData, "이미지 업로드에 실패했습니다"));
  }

  return response.json();
}
