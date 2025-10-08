import { ArrowLeft, Megaphone } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { PostCard } from "~/components/post-card";
import { Spinner } from "~/components/ui/spinner";
import { useAuth } from "~/hooks/useAuth";
import { client } from "~/lib/api-client";

import type { Post } from "~/types/post";

export default function Announcements() {
  const { currentProfile } = useAuth();
  const [announcements, setAnnouncements] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnnouncements = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await client.app.announcements.$get({
        query: {},
      });

      if (response.ok) {
        const data = await response.json();
        // Transform the API response to match PostCard expectations
        const transformedData = data.map((announcement) => ({
          id: announcement.id,
          content: announcement.content,
          createdAt: announcement.createdAt,
          updatedAt: announcement.updatedAt,
          author: {
            id: announcement.author.id,
            name: announcement.author.name,
            username: announcement.author.username,
            profile_picture_url: announcement.author.profile_picture_url,
          },
          images: announcement.images || [],
          announcement: true,
          in_reply_to_id: null,
          depth: 0,
          root_post_id: null,
          content_warning: null,
          replies: [],
          threaded_replies: [],
          is_bookmarked: false,
          reactions: announcement.reactions || [],
        }));
        setAnnouncements(transformedData);
      } else {
        setError("공지사항을 불러오는 데 실패했습니다");
      }
    } catch (error) {
      console.error("Failed to fetch announcements:", error);
      setError("공지사항을 불러오는 데 실패했습니다");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const handleAnnouncementDelete = () => {
    // Refresh announcements after deletion
    fetchAnnouncements();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Spinner className="h-8 w-8 mx-auto mb-4" />
          <p className="text-muted-foreground">공지사항을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Megaphone className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">
            {error}
          </h1>
          <Link
            to="/"
            className="text-primary hover:text-primary/90 font-medium"
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
      <main className="max-w-2xl mx-auto px-4 py-8">
        {announcements.length === 0 ? (
          <div className="bg-card rounded-2xl shadow-sm border border-border p-12 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Megaphone className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              아직 공지사항이 없습니다
            </h3>
            <p className="text-muted-foreground mb-4">
              커뮤 운영자가 공지사항을 게시하면 여기에 표시됩니다.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-primary hover:text-primary/90 font-medium"
            >
              <ArrowLeft className="h-4 w-4" />
              홈으로 돌아가기
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {announcements.map((announcement) => (
              <PostCard
                key={announcement.id}
                post={{
                  ...announcement,
                  replies: [],
                  threaded_replies: [],
                  in_reply_to_id: announcement.in_reply_to_id ?? null,
                  depth: 0,
                  root_post_id: null,
                  content_warning: null,
                  is_bookmarked: false,
                }}
                currentProfileId={currentProfile?.id}
                onDelete={handleAnnouncementDelete}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
