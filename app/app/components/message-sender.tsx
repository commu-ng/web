import {
  AlertTriangle,
  Calendar,
  Edit3,
  Eye,
  Megaphone,
  Paperclip,
  Send,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { DateTimePicker } from "~/components/ui/datetime-picker";
import { Input } from "~/components/ui/input";
import { Spinner } from "~/components/ui/spinner";
import { Textarea } from "~/components/ui/textarea";
import { useAuth } from "~/hooks/useAuth";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";
import { useImageUpload } from "~/hooks/useImageUpload";
import { useMarkdownWithMentions } from "~/hooks/useMarkdownWithMentions";
import { client, getErrorMessage } from "~/lib/api-client";
import { ProfileAvatar } from "./profile-avatar";
import { MarkdownHelpModal } from "./markdown-help-modal";

interface MessageSenderProps {
  onPostSuccess?: () => void;
  replyToId?: string;
  placeholder?: string;
  initialValue?: string;
}

import type { Profile } from "~/types/profile";

const MAX_MESSAGE_LENGTH = 500;

export function MessageSender({
  onPostSuccess,
  replyToId,
  placeholder = "무슨 일이 일어나고 있나요?",
  initialValue = "",
}: MessageSenderProps) {
  const { currentProfile } = useAuth();

  // Core state
  const [message, setMessage] = useState(initialValue);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  // Image handling using hook
  const {
    images,
    uploadedImageIds,
    isUploadingImages,
    handleImageSelect: handleImageSelectFromHook,
    removeImage: removeImageFromHook,
    clearImages,
  } = useImageUpload({ maxImages: 4 });

  // Mention autocomplete state
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionPosition, setMentionPosition] = useState({ start: 0, end: 0 });
  const [mentionProfiles, setMentionProfiles] = useState<Profile[]>([]);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);

  // IME composition state for CJK input
  const compositionDataRef = useRef<string>("");

  // Debounced message for markdown rendering - only render preview after 500ms of no typing
  const [debouncedMessage, setDebouncedMessage] = useState(message);

  useEffect(() => {
    // Only debounce in preview mode to avoid unnecessary processing
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
  // Only render markdown for the debounced message in preview mode
  const { md } = useMarkdownWithMentions({
    content: isPreviewMode ? debouncedMessage : message,
    useUsernameValidation: true,
  });

  // Announcement state
  const [isAnnouncement, setIsAnnouncement] = useState(false);

  // Content warning state
  const [hasContentWarning, setHasContentWarning] = useState(false);
  const [contentWarning, setContentWarning] = useState("");

  // Scheduling state
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<Date | undefined>(undefined);

  // Use existing hooks instead of duplicate API calls
  const { currentInstance, isOwner, isModerator } = useCurrentInstance();

  const now = new Date();
  const communityEnded = currentInstance
    ? now > new Date(currentInstance.ends_at)
    : false;
  const communityNotStarted = currentInstance
    ? now < new Date(currentInstance.starts_at)
    : false;
  const communityEndsAt = currentInstance
    ? new Date(currentInstance.ends_at)
    : undefined;

  const isOwnerOrModerator = isOwner || isModerator;

  // Announcements cannot be replies
  const canBeAnnouncement = isOwner && !replyToId;

  // Scheduling is only available to owners/moderators and cannot be used for replies
  const canSchedule = isOwnerOrModerator && !replyToId;

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
        // API returns an object with data, nextCursor, and hasMore
        const allProfiles: Profile[] = result.data || [];

        // Filter profiles by query if provided
        const filteredProfiles = query
          ? allProfiles.filter(
              (profile) =>
                profile.name.toLowerCase().includes(query.toLowerCase()) ||
                profile.username.toLowerCase().includes(query.toLowerCase()),
            )
          : allProfiles;

        setMentionProfiles(filteredProfiles.slice(0, 10)); // Limit to 10 results
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

    // If we're composing CJK characters, exclude the composition data from the search
    const compositionData = compositionDataRef.current;
    if (compositionData && beforeCursor.endsWith(compositionData)) {
      beforeCursor = beforeCursor.slice(0, -compositionData.length);
    }

    const mentionMatch = beforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      const start = beforeCursor.length - mentionMatch[0].length;
      const query = mentionMatch[1] ?? "";

      setMentionPosition({ start, end: cursorPosition });
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
    const afterMention = message.slice(mentionPosition.end);
    const newMessage = `${beforeMention}@${profile.username} ${afterMention}`;

    setMessage(newMessage);
    setShowMentionDropdown(false);
    setMentionProfiles([]);
    setMentionQuery("");

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

  const sendMessage = async () => {
    const trimmedMessage = message.trim();
    if ((!trimmedMessage && uploadedImageIds.length === 0) || isPosting) return;

    if (!currentProfile) {
      toast.error("프로필를 선택해주세요.");
      return;
    }

    setIsPosting(true);
    try {
      const postData = {
        content: trimmedMessage,
        image_ids: uploadedImageIds,
        in_reply_to_id: replyToId,
        announcement: isAnnouncement,
        content_warning: contentWarning.trim() || undefined,
        scheduled_at:
          isScheduled && scheduledAt ? scheduledAt.toISOString() : undefined,
        profile_id: currentProfile.id,
      };

      const response = await client.app.posts.$post({ json: postData });
      const responseData = await response.json();

      if (!response.ok) {
        toast.error(
          getErrorMessage(
            responseData,
            "메시지 게시에 실패했습니다. 다시 시도해주세요.",
          ),
        );
        return;
      }

      // Reset form
      setMessage("");
      clearImages();
      setIsAnnouncement(false);
      setIsScheduled(false);
      setScheduledAt(undefined);
      setHasContentWarning(false);
      setContentWarning("");
      setIsPreviewMode(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      if (isScheduled && scheduledAt) {
        toast.success(
          `게시물이 ${new Date(scheduledAt).toLocaleString("ko-KR")}에 예약되었습니다!`,
        );
      } else {
        toast.success("메시지가 성공적으로 게시되었습니다!");
      }
      onPostSuccess?.();
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("메시지 게시에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsPosting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle Ctrl+Enter or Cmd+Enter to post
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (canPost) {
        sendMessage();
      }
      return;
    }

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

  // IME composition handlers for CJK input
  const handleCompositionStart = () => {
    compositionDataRef.current = "";
  };

  const handleCompositionUpdate = (
    e: React.CompositionEvent<HTMLTextAreaElement>,
  ) => {
    // Track the current composition data
    compositionDataRef.current = e.data || "";
    // Check for mentions during composition, excluding the composition data
    const currentValue = e.currentTarget.value;
    const cursorPosition = e.currentTarget.selectionStart;
    checkForMention(currentValue, cursorPosition);
  };

  const handleCompositionEnd = (
    e: React.CompositionEvent<HTMLTextAreaElement>,
  ) => {
    // Clear composition data
    compositionDataRef.current = "";
    // Check for mentions after composition ends
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

  const isDisabled = isUploadingImages || isPosting;
  const canPreview = message.trim().length > 0;
  const uploadedImagesCount = images.filter((img) => img.uploadedId).length;
  const isOverLimit = message.length > MAX_MESSAGE_LENGTH;
  const canPost =
    (message.trim().length > 0 || uploadedImagesCount > 0) &&
    !isDisabled &&
    !isOverLimit &&
    currentProfile &&
    (!isScheduled || scheduledAt !== undefined);

  // If community has ended, show notice instead of message sender
  if (communityEnded) {
    return (
      <div className="bg-muted border border-border rounded-xl p-6 text-center">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-foreground mb-2">
          커뮤가 종료되었습니다
        </h3>
        <p className="text-muted-foreground">
          이 커뮤는 종료되어 더 이상 게시할 수 없습니다.
        </p>
      </div>
    );
  }

  // If community hasn't started and user is not owner/moderator, show notice
  if (communityNotStarted && !isOwnerOrModerator) {
    return (
      <div className="bg-muted border border-border rounded-xl p-6 text-center">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-foreground mb-2">
          커뮤가 아직 시작되지 않았습니다
        </h3>
        <p className="text-muted-foreground">
          커뮤가 시작되면 게시할 수 있습니다.
        </p>
      </div>
    );
  }

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
            disabled={isPosting}
            className="h-8 px-2 sm:px-3"
          >
            <Edit3 className="h-3 w-3 sm:mr-1.5" />
            <span className="hidden sm:inline">작성</span>
          </Button>
          <Button
            type="button"
            variant={isPreviewMode ? "default" : "ghost"}
            size="sm"
            onClick={() => setIsPreviewMode(true)}
            disabled={isPosting || !canPreview}
            className="h-8 px-2 sm:px-3"
          >
            <Eye className="h-3 w-3 sm:mr-1.5" />
            <span className="hidden sm:inline">미리보기</span>
          </Button>
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1">
          {canBeAnnouncement && (
            <Button
              type="button"
              variant={isAnnouncement ? "default" : "ghost"}
              size="sm"
              onClick={() => setIsAnnouncement(!isAnnouncement)}
              disabled={isDisabled}
              className="h-8 w-8 p-0"
              title={isAnnouncement ? "공지사항 해제" : "공지사항으로 게시"}
            >
              <Megaphone className="h-4 w-4" />
            </Button>
          )}
          {canSchedule && (
            <Button
              type="button"
              variant={isScheduled ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                setIsScheduled(!isScheduled);
                if (isScheduled) {
                  setScheduledAt(undefined);
                }
              }}
              disabled={isDisabled}
              className="h-8 w-8 p-0"
              title={isScheduled ? "예약 취소" : "게시물 예약"}
            >
              <Calendar className="h-4 w-4" />
            </Button>
          )}
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
            onClick={sendMessage}
            disabled={!canPost}
            size="sm"
            className="h-8 px-2 sm:px-4 ml-1 sm:ml-2"
          >
            {isPosting ? (
              <Spinner className="h-3 w-3 text-white" />
            ) : (
              <>
                <Send className="h-3 w-3 sm:mr-1.5" />
                <span className="hidden sm:inline">게시</span>
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
                  disabled={isPosting}
                  className="bg-card"
                />
              </div>
            )}
            {/* Scheduling DateTime Picker */}
            {isScheduled && (
              <div className="mb-3 pb-4 p-4 bg-muted border-y border-border">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">
                    게시물 예약
                  </span>
                </div>
                <DateTimePicker
                  value={scheduledAt}
                  onChange={setScheduledAt}
                  minDate={new Date()}
                  maxDate={communityEndsAt}
                  disabled={isPosting}
                />
                {scheduledAt && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    이 게시물은 {new Date(scheduledAt).toLocaleString("ko-KR")}
                    에 자동으로 게시됩니다.
                  </p>
                )}
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
              placeholder={placeholder}
              disabled={isPosting}
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

        {/* Integrated mention autocomplete - appears as part of the component */}
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
                  <ProfileAvatar
                    profilePictureUrl={profile.profile_picture_url}
                    name={profile.name}
                    username={profile.username}
                    size="md"
                  />
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
