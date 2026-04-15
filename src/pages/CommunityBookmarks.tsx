import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bookmark } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { RequireAuth } from "@/components/RequireAuth";
import {
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  communityFetch,
  formatRelativeTime,
  type CommunityPostListItem,
} from "@/lib/community";
import { cn } from "@/lib/utils";

export default function CommunityBookmarks() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<CommunityPostListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    communityFetch<{ posts: CommunityPostListItem[] }>("/api/community/bookmarks")
      .then((data) => setPosts(data.posts))
      .finally(() => setLoading(false));
  }, []);

  return (
    <RequireAuth>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container max-w-3xl py-10">
          <div className="flex items-center gap-2 mb-6">
            <Bookmark className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">저장한 글</h1>
          </div>

          {loading ? (
            <div className="py-20 text-center text-sm text-muted-foreground">불러오는 중...</div>
          ) : posts.length === 0 ? (
            <div className="py-20 text-center">
              <Bookmark className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">저장한 글이 없습니다.</p>
              <button
                onClick={() => navigate("/community")}
                className="mt-4 text-sm text-primary underline underline-offset-2"
              >
                커뮤니티 둘러보기
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card divide-y divide-border">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => navigate(`/community/${post.id}`)}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      <span className={cn("text-[14px] font-extrabold shrink-0", CATEGORY_COLORS[post.category])}>
                        [{CATEGORY_LABELS[post.category]}]
                      </span>
                      <span className="text-[16px] text-foreground truncate">{post.title}</span>
                      {post.comment_count > 0 && (
                        <span
                          className={cn(
                            "text-[14px] font-bold shrink-0",
                            post.comment_count >= 5 ? "text-red-500" : "text-muted-foreground",
                          )}
                        >
                          [{post.comment_count}]
                        </span>
                      )}
                    </div>
                    <span className="text-[13px] shrink-0 text-muted-foreground">
                      {formatRelativeTime(post.created_at)}
                    </span>
                  </div>
                  <div className="mt-1 pl-0.5 text-[13px] text-muted-foreground">
                    {post.author.display_name}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
        <Footer />
      </div>
    </RequireAuth>
  );
}
