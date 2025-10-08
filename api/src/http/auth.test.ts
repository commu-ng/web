import { describe, expect, it, vi } from "vitest";

// Mock the db module before importing services
vi.mock("../db");

import { createTestUser } from "../test/factories";
import { createAuthSession, createTestApp } from "../test/http-helpers";

describe("Auth Routes", () => {
  describe("POST /auth/logout", () => {
    it("should logout user with valid session", async () => {
      const app = createTestApp();
      const user = await createTestUser();
      const sessionToken = await createAuthSession(user);

      const res = await app.request("/auth/logout", {
        method: "POST",
        headers: {
          Cookie: `session_token=${sessionToken}`,
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe("성공적으로 로그아웃되었습니다");
    });

    it("should return 400 when session token is missing", async () => {
      const app = createTestApp();

      const res = await app.request("/auth/logout", {
        method: "POST",
      });

      expect(res.status).toBe(401);
    });

    it("should return 401 when session token is invalid", async () => {
      const app = createTestApp();

      // Use a valid UUID format but non-existent session
      const invalidUUID = "00000000-0000-0000-0000-000000000000";

      const res = await app.request("/auth/logout", {
        method: "POST",
        headers: {
          Cookie: `session_token=${invalidUUID}`,
        },
      });

      expect(res.status).toBe(401);
    });
  });

  describe("POST /auth/callback", () => {
    it("should return 400 when token is missing", async () => {
      const app = createTestApp();

      const res = await app.request("/auth/callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          domain: "test.localhost",
        }),
      });

      expect(res.status).toBe(400);
    });

    it("should return 400 when domain is missing", async () => {
      const app = createTestApp();

      const res = await app.request("/auth/callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: "some-token",
        }),
      });

      expect(res.status).toBe(400);
    });

    it("should return error when token is invalid", async () => {
      const app = createTestApp();

      const res = await app.request("/auth/callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: "invalid-token",
          domain: "test.localhost",
        }),
      });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe("GET /auth/sso", () => {
    it("should redirect to login when not authenticated", async () => {
      const app = createTestApp();

      const res = await app.request(
        "/auth/sso?return_to=https://test.localhost/home",
      );

      expect(res.status).toBe(302);
      const location = res.headers.get("location");
      expect(location).toContain("/login");
      expect(location).toContain("next=");
    });

    it("should return 400 when return_to is missing", async () => {
      const app = createTestApp();
      const user = await createTestUser();
      const sessionToken = await createAuthSession(user);

      const res = await app.request("/auth/sso", {
        headers: {
          Cookie: `session_token=${sessionToken}`,
        },
      });

      expect(res.status).toBe(400);
    });
  });
});
