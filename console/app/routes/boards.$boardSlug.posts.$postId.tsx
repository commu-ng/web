import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, Pencil } from "lucide-react";
import { Link } from "react-router";
import { LoadingState } from "~/components/shared/LoadingState";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { useAuth } from "~/hooks/useAuth";
import { api } from "~/lib/api-client";
import type { Route } from "./+types/boards.$boardSlug.posts.$postId";

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `게시물 - ${params.boardSlug}` },
    { name: "description", content: "게시물 상세" },
  ];
}

interface BoardPost {
  id: string;
  board: {
    id: string;
    name: string;
    slug: string;
  };
  title: string;
  content: string;
  image: {
    id: string;
    url: string;
    width: number;
    height: number;
    filename: string;
  } | null;
  community_type: string;
  hashtags: {
    id: string;
    tag: string;
  }[];
  author: {
    id: string;
    login_name: string;
  };
  created_at: string;
  updated_at: string;
}

async function fetchBoardPost(
  boardSlug: string,
  postId: string,
): Promise<BoardPost> {
  const res = await api.console.board[":board_slug"].posts[
    ":board_post_id"
  ].$get({
    param: { board_slug: boardSlug, board_post_id: postId },
  });
  if (!res.ok) {
    throw new Error("Failed to fetch board post");
  }
  return await res.json();
}

export default function BoardPostDetail({ params }: Route.ComponentProps) {
  const { boardSlug, postId } = params;
  const { isLoading: authLoading, isAuthenticated, user } = useAuth();

  const {
    data: post,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["board-post", boardSlug, postId],
    queryFn: () => fetchBoardPost(boardSlug, postId),
  });

  if (authLoading || isLoading) {
    return <LoadingState message="게시물을 불러오는 중..." />;
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AlertCircle />
            </EmptyMedia>
            <EmptyTitle>오류 발생</EmptyTitle>
            <EmptyDescription>게시물을 불러올 수 없습니다</EmptyDescription>
          </EmptyHeader>
          <div className="flex gap-2">
            <Button onClick={() => refetch()}>다시 시도</Button>
            <Button variant="outline" asChild>
              <Link to={`/boards/${boardSlug}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                게시판으로 돌아가기
              </Link>
            </Button>
          </div>
        </Empty>
      </div>
    );
  }

  if (!post) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <Button variant="ghost" asChild className="mb-4">
          <Link to={`/boards/${boardSlug}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {post.board.name}로 돌아가기
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-4">{post.title}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <span className="font-medium">{post.author.login_name}</span>
                <span>•</span>
                <span>
                  {new Date(post.created_at).toLocaleDateString("ko-KR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              {post.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {post.hashtags.map((hashtag) => (
                    <Badge key={hashtag.id} variant="outline">
                      #{hashtag.tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            {isAuthenticated && user?.id === post.author.id && (
              <Button variant="outline" asChild>
                <Link to={`/boards/${boardSlug}/posts/${post.id}/edit`}>
                  <Pencil className="h-4 w-4 mr-2" />
                  수정
                </Link>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {post.image && (
            <div className="mb-6">
              <img
                src={post.image.url}
                alt=""
                className="rounded-lg max-w-full h-auto"
                style={{
                  maxHeight: "600px",
                  objectFit: "contain",
                }}
              />
            </div>
          )}
          <div
            className="prose prose-sm dark:prose-invert max-w-none"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Content is sanitized by the backend
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
