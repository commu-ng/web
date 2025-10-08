import { useQuery } from "@tanstack/react-query";
import { FileText, ImageIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { EmptyState } from "~/components/shared/EmptyState";
import { LoadingState } from "~/components/shared/LoadingState";
import { StatusBadge } from "~/components/shared/StatusBadge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { useAuth } from "~/hooks/useAuth";
import { api } from "~/lib/api-client";
import type { Route } from "./+types/applications";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "내 지원서" },
    {
      name: "description",
      content: "내가 제출한 지원서를 확인하세요",
    },
  ];
}

interface ApplicationWithCommunity {
  id: string;
  profile_name: string;
  profile_username: string;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at: string | null;
  rejection_reason?: string | null;
  community: {
    id: string;
    name: string;
    slug: string;
  };
  attachments?: Array<{
    id: string;
    image_id: string;
    image_url: {
      key: string;
      id: string;
      created_at: string;
      deleted_at: string | null;
      width: number;
      height: number;
      filename: string;
      url: string;
    };
    created_at: string;
  }>;
}

async function fetchMyApplications() {
  const res = await api.console["my-applications"].$get();
  const data = await res.json();

  if (!Array.isArray(data)) {
    throw new Error("Failed to fetch applications");
  }

  return data as ApplicationWithCommunity[];
}

const formatDate = (dateString: string) => {
  if (!dateString) return "알 수 없음";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "알 수 없음";

  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

function ApplicationsTable() {
  const [sortBy, setSortBy] = useState<
    "community" | "status" | "created_at" | "reviewed_at" | ""
  >("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const {
    data: allApplications = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["my-applications"],
    queryFn: fetchMyApplications,
  });

  // Sort applications
  const sortedApplications = [...allApplications].sort((a, b) => {
    if (!sortBy) return 0;

    // Handle community name sorting
    if (sortBy === "community") {
      const aValue = a.community.name;
      const bValue = b.community.name;
      return sortOrder === "asc"
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    // Handle status sorting
    if (sortBy === "status") {
      const aValue = a.status;
      const bValue = b.status;
      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    }

    // Handle date sorting
    if (sortBy === "created_at") {
      const aValue = new Date(a.created_at).toISOString();
      const bValue = new Date(b.created_at).toISOString();
      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    }

    if (sortBy === "reviewed_at") {
      const aValue = a.reviewed_at ? new Date(a.reviewed_at).toISOString() : "";
      const bValue = b.reviewed_at ? new Date(b.reviewed_at).toISOString() : "";
      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    }

    return 0;
  });

  const handleSort = (
    column: "community" | "status" | "created_at" | "reviewed_at",
  ) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  if (isLoading) {
    return <LoadingState message="지원서를 불러오는 중..." asCard={false} />;
  }

  if (error) {
    return (
      <EmptyState
        iconElement={<span className="text-4xl">❌</span>}
        title="오류 발생"
        description="지원서를 불러올 수 없습니다"
        actions={<Button onClick={() => refetch()}>다시 시도</Button>}
      />
    );
  }

  if (sortedApplications.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileText />
          </EmptyMedia>
          <EmptyTitle>지원서가 없습니다</EmptyTitle>
          <EmptyDescription>아직 제출한 지원서가 없습니다</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>내 지원서 목록</CardTitle>
        <CardDescription>
          총 {sortedApplications.length}개의 지원서가 있습니다
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("community")}
              >
                커뮤{" "}
                {sortBy === "community" && (sortOrder === "asc" ? "↑" : "↓")}
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("status")}
              >
                상태 {sortBy === "status" && (sortOrder === "asc" ? "↑" : "↓")}
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("created_at")}
              >
                지원일{" "}
                {sortBy === "created_at" && (sortOrder === "asc" ? "↑" : "↓")}
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("reviewed_at")}
              >
                처리일{" "}
                {sortBy === "reviewed_at" && (sortOrder === "asc" ? "↑" : "↓")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedApplications.map((application) => (
              <TableRow key={application.id}>
                <TableCell>
                  <Link
                    to={`/communities/${application.community.slug}/applications/${application.id}`}
                    className="text-left hover:underline block"
                  >
                    <div className="font-medium">
                      {application.community.name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      @{application.profile_username}
                    </div>
                    {application.attachments &&
                      application.attachments.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <ImageIcon className="w-3 h-3" />
                          <span>{application.attachments.length}개 첨부</span>
                        </div>
                      )}
                  </Link>
                </TableCell>
                <TableCell>
                  <StatusBadge type="application" status={application.status} />
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {formatDate(application.created_at)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {application.reviewed_at
                      ? formatDate(application.reviewed_at)
                      : "-"}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function ApplicationsPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-2xl">
        <LoadingState message="인증 확인 중..." />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-2xl">
        <EmptyState
          iconElement={<span className="text-4xl">🔒</span>}
          title="로그인이 필요합니다"
          description="지원서를 확인하려면 로그인해주세요"
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">내 지원서</h1>
        <p className="text-muted-foreground mt-2">
          내가 제출한 지원서를 확인하세요
        </p>
      </div>

      <ApplicationsTable />
    </div>
  );
}
