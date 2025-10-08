import { useInfiniteQuery } from "@tanstack/react-query";
import { Search, UserPlus, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { ProfileAvatar } from "~/components/profile-avatar";
import { LoadingState } from "~/components/shared/LoadingState";
import { ProfileCardSkeleton } from "~/components/skeletons/ProfileCardSkeleton";
import { client } from "~/lib/api-client";

export function meta() {
  return [
    { title: "멤버 목록 - 커뮤" },
    { name: "description", content: "커뮤 멤버들을 확인하세요" },
  ];
}

export default function Profiles() {
  const [searchQuery, setSearchQuery] = useState("");
  const PROFILES_PER_PAGE = 20;

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
  } = useInfiniteQuery({
    queryKey: ["profiles"],
    queryFn: async ({ pageParam }) => {
      const response = await client.app.profiles.$get({
        query: {
          limit: PROFILES_PER_PAGE.toString(),
          ...(pageParam && { cursor: pageParam }),
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch profiles: ${response.status}`);
      }

      const result = await response.json();

      return result;
    },
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.nextCursor : undefined;
    },
    initialPageParam: undefined,
  });

  const allProfiles = data?.pages.flatMap((page) => page.data) ?? [];

  // Filter profiles based on search query
  const filteredProfiles = allProfiles.filter(
    (profile) =>
      profile.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      profile.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      profile.bio?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Infinite scroll trigger
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Scroll event listener for infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop =
        document.documentElement.scrollTop || document.body.scrollTop;
      const scrollHeight =
        document.documentElement.scrollHeight || document.body.scrollHeight;
      const clientHeight =
        document.documentElement.clientHeight || window.innerHeight;

      // Load more when within 200px of the bottom
      if (scrollHeight - scrollTop - clientHeight < 200) {
        loadMore();
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loadMore]);

  if (isLoading) {
    return (
      <div>
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="이름이나 사용자명으로 검색..."
                disabled
                className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-xl opacity-50"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }, () => (
              <ProfileCardSkeleton key={crypto.randomUUID()} />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">
            {error instanceof Error
              ? error.message
              : "멤버 목록을 불러오는 데 실패했습니다"}
          </h1>
          <Link
            to="/"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="이름이나 사용자명으로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            />
          </div>
        </div>

        {/* Profiles Grid */}
        {filteredProfiles.length === 0 ? (
          <div className="bg-card rounded-2xl shadow-sm border border-border p-12 text-center">
            {searchQuery ? (
              <>
                <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  검색 결과가 없습니다
                </h3>
                <p className="text-muted-foreground mb-4">
                  "{searchQuery}"와 일치하는 멤버를 찾을 수 없습니다.
                </p>
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  모든 멤버 보기
                </button>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <UserPlus className="h-8 w-8 text-blue-500" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  아직 멤버가 없습니다
                </h3>
                <p className="text-muted-foreground">
                  첫 번째 멤버가 되어보세요!
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProfiles.map((profile) => (
              <Link
                key={profile.id}
                to={`/@${profile.username}`}
                className="bg-card rounded-2xl shadow-sm border border-border p-6 hover:shadow-md hover:border-border transition-all duration-200 group"
              >
                <div className="flex items-start gap-4">
                  <ProfileAvatar
                    profilePictureUrl={profile.profile_picture_url || undefined}
                    name={profile.name}
                    username={profile.username}
                    size="lg"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-foreground group-hover:text-blue-600 transition-colors truncate">
                      {profile.name}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      @{profile.username}
                    </p>
                    {profile.bio && (
                      <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                        {profile.bio}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-3">
                      가입일:{" "}
                      {new Date(profile.createdAt).toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Results count */}
        {searchQuery && filteredProfiles.length > 0 && (
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              "{searchQuery}" 검색 결과: {filteredProfiles.length}명
            </p>
          </div>
        )}

        {/* Loading indicator for infinite scroll */}
        {isFetchingNextPage && (
          <div className="mt-6">
            <LoadingState message="더 많은 멤버를 불러오는 중..." />
          </div>
        )}

        {/* End of content indicator */}
        {!hasNextPage && allProfiles.length > 0 && !searchQuery && (
          <div className="bg-background rounded-2xl border border-border p-6 text-center mt-6">
            <p className="text-muted-foreground text-sm">
              모든 멤버를 확인했습니다
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
