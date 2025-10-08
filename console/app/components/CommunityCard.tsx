import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { CalendarIcon, Hash, UsersIcon } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { env } from "~/lib/env";

interface Community {
  id: string;
  name: string;
  slug: string;
  starts_at: string;
  ends_at: string;
  created_at: string;
  role?: string | null;
  custom_domain?: string | null;
  domain_verified?: string | null;
  banner_image_url?: string | null;
  banner_image_width?: number | null;
  banner_image_height?: number | null;
  is_recruiting?: boolean;
  owner_profile_id?: string | null;
  has_applied?: boolean;
  application_id?: string | null;
  application_status?: string | null;
  is_member?: boolean;
  minimum_birth_year?: number | null;
  hashtags?: { id: string; tag: string }[];
  pending_application_count?: number;
}

interface CommunityCardProps {
  community: Community;
}

export function CommunityCard({ community }: CommunityCardProps) {
  const navigate = useNavigate();

  // Use custom domain if verified, otherwise use subdomain
  const communityUrl =
    community.custom_domain && community.domain_verified
      ? community.custom_domain
      : `${community.slug}.${env.domain}`;

  const startDate = new Date(community.starts_at);
  const endDate = new Date(community.ends_at);
  const now = new Date();

  // Validate dates
  const isValidStartDate = !Number.isNaN(startDate.getTime());
  const isValidEndDate = !Number.isNaN(endDate.getTime());

  const isActive =
    isValidStartDate && isValidEndDate && now >= startDate && now <= endDate;
  const isUpcoming = isValidStartDate && now < startDate;
  const isEnded = isValidEndDate && now > endDate;

  // Check if user is owner through their role in the community
  const isOwner = community.role === "owner";
  const hasApplied = community.has_applied;
  const isMember = community.is_member;
  const isRejected = community.application_status === "rejected";

  let statusText = "";
  let statusColor = "";

  if (isUpcoming) {
    statusText = "시작 예정";
    statusColor = "text-blue-600";
  } else if (isActive) {
    statusText = "진행 중";
    statusColor = "text-green-600";
  } else if (isEnded) {
    statusText = "종료됨";
    statusColor = "text-gray-600";
  }

  return (
    <Card
      className={`hover:shadow-md transition-shadow ${
        community.banner_image_url ? "p-0 overflow-hidden" : ""
      }`}
    >
      {/* Banner Image */}
      {community.banner_image_url && (
        <div className="relative w-full overflow-hidden">
          <img
            src={community.banner_image_url}
            alt={`${community.name} 배너`}
            width={community.banner_image_width ?? undefined}
            height={community.banner_image_height ?? undefined}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex flex-col gap-1">
            {community.name}
            {isMember && (
              <div className="text-xs text-muted-foreground font-mono">
                <Link
                  to={`https://${communityUrl}`}
                  target="_blank"
                  className="underline"
                >
                  {communityUrl}
                </Link>
              </div>
            )}
            <div className="flex items-center text-xs text-muted-foreground">
              <CalendarIcon className="mr-1 h-3 w-3" />
              {isValidStartDate
                ? format(startDate, "yy.MM.dd", { locale: ko })
                : "알 수 없음"}{" "}
              -{" "}
              {isValidEndDate
                ? format(endDate, "yy.MM.dd", { locale: ko })
                : "알 수 없음"}
            </div>
          </CardTitle>

          <div className="flex flex-col items-end gap-1">
            {statusText && (
              <span className={`text-sm font-medium ${statusColor}`}>
                {statusText}
              </span>
            )}

            {community.is_recruiting && (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full">
                <UsersIcon className="h-3 w-3" />
                모집 중
              </Badge>
            )}
            {community.role && (
              <Badge
                className={`rounded-full ${
                  community.role === "owner"
                    ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
                    : community.role === "moderator"
                      ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                      : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                }`}
              >
                {community.role === "owner"
                  ? "내가 만든"
                  : community.role === "moderator"
                    ? "모더레이터"
                    : "참여 중"}
              </Badge>
            )}
            {(community.role === "owner" || community.role === "moderator") &&
              community.pending_application_count !== undefined &&
              community.pending_application_count > 0 && (
                <Badge
                  asChild
                  className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded-full hover:bg-yellow-200 dark:hover:bg-yellow-800 cursor-pointer"
                >
                  <Link to={`/communities/${community.slug}/applications`}>
                    신청 {community.pending_application_count}
                  </Link>
                </Badge>
              )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pb-4">
        <div className="space-y-1">
          {/* Hashtags */}
          {community.hashtags && community.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {community.hashtags.slice(0, 3).map((hashtag) => (
                <Badge
                  key={hashtag.id}
                  variant="outline"
                  className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 border-blue-200"
                >
                  <Hash className="h-2.5 w-2.5 mr-1" />
                  {hashtag.tag}
                </Badge>
              ))}
              {community.hashtags.length > 3 && (
                <Badge
                  variant="outline"
                  className="text-xs px-2 py-0.5 bg-gray-50 text-gray-600 border-gray-200"
                >
                  +{community.hashtags.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* Birth year requirement */}
          {community.minimum_birth_year && (
            <div className="text-xs text-muted-foreground bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">
              {community.minimum_birth_year}년생 이상 가입 가능
            </div>
          )}

          {/* Application content */}
          {/* Show apply button for non-owners who haven't joined */}
          {!isOwner && !isMember && !community.role && (
            <div className="pt-1">
              <Button
                variant={hasApplied ? "secondary" : "default"}
                size="sm"
                className={`w-full h-8 text-sm ${
                  hasApplied
                    ? isRejected
                      ? "bg-red-100 text-red-600 hover:bg-red-200 border-red-200"
                      : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                    : ""
                }`}
                onClick={() => {
                  // Navigate to the apply page or community detail for rejected
                  navigate(`/communities/${community.slug}`);
                }}
              >
                {isRejected
                  ? "지원 거부됨"
                  : hasApplied
                    ? "신청 완료"
                    : "가입 지원"}
              </Button>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-1">
          {(community.role === "owner" ||
            community.role === "moderator" ||
            community.role === "member") && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-8 text-xs"
              asChild
            >
              <Link to={`/communities/${community.slug}`}>상세</Link>
            </Button>
          )}
          {(isMember ||
            community.role === "owner" ||
            community.role === "moderator" ||
            community.role === "member") && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-8 text-xs"
              asChild
            >
              <a
                href={`https://${communityUrl}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                입장
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
