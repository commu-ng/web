import { logger } from "../config/logger";
import * as exportJobService from "./export-job.service";
import * as postService from "./post.service";

const SCHEDULER_INTERVAL_MS = 60000; // 1 minute

let schedulerInterval: NodeJS.Timeout | null = null;
let exportJobProcessing = false;

/**
 * Start the scheduler that publishes scheduled posts and processes export jobs
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
 * Run scheduled tasks (publish due posts and process export jobs)
 */
async function runScheduledTasks(): Promise<void> {
  try {
    // Publish scheduled posts
    const publishedCount = await postService.publishScheduledPosts();

    if (publishedCount > 0) {
      logger.http.info(`Published ${publishedCount} scheduled post(s)`);
    }

    // Process export jobs (one at a time)
    if (!exportJobProcessing) {
      exportJobProcessing = true;
      try {
        await processExportJobs();
      } finally {
        exportJobProcessing = false;
      }
    }
  } catch (error) {
    logger.http.error("Error running scheduled tasks", { error });
  }
}

/**
 * Process pending export jobs
 * Processes one job at a time to avoid memory issues
 */
async function processExportJobs(): Promise<void> {
  try {
    const jobId = await exportJobService.getNextPendingJob();

    if (jobId) {
      logger.http.info("Processing export job", { jobId });
      await exportJobService.processExportJob(jobId);
    }
  } catch (error) {
    logger.http.error("Error processing export jobs", { error });
    throw error;
  }
}
