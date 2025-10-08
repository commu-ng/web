import { useQuery } from "@tanstack/react-query";
import { memo, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "~/hooks/useAuth";
import { useMarkdownWithMentions } from "~/hooks/useMarkdownWithMentions";
import { client } from "~/lib/api-client";
import type { PostCardProps } from "~/types/post";
import { MessageSender } from "./message-sender";
import { ImageModal } from "./post/ImageModal";
import { PostCardActions } from "./post/PostCardActions";
import { PostCardContent } from "./post/PostCardContent";
import { PostCardHeader } from "./post/PostCardHeader";
import { PostCardImages } from "./post/PostCardImages";
import { PostCardReactions } from "./post/PostCardReactions";

export const PostCard = memo(function PostCard({
  post,
  currentProfileId,
  onDelete,
  onRefresh,
  isCommunityOwner = false,
  isModerator = false,
  hideBorder = false,
}: PostCardProps) {
  const { currentProfile } = useAuth();
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showContentWarningContent, setShowContentWarningContent] =
    useState(false);
  const [selectedImage, setSelectedImage] = useState<{
    url: string;
    filename: string;
  } | null>(null);

  // Use the markdown hook for mention validation and rendering
  // For read-only posts, disable username validation to avoid API calls
  const { md } = useMarkdownWithMentions({
    content: post.content,
    useUsernameValidation: false,
  });

  // Use shared instance data instead of querying per post
  const { data: instanceData } = useQuery({
    queryKey: ["current-instance"],
  });

  const now = new Date();
  const communityEnded = instanceData
    ? now > new Date(instanceData.ends_at)
    : false;
  const communityNotStarted = instanceData
    ? now < new Date(instanceData.starts_at)
    : false;
  const canInteract = !communityEnded && !communityNotStarted;

  const deletePost = useCallback(async () => {
    const profileIdToUse = currentProfileId;

    if (!profileIdToUse) {
      toast.error("프로필를 선택해주세요.");
      return;
    }

    try {
      const response = await client.app.posts[":post_id"].$delete({
        query: { profile_id: profileIdToUse },
        param: { post_id: post.id },
      });
      if (response.ok) {
        toast.success("게시물이 성공적으로 삭제되었습니다");
        onDelete?.();
      } else {
        throw new Error("게시물 삭제에 실패했습니다");
      }
    } catch (error) {
      console.error("Error deleting post:", error);
      toast.error("게시물 삭제에 실패했습니다");
    }
  }, [currentProfileId, post.id, onDelete]);

  const addReaction = useCallback(
    async (emoji: string) => {
      if (!currentProfile) return;

      try {
        const response = await client.app.posts[":post_id"].reactions.$post({
          param: { post_id: post.id },
          json: {
            profile_id: currentProfile.id,
            emoji: emoji,
          },
        });

        if (response.ok) {
          // Trigger a refresh of the post data
          (onRefresh || onDelete)?.();
        } else {
          // Handle API error response
          try {
            const errorData = await response.json();
            const errorMessage =
              errorData && typeof errorData === "object"
                ? "error" in errorData && typeof errorData.error === "string"
                  ? errorData.error
                  : "message" in errorData &&
                      typeof errorData.message === "string"
                    ? errorData.message
                    : undefined
                : undefined;
            toast.error(errorMessage || "반응을 추가할 수 없습니다");
          } catch {
            toast.error("반응을 추가할 수 없습니다");
          }
        }
      } catch (_err) {
        toast.error("반응 추가 중 오류가 발생했습니다");
      }
    },
    [currentProfile, post.id, onRefresh, onDelete],
  );

  const removeReaction = useCallback(
    async (emoji: string) => {
      if (!currentProfile) return;

      try {
        const response = await client.app.posts[":post_id"].reactions.$delete({
          param: { post_id: post.id },
          query: {
            profile_id: currentProfile.id,
            emoji: emoji,
          },
        });

        if (response.ok) {
          // Trigger a refresh of the post data
          (onRefresh || onDelete)?.();
        } else {
          // Handle API error response
          try {
            const errorData = await response.json();
            const errorMessage =
              errorData && typeof errorData === "object"
                ? "error" in errorData && typeof errorData.error === "string"
                  ? errorData.error
                  : "message" in errorData &&
                      typeof errorData.message === "string"
                    ? errorData.message
                    : undefined
                : undefined;
            toast.error(errorMessage || "반응을 제거할 수 없습니다");
          } catch {
            toast.error("반응을 제거할 수 없습니다");
          }
        }
      } catch (_err) {
        toast.error("반응 제거 중 오류가 발생했습니다");
      }
    },
    [currentProfile, post.id, onRefresh, onDelete],
  );

  // Calculate indentation and styling based on depth - memoize to avoid recalculation
  const { depth, marginLeft, isReply, cardSize, padding } = useMemo(() => {
    const depth = post.depth || 0;
    const indentationLevel = Math.min(depth, 5);
    const marginLeft = `${indentationLevel * 12}px`;
    const isReply = depth > 0;
    const cardSize = isReply ? "text-xs" : "text-sm";
    const padding = isReply ? "p-2" : "p-4";
    return { depth, marginLeft, isReply, cardSize, padding };
  }, [post.depth]);

  return (
    <div
      style={{ marginLeft }}
      className={`${
        post.announcement
          ? "bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-l-4 border-l-amber-500 dark:border-l-amber-600 shadow-lg"
          : isReply
            ? `bg-background ${!hideBorder ? "border border-border" : ""}`
            : `bg-card ${!hideBorder ? "border border-border" : ""}`
      } ${isReply ? "rounded-lg" : "rounded-2xl"} ${!hideBorder ? "shadow-sm" : ""} overflow-hidden ${
        isReply
          ? `border-l-4 ${
              depth === 1
                ? "border-l-blue-300 dark:border-l-blue-600"
                : depth === 2
                  ? "border-l-blue-400 dark:border-l-blue-500"
                  : depth === 3
                    ? "border-l-blue-500 dark:border-l-blue-400"
                    : depth === 4
                      ? "border-l-blue-600 dark:border-l-blue-300"
                      : "border-l-blue-700 dark:border-l-blue-200"
            }`
          : ""
      } ${cardSize}`}
    >
      <div className={padding}>
        {/* Header */}
        <PostCardHeader
          postId={post.id}
          author={post.author}
          createdAt={post.createdAt}
          isAnnouncement={post.announcement}
          isReply={isReply}
          currentProfileId={currentProfileId}
          isModerator={isModerator}
          onDelete={deletePost}
        />

        {/* Content */}
        <PostCardContent
          content={post.content}
          contentWarning={post.content_warning}
          md={md}
          isReply={isReply}
          showContentWarningContent={showContentWarningContent}
          onToggleContentWarning={setShowContentWarningContent}
        />

        {/* Images */}
        {post.images && post.images.length > 0 && (
          <PostCardImages
            images={post.images}
            isReply={isReply}
            onImageClick={setSelectedImage}
            hidden={!!post.content_warning && !showContentWarningContent}
          />
        )}

        {/* Reply actions and reactions */}
        <div
          className={`${
            isReply ? "mt-2 pt-2" : "mt-4 pt-3"
          } border-t border-border`}
        >
          {/* Action buttons row */}
          <div
            className={`flex items-center flex-wrap ${
              isReply ? "gap-2" : "gap-4"
            }`}
          >
            <PostCardActions
              postId={post.id}
              replyCount={post.replies?.length || 0}
              isBookmarked={post.is_bookmarked || false}
              currentProfileId={currentProfileId}
              isReply={isReply}
              onToggleReply={() => setShowReplyForm(!showReplyForm)}
              showReplyForm={showReplyForm}
              onBookmarkChange={() => {}} // Handled internally by PostCardActions
            />

            {/* Reaction button and reactions display */}
            {currentProfile && (
              <PostCardReactions
                reactions={post.reactions || []}
                currentProfileId={currentProfile.id}
                canInteract={canInteract}
                onAddReaction={addReaction}
                onRemoveReaction={removeReaction}
                isReply={isReply}
              />
            )}
          </div>
        </div>

        {/* Inline reply form */}
        {showReplyForm && (
          <div
            className={`${
              isReply ? "mt-2 pl-2" : "mt-4 pl-4"
            } border-l-2 border-blue-200`}
          >
            <MessageSender
              key={currentProfile?.id || "no-profile"}
              replyToId={post.id}
              placeholder={`@${post.author.username}님에게 답글을 작성하세요...`}
              initialValue={`@${post.author.username} `}
              onPostSuccess={() => {
                toast.success("답글이 작성되었습니다");
                setShowReplyForm(false);
                (onRefresh || onDelete)?.();
              }}
            />
          </div>
        )}

        {/* Nested replies - only show for root posts (depth 0 or undefined) to avoid infinite nesting */}
        {post.threaded_replies &&
          post.threaded_replies.length > 0 &&
          (post.depth === 0 || post.depth === undefined) && (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-muted-foreground font-medium">
                  답글 {post.threaded_replies.length}개
                </span>
              </div>
              <div className="space-y-1">
                {post.threaded_replies.map((reply) => (
                  <PostCard
                    key={reply.id}
                    post={reply}
                    currentProfileId={currentProfileId}
                    onDelete={onDelete}
                    onRefresh={onRefresh}
                    isCommunityOwner={isCommunityOwner}
                    isModerator={isModerator}
                  />
                ))}
              </div>
            </div>
          )}
      </div>

      {/* Image Modal */}
      <ImageModal
        image={selectedImage}
        onClose={() => setSelectedImage(null)}
      />
    </div>
  );
});
