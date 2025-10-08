import { CheckIcon, ClockIcon, XIcon } from "lucide-react";
import { Badge } from "~/components/ui/badge";

type ApplicationStatus = "pending" | "approved" | "rejected";
type CommunityStatus = "active" | "upcoming" | "ended" | "recruiting";

interface StatusBadgeProps {
  /**
   * Type of status to display
   */
  type: "application" | "community";
  /**
   * Status value
   */
  status: ApplicationStatus | CommunityStatus | string;
  /**
   * Optional className
   */
  className?: string;
}

const APPLICATION_STATUS_CONFIG = {
  pending: {
    label: "대기 중",
    variant: "secondary" as const,
    icon: ClockIcon,
    className: "bg-yellow-100 text-yellow-800",
  },
  approved: {
    label: "승인됨",
    variant: "default" as const,
    icon: CheckIcon,
    className: "bg-green-100 text-green-800",
  },
  rejected: {
    label: "거절됨",
    variant: "destructive" as const,
    icon: XIcon,
    className: "bg-red-100 text-red-800",
  },
};

const COMMUNITY_STATUS_CONFIG = {
  active: {
    label: "진행 중",
    className: "bg-green-100 text-green-800",
  },
  upcoming: {
    label: "시작 예정",
    className: "bg-blue-100 text-blue-800",
  },
  ended: {
    label: "종료됨",
    className: "bg-gray-100 text-gray-800",
  },
  recruiting: {
    label: "모집 중",
    className: "bg-purple-100 text-purple-800",
  },
};

/**
 * Reusable status badge component for applications and communities
 */
export function StatusBadge({
  type,
  status,
  className = "",
}: StatusBadgeProps) {
  if (type === "application") {
    if (status in APPLICATION_STATUS_CONFIG) {
      const config =
        APPLICATION_STATUS_CONFIG[
          status as keyof typeof APPLICATION_STATUS_CONFIG
        ];
      const Icon = config.icon;

      return (
        <Badge
          variant={config.variant}
          className={`${config.className} ${className}`}
        >
          <Icon className="h-3 w-3 mr-1" />
          {config.label}
        </Badge>
      );
    }
    return null;
  }

  if (type === "community") {
    if (status in COMMUNITY_STATUS_CONFIG) {
      const config =
        COMMUNITY_STATUS_CONFIG[status as keyof typeof COMMUNITY_STATUS_CONFIG];

      return (
        <Badge className={`${config.className} ${className}`}>
          {config.label}
        </Badge>
      );
    }
    return null;
  }

  return null;
}

/**
 * Get status badge configuration for custom rendering
 */
export function getApplicationStatusConfig(status: ApplicationStatus) {
  return APPLICATION_STATUS_CONFIG[status];
}

export function getCommunityStatusConfig(status: CommunityStatus) {
  return COMMUNITY_STATUS_CONFIG[status];
}
