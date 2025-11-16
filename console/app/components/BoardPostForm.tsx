import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImageIcon, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { HashtagInput } from "~/components/hashtag-input";
import { MarkdownEditor } from "~/components/MarkdownEditor";
import { Button } from "~/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { api, getErrorMessage, uploadImage } from "~/lib/api-client";
import { COMMUNITY_TYPE_LABELS } from "~/lib/constants";

interface BoardPostFormProps {
  boardSlug: string;
  postId?: string;
  initialData?: {
    title: string;
    content: string;
    imageId: string | null;
    imageUrl: string | null;
    hashtags: string[];
  };
  onSuccess?: () => void;
}

export function BoardPostForm({
  boardSlug,
  postId,
  initialData,
  onSuccess,
}: BoardPostFormProps) {
  const titleId = useId();
  const imageId = useId();
  const communityTypeId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(initialData?.title || "");
  const [content, setContent] = useState(initialData?.content || "");
  const [uploadedImageId, setUploadedImageId] = useState<string | null>(
    initialData?.imageId || null,
  );
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(
    initialData?.imageUrl || null,
  );
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [communityType, setCommunityType] = useState<string>(() => {
    // Initialize community type from hashtags if editing
    if (boardSlug === "promo" && initialData?.hashtags) {
      // Check if any hashtag matches a Korean community type label
      const communityTypeLabels = Object.values(COMMUNITY_TYPE_LABELS);
      const existingCommunityType = initialData.hashtags.find((tag) =>
        communityTypeLabels.includes(tag),
      );
      return existingCommunityType || "";
    }
    return "";
  });
  const [hashtags, setHashtags] = useState<string[]>(
    initialData?.hashtags || [],
  );
  const queryClient = useQueryClient();

  const isEditMode = !!postId;
  const isPromoBoard = boardSlug === "promo";

  // Automatically add/remove community type as hashtag
  useEffect(() => {
    if (!isPromoBoard) return;

    // Get all Korean community type labels
    const communityTypeLabels = Object.values(COMMUNITY_TYPE_LABELS);

    // Remove any existing community type hashtags
    setHashtags((prev) => {
      const filtered = prev.filter((tag) => !communityTypeLabels.includes(tag));
      // Add the selected community type if one is selected
      if (communityType) {
        return [...filtered, communityType];
      }
      return filtered;
    });
  }, [communityType, isPromoBoard]);

  const savePostMutation = useMutation({
    mutationFn: async () => {
      if (isEditMode && postId) {
        // Update existing post
        const res = await api.console.board[":board_slug"].posts[
          ":board_post_id"
        ].$patch({
          param: { board_slug: boardSlug, board_post_id: postId },
          json: {
            title,
            content,
            image_id: uploadedImageId || undefined,
            hashtags: hashtags.length > 0 ? hashtags : undefined,
          },
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(
            getErrorMessage(errorData, "게시물 수정에 실패했습니다"),
          );
        }

        return await res.json();
      }

      // Create new post
      const res = await api.console.board[":board_slug"].posts.$post({
        param: { board_slug: boardSlug },
        json: {
          title,
          content,
          image_id: uploadedImageId || undefined,
          hashtags: hashtags.length > 0 ? hashtags : undefined,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          getErrorMessage(errorData, "게시물 작성에 실패했습니다"),
        );
      }

      return await res.json();
    },
    onSuccess: () => {
      toast.success(
        isEditMode
          ? "게시물이 성공적으로 수정되었습니다"
          : "게시물이 성공적으로 작성되었습니다",
      );
      // Reset form only if creating new post
      if (!isEditMode) {
        setTitle("");
        setContent("");
        setUploadedImageId(null);
        setUploadedImageUrl(null);
        setCommunityType("");
        setHashtags([]);
      }
      // Invalidate queries to refetch
      queryClient.invalidateQueries({ queryKey: ["board-posts", boardSlug] });
      if (isEditMode && postId) {
        queryClient.invalidateQueries({
          queryKey: ["board-post", boardSlug, postId],
        });
      }
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("제목을 입력해주세요");
      return;
    }
    if (!content.trim()) {
      toast.error("내용을 입력해주세요");
      return;
    }
    savePostMutation.mutate();
  };

  const handleImageButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const result = await uploadImage(file);
      setUploadedImageId(result.id);
      setUploadedImageUrl(result.url);
      toast.success("이미지가 업로드되었습니다");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "알 수 없는 오류";
      toast.error(`이미지 업로드 실패: ${errorMessage}`);
    } finally {
      setIsUploadingImage(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveImage = () => {
    setUploadedImageId(null);
    setUploadedImageUrl(null);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field>
        <FieldLabel htmlFor={titleId}>제목</FieldLabel>
        <Input
          id={titleId}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="게시물 제목을 입력하세요"
          maxLength={200}
          disabled={savePostMutation.isPending}
          required
        />
      </Field>

      <Field>
        <FieldLabel htmlFor={imageId}>이미지 (선택)</FieldLabel>
        {!uploadedImageUrl ? (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={handleImageButtonClick}
              disabled={savePostMutation.isPending || isUploadingImage}
              className="w-full"
            >
              <ImageIcon className="h-4 w-4 mr-2" />
              {isUploadingImage ? "업로드 중..." : "이미지 선택"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
              disabled={savePostMutation.isPending || isUploadingImage}
            />
            <FieldDescription>
              단일 이미지만 업로드할 수 있습니다
            </FieldDescription>
          </>
        ) : (
          <div className="relative">
            <img
              src={uploadedImageUrl}
              alt="업로드된 이미지"
              className="rounded-lg max-w-full h-auto max-h-64 object-contain"
            />
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleRemoveImage}
              disabled={savePostMutation.isPending}
              className="absolute top-2 right-2"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </Field>

      <MarkdownEditor
        value={content}
        onChange={setContent}
        onImageUpload={async (file) => {
          const result = await uploadImage(file);
          return { url: result.url };
        }}
        placeholder="게시물 내용을 입력하세요..."
        disabled={savePostMutation.isPending}
      />

      {isPromoBoard && (
        <Field>
          <FieldLabel htmlFor={communityTypeId}>
            커뮤니티 유형 (선택)
          </FieldLabel>
          <Select
            value={communityType || undefined}
            onValueChange={setCommunityType}
            disabled={savePostMutation.isPending}
          >
            <SelectTrigger id={communityTypeId}>
              <SelectValue placeholder="선택하지 않음" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(COMMUNITY_TYPE_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={label}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>
            선택한 커뮤니티 유형은 자동으로 해시태그로 추가됩니다
          </FieldDescription>
        </Field>
      )}

      <div>
        <HashtagInput
          value={hashtags}
          onChange={setHashtags}
          disabled={savePostMutation.isPending}
          label="해시태그 (선택)"
        />
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={
            savePostMutation.isPending || !title.trim() || !content.trim()
          }
        >
          {savePostMutation.isPending
            ? isEditMode
              ? "수정 중..."
              : "작성 중..."
            : isEditMode
              ? "게시물 수정"
              : "게시물 작성"}
        </Button>
      </div>
    </form>
  );
}
