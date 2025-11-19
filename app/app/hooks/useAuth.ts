import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { client, getErrorMessage } from "~/lib/api-client";
import { env } from "~/lib/env";
import { useCurrentProfileState } from "~/providers/CurrentProfileProvider";

import type { CreateProfileRequest, Profile } from "~/types/profile";

interface Instance {
  id: string;
  name: string;
  slug: string;
  starts_at: string;
  ends_at: string;
  is_recruiting: boolean;
  created_at: string;
  role: string;
  custom_domain: string | null;
  domain_verified: string | null;
}

interface User {
  id: string;
  login_name: string | null;
  created_at: string;
  is_admin: boolean;
  instances: Instance[];
}

interface AuthState {
  user: User | null;
  currentProfile: Profile | null;
  availableProfiles: Profile[];
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  refetch: () => void;
  belongsToCurrentInstance: boolean;
  consoleUrl: string;
  switchProfile: (profileId: string) => Promise<void>;
  createProfile: (profileData: CreateProfileRequest) => Promise<Profile>;
  refreshProfiles: () => void;
}

async function fetchCurrentUser(): Promise<User | null> {
  try {
    const response = await client.app.me.$get();

    if (response.ok) {
      const result = await response.json();
      return result.data;
    } else {
      return null;
    }
  } catch (_error) {
    return null;
  }
}

async function fetchMyProfiles(currentSlug: string | null): Promise<Profile[]> {
  // Don't fetch if no current slug
  if (!currentSlug) return [];

  try {
    const response = await client.app.me.profiles.$get();

    if (response.ok) {
      const result = await response.json();
      return result.data;
    } else {
      return [];
    }
  } catch (_error) {
    return [];
  }
}

/**
 * Extract console hostname from URL
 */
function getConsoleHostname(): string {
  try {
    return new URL(env.consoleUrl).hostname;
  } catch {
    // Fallback to regex if URL parsing fails
    return env.consoleUrl.replace(/^https?:\/\//, "");
  }
}

function getCurrentInstanceSlug(): string | null {
  if (typeof window === "undefined") return null;

  const hostname = window.location.hostname;
  const consoleHostname = getConsoleHostname();

  if (hostname.endsWith(`.${consoleHostname}`)) {
    return hostname.replace(`.${consoleHostname}`, "");
  }

  return null;
}

function getConsoleUrl(): string {
  if (typeof window === "undefined") return env.consoleUrl;

  const hostname = window.location.hostname;
  const consoleHostname = getConsoleHostname();

  // Check if we're on a subdomain of the console
  if (hostname.endsWith(`.${consoleHostname}`)) {
    return env.consoleUrl;
  }

  // Fallback
  return env.consoleUrl;
}

export function useAuth(): AuthState {
  const queryClient = useQueryClient();
  const currentSlug = getCurrentInstanceSlug();
  const consoleUrl = getConsoleUrl();

  const {
    data: user,
    isLoading: userLoading,
    refetch: refetchUser,
  } = useQuery({
    queryKey: ["auth", "currentUser"],
    queryFn: fetchCurrentUser,
    staleTime: 15 * 60 * 1000, // 15 minutes - user data changes infrequently
    gcTime: 60 * 60 * 1000, // 1 hour - keep in cache longer
  });

  const {
    data: availableProfiles = [],
    isLoading: profilesLoading,
    refetch: refetchProfiles,
  } = useQuery({
    queryKey: ["auth", "myProfiles", currentSlug],
    queryFn: () => fetchMyProfiles(currentSlug),
    enabled: !!user,
    staleTime: 10 * 60 * 1000, // 10 minutes - profiles change less frequently
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  // Use shared current profile state
  const {
    currentProfileId,
    setCurrentProfileId,
    hasSetInitialProfile,
    setHasSetInitialProfile,
  } = useCurrentProfileState();

  // Get current profile from available profiles, defaulting to primary profile
  const currentProfile = currentProfileId
    ? availableProfiles.find((profile) => profile.id === currentProfileId) ||
      null
    : availableProfiles.find((profile) => profile.is_primary) ||
      availableProfiles[0];

  // Set initial profile to primary when profiles are loaded (only once)
  useEffect(() => {
    if (
      availableProfiles.length > 0 &&
      currentProfileId === null &&
      !hasSetInitialProfile
    ) {
      const primaryProfile = availableProfiles.find(
        (profile) => profile.is_primary,
      );
      const initialProfile = primaryProfile || availableProfiles[0];
      if (initialProfile) {
        setCurrentProfileId(initialProfile.id);
        setHasSetInitialProfile(true);
      }
    }
  }, [
    availableProfiles,
    currentProfileId,
    hasSetInitialProfile,
    setCurrentProfileId,
    setHasSetInitialProfile,
  ]);

  const isLoading = userLoading || profilesLoading;

  const belongsToCurrentInstance = !!(
    user &&
    currentSlug &&
    user.instances.some((instance) => instance.slug === currentSlug)
  );

  const logout = async () => {
    try {
      await client.auth.logout.$post();
    } catch (_error) {
      // Continue even if logout fails on server
    } finally {
      // Clear session token from localStorage
      if (typeof window !== "undefined") {
        localStorage.removeItem("session_token");
      }

      // Invalidate and refetch auth query to clear user data
      queryClient.setQueryData(["auth", "currentUser"], null);
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    }
  };

  const switchProfile = async (profileId: string) => {
    // Verify the profile exists in available profiles
    const targetProfile = availableProfiles.find(
      (profile) => profile.id === profileId,
    );
    if (!targetProfile) {
      toast.error("유효하지 않은 프로필입니다");
      return;
    }

    // Update local state only (no localStorage)
    setCurrentProfileId(profileId);

    toast.success("프로필 전환이 완료되었습니다!");
  };

  const createProfile = async (
    profileData: CreateProfileRequest,
  ): Promise<Profile> => {
    try {
      const response = await client.app.profiles.$post({ json: profileData });

      if (response.ok) {
        const result = await response.json();
        // Refresh profile data
        queryClient.invalidateQueries({ queryKey: ["auth", "myProfiles"] });
        toast.success("프로필이 성공적으로 생성되었습니다!");
        return result.data;
      } else {
        const errorData = await response.json();
        throw new Error(
          getErrorMessage(errorData, "프로필 생성에 실패했습니다"),
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "프로필 생성에 실패했습니다",
      );
      throw error;
    }
  };

  const refreshProfiles = () => {
    refetchProfiles();
  };

  return {
    user: user || null,
    currentProfile: currentProfile || null,
    availableProfiles,
    isLoading,
    isAuthenticated: !!user,
    belongsToCurrentInstance,
    consoleUrl,
    logout,
    switchProfile,
    createProfile,
    refreshProfiles,
    refetch: () => {
      refetchUser();
      refetchProfiles();
    },
  };
}
