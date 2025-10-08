import { Hono } from "hono";
import { cors } from "hono/cors";
import type { user as userTable } from "../drizzle/schema";
import { appRouter } from "../http/app/index";
import { auth } from "../http/auth";
import { consoleRouter } from "../http/console";
import * as authService from "../services/auth.service";

/**
 * Create a test app instance that uses the transactional DB
 * This mirrors the production app setup but without the server
 */
export function createTestApp() {
  const app = new Hono()
    .use(
      "/*",
      cors({
        origin: "*", // Allow all origins in tests
        allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allowHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
        credentials: true,
      }),
    )
    .get("/", (c) => {
      return c.text("OK");
    })
    .get("/health", (c) => {
      return c.text("OK");
    })
    .route("/auth", auth)
    .route("/app", appRouter)
    .route("/console", consoleRouter);

  return app;
}

/**
 * Create an authenticated session for a user
 * Returns the session token that can be used in Authorization header
 * @param user - User to create session for
 * @param communityId - Optional community ID to scope the session (null for console, required for app)
 */
export async function createAuthSession(
  user: typeof userTable.$inferSelect,
  communityId: string | null = null,
): Promise<string> {
  const session = await authService.createSession(user.id, communityId);
  return session.token;
}

/**
 * Create session token and format as Bearer header
 */
export async function createAuthHeader(
  user: typeof userTable.$inferSelect,
  communityId: string | null = null,
): Promise<Record<string, string>> {
  const token = await createAuthSession(user, communityId);
  return {
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Helper to make an authenticated request (Bearer token - for app routes)
 */
export async function makeAuthenticatedRequest(
  app: Hono,
  url: string,
  user: typeof userTable.$inferSelect,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    communityId?: string | null;
  } = {},
) {
  const communityId = options.communityId ?? null;
  const authHeader = await createAuthHeader(user, communityId);
  const headers: Record<string, string> = {
    ...authHeader,
    ...options.headers,
  };

  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  return app.request(url, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

/**
 * Helper to make an authenticated request using cookies (for console routes)
 * Console sessions are always created with communityId = null
 */
export async function makeConsoleAuthenticatedRequest(
  app: Hono,
  url: string,
  user: typeof userTable.$inferSelect,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
) {
  const token = await createAuthSession(
    user,
    null, // Console sessions are not scoped to a community
  );
  const headers: Record<string, string> = {
    Cookie: `session_token=${token}`,
    ...options.headers,
  };

  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  return app.request(url, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

/**
 * Helper to assert error responses
 */
export function expectError(
  response: Response,
  status: number,
  errorMessage?: string,
) {
  if (response.status !== status) {
    throw new Error(`Expected status ${status} but got ${response.status}`);
  }

  if (errorMessage) {
    return response.json().then((data) => {
      const message = data.error || data.message;
      if (!message || !message.includes(errorMessage)) {
        throw new Error(
          `Expected error message to include "${errorMessage}" but got "${message}"`,
        );
      }
      return data;
    });
  }

  return response.json();
}

/**
 * Helper to assert successful responses
 */
export async function expectSuccess(response: Response, status = 200) {
  if (response.status !== status) {
    const body = await response.text();
    throw new Error(
      `Expected status ${status} but got ${response.status}. Body: ${body}`,
    );
  }

  return response.json();
}
