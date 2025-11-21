import { format } from "date-fns";
import { ko } from "date-fns/locale";
import {
  Activity,
  CalendarIcon,
  CheckCircle,
  Clock,
  Hash,
  UsersIcon,
} from "lucide-react";
import { Link } from "react-router";
import { Badge } from "~/components/ui/badge";
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

  const isMember = community.is_member;

  return (
    <Card
      className={`hover:shadow-md transition-shadow overflow-hidden pb-4 ${community.banner_image_url ? "pt-0" : ""}`}
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
            <Link
              to={`/communities/${community.slug}`}
              className="hover:underline break-keep"
            >
              {community.name}
            </Link>
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
            {/* Status Badge */}
            {isUpcoming && (
              <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full break-keep">
                <Clock className="h-3 w-3" />
                시작 예정
              </Badge>
            )}
            {isActive && (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full break-keep">
                <Activity className="h-3 w-3" />
                진행 중
              </Badge>
            )}
            {isEnded && (
              <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200 rounded-full break-keep">
                <CheckCircle className="h-3 w-3" />
                종료됨
              </Badge>
            )}

            {/* Application Status Badge - for non-members who have applied */}
            {!community.role && community.has_applied && (
              <Badge
                className={`rounded-full break-keep ${
                  community.application_status === "rejected"
                    ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                    : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                }`}
              >
                {community.application_status === "rejected"
                  ? "지원 거부됨"
                  : "신청 완료"}
              </Badge>
            )}
            {community.is_recruiting && (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full break-keep">
                <UsersIcon className="h-3 w-3" />
                모집 중
              </Badge>
            )}
            {community.role && (
              <Badge
                className={`rounded-full break-keep ${
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

      {((community.hashtags && community.hashtags.length > 0) ||
        community.minimum_birth_year) && (
        <CardContent className="pt-0">
          <div className="space-y-1">
            {/* Hashtags */}
            {community.hashtags && community.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {community.hashtags.map((hashtag) => (
                  <Badge
                    key={hashtag.id}
                    variant="outline"
                    className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
                  >
                    <Hash className="h-2.5 w-2.5 mr-1" />
                    {hashtag.tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Birth year requirement */}
            {community.minimum_birth_year && (
              <div className="text-xs text-muted-foreground bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">
                {community.minimum_birth_year}년생 이상 가입 가능
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
