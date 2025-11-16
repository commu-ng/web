import { useEffect, useId, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { LoadingState } from "~/components/shared/LoadingState";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { useAuth } from "~/hooks/useAuth";
import { api, getErrorMessage } from "~/lib/api-client";
import type { Route } from "./+types/signup";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "회원가입" },
    { name: "description", content: "계정을 생성하세요" },
  ];
}

export default function Signup() {
  const loginNameId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();

  const [formData, setFormData] = useState({
    login_name: "",
    password: "",
    confirmPassword: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refetch, isAuthenticated, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate("/");
    }
  }, [authLoading, isAuthenticated, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("비밀번호가 일치하지 않습니다");
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 8) {
      setError("비밀번호는 최소 8자 이상이어야 합니다");
      setIsLoading(false);
      return;
    }

    try {
      const response = await api.console.signup.$post({
        json: {
          login_name: formData.login_name,
          password: formData.password,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = getErrorMessage(
          errorData,
          "회원가입에 실패했습니다",
        );
        toast.error(errorMessage);
        return;
      }

      // Refetch auth state to update navigation
      refetch();

      // Redirect to next URL if provided, otherwise go to home
      const nextUrl = searchParams.get("next");
      if (nextUrl) {
        // If next URL is provided, redirect to it (could be external)
        window.location.href = nextUrl;
      } else {
        // Otherwise navigate to home within the console
        navigate("/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "회원가입에 실패했습니다");
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center bg-background">
        <LoadingState message="인증 정보를 확인하는 중..." />
      </div>
    );
  }

  if (isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">회원가입</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={loginNameId}>아이디</FieldLabel>
                <Input
                  id={loginNameId}
                  name="login_name"
                  type="text"
                  placeholder="아이디를 입력하세요"
                  value={formData.login_name}
                  onChange={handleInputChange}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={passwordId}>비밀번호</FieldLabel>
                <Input
                  id={passwordId}
                  name="password"
                  type="password"
                  placeholder="비밀번호를 입력하세요 (최소 8자)"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={confirmPasswordId}>
                  비밀번호 확인
                </FieldLabel>
                <Input
                  id={confirmPasswordId}
                  name="confirmPassword"
                  type="password"
                  placeholder="비밀번호를 다시 입력하세요"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  required
                />
              </Field>
              <FieldError>{error}</FieldError>
              <Field orientation="horizontal">
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Spinner />}
                  {isLoading ? "회원가입 중..." : "회원가입"}
                </Button>
              </Field>
            </FieldGroup>
          </form>
          <div className="text-center text-sm">
            이미 계정이 있으신가요?{" "}
            <Link
              to={`/login${searchParams.get("next") ? `?next=${encodeURIComponent(searchParams.get("next") || "")}` : ""}`}
              className="text-primary hover:underline"
            >
              로그인
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
