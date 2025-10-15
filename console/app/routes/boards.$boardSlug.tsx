import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { BoardPostList } from "~/components/BoardPostList";
import { HashtagFilter } from "~/components/HashtagFilter";
import { LoadingState } from "~/components/shared/LoadingState";
import { Button } from "~/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { useAuth } from "~/hooks/useAuth";
import { api } from "~/lib/api-client";
import type { Route } from "./+types/boards.$boardSlug";

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `게시판 - ${params.boardSlug}` },
    { name: "description", content: "게시판" },
  ];
}

interface Board {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

async function fetchBoard(boardSlug: string): Promise<Board> {
  const res = await api.console.board[":board_slug"].$get({
    param: { board_slug: boardSlug },
  });
  if (!res.ok) {
    throw new Error("Failed to fetch board");
  }
  return await res.json();
}

async function fetchBoardHashtags(boardSlug: string): Promise<string[]> {
  const res = await api.console.board[":board_slug"].hashtags.$get({
    param: { board_slug: boardSlug },
  });
  if (!res.ok) {
    throw new Error("Failed to fetch board hashtags");
  }
  return await res.json();
}

export default function BoardDetail({ params }: Route.ComponentProps) {
  const { boardSlug } = params;
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const [selectedHashtags, setSelectedHashtags] = useState<string[]>([]);

  const {
    data: board,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["board", boardSlug],
    queryFn: () => fetchBoard(boardSlug),
  });

  const { data: allHashtags = [] } = useQuery({
    queryKey: ["board-hashtags", boardSlug],
    queryFn: () => fetchBoardHashtags(boardSlug),
  });

  const toggleHashtag = (hashtag: string) => {
    setSelectedHashtags((prev) =>
      prev.includes(hashtag)
        ? prev.filter((h) => h !== hashtag)
        : [...prev, hashtag],
    );
  };

  if (authLoading || isLoading) {
    return <LoadingState message="게시판을 불러오는 중..." />;
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
            <EmptyDescription>게시판을 불러올 수 없습니다</EmptyDescription>
          </EmptyHeader>
          <div className="flex gap-2">
            <Button onClick={() => refetch()}>다시 시도</Button>
            <Button variant="outline" asChild>
              <Link to="/boards">
                <ArrowLeft className="mr-2 h-4 w-4" />
                게시판 목록으로
              </Link>
            </Button>
          </div>
        </Empty>
      </div>
    );
  }

  if (!board) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <Button variant="ghost" asChild className="mb-4">
          <Link to="/boards">
            <ArrowLeft className="mr-2 h-4 w-4" />
            게시판 목록으로
          </Link>
        </Button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">{board.name}</h1>
            {board.description && (
              <p className="text-muted-foreground mt-2">{board.description}</p>
            )}
          </div>
          {isAuthenticated && (
            <Button asChild>
              <Link to={`/boards/${boardSlug}/create`}>
                <Plus className="mr-2 h-4 w-4" />
                게시물 작성
              </Link>
            </Button>
          )}
        </div>
      </div>

      <HashtagFilter
        allHashtags={allHashtags}
        selectedHashtags={selectedHashtags}
        onToggleHashtag={toggleHashtag}
        onClearFilters={() => setSelectedHashtags([])}
      />

      <div>
        <h2 className="text-2xl font-bold mb-4">게시물</h2>
        <BoardPostList
          boardSlug={boardSlug}
          hashtags={selectedHashtags.length > 0 ? selectedHashtags : undefined}
        />
      </div>
    </div>
  );
}
