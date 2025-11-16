import { randomUUID } from "node:crypto";
import { createMessage } from "@upyo/core";
import { MailgunTransport } from "@upyo/mailgun";
import { and, eq, isNull, sql } from "drizzle-orm";
import { env } from "../config/env";
import { db } from "../db";
import {
  accountDeletionToken as accountDeletionTokenTable,
  emailVerificationToken as emailVerificationTokenTable,
  passwordResetToken as passwordResetTokenTable,
  user as userTable,
} from "../drizzle/schema";
import { AppException } from "../exception";
import { GENERAL_ERROR_CODE } from "../types/api-responses";

const transport = new MailgunTransport({
  apiKey: env.mailgun.apiKey,
  domain: env.mailgun.domain,
  region: "us",
});

const DOMAIN = env.consoleDomain;

/**
 * Send email verification email and create token
 */
export async function sendVerificationEmail(userId: string, email: string) {
  // Create verification token
  const token = randomUUID();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours expiry

  // Save token to database
  await db.insert(emailVerificationTokenTable).values({
    userId,
    email,
    token,
    expiresAt: expiresAt.toISOString(),
  });

  // Create verification URL
  const verificationUrl = `https://${DOMAIN}/verify-email?token=${token}`;

  // Send email
  const message = createMessage({
    from: `커뮹! <noreply@${env.mailgun.domain}>`,
    to: email,
    subject: "이메일 인증",
    content: {
      text: `이메일 인증을 완료하려면 다음 링크를 클릭하세요:\n\n${verificationUrl}\n\n이 링크는 24시간 후에 만료됩니다.`,
      html: `
        <h2>이메일 인증</h2>
        <p>이메일 인증을 완료하려면 아래 버튼을 클릭하세요:</p>
        <a href="${verificationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">이메일 인증하기</a>
        <p>또는 다음 링크를 복사하여 브라우저에 붙여넣으세요:</p>
        <p>${verificationUrl}</p>
        <p style="color: #666; font-size: 14px;">이 링크는 24시간 후에 만료됩니다.</p>
      `,
    },
  });

  const receipt = await transport.send(message);

  if (!receipt.successful) {
    throw new Error(`이메일 전송 실패: ${receipt.errorMessages.join(", ")}`);
  }

  return { token };
}

/**
 * Verify email with token
 */
export async function verifyEmail(token: string) {
  // Find token
  const verificationToken = await db.query.emailVerificationToken.findFirst({
    where: and(
      eq(emailVerificationTokenTable.token, token),
      isNull(emailVerificationTokenTable.verifiedAt),
    ),
  });

  if (!verificationToken) {
    throw new Error("유효하지 않은 인증 토큰입니다");
  }

  // Check if expired
  const now = new Date();
  const expiresAt = new Date(verificationToken.expiresAt);
  if (now > expiresAt) {
    throw new Error("만료된 인증 토큰입니다");
  }

  // Mark token as verified
  await db
    .update(emailVerificationTokenTable)
    .set({ verifiedAt: sql`NOW()` })
    .where(eq(emailVerificationTokenTable.id, verificationToken.id));

  // Update user's email and emailVerifiedAt
  await db
    .update(userTable)
    .set({
      email: verificationToken.email,
      emailVerifiedAt: sql`NOW()`,
    })
    .where(eq(userTable.id, verificationToken.userId));

  return {
    userId: verificationToken.userId,
    email: verificationToken.email,
  };
}

/**
 * Send account deletion confirmation email
 */
export async function sendAccountDeletionEmail(userId: string, email: string) {
  // Create deletion token
  const token = randomUUID();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry

  // Save token to database
  await db.insert(accountDeletionTokenTable).values({
    userId,
    token,
    expiresAt: expiresAt.toISOString(),
  });

  // Create confirmation URL
  const confirmationUrl = `https://${DOMAIN}/confirm-delete-account?token=${token}`;

  // Send email
  const message = createMessage({
    from: `커뮹! <noreply@${env.mailgun.domain}>`,
    to: email,
    subject: "계정 삭제 확인",
    content: {
      text: `계정 삭제를 확인하려면 다음 링크를 클릭하세요:\n\n${confirmationUrl}\n\n이 링크는 1시간 후에 만료됩니다.\n\n계정 삭제를 요청하지 않으셨다면 이 이메일을 무시하세요.`,
      html: `
        <h2>계정 삭제 확인</h2>
        <p>계정 삭제를 확인하려면 아래 버튼을 클릭하세요:</p>
        <a href="${confirmationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 4px;">계정 삭제 확인</a>
        <p>또는 다음 링크를 복사하여 브라우저에 붙여넣으세요:</p>
        <p>${confirmationUrl}</p>
        <p style="color: #666; font-size: 14px;">이 링크는 1시간 후에 만료됩니다.</p>
        <p style="color: #dc2626; font-size: 14px; font-weight: bold;">계정 삭제를 요청하지 않으셨다면 이 이메일을 무시하세요.</p>
      `,
    },
  });

  const receipt = await transport.send(message);

  if (!receipt.successful) {
    throw new Error(`이메일 전송 실패: ${receipt.errorMessages.join(", ")}`);
  }

  return { token };
}

/**
 * Verify and use account deletion token
 */
/**
 * Check account deletion token without marking it as used
 */
export async function checkAccountDeletionToken(token: string) {
  // Find token
  const deletionToken = await db.query.accountDeletionToken.findFirst({
    where: and(
      eq(accountDeletionTokenTable.token, token),
      isNull(accountDeletionTokenTable.usedAt),
    ),
  });

  if (!deletionToken) {
    throw new AppException(
      400,
      GENERAL_ERROR_CODE,
      "유효하지 않은 삭제 확인 토큰입니다",
    );
  }

  // Check if expired
  const now = new Date();
  const expiresAt = new Date(deletionToken.expiresAt);
  if (now > expiresAt) {
    throw new AppException(
      400,
      GENERAL_ERROR_CODE,
      "만료된 삭제 확인 토큰입니다",
    );
  }

  return {
    userId: deletionToken.userId,
  };
}

export async function verifyAccountDeletionToken(token: string) {
  // Find token
  const deletionToken = await db.query.accountDeletionToken.findFirst({
    where: and(
      eq(accountDeletionTokenTable.token, token),
      isNull(accountDeletionTokenTable.usedAt),
    ),
  });

  if (!deletionToken) {
    throw new AppException(
      400,
      GENERAL_ERROR_CODE,
      "유효하지 않은 삭제 확인 토큰입니다",
    );
  }

  // Check if expired
  const now = new Date();
  const expiresAt = new Date(deletionToken.expiresAt);
  if (now > expiresAt) {
    throw new Error("만료된 삭제 확인 토큰입니다");
  }

  // Mark token as used
  await db
    .update(accountDeletionTokenTable)
    .set({ usedAt: sql`NOW()` })
    .where(eq(accountDeletionTokenTable.id, deletionToken.id));

  return {
    userId: deletionToken.userId,
  };
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email: string) {
  // Find user by email
  const user = await db.query.user.findFirst({
    where: and(eq(userTable.email, email), isNull(userTable.deletedAt)),
  });

  if (!user) {
    throw new AppException(
      404,
      GENERAL_ERROR_CODE,
      "해당 이메일로 등록된 계정을 찾을 수 없습니다",
    );
  }

  if (!user.emailVerifiedAt) {
    throw new AppException(
      403,
      GENERAL_ERROR_CODE,
      "이메일이 인증되지 않았습니다",
    );
  }

  // Create reset token
  const token = randomUUID();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry

  // Save token to database
  await db.insert(passwordResetTokenTable).values({
    userId: user.id,
    token,
    expiresAt: expiresAt.toISOString(),
  });

  // Create reset URL
  const resetUrl = `https://${DOMAIN}/reset-password?token=${token}`;

  // Send email
  const message = createMessage({
    from: `커뮹! <noreply@${env.mailgun.domain}>`,
    to: email,
    subject: "비밀번호 재설정",
    content: {
      text: `비밀번호를 재설정하려면 다음 링크를 클릭하세요:\n\n${resetUrl}\n\n이 링크는 1시간 후에 만료됩니다.\n\n비밀번호 재설정을 요청하지 않으셨다면 이 이메일을 무시하세요.`,
      html: `
        <h2>비밀번호 재설정</h2>
        <p>비밀번호를 재설정하려면 아래 버튼을 클릭하세요:</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">비밀번호 재설정</a>
        <p>또는 다음 링크를 복사하여 브라우저에 붙여넣으세요:</p>
        <p>${resetUrl}</p>
        <p style="color: #666; font-size: 14px;">이 링크는 1시간 후에 만료됩니다.</p>
        <p style="color: #dc2626; font-size: 14px; font-weight: bold;">비밀번호 재설정을 요청하지 않으셨다면 이 이메일을 무시하세요.</p>
      `,
    },
  });

  const receipt = await transport.send(message);

  if (!receipt.successful) {
    throw new Error(`이메일 전송 실패: ${receipt.errorMessages.join(", ")}`);
  }

  return { token };
}

/**
 * Check password reset token without marking it as used
 */
export async function checkPasswordResetToken(token: string) {
  // Find token
  const resetToken = await db.query.passwordResetToken.findFirst({
    where: and(
      eq(passwordResetTokenTable.token, token),
      isNull(passwordResetTokenTable.usedAt),
    ),
  });

  if (!resetToken) {
    throw new Error("유효하지 않은 비밀번호 재설정 토큰입니다");
  }

  // Check if expired
  const now = new Date();
  const expiresAt = new Date(resetToken.expiresAt);
  if (now > expiresAt) {
    throw new Error("만료된 비밀번호 재설정 토큰입니다");
  }

  return {
    userId: resetToken.userId,
  };
}

/**
 * Verify and use password reset token
 */
export async function verifyPasswordResetToken(token: string) {
  // Find token
  const resetToken = await db.query.passwordResetToken.findFirst({
    where: and(
      eq(passwordResetTokenTable.token, token),
      isNull(passwordResetTokenTable.usedAt),
    ),
  });

  if (!resetToken) {
    throw new Error("유효하지 않은 비밀번호 재설정 토큰입니다");
  }

  // Check if expired
  const now = new Date();
  const expiresAt = new Date(resetToken.expiresAt);
  if (now > expiresAt) {
    throw new Error("만료된 비밀번호 재설정 토큰입니다");
  }

  // Mark token as used
  await db
    .update(passwordResetTokenTable)
    .set({ usedAt: sql`NOW()` })
    .where(eq(passwordResetTokenTable.id, resetToken.id));

  return {
    userId: resetToken.userId,
  };
}

/**
 * Send export ready notification email
 */
export async function sendExportReadyEmail(
  email: string,
  downloadUrl: string,
  communityName: string,
) {
  const message = createMessage({
    from: `커뮹! <noreply@${env.mailgun.domain}>`,
    to: email,
    subject: `${communityName} 커뮤 내보내기 완료`,
    content: {
      text: `${communityName} 커뮤의 데이터 내보내기가 완료되었습니다.\n\n다운로드 링크:\n${downloadUrl}`,
      html: `
        <h2>${communityName} 커뮤 내보내기 완료</h2>
        <p>${communityName} 커뮤의 데이터 내보내기가 완료되었습니다.</p>
        <p>아래 버튼을 클릭하여 다운로드하세요:</p>
        <a href="${downloadUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">다운로드</a>
        <p>또는 다음 링크를 복사하여 브라우저에 붙여넣으세요:</p>
        <p>${downloadUrl}</p>
      `,
    },
  });

  const receipt = await transport.send(message);

  if (!receipt.successful) {
    throw new Error(`이메일 전송 실패: ${receipt.errorMessages.join(", ")}`);
  }
}

/**
 * Send new application notification email to community owner
 */
export async function sendApplicationNotificationEmail(
  ownerEmail: string,
  communityName: string,
  communitySlug: string,
  applicantUsername: string,
) {
  const applicationsUrl = `https://${DOMAIN}/communities/${communitySlug}/applications`;

  const message = createMessage({
    from: `커뮹! <noreply@${env.mailgun.domain}>`,
    to: ownerEmail,
    subject: `[${communityName}] 새로운 가입 지원서`,
    content: {
      text: `${communityName} 커뮤에 새로운 가입 지원서가 도착했습니다.\n\n지원자: ${applicantUsername}\n\n지원서 확인하기:\n${applicationsUrl}`,
      html: `
        <h2>[${communityName}] 새로운 가입 지원서</h2>
        <p>${communityName} 커뮤에 새로운 가입 지원서가 도착했습니다.</p>
        <p><strong>지원자:</strong> ${applicantUsername}</p>
        <p>아래 버튼을 클릭하여 지원서를 확인하세요:</p>
        <a href="${applicationsUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">지원서 확인하기</a>
        <p>또는 다음 링크를 복사하여 브라우저에 붙여넣으세요:</p>
        <p>${applicationsUrl}</p>
      `,
    },
  });

  const receipt = await transport.send(message);

  if (!receipt.successful) {
    throw new Error(`이메일 전송 실패: ${receipt.errorMessages.join(", ")}`);
  }
}

/**
 * Send application approved notification email to applicant
 */
export async function sendApplicationApprovedEmail(
  applicantEmail: string,
  communityName: string,
) {
  const consoleUrl = `https://${DOMAIN}`;

  const message = createMessage({
    from: `커뮹! <noreply@${env.mailgun.domain}>`,
    to: applicantEmail,
    subject: `[${communityName}] 가입 지원서가 승인되었습니다`,
    content: {
      text: `${communityName} 커뮤 가입 지원서가 승인되었습니다.\n\n이제 ${communityName} 커뮤의 멤버가 되었습니다.\n\n커뮹 바로가기:\n${consoleUrl}`,
      html: `
        <h2>[${communityName}] 가입 지원서가 승인되었습니다</h2>
        <p>${communityName} 커뮤 가입 지원서가 승인되었습니다.</p>
        <p>이제 ${communityName} 커뮤의 멤버가 되었습니다.</p>
        <p>아래 버튼을 클릭하여 커뮹으로 이동하세요:</p>
        <a href="${consoleUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">커뮹 바로가기</a>
        <p>또는 다음 링크를 복사하여 브라우저에 붙여넣으세요:</p>
        <p>${consoleUrl}</p>
      `,
    },
  });

  const receipt = await transport.send(message);

  if (!receipt.successful) {
    throw new Error(`이메일 전송 실패: ${receipt.errorMessages.join(", ")}`);
  }
}

/**
 * Send application rejected notification email to applicant
 */
export async function sendApplicationRejectedEmail(
  applicantEmail: string,
  communityName: string,
  rejectionReason?: string,
) {
  const reasonText = rejectionReason ? `\n\n거절 사유: ${rejectionReason}` : "";
  const consoleUrl = `https://${DOMAIN}`;

  const message = createMessage({
    from: `커뮹! <noreply@${env.mailgun.domain}>`,
    to: applicantEmail,
    subject: `[${communityName}] 가입 지원서가 거절되었습니다`,
    content: {
      text: `${communityName} 커뮤 가입 지원서가 거절되었습니다.${reasonText}\n\n커뮹 바로가기:\n${consoleUrl}`,
      html: `
        <h2>[${communityName}] 가입 지원서가 거절되었습니다</h2>
        <p>${communityName} 커뮤 가입 지원서가 거절되었습니다.</p>
        ${rejectionReason ? `<p><strong>거절 사유:</strong> ${rejectionReason}</p>` : ""}
        <p>아래 버튼을 클릭하여 커뮹으로 이동하세요:</p>
        <a href="${consoleUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">커뮹 바로가기</a>
        <p>또는 다음 링크를 복사하여 브라우저에 붙여넣으세요:</p>
        <p>${consoleUrl}</p>
      `,
    },
  });

  const receipt = await transport.send(message);

  if (!receipt.successful) {
    throw new Error(`이메일 전송 실패: ${receipt.errorMessages.join(", ")}`);
  }
}
