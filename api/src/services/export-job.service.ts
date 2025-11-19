import { and, eq, isNotNull, or, sql } from "drizzle-orm";
import { logger } from "../config/logger";
import { db } from "../db";
import {
  communityExport as communityExportTable,
  community as communityTable,
  membership as membershipTable,
  user as userTable,
} from "../drizzle/schema";
import { AppException } from "../exception";
import { GENERAL_ERROR_CODE } from "../types/api-responses";
import { getFileUrl, uploadExportFile } from "../utils/r2";
import * as emailService from "./email.service";
import * as exportService from "./export.service";

/**
 * Create a new export job
 * Prevents concurrent exports for the same user/community combination
 * Requires verified email
 */
export async function createExportJob(communityId: string, userId: string) {
  // Verify user exists and has verified email
  const user = await db.query.user.findFirst({
    where: eq(userTable.id, userId),
  });

  if (!user) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "사용자를 찾을 수 없습니다",
    );
  }

  if (!user.email) {
    throw new AppException(
      403,
      GENERAL_ERROR_CODE,
      "이메일 주소가 필요합니다. 이메일을 등록한 후 다시 시도해주세요.",
    );
  }

  if (!user.emailVerifiedAt) {
    throw new AppException(
      403,
      GENERAL_ERROR_CODE,
      "이메일 인증이 필요합니다. 이메일을 인증한 후 다시 시도해주세요.",
    );
  }

  // Check for existing pending/processing jobs
  const existingJob = await db.query.communityExport.findFirst({
    where: and(
      eq(communityExportTable.communityId, communityId),
      eq(communityExportTable.userId, userId),
      or(
        eq(communityExportTable.status, "pending"),
        eq(communityExportTable.status, "processing"),
      ),
    ),
  });

  if (existingJob) {
    throw new AppException(
      409,
      GENERAL_ERROR_CODE,
      "이미 진행 중인 내보내기가 있습니다",
    );
  }

  // Create new export job
  const result = await db
    .insert(communityExportTable)
    .values({
      communityId,
      userId,
      status: "pending",
    })
    .returning();

  const job = result[0];
  if (!job) {
    throw new Error("Failed to create export job");
  }

  return {
    id: job.id,
    status: job.status,
    created_at: job.createdAt,
  };
}

/**
 * Process an export job
 * Called by the background scheduler
 */
export async function processExportJob(jobId: string): Promise<void> {
  // Get the job
  const job = await db.query.communityExport.findFirst({
    where: eq(communityExportTable.id, jobId),
  });

  if (!job) {
    logger.service.error("Export job not found", { jobId });
    return;
  }

  if (job.status !== "pending") {
    logger.service.warn("Export job is not pending", {
      jobId,
      status: job.status,
    });
    return;
  }

  // Mark as processing
  await db
    .update(communityExportTable)
    .set({ status: "processing" })
    .where(eq(communityExportTable.id, jobId));

  try {
    // Generate export stream
    const { stream, filename } = await exportService.exportCommunityData(
      job.communityId,
      job.userId,
    );

    // Upload stream to R2 (streams directly, no memory accumulation)
    const r2Key = await uploadExportFile(stream, filename);

    // Set expiration date (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Mark as completed
    await db
      .update(communityExportTable)
      .set({
        status: "completed",
        r2Key,
        completedAt: sql`NOW()`,
        expiresAt: expiresAt.toISOString(),
      })
      .where(eq(communityExportTable.id, jobId));

    // Send email notification
    const user = await db.query.user.findFirst({
      where: eq(userTable.id, job.userId),
    });

    const community = await db.query.community.findFirst({
      where: eq(communityTable.id, job.communityId),
    });

    if (user?.email && community) {
      const downloadUrl = getFileUrl(r2Key);
      await emailService.sendExportReadyEmail(
        user.email,
        downloadUrl,
        community.name,
      );
    }

    logger.service.info("Export job completed successfully", { jobId });
  } catch (error) {
    // Mark as failed
    await db
      .update(communityExportTable)
      .set({
        status: "failed",
        errorMessage:
          error instanceof Error ? error.message : "Unknown error occurred",
        completedAt: sql`NOW()`,
      })
      .where(eq(communityExportTable.id, jobId));

    throw error;
  }
}

/**
 * Get export job status
 * User must own the job and have active membership in the community
 */
export async function getExportJobStatus(jobId: string, userId: string) {
  const job = await db.query.communityExport.findFirst({
    where: and(
      eq(communityExportTable.id, jobId),
      eq(communityExportTable.userId, userId),
    ),
  });

  if (!job) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "내보내기 작업을 찾을 수 없습니다",
    );
  }

  // Verify user still has active membership in the community
  const membership = await db.query.membership.findFirst({
    where: and(
      eq(membershipTable.userId, userId),
      eq(membershipTable.communityId, job.communityId),
      isNotNull(membershipTable.activatedAt),
    ),
  });

  if (!membership) {
    throw new AppException(
      403,
      GENERAL_ERROR_CODE,
      "이 커뮤의 활성 회원이 아니므로 내보내기 상태에 접근할 수 없습니다",
    );
  }

  return {
    id: job.id,
    status: job.status,
    download_url: job.r2Key ? getFileUrl(job.r2Key) : null,
    expires_at: job.expiresAt,
    error_message: job.errorMessage,
    created_at: job.createdAt,
    completed_at: job.completedAt,
  };
}

/**
 * Get all export jobs for a user in a community
 */
export async function getUserExports(userId: string, communityId: string) {
  const exports = await db.query.communityExport.findMany({
    where: and(
      eq(communityExportTable.userId, userId),
      eq(communityExportTable.communityId, communityId),
    ),
    orderBy: sql`${communityExportTable.createdAt} DESC`,
    limit: 10,
  });

  return exports.map((exp) => ({
    id: exp.id,
    status: exp.status,
    download_url: exp.r2Key ? getFileUrl(exp.r2Key) : null,
    expires_at: exp.expiresAt,
    created_at: exp.createdAt,
    completed_at: exp.completedAt,
    error_message: exp.errorMessage,
  }));
}

/**
 * Get next pending export job
 * Used by the scheduler to process jobs one at a time
 */
export async function getNextPendingJob(): Promise<string | null> {
  const job = await db.query.communityExport.findFirst({
    where: eq(communityExportTable.status, "pending"),
    orderBy: sql`${communityExportTable.createdAt} ASC`,
  });

  return job?.id || null;
}
