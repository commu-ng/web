import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { ProfileAvatar } from "~/components/profile-avatar";
import { client } from "~/lib/api-client";
import { useOnlineStatus } from "~/hooks/useOnlineStatus";

export function OnlineUsers() {
  // Fetch all profiles in the community
  const { data: profilesData } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const response = await client.app.profiles.$get({
        query: {},
      });

      if (!response.ok) {
        throw new Error("Failed to fetch profiles");
      }

      const result = await response.json();
      return result.data;
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const allProfiles = profilesData ?? [];
  const profileIds = allProfiles.map((profile) => profile.id);

  // Get online status for all profiles
  const { data: onlineStatusData } = useOnlineStatus(profileIds);

  // Filter to only online profiles
  const onlineProfiles = allProfiles.filter((profile) => {
    const status = onlineStatusData?.find((s) => s.profile_id === profile.id);
    return status?.is_online;
  });

  // Don't show the section if no one is online
  if (onlineProfiles.length === 0) {
    return null;
  }

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full bg-green-500" />
        <h2 className="text-xs font-semibold text-foreground">
          온라인 ({onlineProfiles.length})
        </h2>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
        {onlineProfiles.map((profile) => (
          <Link
            key={profile.id}
            to={`/@${profile.username}`}
            className="flex flex-col items-center gap-1 min-w-[60px] group p-1"
            title={profile.name}
          >
            <ProfileAvatar
              profilePictureUrl={profile.profile_picture_url || undefined}
              name={profile.name}
              username={profile.username}
              profileId={profile.id}
              size="md"
              showOnlineStatus={true}
              className="ring-2 ring-green-500/20 group-hover:ring-green-500/40 transition-all"
            />
            <span className="text-xs text-muted-foreground truncate max-w-[60px] group-hover:text-blue-600 transition-colors">
              {profile.name}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
