import { Clock } from "lucide-react";
import { useState } from "react";
import { ImageModal } from "./post/ImageModal";

interface MessageBubbleProps {
  content: string;
  timestamp: string;
  isFromMe: boolean;
  senderName?: string;
  senderAvatar?: React.ReactNode;
  children?: React.ReactNode;
  onClick?: () => void;
  hasReactions?: boolean;
  images?: Array<{
    id: string;
    url: string;
    width: number;
    height: number;
  }>;
}

export function MessageBubble({
  content,
  timestamp,
  isFromMe,
  senderName,
  senderAvatar,
  children,
  onClick,
  hasReactions = false,
  images,
}: MessageBubbleProps) {
  const [selectedImage, setSelectedImage] = useState<{
    url: string;
    filename: string;
  } | null>(null);
  return (
    <div
      className={`flex flex-col ${isFromMe ? "items-end" : "items-start"} max-w-xs lg:max-w-md`}
    >
      {/* Sender info for messages from others */}
      {!isFromMe && senderAvatar && (
        <div className="flex items-center gap-2 mb-1">
          {senderAvatar}
          {senderName && (
            <span className="text-sm font-medium text-foreground">
              {senderName}
            </span>
          )}
        </div>
      )}

      {/* Message bubble */}
      <div
        {...(onClick && {
          onClick,
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onClick();
            }
          },
          role: "button" as const,
          tabIndex: 0,
        })}
        className={`rounded-lg px-4 py-2 ${
          isFromMe ? "bg-blue-600 text-white" : "bg-accent text-foreground"
        } ${hasReactions && onClick ? "cursor-pointer hover:opacity-90" : ""}`}
      >
        {/* Images */}
        {images && images.length > 0 && (
          <div className={`flex flex-col gap-2 ${content ? "mb-2" : ""}`}>
            {images.map((image) => (
              <button
                key={image.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedImage({
                    url: image.url,
                    filename: `image-${image.id}`,
                  });
                }}
                className="cursor-pointer"
              >
                <img
                  src={image.url}
                  alt="Attached"
                  width={image.width}
                  height={image.height}
                  className="rounded-md w-full h-auto object-cover"
                  style={{ maxHeight: "300px", minWidth: "200px" }}
                />
              </button>
            ))}
          </div>
        )}
        {/* Content */}
        {content && <p className="text-sm whitespace-pre-wrap">{content}</p>}
      </div>

      {/* Timestamp */}
      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        <span>{timestamp}</span>
      </div>

      {/* Reactions and other content */}
      {children}

      {/* Image Modal */}
      <ImageModal
        image={selectedImage}
        onClose={() => setSelectedImage(null)}
      />
    </div>
  );
}
