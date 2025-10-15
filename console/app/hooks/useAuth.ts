import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "~/lib/api-client";

interface User {
  id: string;
  loginName: string | null;
  email: string | null;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
  admin: boolean;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  refetch: () => void;
}

async function fetchCurrentUser(): Promise<User | null> {
  try {
    const response = await api.console.me.$get();

    if (response.ok) {
      const data = await response.json();
      return data;
    } else {
      return null;
    }
  } catch (_error) {
    return null;
  }
}

export function useAuth(): AuthState {
  const queryClient = useQueryClient();

  const {
    data: user,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["auth", "currentUser"],
    queryFn: fetchCurrentUser,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false, // Don't retry on 401 errors
  });

  const logout = async () => {
    try {
      // Note: We would use consoleApi.logout.$post() if it existed
      // For now, use the auth API logout
      await api.auth.logout.$post();
    } catch (_error) {
      // Continue even if logout fails on server
    } finally {
      // Invalidate and refetch auth query to clear user data
      queryClient.setQueryData(["auth", "currentUser"], null);
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    }
  };

  return {
    user: user || null,
    isLoading,
    isAuthenticated: !!user,
    logout,
    refetch: () => {
      refetch();
    },
  };
}
