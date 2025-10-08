import { Megaphone, Shield, Trash2 } from "lucide-react";
import { Link } from "react-router";
import { ProfileAvatar } from "~/components/profile-avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";

interface PostAuthor {
  id: string;
  username: string;
  name: string;
  profile_picture_url?: string | null;
}

interface PostCardHeaderProps {
  postId: string;
  author: PostAuthor;
  createdAt: string;
  isAnnouncement?: boolean;
  isReply?: boolean;
  currentProfileId?: string;
  isModerator?: boolean;
  onDelete: () => void;
  size?: "sm" | "md";
}

export function PostCardHeader({
  postId,
  author,
  createdAt,
  isAnnouncement = false,
  isReply = false,
  currentProfileId,
  isModerator = false,
  onDelete,
  size: _size = "md",
}: PostCardHeaderProps) {
  const canDelete =
    (currentProfileId && author.id === currentProfileId) || isModerator;
  const isOwnPost = currentProfileId && author.id === currentProfileId;

  return (
    <div
      className={`flex items-center justify-between ${
        isReply ? "mb-1" : "mb-3"
      }`}
    >
      <div className="flex items-center gap-1">
        {/* Reply indicator */}
        {isReply && (
          <div className="flex items-center text-muted-foreground">
            <span className="text-xs">↳</span>
          </div>
        )}
        <Link to={`/@${author.username}`} className="block">
          <ProfileAvatar
            profilePictureUrl={author.profile_picture_url}
            name={author.name}
            username={author.username}
            size={isReply ? "sm" : "md"}
          />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <Link to={`/@${author.username}`} className="hover:underline">
              <span
                className={`${isReply ? "text-xs" : "text-sm"} font-${
                  isReply ? "medium" : "semibold"
                } text-foreground`}
              >
                {author.name}
              </span>
            </Link>
            <Link to={`/@${author.username}`} className="hover:underline">
              <span
                className={`${isReply ? "text-xs" : "text-xs"} text-muted-foreground`}
              >
                @{author.username}
              </span>
            </Link>
            {isAnnouncement && (
              <div className="flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-1 rounded-full text-xs font-medium">
                <Megaphone className="h-3 w-3" />
                <span>공지사항</span>
              </div>
            )}
          </div>
          <Link
            to={`/@${author.username}/${postId}`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {new Date(createdAt).toLocaleString()}
          </Link>
        </div>
      </div>
      {canDelete && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              className="text-muted-foreground hover:text-red-500 p-2 rounded-lg hover:bg-background transition-colors"
              title={isOwnPost ? "게시물 삭제" : "모더레이션 삭제"}
            >
              {isOwnPost ? (
                <Trash2 className="h-4 w-4" />
              ) : (
                <Shield className="h-4 w-4" />
              )}
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>게시물 삭제</AlertDialogTitle>
              <AlertDialogDescription>
                이 게시물을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
              <AlertDialogAction
                onClick={onDelete}
                className="bg-red-600 hover:bg-red-700"
              >
                삭제
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
