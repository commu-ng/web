import { useInfiniteQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle } from "react";
import { useAuth } from "~/hooks/useAuth";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";
import { client } from "~/lib/api-client";
import type { Post } from "~/types/post";
import { PostCard } from "./post-card";
import { LoadingState } from "./shared/LoadingState";

export interface ScheduledPostsListRef {
  refresh: () => void;
}

export const ScheduledPostsList = forwardRef<ScheduledPostsListRef>(
  (_props, ref) => {
    const { currentProfile } = useAuth();
    const { isOwner: isCommunityOwner, isModerator } = useCurrentInstance();
    const POSTS_PER_PAGE = 20;

    // Fetch scheduled posts with infinite query
    const {
      data,
      fetchNextPage,
      hasNextPage,
      isFetchingNextPage,
      isLoading,
      refetch,
    } = useInfiniteQuery({
      queryKey: ["scheduledPosts", currentProfile?.id],
      queryFn: async ({ pageParam }) => {
        if (!currentProfile?.id) {
          return { data: [], nextCursor: null, hasMore: false };
        }

        const response = await client.app["scheduled-posts"].$get({
          query: {
            profile_id: currentProfile.id,
            limit: POSTS_PER_PAGE.toString(),
            ...(pageParam && { cursor: pageParam }),
          },
        });

        if (!response.ok) {
          throw new Error(
            `Failed to fetch scheduled posts: ${response.status}`,
          );
        }

        const result = await response.json();
        return result;
      },
      getNextPageParam: (lastPage) => {
        return lastPage.hasMore ? lastPage.nextCursor : undefined;
      },
      initialPageParam: undefined,
      enabled: !!currentProfile?.id,
    });

    const scheduledPosts = data?.pages.flatMap((page) => page.data) ?? [];

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

    useImperativeHandle(ref, () => ({
      refresh: () => refetch(),
    }));

    // Don't show anything if there are no scheduled posts or still loading
    if (isLoading || scheduledPosts.length === 0) {
      return null;
    }

    return (
      <div className="space-y-4">
        {/* Section Header */}
        <div className="flex items-center gap-3 px-1">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <Clock className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              예약된 게시물
            </h2>
          </div>
          <div className="flex h-6 min-w-6 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30 px-2">
            <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">
              {scheduledPosts.length}
            </span>
          </div>
        </div>

        {/* Scheduled Posts */}
        <div className="space-y-4">
          {scheduledPosts.map((post) => (
            <div
              key={post.id}
              className="overflow-hidden rounded-2xl border-2 border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20"
            >
              {/* Scheduled Time */}
              {post.scheduled_at && (
                <div className="flex items-center justify-between border-b border-purple-200 dark:border-purple-800 bg-purple-100/50 dark:bg-purple-900/20 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    <span className="font-medium text-purple-900 dark:text-purple-200">
                      {new Date(post.scheduled_at).toLocaleString("ko-KR", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      에 게시 예정
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full bg-purple-600 dark:bg-purple-700 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                    <Clock className="h-3 w-3" />
                    예약됨
                  </div>
                </div>
              )}

              {/* Post Content */}
              <div className="bg-card">
                <PostCard
                  post={post}
                  currentProfileId={currentProfile?.id}
                  onDelete={() => refetch()}
                  onRefresh={() => refetch()}
                  isCommunityOwner={isCommunityOwner}
                  isModerator={isModerator}
                  hideBorder={true}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Loading indicator for infinite scroll */}
        {isFetchingNextPage && (
          <div className="mt-4">
            <LoadingState message="더 많은 예약 게시물을 불러오는 중..." />
          </div>
        )}

        {/* End of content indicator */}
        {!hasNextPage && scheduledPosts.length > 0 && (
          <div className="bg-background rounded-2xl border border-border p-6 text-center mt-4">
            <p className="text-muted-foreground text-sm">
              모든 예약 게시물을 확인했습니다
            </p>
          </div>
        )}
      </div>
    );
  },
);
