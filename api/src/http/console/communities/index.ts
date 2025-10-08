import { Hono } from "hono";
import { applicationsRouter } from "./applications";
import { crudRouter } from "./crud";
import { linksRouter } from "./links";
import { membersRouter } from "./members";
import { statsRouter } from "./stats";

export const consoleCommunitiesRouter = new Hono()
  .route("/communities", crudRouter)
  .route("/communities", statsRouter)
  .route("/communities", linksRouter)
  .route("/communities", membersRouter)
  .route("/communities", applicationsRouter);
