import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAuth } from "~/hooks/useAuth";
import { env } from "~/lib/env";

export function meta() {
  return [
    { title: "로그인 중..." },
    { name: "description", content: "인증 중입니다..." },
  ];
}

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refetch } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setStatus("error");
      setError("인증 토큰이 없습니다.");
      return;
    }

    // Prevent multiple executions of the same token exchange
    let cancelled = false;

    async function exchangeToken() {
      if (cancelled) return;

      try {
        // Call the console API's callback endpoint to exchange the token for a session
        const response = await fetch(`${env.apiBaseUrl}/auth/callback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token,
            domain: window.location.hostname,
          }),
        });

        if (cancelled) return;

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || "인증에 실패했습니다.");
        }

        // Parse the response to get the session token
        const responseData = await response.json();

        if (cancelled) return;

        // Store the session token in localStorage
        const sessionToken =
          responseData.data?.session_token || responseData.session_token;
        if (sessionToken) {
          localStorage.setItem("session_token", sessionToken);
        }

        // Token exchange successful
        setStatus("success");

        // Refetch auth state to update the app
        refetch();

        // Get the return path from search params, default to home
        const returnPath = searchParams.get("return_path") || "/";

        // Redirect to return path after a brief delay
        setTimeout(() => {
          if (!cancelled) {
            navigate(returnPath, { replace: true });
          }
        }, 1000);
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setError(err instanceof Error ? err.message : "인증에 실패했습니다.");
        }
      }
    }

    exchangeToken();

    // Cleanup function to cancel the operation if component unmounts or effect re-runs
    return () => {
      cancelled = true;
    };
  }, [
    searchParams,
    navigate, // Refetch auth state to update the app
    refetch,
  ]); // Removed refetch from dependencies to prevent re-runs

  // Show loading state
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">로그인 중입니다...</p>
        </div>
      </div>
    );
  }

  // Show success state
  if (status === "success") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <div className="text-green-500 text-4xl">✓</div>
          <p className="text-foreground">로그인이 완료되었습니다!</p>
          <p className="text-muted-foreground">
            잠시 후 홈페이지로 이동합니다...
          </p>
        </div>
      </div>
    );
  }

  // Show error state
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-4 max-w-md">
        <div className="text-red-500 text-4xl">✗</div>
        <p className="text-foreground font-semibold">로그인에 실패했습니다</p>
        <p className="text-muted-foreground">{error}</p>
        <button
          type="button"
          onClick={() => navigate("/", { replace: true })}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
        >
          홈으로 돌아가기
        </button>
      </div>
    </div>
  );
}
