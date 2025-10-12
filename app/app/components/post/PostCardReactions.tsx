import { Smile } from "lucide-react";
import { useEffect, useState } from "react";

interface Reaction {
  emoji: string;
  user: {
    id: string;
    username: string;
    name: string;
  };
}

interface PostCardReactionsProps {
  reactions: Reaction[];
  currentProfileId?: string;
  canInteract: boolean;
  onAddReaction: (emoji: string) => Promise<void>;
  onRemoveReaction: (emoji: string) => Promise<void>;
  isReply?: boolean;
}

const AVAILABLE_REACTIONS = [
  { emoji: "❤️", label: "좋아요" },
  { emoji: "🎉", label: "축하" },
  { emoji: "😂", label: "웃김" },
  { emoji: "😲", label: "놀람" },
  { emoji: "🤔", label: "생각" },
  { emoji: "😢", label: "슬픔" },
  { emoji: "👀", label: "주목" },
];

export function PostCardReactions({
  reactions,
  currentProfileId,
  canInteract,
  onAddReaction,
  onRemoveReaction,
  isReply = false,
}: PostCardReactionsProps) {
  const [openReactionSelector, setOpenReactionSelector] = useState(false);

  // Close reaction selector when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        openReactionSelector &&
        event.target instanceof Element &&
        !event.target.closest(".reaction-selector")
      ) {
        setOpenReactionSelector(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openReactionSelector]);

  const handleReactionClick = async (emoji: string) => {
    await onAddReaction(emoji);
    setOpenReactionSelector(false);
  };

  // Group reactions by emoji type
  const reactionGroups = reactions.reduce<
    Record<string, Array<{ id: string; username: string; name: string }>>
  >((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = [];
    }
    if (reaction.user) {
      const group = acc[reaction.emoji];
      if (group) {
        group.push(reaction.user);
      }
    }
    return acc;
  }, {});

  return (
    <>
      {/* Reaction button */}
      {currentProfileId && canInteract && (
        <>
          <button
            type="button"
            onClick={() => setOpenReactionSelector(!openReactionSelector)}
            className={`reaction-selector inline-flex items-center gap-1 ${
              isReply ? "text-xs" : "text-sm"
            } text-muted-foreground hover:text-blue-600 transition-colors`}
          >
            <Smile className={isReply ? "h-3 w-3" : "h-4 w-4"} />
            <span>반응</span>
          </button>

          {openReactionSelector && (
            <div className="reaction-selector basis-full bg-popover border border-border rounded-lg shadow-lg p-2 flex flex-wrap gap-1">
              {AVAILABLE_REACTIONS.map(({ emoji, label }) => (
                <button
                  type="button"
                  key={emoji}
                  onClick={() => handleReactionClick(emoji)}
                  className="hover:bg-accent p-1 rounded text-lg transition-colors"
                  title={label}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Reactions display - placed in separate row */}
      {Object.keys(reactionGroups).length > 0 && (
        <div
          className={`basis-full flex flex-wrap gap-1 ${isReply ? "mt-1" : "mt-2"}`}
        >
          {Object.entries(reactionGroups).map(([emoji, users]) => {
            const hasCurrentUserReaction =
              currentProfileId &&
              users.some((user) => user.id === currentProfileId);

            return (
              <button
                type="button"
                key={emoji}
                onClick={() => {
                  if (hasCurrentUserReaction) {
                    onRemoveReaction(emoji);
                  } else {
                    handleReactionClick(emoji);
                  }
                }}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border transition-colors ${
                  hasCurrentUserReaction
                    ? "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900"
                    : "bg-background border-border text-foreground hover:bg-accent"
                }`}
                title={`${users.map((u) => `${u.name} (@${u.username})`).join(", ")}`}
              >
                <span>{emoji}</span>
                <span>{users.length}</span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
