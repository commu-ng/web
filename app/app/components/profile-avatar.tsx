import { User } from "lucide-react";
import { getGradientForUser } from "~/lib/gradient-utils";
import { cn } from "~/lib/utils";

interface ProfileAvatarProps {
  profilePictureUrl?: string | null;
  name: string;
  username?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  sm: "w-6 h-6",
  md: "w-8 h-8",
  lg: "w-10 h-10",
  xl: "w-20 h-20",
};

const iconSizeClasses = {
  sm: "h-3 w-3",
  md: "h-4 w-4",
  lg: "h-5 w-5",
  xl: "h-10 w-10",
};

export function ProfileAvatar({
  profilePictureUrl,
  name,
  username,
  size = "lg",
  className,
}: ProfileAvatarProps) {
  const gradient = getGradientForUser(username, name);
  const baseClasses = `bg-gradient-to-br ${gradient} rounded-full flex items-center justify-center overflow-hidden`;
  const sizeClass = sizeClasses[size];
  const iconSizeClass = iconSizeClasses[size];

  return (
    <div className={cn(baseClasses, sizeClass, className)}>
      {profilePictureUrl ? (
        <img
          src={profilePictureUrl}
          alt={`${name}의 프로필 사진`}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover"
        />
      ) : (
        <User className={cn(iconSizeClass, "text-white")} />
      )}
    </div>
  );
}
