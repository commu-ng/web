import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react";
import MarkdownIt from "markdown-it";
import { useId, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "~/components/ui/field";
import { Label } from "~/components/ui/label";
import { Spinner } from "~/components/ui/spinner";
import { Textarea } from "~/components/ui/textarea";
import { api } from "~/lib/api-client";

export function meta() {
  return [
    { title: "가입 신청서 검토" },
    {
      name: "description",
      content: "커뮤 가입 신청서를 검토합니다",
    },
  ];
}

const md = new MarkdownIt({ linkify: true, breaks: true });

interface Application {
  id: string;
  profile_name: string;
  profile_username: string;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at: string | null;
  applicant: {
    profile_id: string | null;
  };
  reviewed_by: {
    profile_id: string | null;
  } | null;
  attachments: Array<{
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

async function fetchApplication(
  communityId: string,
  applicationId: string,
): Promise<Application> {
  const res = await api.console.communities[":id"].applications[
    ":application_id"
  ].$get({
    param: { id: communityId, application_id: applicationId },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch application");
  }

  const result = await res.json();
  return result.data;
}

async function fetchCommunity(slug: string) {
  const res = await api.console.communities[":id"].$get({
    param: { id: slug },
  });
  if (!res.ok) {
    throw new Error("커뮤를 찾을 수 없습니다");
  }
  const result = await res.json();
  return result.data;
}

export default function ApplicationView() {
  const { slug, applicationId } = useParams<{
    slug: string;
    applicationId: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const rejectionReasonId = useId();
  const [rejectionReason, setRejectionReason] = useState("");

  const {
    data: application,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["application", slug, applicationId],
    queryFn: () => fetchApplication(slug ?? "", applicationId ?? ""),
    enabled: !!slug && !!applicationId,
  });

  const { data: community } = useQuery({
    queryKey: ["community", slug],
    queryFn: () => fetchCommunity(slug ?? ""),
    enabled: !!slug,
  });

  const approveMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      if (!slug) throw new Error("커뮤를 찾을 수 없습니다");
      const res = await api.console.communities[":id"].applications[
        ":application_id"
      ].review.$put({
        param: { id: slug, application_id: applicationId },
        json: { status: "approved" },
      });
      if (!res.ok) {
        const errorData = await res.json();
        const errorMessage =
          ("error" in errorData && typeof errorData.error === "string"
            ? errorData.error
            : null) ||
          ("message" in errorData && typeof errorData.message === "string"
            ? errorData.message
            : null) ||
          "승인에 실패했습니다";
        throw new Error(errorMessage);
      }
      return await res.json();
    },
    onSuccess: () => {
      toast.success("지원을 승인했습니다");
      queryClient.invalidateQueries({
        queryKey: ["application", slug, applicationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["applications", slug],
      });
      navigate(`/communities/${slug}/applications`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({
      applicationId,
      reason,
    }: {
      applicationId: string;
      reason?: string;
    }) => {
      if (!slug) throw new Error("커뮤를 찾을 수 없습니다");
      const res = await api.console.communities[":id"].applications[
        ":application_id"
      ].review.$put({
        param: { id: slug, application_id: applicationId },
        json: { status: "rejected", rejection_reason: reason },
      });
      if (!res.ok) {
        const errorData = await res.json();
        const errorMessage =
          ("error" in errorData && typeof errorData.error === "string"
            ? errorData.error
            : null) ||
          ("message" in errorData && typeof errorData.message === "string"
            ? errorData.message
            : null) ||
          "거절에 실패했습니다";
        throw new Error(errorMessage);
      }
      return await res.json();
    },
    onSuccess: () => {
      toast.success("지원을 거절했습니다");
      queryClient.invalidateQueries({
        queryKey: ["application", slug, applicationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["applications", slug],
      });
      navigate(`/communities/${slug}/applications`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  if (!slug || !applicationId) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">오류 발생</CardTitle>
          </CardHeader>
          <CardContent>
            <p>잘못된 URL입니다</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="flex items-center justify-center min-h-64">
          <div className="flex items-center gap-3">
            <Spinner className="h-6 w-6" />
            <span className="text-gray-600">신청서를 불러오는 중...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">오류 발생</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>신청서를 불러올 수 없습니다</p>
            <Link to={`/communities/${slug}/apply`}>
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                지원하기
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusConfig = {
    pending: {
      label: "대기중",
      className: "bg-yellow-100 text-yellow-800",
      icon: null,
    },
    approved: {
      label: "승인됨",
      className: "bg-green-100 text-green-800",
      icon: <CheckCircle className="h-4 w-4" />,
    },
    rejected: {
      label: "거절됨",
      className: "bg-red-100 text-red-800",
      icon: <XCircle className="h-4 w-4" />,
    },
  };

  const status = statusConfig[application.status];

  // Check if user is a moderator/owner (not just a regular member)
  const isModerator =
    community?.user_role === "owner" || community?.user_role === "moderator";

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link
            to={
              isModerator
                ? `/communities/${slug}/applications`
                : `/communities/${slug}/apply`
            }
          >
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              커뮤로 돌아가기
            </Button>
          </Link>
          <Badge className={status.className}>
            {status.icon}
            {status.label}
          </Badge>
        </div>

        {/* Application Details */}
        <Card>
          <CardHeader>
            <CardTitle>가입 신청서</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Applicant Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>신청자 이름</Label>
                <p className="text-lg font-semibold mt-1">
                  {application.profile_name}
                </p>
              </div>
              <div>
                <Label>사용자명</Label>
                <p className="text-lg font-mono mt-1">
                  @{application.profile_username}
                </p>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>신청일</Label>
                <p className="mt-1">
                  {format(new Date(application.created_at), "PPP p", {
                    locale: ko,
                  })}
                </p>
              </div>
              {application.reviewed_at && (
                <div>
                  <Label>처리일</Label>
                  <p className="mt-1">
                    {format(new Date(application.reviewed_at), "PPP p", {
                      locale: ko,
                    })}
                  </p>
                </div>
              )}
            </div>

            {/* Application Message */}
            {application.message && (
              <div>
                <Label className="text-base font-semibold">신청 메시지</Label>
                <div
                  className="prose prose-sm dark:prose-invert max-w-none border rounded-lg p-4 bg-muted/30 mt-2"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: markdown is sanitized by markdown-it
                  dangerouslySetInnerHTML={{
                    __html: md.render(application.message),
                  }}
                />
              </div>
            )}

            {/* Action Buttons for Pending Applications - Only for Moderators/Owners */}
            {application.status === "pending" && isModerator && (
              <div className="pt-4 border-t space-y-4">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor={rejectionReasonId}>
                      거절 사유 (선택사항)
                    </FieldLabel>
                    <Textarea
                      id={rejectionReasonId}
                      placeholder="신청을 거절하는 경우 사유를 입력하세요..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      rows={3}
                    />
                  </Field>
                </FieldGroup>

                <div className="flex gap-3">
                  <Button
                    variant="default"
                    className="flex-1"
                    onClick={() => approveMutation.mutate(application.id)}
                    disabled={
                      approveMutation.isPending || rejectMutation.isPending
                    }
                  >
                    {approveMutation.isPending ? (
                      <Spinner />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    {approveMutation.isPending ? "승인 중..." : "승인"}
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() =>
                      rejectMutation.mutate({
                        applicationId: application.id,
                        reason: rejectionReason.trim() || undefined,
                      })
                    }
                    disabled={
                      approveMutation.isPending || rejectMutation.isPending
                    }
                  >
                    {rejectMutation.isPending ? (
                      <Spinner />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    {rejectMutation.isPending ? "거절 중..." : "거절"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
