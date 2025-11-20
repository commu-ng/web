import { useQuery } from "@tanstack/react-query";
import { Filter, Hash, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { CommunityCard } from "~/components/CommunityCard";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { api } from "~/lib/api-client";
import type { Route } from "./+types/communities._index";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "커뮤 목록" },
    {
      name: "description",
      content: "모집 중인 커뮤와 진행 중인 커뮤 목록",
    },
  ];
}

interface Community {
  id: string;
  name: string;
  slug: string;
  starts_at: string;
  ends_at: string;
  is_recruiting: boolean;
  minimum_birth_year: number | null;
  created_at: string;
  custom_domain: string | null;
  domain_verified: string | null;
  owner_profile_id: string | null;
  banner_image_url?: string | null;
  banner_image_width?: number | null;
  banner_image_height?: number | null;
  has_applied: boolean;
  application_id?: string | null;
  application_status?: string | null;
  is_member: boolean;
  role?: string | null;
  hashtags?: { id: string; tag: string }[];
}

async function fetchRecruitingCommunities(): Promise<Community[]> {
  const res = await api.console.communities.recruiting.$get();
  const result = await res.json();
  return result.data;
}

async function fetchOngoingCommunities(): Promise<Community[]> {
  const res = await api.console.communities.ongoing.$get();
  const result = await res.json();
  return result.data;
}

export default function Communities() {
  const [selectedHashtags, setSelectedHashtags] = useState<string[]>([]);

  const {
    data: recruitingCommunities,
    isLoading: isLoadingRecruiting,
    error: recruitingError,
    refetch: refetchRecruiting,
  } = useQuery({
    queryKey: ["communities", "recruiting"],
    queryFn: fetchRecruitingCommunities,
  });

  const {
    data: ongoingCommunities,
    isLoading: isLoadingOngoing,
    error: ongoingError,
    refetch: refetchOngoing,
  } = useQuery({
    queryKey: ["communities", "ongoing"],
    queryFn: fetchOngoingCommunities,
  });

  const isLoading = isLoadingRecruiting || isLoadingOngoing;
  const error = recruitingError || ongoingError;

  // Combine all communities for hashtag extraction
  const allCommunities = useMemo(() => {
    return [...(recruitingCommunities || []), ...(ongoingCommunities || [])];
  }, [recruitingCommunities, ongoingCommunities]);

  // Get top 30 most frequently used hashtags from all communities
  const allHashtags = useMemo(() => {
    if (allCommunities.length === 0) return [];

    const hashtagCounts = new Map<string, number>();
    allCommunities.forEach((community) => {
      community.hashtags?.forEach((hashtag) => {
        hashtagCounts.set(
          hashtag.tag,
          (hashtagCounts.get(hashtag.tag) || 0) + 1,
        );
      });
    });

    return Array.from(hashtagCounts.entries())
      .sort((a, b) => b[1] - a[1]) // Sort by count descending
      .slice(0, 30) // Take top 30
      .map((entry) => entry[0]); // Extract hashtag names
  }, [allCommunities]);

  // Filter communities based on selected hashtags
  const filterCommunities = useCallback(
    (communities: Community[] | undefined) => {
      if (!communities) return [];
      if (selectedHashtags.length === 0) return communities;

      return communities.filter((community) => {
        if (!community.hashtags || community.hashtags.length === 0)
          return false;

        // Check if community has ALL selected hashtags
        const hashtags = community.hashtags;
        return selectedHashtags.every((selectedTag) =>
          hashtags.some((hashtag) => hashtag.tag === selectedTag),
        );
      });
    },
    [selectedHashtags],
  );

  const filteredRecruitingCommunities = useMemo(
    () => filterCommunities(recruitingCommunities),
    [filterCommunities, recruitingCommunities],
  );

  const filteredOngoingCommunities = useMemo(
    () => filterCommunities(ongoingCommunities),
    [filterCommunities, ongoingCommunities],
  );

  // Toggle hashtag selection
  const toggleHashtag = (hashtag: string) => {
    setSelectedHashtags((prev) =>
      prev.includes(hashtag)
        ? prev.filter((h) => h !== hashtag)
        : [...prev, hashtag],
    );
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedHashtags([]);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-2xl">
        <div className="text-center">커뮤 목록을 불러오는 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-2xl">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="text-red-600">오류 발생</CardTitle>
            <CardDescription>커뮤 목록을 불러올 수 없습니다</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button
              onClick={() => {
                refetchRecruiting();
                refetchOngoing();
              }}
            >
              다시 시도
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasRecruitingCommunities =
    recruitingCommunities && recruitingCommunities.length > 0;
  const hasOngoingCommunities =
    ongoingCommunities && ongoingCommunities.length > 0;
  const hasAnyCommunities = hasRecruitingCommunities || hasOngoingCommunities;

  if (!hasAnyCommunities) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-2xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">커뮤 목록</h1>
            <p className="text-muted-foreground mt-2">
              현재 표시할 커뮤가 없습니다.
            </p>
          </div>
        </div>

        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <CardTitle>커뮤가 없습니다</CardTitle>
            <CardDescription>현재 표시할 커뮤가 없어요.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const totalFiltered =
    filteredRecruitingCommunities.length + filteredOngoingCommunities.length;

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl lg:max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">커뮤 목록</h1>
          <p className="text-muted-foreground mt-2">
            모집 중 {recruitingCommunities?.length || 0}개 · 진행 중{" "}
            {ongoingCommunities?.length || 0}개
            {selectedHashtags.length > 0 && (
              <span className="ml-2 text-blue-600">
                (필터 적용: {totalFiltered}개)
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Hashtag Filter */}
      {allHashtags.length > 0 && (
        <div className="bg-background pb-6 mb-6">
          <Card className="shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <CardTitle className="text-lg">해시태그로 필터링</CardTitle>
                </div>
                {selectedHashtags.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearFilters}
                    className="text-xs"
                  >
                    <X className="h-3 w-3 mr-1" />
                    필터 초기화
                  </Button>
                )}
              </div>
              <CardDescription>
                관심 있는 해시태그를 선택해서 커뮤를 필터링하세요
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {allHashtags.map((hashtag) => (
                  <Badge
                    key={hashtag}
                    variant={
                      selectedHashtags.includes(hashtag) ? "default" : "outline"
                    }
                    className={`cursor-pointer transition-colors ${
                      selectedHashtags.includes(hashtag)
                        ? "bg-blue-600 hover:bg-blue-700 text-white"
                        : "hover:bg-blue-50 hover:border-blue-300"
                    }`}
                    onClick={() => toggleHashtag(hashtag)}
                  >
                    <Hash className="h-3 w-3 mr-1" />
                    {hashtag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* No Results After Filter */}
      {totalFiltered === 0 && selectedHashtags.length > 0 ? (
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <CardTitle>선택한 해시태그와 일치하는 커뮤가 없습니다</CardTitle>
            <CardDescription>
              다른 해시태그를 선택하거나 필터를 초기화해보세요.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={clearFilters} variant="outline">
              필터 초기화
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Recruiting Communities Section */}
          {filteredRecruitingCommunities.length > 0 && (
            <div className="mb-12">
              <div className="mb-6">
                <h2 className="text-2xl font-bold">모집 중인 커뮤</h2>
                <p className="text-muted-foreground mt-1">
                  새로운 멤버를 모집하고 있는 커뮤 (
                  {filteredRecruitingCommunities.length}개)
                </p>
              </div>
              <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
                {filteredRecruitingCommunities.map((community) => (
                  <div key={community.id} className="break-inside-avoid mb-4">
                    <CommunityCard community={community} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ongoing Communities Section */}
          {filteredOngoingCommunities.length > 0 && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold">진행 중인 커뮤</h2>
                <p className="text-muted-foreground mt-1">
                  현재 진행 중이지만 모집하지 않는 커뮤 (
                  {filteredOngoingCommunities.length}개)
                </p>
              </div>
              <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
                {filteredOngoingCommunities.map((community) => (
                  <div key={community.id} className="break-inside-avoid mb-4">
                    <CommunityCard community={community} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
