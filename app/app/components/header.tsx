import {
  Bell,
  Bookmark,
  ExternalLink,
  Hash,
  Home,
  Megaphone,
  MessageCircle,
  Settings,
  UserCheck,
} from "lucide-react";
import { Link, useLocation } from "react-router";
import { ProfileSwitcher } from "~/components/profile-switcher";
import { ThemeToggle } from "~/components/ThemeToggle";

interface HeaderProps {
  communityName: string;
  consoleUrl: string;
  unreadCount: number;
  unreadMessageCount: number;
}

export function Header({
  communityName,
  consoleUrl,
  unreadCount,
  unreadMessageCount,
}: HeaderProps) {
  const location = useLocation();

  const getNavLinkClasses = (path: string) => {
    const isActive =
      location.pathname === path ||
      (path === "/" && location.pathname === "/") ||
      (path !== "/" && location.pathname.startsWith(path));

    if (isActive) {
      return "inline-flex items-center gap-2 px-3 py-1.5 text-sm text-primary-foreground bg-primary rounded-lg transition-colors hover:bg-primary/90";
    }

    return "inline-flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors";
  };
  return (
    <header className="bg-card border-b border-border">
      <div className="max-w-4xl mx-auto px-4">
        {/* First Row - Community Info & Console Link */}
        <div className="flex items-center justify-between h-12 border-b border-border">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <a href="/">
                  <Hash className="h-4 w-4 text-primary-foreground" />
                </a>
              </div>
              <div>
                <h1 className="font-bold text-foreground">
                  <a href="/">{communityName || "커뮤"}</a>
                </h1>
              </div>
            </div>
            <div className="h-6 w-px bg-border"></div>
            <a
              target="_blank"
              href={consoleUrl}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
              title="콘솔로 이동"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="hidden lg:inline">커뮹! 메인으로 가기</span>
            </a>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <ProfileSwitcher />
          </div>
        </div>

        {/* Second Row - Navigation */}
        <div className="flex items-center justify-center h-12">
          <nav className="flex items-center gap-3">
            <Link to="/" className={getNavLinkClasses("/")} title="홈">
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">홈</span>
            </Link>
            <Link
              to="/notifications"
              className={getNavLinkClasses("/notifications")}
              title="알림"
            >
              <div className="relative">
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-[8px] text-white font-bold">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  </div>
                )}
              </div>
              <span className="hidden sm:inline">알림</span>
            </Link>
            <Link
              to="/messages"
              className={getNavLinkClasses("/messages")}
              title="메시지"
            >
              <div className="relative">
                <MessageCircle className="h-4 w-4" />
                {unreadMessageCount > 0 && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-[8px] text-white font-bold">
                      {unreadMessageCount > 9 ? "9+" : unreadMessageCount}
                    </span>
                  </div>
                )}
              </div>
              <span className="hidden sm:inline">메시지</span>
            </Link>
            <Link
              to="/announcements"
              className={getNavLinkClasses("/announcements")}
              title="공지사항"
            >
              <Megaphone className="h-4 w-4" />
              <span className="hidden sm:inline">공지사항</span>
            </Link>
            <Link
              to="/bookmarks"
              className={getNavLinkClasses("/bookmarks")}
              title="북마크"
            >
              <Bookmark className="h-4 w-4" />
              <span className="hidden sm:inline">북마크</span>
            </Link>
            <Link
              to="/profiles"
              className={getNavLinkClasses("/profiles")}
              title="멤버 목록"
            >
              <UserCheck className="h-4 w-4" />
              <span className="hidden sm:inline">멤버</span>
            </Link>
            <Link
              to="/settings"
              className={getNavLinkClasses("/settings")}
              title="설정"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">설정</span>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
