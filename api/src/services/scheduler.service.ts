import { logger } from "../config/logger";
import * as postService from "./post.service";

const SCHEDULER_INTERVAL_MS = 60000; // 1 minute

let schedulerInterval: NodeJS.Timeout | null = null;

/**
 * Start the scheduler that publishes scheduled posts
 */
export function startScheduler(): void {
  if (schedulerInterval) {
    logger.http.warn("Scheduler is already running");
    return;
  }

  logger.http.info("Starting scheduler");

  // Run immediately on start
  runScheduledTasks();

  // Then run every minute
  schedulerInterval = setInterval(() => {
    runScheduledTasks();
  }, SCHEDULER_INTERVAL_MS);
}

/**
 * Stop the scheduler
 */
export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logger.http.info("Scheduler stopped");
  }
}

/**
 * Run scheduled tasks (publish due posts)
 */
async function runScheduledTasks(): Promise<void> {
  try {
    // Publish scheduled posts
    const publishedCount = await postService.publishScheduledPosts();

    if (publishedCount > 0) {
      logger.http.info(`Published ${publishedCount} scheduled post(s)`);
    }
  } catch (error) {
    logger.http.error("Error running scheduled tasks", { error });
  }
}
