import { AlertTriangle, Edit3, Eye, Paperclip, Save, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Spinner } from "~/components/ui/spinner";
import { Textarea } from "~/components/ui/textarea";
import { useAuth } from "~/hooks/useAuth";
import { useImageUpload } from "~/hooks/useImageUpload";
import { useMarkdownWithMentions } from "~/hooks/useMarkdownWithMentions";
import { client, getErrorMessage } from "~/lib/api-client";
import type { Post, PostImage } from "~/types/post";
import { MarkdownHelpModal } from "./markdown-help-modal";
import type { Profile } from "~/types/profile";

interface PostEditorProps {
  post: Post;
  onSaveSuccess?: () => void;
  onCancel: () => void;
}

const MAX_MESSAGE_LENGTH = 500;

export function PostEditor({ post, onSaveSuccess, onCancel }: PostEditorProps) {
  const { currentProfile } = useAuth();

  // Core state
  const [message, setMessage] = useState(post.content);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Content warning state
  const [hasContentWarning, setHasContentWarning] = useState(
    !!post.content_warning,
  );
  const [contentWarning, setContentWarning] = useState(
    post.content_warning || "",
  );

  // Image handling using hook - initialize with existing images
  const {
    images,
    uploadedImageIds,
    isUploadingImages,
    handleImageSelect: handleImageSelectFromHook,
    removeImage: removeImageFromHook,
    initializeWithExisting,
  } = useImageUpload({ maxImages: 4 });

  // Initialize images from post
  useEffect(() => {
    if (post.images && post.images.length > 0) {
      const existingImages = post.images.map((img: PostImage) => ({
        id: crypto.randomUUID(),
        file: null,
        preview: img.url,
        uploadedId: img.id,
      }));
      initializeWithExisting(existingImages);
    }
  }, [post.images, initializeWithExisting]);

  // Mention autocomplete state
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionPosition, setMentionPosition] = useState({ start: 0, end: 0 });
  const [mentionProfiles, setMentionProfiles] = useState<Profile[]>([]);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);

  // IME composition state for CJK input
  const compositionDataRef = useRef<string>("");

  // Debounced message for markdown rendering
  const [debouncedMessage, setDebouncedMessage] = useState(message);

  useEffect(() => {
    if (!isPreviewMode) {
      setDebouncedMessage(message);
      return;
    }

    const debounceTimer = setTimeout(() => {
      setDebouncedMessage(message);
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [message, isPreviewMode]);

  // Use the markdown hook for mention validation and rendering
  const { md } = useMarkdownWithMentions({
    content: isPreviewMode ? debouncedMessage : message,
    useUsernameValidation: true,
  });

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch profiles for mention autocomplete
  const fetchProfiles = useCallback(async (query: string) => {
    try {
      const response = await client.app.profiles.$get({
        query: {},
      });
      if (response.ok) {
        const result = await response.json();
        const allProfiles: Profile[] = Array.isArray(result) ? result : [];

        const filteredProfiles = query
          ? allProfiles.filter(
              (profile) =>
                profile.name.toLowerCase().includes(query.toLowerCase()) ||
                profile.username.toLowerCase().includes(query.toLowerCase()),
            )
          : allProfiles;

        setMentionProfiles(filteredProfiles.slice(0, 10));
        setSelectedMentionIndex(0);
      }
    } catch (error) {
      console.error("Failed to fetch profiles:", error);
    }
  }, []);

  // Debounce profile fetching
  useEffect(() => {
    if (!showMentionDropdown) return;

    if (mentionQuery === "") {
      fetchProfiles("");
      return;
    }

    const debounceTimer = setTimeout(() => {
      fetchProfiles(mentionQuery);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [mentionQuery, showMentionDropdown, fetchProfiles]);

  // Check for @ mentions in the text
  const checkForMention = (text: string, cursorPosition: number) => {
    let beforeCursor = text.slice(0, cursorPosition);

    const compositionData = compositionDataRef.current;
    let adjustedCursorPosition = cursorPosition;
    if (compositionData && beforeCursor.endsWith(compositionData)) {
      beforeCursor = beforeCursor.slice(0, -compositionData.length);
      adjustedCursorPosition = cursorPosition - compositionData.length;
    }

    const mentionMatch = beforeCursor.match(/@([^\s@]*)$/);

    if (mentionMatch) {
      const start = beforeCursor.length - mentionMatch[0].length;
      const query = mentionMatch[1] ?? "";

      setMentionPosition({ start, end: adjustedCursorPosition });
      setMentionQuery(query);
      setShowMentionDropdown(true);
    } else {
      setShowMentionDropdown(false);
      setMentionProfiles([]);
      setMentionQuery("");
    }
  };

  // Handle mention selection
  const selectMention = (profile: Profile) => {
    const beforeMention = message.slice(0, mentionPosition.start);

    const compositionData = compositionDataRef.current;
    const skipLength = compositionData ? compositionData.length : 0;
    const afterMention = message.slice(mentionPosition.end + skipLength);

    const newMessage = `${beforeMention}@${profile.username} ${afterMention}`;

    setMessage(newMessage);
    setShowMentionDropdown(false);
    setMentionProfiles([]);
    setMentionQuery("");

    compositionDataRef.current = "";

    setTimeout(() => {
      textareaRef.current?.focus();
      const newPosition = mentionPosition.start + profile.username.length + 2;
      textareaRef.current?.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleImageSelectFromHook(e.target.files);
    }
  };

  const savePost = async () => {
    const trimmedMessage = message.trim();
    if ((!trimmedMessage && uploadedImageIds.length === 0) || isSaving) return;

    if (!currentProfile) {
      toast.error("프로필을 선택해주세요.");
      return;
    }

    setIsSaving(true);
    try {
      const updateData = {
        content: trimmedMessage,
        image_ids: uploadedImageIds,
        content_warning: contentWarning.trim() || undefined,
      };

      const response = await client.app.posts[":post_id"].$patch({
        param: { post_id: post.id },
        query: { profile_id: currentProfile.id },
        json: updateData,
      });

      const responseData = await response.json();

      if (!response.ok) {
        toast.error(
          getErrorMessage(
            responseData,
            "게시물 수정에 실패했습니다. 다시 시도해주세요.",
          ),
        );
        return;
      }

      toast.success("게시물이 성공적으로 수정되었습니다!");
      onSaveSuccess?.();
    } catch (error) {
      console.error("Failed to update post:", error);
      toast.error("게시물 수정에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentionDropdown && mentionProfiles.length > 0) {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedMentionIndex((prev) =>
            prev < mentionProfiles.length - 1 ? prev + 1 : 0,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedMentionIndex((prev) =>
            prev > 0 ? prev - 1 : mentionProfiles.length - 1,
          );
          break;
        case "Enter":
        case "Tab": {
          e.preventDefault();
          const selectedProfile = mentionProfiles[selectedMentionIndex];
          if (selectedProfile) {
            selectMention(selectedProfile);
          }
          break;
        }
        case "Escape":
          e.preventDefault();
          setShowMentionDropdown(false);
          setMentionProfiles([]);
          break;
      }
      return;
    }
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newMessage = e.target.value;
    setMessage(newMessage);
    const cursorPosition = e.target.selectionStart;
    checkForMention(newMessage, cursorPosition);
  };

  const handleTextareaClick = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    const cursorPosition = e.currentTarget.selectionStart;
    checkForMention(message, cursorPosition);
  };

  const handleCompositionStart = () => {
    compositionDataRef.current = "";
  };

  const handleCompositionUpdate = (
    e: React.CompositionEvent<HTMLTextAreaElement>,
  ) => {
    compositionDataRef.current = e.data || "";
    const currentValue = e.currentTarget.value;
    const cursorPosition = e.currentTarget.selectionStart;
    checkForMention(currentValue, cursorPosition);
  };

  const handleCompositionEnd = (
    e: React.CompositionEvent<HTMLTextAreaElement>,
  ) => {
    compositionDataRef.current = "";
    const currentValue = e.currentTarget.value;
    const cursorPosition = e.currentTarget.selectionStart;
    checkForMention(currentValue, cursorPosition);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showMentionDropdown && event.target instanceof HTMLElement) {
        if (
          !event.target.closest(".mention-dropdown") &&
          !event.target.closest("textarea")
        ) {
          setShowMentionDropdown(false);
          setMentionProfiles([]);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMentionDropdown]);

  const isDisabled = isUploadingImages || isSaving;
  const canPreview = message.trim().length > 0;
  const uploadedImagesCount = images.filter((img) => img.uploadedId).length;
  const isOverLimit = message.length > MAX_MESSAGE_LENGTH;
  const canSave =
    (message.trim().length > 0 || uploadedImagesCount > 0) &&
    !isDisabled &&
    !isOverLimit &&
    currentProfile;

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm relative">
      {/* Header with toggle buttons */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background rounded-t-xl">
        <div className="flex items-center gap-1 sm:gap-2">
          <Button
            type="button"
            variant={!isPreviewMode ? "default" : "ghost"}
            size="sm"
            onClick={() => setIsPreviewMode(false)}
            disabled={isSaving}
            className="h-8 px-2 sm:px-3"
          >
            <Edit3 className="h-3 w-3 sm:mr-1.5" />
            <span className="hidden sm:inline">편집</span>
          </Button>
          <Button
            type="button"
            variant={isPreviewMode ? "default" : "ghost"}
            size="sm"
            onClick={() => setIsPreviewMode(true)}
            disabled={isSaving || !canPreview}
            className="h-8 px-2 sm:px-3"
          >
            <Eye className="h-3 w-3 sm:mr-1.5" />
            <span className="hidden sm:inline">미리보기</span>
          </Button>
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1">
          <Button
            type="button"
            variant={hasContentWarning ? "default" : "ghost"}
            size="sm"
            onClick={() => {
              setHasContentWarning(!hasContentWarning);
              if (!hasContentWarning) {
                setContentWarning("민감한 내용");
              } else {
                setContentWarning("");
              }
            }}
            disabled={isDisabled}
            className="h-8 w-8 p-0"
            title={hasContentWarning ? "컨텐츠 경고 해제" : "컨텐츠 경고 추가"}
          >
            <AlertTriangle className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isDisabled}
            className="h-8 w-8 p-0"
            title="이미지 첨부"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button
            onClick={onCancel}
            variant="ghost"
            size="sm"
            disabled={isSaving}
            className="h-8 px-2 sm:px-4 ml-1 sm:ml-2"
          >
            취소
          </Button>
          <Button
            onClick={savePost}
            disabled={!canSave}
            size="sm"
            className="h-8 px-2 sm:px-4"
          >
            {isSaving ? (
              <Spinner className="h-3 w-3 text-white" />
            ) : (
              <>
                <Save className="h-3 w-3 sm:mr-1.5" />
                <span className="hidden sm:inline">저장</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Image previews */}
      {images.length > 0 && (
        <div className="px-4 py-3 border-b border-border">
          <div className="flex flex-wrap gap-2">
            {images.map((image, index) => (
              <div key={image.id} className="relative group">
                <img
                  src={image.preview}
                  alt="Preview"
                  className="w-16 h-16 object-cover rounded-lg border border-border"
                />
                <button
                  type="button"
                  onClick={() => removeImageFromHook(index)}
                  disabled={isDisabled}
                  className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 disabled:opacity-50"
                  title="이미지 제거"
                >
                  <X className="h-3 w-3" />
                </button>
                {isUploadingImages && !image.uploadedId && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                    <div className="text-white text-xs font-medium">
                      업로드 중...
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="relative">
        {!isPreviewMode ? (
          <div className="relative">
            {/* Content Warning Input */}
            {hasContentWarning && (
              <div className="mb-3 pb-3 p-4 bg-muted border-y border-border">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">
                    컨텐츠 경고
                  </span>
                </div>
                <Input
                  value={contentWarning}
                  onChange={(e) => setContentWarning(e.target.value)}
                  placeholder="경고 내용을 입력하세요 (예: 민감한 내용, 스포일러 포함 등)"
                  disabled={isSaving}
                  className="bg-card"
                />
              </div>
            )}
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={handleMessageChange}
              onKeyDown={handleKeyDown}
              onClick={handleTextareaClick}
              onCompositionStart={handleCompositionStart}
              onCompositionUpdate={handleCompositionUpdate}
              onCompositionEnd={handleCompositionEnd}
              placeholder="게시물 내용을 입력하세요..."
              disabled={isSaving}
              className={`resize-none border-0 focus:ring-0 focus:border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent text-base leading-relaxed transition-all ${
                showMentionDropdown && mentionProfiles.length > 0
                  ? "min-h-[120px] rounded-t-none"
                  : "min-h-[120px] rounded-none"
              }`}
            />
          </div>
        ) : (
          <div className="min-h-[120px] p-4">
            {message.trim() ? (
              <div
                className="prose prose-sm dark:prose-invert max-w-none text-base leading-relaxed"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized html
                dangerouslySetInnerHTML={{
                  __html: md.render(message),
                }}
              />
            ) : (
              <p className="text-muted-foreground text-base">
                미리 볼 내용이 없습니다.
              </p>
            )}
          </div>
        )}

        {/* Mention autocomplete */}
        {showMentionDropdown &&
          mentionProfiles.length > 0 &&
          !isPreviewMode && (
            <div className="mention-dropdown bg-card border-t border-border max-h-48 overflow-y-auto">
              {mentionProfiles.map((profile, index) => (
                <button
                  key={profile.username}
                  type="button"
                  className={`px-4 py-3 cursor-pointer w-full text-left flex items-center gap-3 transition-colors border-l-4 ${
                    index === selectedMentionIndex
                      ? "bg-accent border-l-primary"
                      : "hover:bg-background border-l-transparent"
                  }`}
                  onClick={() => selectMention(profile)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      selectMention(profile);
                    }
                  }}
                >
                  <div className="flex flex-col flex-1">
                    <span className="text-sm font-medium text-foreground">
                      {profile.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      @{profile.username}
                    </span>
                  </div>
                  {index === selectedMentionIndex && (
                    <div className="text-xs text-muted-foreground font-medium">
                      Tab
                    </div>
                  )}
                </button>
              ))}
              <div className="px-4 py-2 bg-background border-t border-border">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>↑↓ 선택</span>
                  <span>Tab 확인</span>
                </div>
              </div>
            </div>
          )}
      </div>

      {/* Footer */}
      <div
        className={`px-4 py-3 bg-background ${
          showMentionDropdown && mentionProfiles.length > 0 && !isPreviewMode
            ? "border-t-0"
            : "border-t border-border rounded-b-xl"
        }`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
          <p className="text-xs text-muted-foreground">
            <MarkdownHelpModal /> 문법을 사용할 수 있습니다.
          </p>
          <div
            className={`text-xs ${
              isOverLimit
                ? "text-red-600 dark:text-red-400 font-semibold"
                : "text-muted-foreground"
            }`}
          >
            {message.length > 0 &&
              `${message.length} / ${MAX_MESSAGE_LENGTH}자`}
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleImageSelect}
        className="hidden"
      />
    </div>
  );
}
