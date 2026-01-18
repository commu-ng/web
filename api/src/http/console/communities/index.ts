import { Hono } from "hono";
import { applicationsRouter } from "./applications";
import { botsRouter } from "./bots";
import { crudRouter } from "./crud";
import { linksRouter } from "./links";
import { membersRouter } from "./members";
import { moderationRouter } from "./moderation";
import { statsRouter } from "./stats";

export const consoleCommunitiesRouter = new Hono()
  .route("/communities", crudRouter)
  .route("/communities", statsRouter)
  .route("/communities", linksRouter)
  .route("/communities", membersRouter)
  .route("/communities", applicationsRouter)
  .route("/communities", moderationRouter)
  .route("/communities", botsRouter);
