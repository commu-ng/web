import { useCallback } from "react";
import { toast } from "sonner";
import { useAuth } from "~/hooks/useAuth";
import { client, getErrorMessage } from "~/lib/api-client";
import type { Post } from "~/types/post";
import { MessageComposer } from "./MessageComposer";

interface PostEditorProps {
  post: Post;
  onSaveSuccess?: () => void;
  onCancel: () => void;
}

export function PostEditor({ post, onSaveSuccess, onCancel }: PostEditorProps) {
  const { currentProfile } = useAuth();

  const handleSubmit = useCallback(
    async (data: {
      content: string;
      image_ids: string[];
      content_warning?: string;
    }) => {
      if (!currentProfile) {
        toast.error("프로필을 선택해주세요.");
        return;
      }

      const response = await client.app.posts[":post_id"].$patch({
        param: { post_id: post.id },
        query: { profile_id: currentProfile.id },
        json: data,
      });

      const responseData = await response.json();

      if (!response.ok) {
        toast.error(
          getErrorMessage(
            responseData,
            "게시물 수정에 실패했습니다. 다시 시도해주세요.",
          ),
        );
        throw new Error("Failed to update post");
      }

      toast.success("게시물이 성공적으로 수정되었습니다!");
      onSaveSuccess?.();
    },
    [currentProfile, post.id, onSaveSuccess],
  );

  return (
    <MessageComposer
      mode="edit"
      initialContent={post.content}
      initialImages={post.images}
      initialContentWarning={post.content_warning}
      placeholder="게시물 내용을 입력하세요..."
      onSubmit={handleSubmit}
      onCancel={onCancel}
    />
  );
}
