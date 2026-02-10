import { Send, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "~/hooks/useAuth";
import { client } from "~/lib/api-client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Spinner } from "./ui/spinner";
import { Textarea } from "./ui/textarea";

interface BoardPostFormProps {
  boardSlug: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function BoardPostForm({
  boardSlug,
  onSuccess,
  onCancel,
}: BoardPostFormProps) {
  const { currentProfile } = useAuth();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
            placeholder="내용을 입력하세요"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            className="resize-none"
          />
        </div>

        <div className="flex justify-end gap-2">
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
    </form>
  );
}
