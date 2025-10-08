import { Bookmark, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { client } from "~/lib/api-client";

interface PostCardActionsProps {
  postId: string;
  replyCount?: number;
  isBookmarked: boolean;
  currentProfileId?: string;
  isReply?: boolean;
  onToggleReply: () => void;
  showReplyForm: boolean;
  onBookmarkChange: (isBookmarked: boolean) => void;
}

export function PostCardActions({
  postId,
  replyCount = 0,
  isBookmarked: initialBookmarked,
  currentProfileId,
  isReply = false,
  onToggleReply,
  showReplyForm,
  onBookmarkChange,
}: PostCardActionsProps) {
  const [isBookmarked, setIsBookmarked] = useState(initialBookmarked);
  const [isBookmarkLoading, setIsBookmarkLoading] = useState(false);

  // Sync bookmark state when prop changes
  useEffect(() => {
    setIsBookmarked(initialBookmarked);
  }, [initialBookmarked]);

  const toggleBookmark = async () => {
    if (!currentProfileId) {
      toast.error("프로필를 선택해주세요.");
      return;
    }

    setIsBookmarkLoading(true);
    try {
      if (isBookmarked) {
        const response = await client.app.posts[":post_id"].bookmark.$delete({
          query: { profile_id: currentProfileId },
          param: { post_id: postId },
        });
        if (response.ok) {
          setIsBookmarked(false);
          onBookmarkChange(false);
          toast.success("북마크가 제거되었습니다");
        } else {
          throw new Error("북마크 제거에 실패했습니다");
        }
      } else {
        const response = await client.app.posts[":post_id"].bookmark.$post({
          query: { profile_id: currentProfileId },
          param: { post_id: postId },
        });
        if (response.ok) {
          setIsBookmarked(true);
          onBookmarkChange(true);
          toast.success("북마크에 추가되었습니다");
        } else {
          throw new Error("북마크 추가에 실패했습니다");
        }
      }
    } catch (error) {
      console.error("Error toggling bookmark:", error);
      toast.error("북마크 처리에 실패했습니다");
    } finally {
      setIsBookmarkLoading(false);
    }
  };

  return (
    <div className={`flex items-center ${isReply ? "gap-2" : "gap-4"}`}>
      <button
        type="button"
        onClick={onToggleReply}
        className={`inline-flex items-center gap-1 ${
          isReply ? "text-xs" : "text-sm"
        } text-muted-foreground hover:text-blue-600 transition-colors`}
      >
        <MessageCircle className={isReply ? "h-3 w-3" : "h-4 w-4"} />
        <span>
          {showReplyForm ? "답글 취소" : "답글"}
          {replyCount > 0 && (
            <span className="ml-1 text-xs bg-accent text-muted-foreground px-2 py-0.5 rounded-full">
              {replyCount}
            </span>
          )}
        </span>
      </button>
      {currentProfileId && (
        <button
          type="button"
          onClick={toggleBookmark}
          disabled={isBookmarkLoading}
          className={`inline-flex items-center gap-1 ${
            isReply ? "text-xs" : "text-sm"
          } ${
            isBookmarked
              ? "text-blue-600"
              : "text-muted-foreground hover:text-blue-600"
          } transition-colors disabled:opacity-50`}
        >
          <Bookmark
            className={`${isReply ? "h-3 w-3" : "h-4 w-4"} ${
              isBookmarked ? "fill-current" : ""
            }`}
          />
          <span>{isBookmarked ? "북마크됨" : "북마크"}</span>
        </button>
      )}
    </div>
  );
}
