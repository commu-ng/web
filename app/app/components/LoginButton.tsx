import { env } from "~/lib/env";

interface LoginButtonProps {
  className?: string;
  children?: React.ReactNode;
}

export function LoginButton({
  className,
  children = "로그인하기",
}: LoginButtonProps) {
  const handleLogin = () => {
    const ssoUrl = `${env.apiBaseUrl}/auth/sso?return_to=${encodeURIComponent(
      window.location.href,
    )}`;
    window.location.href = ssoUrl;
  };

  return (
    <button
      type="button"
      onClick={handleLogin}
      className={
        className ||
        "inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
      }
    >
      {children}
    </button>
  );
}
