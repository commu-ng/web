import { AppException } from "../exception";

/**
 * Validate if community is active (not ended, started)
 * Throws AppException if validation fails
 */
export function validateCommunityActive(
  startsAt: string | Date,
  endsAt: string | Date,
  actionDescription: string = "이 작업을 수행",
): void {
  const now = new Date();
  const communityStartsAt = new Date(startsAt);
  const communityEndsAt = new Date(endsAt);

  if (now > communityEndsAt) {
    throw new AppException(
      403,
      `커뮤가 종료되어 ${actionDescription}할 수 없습니다`,
    );
  }

  if (now < communityStartsAt) {
    throw new AppException(403, "커뮤가 아직 시작되지 않았습니다");
  }
}

/**
 * Check if community has ended
 */
export function isCommunityEnded(endsAt: string | Date): boolean {
  const now = new Date();
  const communityEndsAt = new Date(endsAt);
  return now > communityEndsAt;
}

/**
 * Check if community has started
 */
export function isCommunityStarted(startsAt: string | Date): boolean {
  const now = new Date();
  const communityStartsAt = new Date(startsAt);
  return now >= communityStartsAt;
}

/**
 * Check if community is currently active
 */
export function isCommunityActive(
  startsAt: string | Date,
  endsAt: string | Date,
): boolean {
  return isCommunityStarted(startsAt) && !isCommunityEnded(endsAt);
}
