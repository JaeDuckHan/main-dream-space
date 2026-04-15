import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bookmark, BookmarkX } from "lucide-react";
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
import { toast } from "sonner";

export default function CommunityBookmarks() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<CommunityPostListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<number | null>(null);

  useEffect(() => {
    communityFetch<{ posts: CommunityPostListItem[] }>("/api/community/bookmarks")
      .then((data) => setPosts(data.posts))
      .finally(() => setLoading(false));
  }, []);

  const handleRemove = async (e: React.MouseEvent, postId: number) => {
    e.stopPropagation();
    setRemoving(postId);
    try {
      await communityFetch(`/api/community/posts/${postId}/bookmark`, { method: "POST" });
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      toast.success("저장 목록에서 삭제했습니다.");
    } catch {
      toast.error("삭제에 실패했습니다.");
    } finally {
      setRemoving(null);
    }
  };

  return (
    <RequireAuth>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container max-w-3xl py-10">
          <div className="flex items-center gap-2 mb-6">
            <Bookmark className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">저장한 글</h1>
            {posts.length > 0 && (
              <span className="text-sm text-muted-foreground">({posts.length})</span>
            )}
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
                  className="px-4 py-3 flex items-center gap-3 group hover:bg-muted/40 transition-colors"
                >
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
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
                  <button
                    onClick={(e) => void handleRemove(e, post.id)}
                    disabled={removing === post.id}
                    className="shrink-0 p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                    title="저장 해제"
                  >
                    <BookmarkX className="h-4 w-4" />
                  </button>
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
