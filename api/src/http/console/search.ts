import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { logger } from "../../config/logger";
import { authMiddleware } from "../../middleware/auth";
import * as searchService from "../../services/search.service";

// Search query schema
const searchQuerySchema = z.object({
  query: z.string().min(2, "Query must be at least 2 characters").optional(),
  q: z.string().min(2, "Query must be at least 2 characters").optional(),
});

export const consoleSearchRouter = new Hono().get(
  "/hashtags/search",
  authMiddleware,
  zValidator("query", searchQuerySchema),
  async (c) => {
    const { q: query } = c.req.valid("query");

    try {
      const result = await searchService.searchHashtags(query || "", 10);
      return c.json(result);
    } catch (error) {
      logger.http.error("Error searching hashtags", { error });
      return c.json({ error: "해시태그 검색에 실패했습니다" }, 500);
    }
  },
);
