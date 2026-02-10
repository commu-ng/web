import { ImagePlus, Send, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "~/hooks/useAuth";
import { client } from "~/lib/api-client";
import { env } from "~/lib/env";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Spinner } from "./ui/spinner";
import { Textarea } from "./ui/textarea";

interface BoardPostFormProps {
  boardSlug: string;
  onSuccess: () => void;
  onCancel: () => void;
}

interface UploadedImage {
  id: string;
  filename: string;
  url: string;
  width: number;
  height: number;
}

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function BoardPostForm({
  boardSlug,
  onSuccess,
  onCancel,
}: BoardPostFormProps) {
  const { currentProfile } = useAuth();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadImage = async (file: File): Promise<UploadedImage> => {
    const formData = new FormData();
    formData.append("file", file);

    const uploadResponse = await fetch(`${env.apiBaseUrl}/app/upload/file`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("session_token")}`,
      },
      body: formData,
    });

    if (!uploadResponse.ok) {
      throw new Error("이미지 업로드에 실패했습니다");
    }

    const uploadData = await uploadResponse.json();
    return uploadData.data;
  };

  const insertTextAtCursor = (text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent((prev) => prev + text);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent =
      content.substring(0, start) + text + content.substring(end);
    setContent(newContent);

    // Set cursor position after inserted text
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + text.length, start + text.length);
    }, 0);
  };

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    // Validate file type
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error("이미지 파일만 업로드 가능합니다 (JPG, PNG, GIF, WebP)");
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error("이미지 크기는 10MB 이하여야 합니다");
      return;
    }

    try {
      setIsUploadingImage(true);
      const uploadedImage = await uploadImage(file);
      const markdownImage = `![${uploadedImage.filename}](${uploadedImage.url})`;
      insertTextAtCursor(`${markdownImage}\n`);
      toast.success("이미지가 업로드되었습니다");
    } catch (err) {
      console.error("Failed to upload image:", err);
      toast.error("이미지 업로드에 실패했습니다");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !content.trim() || !currentProfile) {
      toast.error("제목과 내용을 모두 입력해주세요");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await client.app.boards[":slug"].posts.$post({
        param: { slug: boardSlug },
        json: {
          profile_id: currentProfile.id,
          title: title.trim(),
          content: content.trim(),
        },
      });

      if (response.ok) {
        toast.success("게시글이 등록되었습니다");
        onSuccess();
      } else {
        toast.error("게시글 등록에 실패했습니다");
      }
    } catch (err) {
      console.error("Failed to create post:", err);
      toast.error("게시글 등록에 실패했습니다");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-card rounded-2xl shadow-sm border border-border p-6"
    >
      <h3 className="text-lg font-semibold text-foreground mb-4">
        새 게시글 작성
      </h3>

      <div className="space-y-4">
        <div>
          <Input
            type="text"
            placeholder="제목을 입력하세요"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
          />
        </div>

        <div>
          <Textarea
            ref={textareaRef}
            placeholder="내용을 입력하세요 (마크다운 형식 지원)"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            className="resize-none"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
              onChange={handleImageUpload}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingImage}
            >
              {isUploadingImage ? (
                <Spinner className="h-4 w-4 mr-2" />
              ) : (
                <ImagePlus className="h-4 w-4 mr-2" />
              )}
              이미지 추가
            </Button>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              <X className="h-4 w-4 mr-2" />
              취소
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || !content.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <Spinner className="h-4 w-4 mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              등록
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
