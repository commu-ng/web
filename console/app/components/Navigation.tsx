import {
  AlertCircle,
  FileText,
  Home,
  LogIn,
  Search,
  Star,
  UserIcon,
  UserPlus,
} from "lucide-react";
import { Link } from "react-router";
import { ThemeToggle } from "~/components/ThemeToggle";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { useAuth } from "~/hooks/useAuth";

export function Navigation() {
  const { isAuthenticated, isLoading, user } = useAuth();

  return (
    <nav>
      <div className="flex flex-col items-center justify-center bg-background space-y-6 py-8 px-4">
        <h1 className="text-4xl font-bold text-foreground flex flex-col items-center gap-2">
          <span className="text-6xl commu-ng">
            <Star width={48} height={48} />
          </span>
          <Link to="/" className="flex items-center gap-2">
            커뮹!
          </Link>
        </h1>
        <p className="text-muted-foreground max-w-2xl text-center">
          타임라인 기반 커뮤 플랫폼
        </p>

        {isAuthenticated && user && !user.emailVerified && (
          <Alert variant="destructive" className="max-w-2xl">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>이메일 인증이 필요합니다</AlertTitle>
            <AlertDescription>
              비밀번호 재설정 등 중요한 기능을 사용하려면 이메일 인증이
              필요합니다.{" "}
              <Link to="/account" className="underline font-medium">
                계정 설정에서 이메일을 인증하세요
              </Link>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:flex md:flex-wrap justify-center gap-2 max-w-2xl w-full">
          {isLoading ? (
            <div className="col-span-2 sm:col-span-3 flex justify-center py-2">
              <Spinner />
            </div>
          ) : isAuthenticated ? (
            <>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="w-full md:w-auto"
              >
                <Link to="/communities/mine">
                  <Home className="h-4 w-4" />내 커뮤
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="w-full md:w-auto"
              >
                <Link to="/communities/recruiting">
                  <Search className="h-4 w-4" />
                  모집 중인 커뮤
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="w-full md:w-auto"
              >
                <Link to="/applications">
                  <FileText className="h-4 w-4" />내 지원서
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="w-full md:w-auto"
              >
                <Link to="/account">
                  <UserIcon className="h-4 w-4" />내 계정
                </Link>
              </Button>
              <ThemeToggle />
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="w-full md:w-auto col-span-2"
              >
                <Link to="/communities/recruiting">
                  <Search className="h-4 w-4" />
                  모집 중인 커뮤
                </Link>
              </Button>
              <Button size="sm" asChild className="w-full md:w-auto">
                <Link to="/login">
                  <LogIn className="h-4 w-4" />
                  로그인
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="w-full md:w-auto"
              >
                <Link to="/signup">
                  <UserPlus className="h-4 w-4" />
                  회원가입
                </Link>
              </Button>
              <ThemeToggle />
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
