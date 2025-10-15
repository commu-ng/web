import { Hono } from "hono";
import { consoleAccountRouter } from "./account";
import { consoleBoardsRouter } from "./boards";
import { consoleCommunitiesRouter } from "./communities/index";
import { consoleSearchRouter } from "./search";
import { uploadRouter } from "./upload";

export const consoleRouter = new Hono()
  .route("/", uploadRouter)
  .route("/", consoleAccountRouter)
  .route("/", consoleCommunitiesRouter)
  .route("/", consoleSearchRouter)
  .route("/", consoleBoardsRouter);
