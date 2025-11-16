import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  MessageSquare,
  Pencil,
  Reply,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { LoadingState } from "~/components/shared/LoadingState";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
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
import { Textarea } from "~/components/ui/textarea";
import { useAuth } from "~/hooks/useAuth";
import { api, getErrorMessage } from "~/lib/api-client";
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
    allow_comments: boolean;
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

interface BoardPostReply {
  id: string;
  content: string;
  depth: number;
  author: {
    id: string;
    login_name: string;
  };
  created_at: string;
  updated_at: string;
  replies?: BoardPostReply[];
}

type BoardPostResponse = {
  data: BoardPost;
};

type BoardPostRepliesResponse = {
  data: BoardPostReply[];
};

function isBoardPostResponse(value: object): value is BoardPostResponse {
  return (
    "data" in value &&
    typeof value.data === "object" &&
    value.data !== null &&
    "id" in value.data &&
    "title" in value.data &&
    "content" in value.data
  );
}

function isBoardPostRepliesResponse(
  value: object,
): value is BoardPostRepliesResponse {
  return "data" in value && Array.isArray(value.data);
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
  const json = await res.json();

  if (typeof json === "object" && json !== null && isBoardPostResponse(json)) {
    return json.data;
  }

  throw new Error("Invalid board post response format");
}

async function fetchBoardPostReplies(
  boardSlug: string,
  postId: string,
): Promise<BoardPostReply[]> {
  const res = await api.console.board[":board_slug"].posts[
    ":board_post_id"
  ].replies.$get({
    param: { board_slug: boardSlug, board_post_id: postId },
    query: {},
  });
  if (!res.ok) {
    throw new Error("Failed to fetch replies");
  }
  const json = await res.json();

  if (
    typeof json === "object" &&
    json !== null &&
    isBoardPostRepliesResponse(json)
  ) {
    return json.data;
  }

  throw new Error("Invalid board post replies response format");
}

function ReplyItem({
  reply,
  depth,
  onReplyTo,
  onEdit,
  onDelete,
  editingReplyId,
  editingContent,
  onUpdateContent,
  onUpdate,
  onCancelEdit,
  currentUserId,
  isAuthenticated,
}: {
  reply: BoardPostReply;
  depth: number;
  onReplyTo: (replyId: string) => void;
  onEdit: (reply: BoardPostReply) => void;
  onDelete: (replyId: string) => void;
  editingReplyId: string | null;
  editingContent: string;
  onUpdateContent: (content: string) => void;
  onUpdate: (replyId: string) => void;
  onCancelEdit: () => void;
  currentUserId?: string;
  isAuthenticated: boolean;
}) {
  const isEditing = editingReplyId === reply.id;
  const visualDepth = Math.min(depth, 2);

  return (
    <div
      className="border-l-2 border-border pl-3 sm:pl-4"
      style={{
        marginLeft: `${visualDepth * 0.75}rem`,
      }}
    >
      <div className="py-3">
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editingContent}
              onChange={(e) => onUpdateContent(e.target.value)}
              className="min-h-[80px]"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => onUpdate(reply.id)}>
                저장
              </Button>
              <Button size="sm" variant="outline" onClick={onCancelEdit}>
                취소
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground flex-wrap">
                <span className="font-medium">{reply.author.login_name}</span>
                <span>•</span>
                <span>
                  {new Date(reply.created_at).toLocaleDateString("ko-KR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              {isAuthenticated && currentUserId === reply.author.id && (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onEdit(reply)}
                    className="h-7 px-2"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDelete(reply.id)}
                    className="h-7 px-2"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
            <p className="text-sm whitespace-pre-wrap break-words mb-2">
              {reply.content}
            </p>
            {isAuthenticated && depth < 10 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onReplyTo(reply.id)}
                className="h-7 px-2 text-xs"
              >
                <Reply className="h-3 w-3 mr-1" />
                답글
              </Button>
            )}
          </>
        )}
      </div>
      {reply.replies && reply.replies.length > 0 && (
        <div className="space-y-0">
          {reply.replies.map((childReply) => (
            <ReplyItem
              key={childReply.id}
              reply={childReply}
              depth={depth + 1}
              onReplyTo={onReplyTo}
              onEdit={onEdit}
              onDelete={onDelete}
              editingReplyId={editingReplyId}
              editingContent={editingContent}
              onUpdateContent={onUpdateContent}
              onUpdate={onUpdate}
              onCancelEdit={onCancelEdit}
              currentUserId={currentUserId}
              isAuthenticated={isAuthenticated}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function BoardPostDetail({ params }: Route.ComponentProps) {
  const { boardSlug, postId } = params;
  const { isLoading: authLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editingReplyContent, setEditingReplyContent] = useState("");

  const {
    data: post,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["board-post", boardSlug, postId],
    queryFn: () => fetchBoardPost(boardSlug, postId),
  });

  const {
    data: replies = [],
    isLoading: repliesLoading,
  } = useQuery({
    queryKey: ["board-post-replies", boardSlug, postId],
    queryFn: () => fetchBoardPostReplies(boardSlug, postId),
    enabled: !!post && post.board.allow_comments,
  });

  const createReplyMutation = useMutation({
    mutationFn: async ({
      content,
      inReplyToId,
    }: {
      content: string;
      inReplyToId?: string;
    }) => {
      const res = await api.console.board[":board_slug"].posts[
        ":board_post_id"
      ].replies.$post({
        param: { board_slug: boardSlug, board_post_id: postId },
        json: {
          content,
          in_reply_to_id: inReplyToId,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(getErrorMessage(errorData, "댓글 작성에 실패했습니다"));
      }

      return await res.json();
    },
    onSuccess: () => {
      toast.success("댓글이 작성되었습니다");
      setReplyContent("");
      setReplyingTo(null);
      queryClient.invalidateQueries({
        queryKey: ["board-post-replies", boardSlug, postId],
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateReplyMutation = useMutation({
    mutationFn: async ({
      replyId,
      content,
    }: {
      replyId: string;
      content: string;
    }) => {
      const res = await api.console.board[":board_slug"].posts[
        ":board_post_id"
      ].replies[":reply_id"].$patch({
        param: {
          board_slug: boardSlug,
          board_post_id: postId,
          reply_id: replyId,
        },
        json: { content },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(getErrorMessage(errorData, "댓글 수정에 실패했습니다"));
      }

      return await res.json();
    },
    onSuccess: () => {
      toast.success("댓글이 수정되었습니다");
      setEditingReplyId(null);
      setEditingReplyContent("");
      queryClient.invalidateQueries({
        queryKey: ["board-post-replies", boardSlug, postId],
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteReplyMutation = useMutation({
    mutationFn: async (replyId: string) => {
      const res = await api.console.board[":board_slug"].posts[
        ":board_post_id"
      ].replies[":reply_id"].$delete({
        param: {
          board_slug: boardSlug,
          board_post_id: postId,
          reply_id: replyId,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(getErrorMessage(errorData, "댓글 삭제에 실패했습니다"));
      }

      return await res.json();
    },
    onSuccess: () => {
      toast.success("댓글이 삭제되었습니다");
      queryClient.invalidateQueries({
        queryKey: ["board-post-replies", boardSlug, postId],
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteBoardPostMutation = useMutation({
    mutationFn: async () => {
      const res = await api.console.board[":board_slug"].posts[
        ":board_post_id"
      ].$delete({
        param: { board_slug: boardSlug, board_post_id: postId },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          getErrorMessage(errorData, "게시물 삭제에 실패했습니다"),
        );
      }

      return await res.json();
    },
    onSuccess: () => {
      toast.success("게시물이 성공적으로 삭제되었습니다");
      queryClient.invalidateQueries({ queryKey: ["board-posts", boardSlug] });
      navigate(`/boards/${boardSlug}`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleDeleteClick = () => {
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    deleteBoardPostMutation.mutate();
  };

  const handleReplySubmit = () => {
    if (!replyContent.trim()) return;
    createReplyMutation.mutate({
      content: replyContent,
      inReplyToId: replyingTo ?? undefined,
    });
  };

  const handleReplyToClick = (replyId: string) => {
    setReplyingTo(replyId);
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
    setReplyContent("");
  };

  const handleEditReply = (reply: BoardPostReply) => {
    setEditingReplyId(reply.id);
    setEditingReplyContent(reply.content);
  };

  const handleUpdateReply = (replyId: string) => {
    if (!editingReplyContent.trim()) return;
    updateReplyMutation.mutate({
      replyId,
      content: editingReplyContent,
    });
  };

  const handleCancelEdit = () => {
    setEditingReplyId(null);
    setEditingReplyContent("");
  };

  const handleDeleteReply = (replyId: string) => {
    if (window.confirm("이 댓글을 삭제하시겠습니까?")) {
      deleteReplyMutation.mutate(replyId);
    }
  };

  if (authLoading || isLoading) {
    return <LoadingState message="게시물을 불러오는 중..." />;
  }

  if (error) {
    return (
      <div className="container mx-auto py-4 sm:py-8 px-3 sm:px-4 max-w-4xl">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AlertCircle />
            </EmptyMedia>
            <EmptyTitle>오류 발생</EmptyTitle>
            <EmptyDescription>게시물을 불러올 수 없습니다</EmptyDescription>
          </EmptyHeader>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button onClick={() => refetch()} className="w-full sm:w-auto">
              다시 시도
            </Button>
            <Button variant="outline" asChild className="w-full sm:w-auto">
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
    <div className="container mx-auto py-4 sm:py-8 px-3 sm:px-4 max-w-4xl">
      <div className="mb-4 sm:mb-6">
        <Button variant="ghost" asChild className="mb-2 sm:mb-4 -ml-2">
          <Link to={`/boards/${boardSlug}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">
              {post.board.name}로 돌아가기
            </span>
            <span className="sm:hidden">돌아가기</span>
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col gap-4">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4 break-words">
                {post.title}
              </h1>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4 flex-wrap">
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
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {post.hashtags.map((hashtag) => (
                    <Badge
                      key={hashtag.id}
                      variant="outline"
                      className="text-xs"
                    >
                      #{hashtag.tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            {isAuthenticated && user?.id === post.author.id && (
              <div className="flex gap-2 pt-2 border-t sm:border-t-0 sm:pt-0">
                <Button
                  variant="outline"
                  asChild
                  size="sm"
                  className="flex-1 sm:flex-none"
                >
                  <Link to={`/boards/${boardSlug}/posts/${post.id}/edit`}>
                    <Pencil className="h-4 w-4 mr-2" />
                    수정
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDeleteClick}
                  size="sm"
                  className="flex-1 sm:flex-none"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  삭제
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 py-4 sm:py-6">
          {post.image && (
            <div className="mb-4 sm:mb-6 -mx-4 sm:mx-0">
              <img
                src={post.image.url}
                alt=""
                className="w-full h-auto sm:rounded-lg"
                style={{
                  maxHeight: "400px",
                  objectFit: "contain",
                }}
              />
            </div>
          )}
          <div
            className="prose prose-sm dark:prose-invert max-w-none break-words"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Content is sanitized by the backend
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        </CardContent>
      </Card>

      {/* Replies Section */}
      {post.board.allow_comments && (
        <Card className="mt-6">
          <CardHeader className="px-4 sm:px-6 py-4 sm:py-6">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              <h2 className="text-lg font-semibold">
                댓글 {replies.length > 0 && `(${replies.length})`}
              </h2>
            </div>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 py-4 sm:py-6 space-y-4">
            {/* Reply Composition */}
            {isAuthenticated && (
              <div className="space-y-2">
                {replyingTo && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Reply className="h-4 w-4" />
                    <span>답글 작성 중...</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCancelReply}
                      className="h-6 px-2 ml-auto"
                    >
                      취소
                    </Button>
                  </div>
                )}
                <Textarea
                  placeholder={
                    replyingTo ? "답글을 입력하세요..." : "댓글을 입력하세요..."
                  }
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  className="min-h-[100px]"
                />
                <div className="flex justify-end">
                  <Button
                    onClick={handleReplySubmit}
                    disabled={
                      !replyContent.trim() || createReplyMutation.isPending
                    }
                  >
                    {createReplyMutation.isPending ? "작성 중..." : "댓글 작성"}
                  </Button>
                </div>
              </div>
            )}

            {/* Replies List */}
            {repliesLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                댓글을 불러오는 중...
              </div>
            ) : replies.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {isAuthenticated
                  ? "첫 댓글을 작성해보세요!"
                  : "아직 댓글이 없습니다."}
              </div>
            ) : (
              <div className="space-y-0">
                {replies.map((reply) => (
                  <ReplyItem
                    key={reply.id}
                    reply={reply}
                    depth={0}
                    onReplyTo={handleReplyToClick}
                    onEdit={handleEditReply}
                    onDelete={handleDeleteReply}
                    editingReplyId={editingReplyId}
                    editingContent={editingReplyContent}
                    onUpdateContent={setEditingReplyContent}
                    onUpdate={handleUpdateReply}
                    onCancelEdit={handleCancelEdit}
                    currentUserId={user?.id}
                    isAuthenticated={isAuthenticated}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>게시물을 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              게시물 "{post?.title}"을(를) 삭제합니다. 이 작업은 되돌릴 수
              없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteBoardPostMutation.isPending}
            >
              {deleteBoardPostMutation.isPending ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
