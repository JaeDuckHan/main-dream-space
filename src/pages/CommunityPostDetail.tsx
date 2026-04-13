import { useEffect, useMemo, useState } from "react";
import { MessageSquare, Pencil, ThumbsUp, Trash2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  communityFetch,
  formatRelativeTime,
  type CommunityComment,
  type CommunityPostDetail,
} from "@/lib/community";
import { toast } from "sonner";

export default function CommunityPostDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const [post, setPost] = useState<CommunityPostDetail | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentContent, setCommentContent] = useState("");
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);

  const topLevelComments = useMemo(() => comments.filter((comment) => comment.parent_id === null), [comments]);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [postResponse, commentResponse] = await Promise.all([
        communityFetch<CommunityPostDetail>(`/api/community/posts/${id}`),
        communityFetch<{ comments: CommunityComment[] }>(`/api/community/posts/${id}/comments`),
      ]);
      setPost(postResponse);
      setComments(commentResponse.comments);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "게시글을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  const requireLogin = () => {
    navigate(`/login?redirect=${encodeURIComponent(`/community/${id}`)}`);
  };

  const handlePostLike = async () => {
    if (!user) return requireLogin();
    const response = await communityFetch<{ liked: boolean; like_count: number }>(`/api/community/posts/${id}/like`, { method: "POST" });
    setPost((current) => (current ? { ...current, liked_by_me: response.liked, like_count: response.like_count } : current));
  };

  const handleBookmark = async () => {
    if (!user) return requireLogin();
    const response = await communityFetch<{ bookmarked: boolean }>(`/api/community/posts/${id}/bookmark`, { method: "POST" });
    setPost((current) => (current ? { ...current, bookmarked_by_me: response.bookmarked } : current));
  };

  const handleCommentSubmit = async () => {
    if (!user) return requireLogin();
    if (!commentContent.trim()) return;
    setSubmittingComment(true);
    try {
      const response = await communityFetch<{ comment: CommunityComment }>(`/api/community/posts/${id}/comments`, {
        method: "POST",
        body: JSON.stringify({
          content: commentContent,
          parent_id: replyTo,
        }),
      });
      setComments((current) => [...current, response.comment]);
      setPost((current) => (current ? { ...current, comment_count: current.comment_count + 1 } : current));
      setCommentContent("");
      setReplyTo(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "댓글 저장에 실패했습니다.");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeletePost = async () => {
    if (!confirm("게시글을 삭제하시겠습니까?")) return;
    try {
      await communityFetch(`/api/community/posts/${id}`, { method: "DELETE" });
      navigate("/community");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "게시글 삭제에 실패했습니다.");
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!confirm("댓글을 삭제하시겠습니까?")) return;
    try {
      await communityFetch(`/api/community/comments/${commentId}`, { method: "DELETE" });
      setComments((current) =>
        current.map((comment) => (comment.id === commentId ? { ...comment, is_deleted: true, content: "" } : comment)),
      );
      setPost((current) => (current ? { ...current, comment_count: Math.max(0, current.comment_count - 1) } : current));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "댓글 삭제에 실패했습니다.");
    }
  };

  const handleLikeComment = async (commentId: number) => {
    if (!user) return requireLogin();
    const response = await communityFetch<{ liked: boolean; like_count: number }>(`/api/community/comments/${commentId}/like`, { method: "POST" });
    setComments((current) =>
      current.map((comment) =>
        comment.id === commentId ? { ...comment, liked_by_me: response.liked, like_count: response.like_count } : comment,
      ),
    );
  };

  if (loading) {
    return <div className="container py-20 text-center text-muted-foreground">게시글을 불러오는 중입니다.</div>;
  }

  if (!post) {
    return <div className="container py-20 text-center text-muted-foreground">게시글을 찾을 수 없습니다.</div>;
  }

  const canEditPost = user?.id === post.author.id;
  const canDeletePost = user?.id === post.author.id || user?.role === "admin";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container max-w-4xl py-10">
        <button onClick={() => navigate("/community")} className="mb-4 text-sm text-muted-foreground hover:text-foreground">
          ← 커뮤니티 목록
        </button>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-6 border-b border-border pb-5">
            <div className={cn("mb-2 text-sm font-extrabold", CATEGORY_COLORS[post.category])}>[{CATEGORY_LABELS[post.category]}]</div>
            <h1 className="text-3xl font-bold text-foreground">{post.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span>{post.author.display_name}</span>
              <span>{new Date(post.created_at).toLocaleString("ko-KR")}</span>
              <span>조회 {post.view_count}</span>
              <span>좋아요 {post.like_count}</span>
            </div>
          </div>

          <div className="prose prose-slate max-w-none prose-img:rounded-xl" dangerouslySetInnerHTML={{ __html: post.content_html }} />

          <div className="mt-8 flex flex-wrap gap-2">
            <Button variant={post.liked_by_me ? "default" : "outline"} onClick={() => void handlePostLike()}>
              <ThumbsUp className="mr-2 h-4 w-4" />
              추천 {post.like_count}
            </Button>
            <Button variant={post.bookmarked_by_me ? "default" : "outline"} onClick={() => void handleBookmark()}>
              북마크
            </Button>
            {canEditPost ? (
              <Button variant="outline" onClick={() => navigate(`/community/${post.id}/edit`)}>
                <Pencil className="mr-2 h-4 w-4" />
                수정
              </Button>
            ) : null}
            {canDeletePost ? (
              <Button variant="destructive" onClick={() => void handleDeletePost()}>
                <Trash2 className="mr-2 h-4 w-4" />
                삭제
              </Button>
            ) : null}
          </div>
        </div>

        <section className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">댓글 {post.comment_count}</h2>
          </div>

          <div className="space-y-5">
            {topLevelComments.map((comment) => (
              <div key={comment.id} className="rounded-xl border border-border/80 p-4">
                <CommentBlock
                  comment={comment}
                  replies={comments.filter((reply) => reply.parent_id === comment.id)}
                  canDelete={user?.id === comment.author.id || user?.role === "admin"}
                  onReply={() => setReplyTo(comment.id)}
                  onDelete={() => void handleDeleteComment(comment.id)}
                  onLike={() => void handleLikeComment(comment.id)}
                  onDeleteReply={handleDeleteComment}
                  onLikeReply={handleLikeComment}
                  currentUserId={user?.id ?? null}
                  admin={user?.role === "admin"}
                />
              </div>
            ))}
            {topLevelComments.length === 0 ? <div className="text-sm text-muted-foreground">첫 댓글을 남겨보세요.</div> : null}
          </div>

          <div className="mt-6 rounded-xl border border-dashed border-border p-4">
            {replyTo ? (
              <div className="mb-2 text-sm text-muted-foreground">
                답글 작성 중
                <button className="ml-2 underline" onClick={() => setReplyTo(null)}>
                  취소
                </button>
              </div>
            ) : null}
            <Textarea
              value={commentContent}
              onChange={(event) => setCommentContent(event.target.value)}
              rows={4}
              placeholder={user ? "댓글을 작성하세요." : "로그인 후 댓글을 작성할 수 있습니다."}
              disabled={!user}
            />
            <div className="mt-3 flex justify-end">
              <Button onClick={() => void handleCommentSubmit()} disabled={!user || submittingComment}>
                {submittingComment ? "등록 중..." : "댓글 등록"}
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function CommentBlock({
  comment,
  replies,
  canDelete,
  onReply,
  onDelete,
  onLike,
  onDeleteReply,
  onLikeReply,
  currentUserId,
  admin,
}: {
  comment: CommunityComment;
  replies: CommunityComment[];
  canDelete: boolean;
  onReply: () => void;
  onDelete: () => void;
  onLike: () => void;
  onDeleteReply: (id: number) => void;
  onLikeReply: (id: number) => void;
  currentUserId: number | null;
  admin: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold text-foreground">{comment.author.display_name}</div>
          <div className="text-xs text-muted-foreground">{formatRelativeTime(comment.created_at)}</div>
        </div>
        {!comment.is_deleted ? (
          <div className="flex gap-2">
            <Button size="sm" variant={comment.liked_by_me ? "default" : "ghost"} onClick={onLike}>
              추천 {comment.like_count}
            </Button>
            <Button size="sm" variant="ghost" onClick={onReply}>
              답글
            </Button>
            {canDelete ? (
              <Button size="sm" variant="ghost" onClick={onDelete}>
                삭제
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">
        {comment.is_deleted ? <span className="italic text-muted-foreground">삭제된 댓글입니다.</span> : comment.content}
      </div>

      {replies.length > 0 ? (
        <div className="mt-4 space-y-3 border-l border-border pl-4">
          {replies.map((reply) => (
            <div key={reply.id} className="rounded-lg bg-muted/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-foreground">{reply.author.display_name}</div>
                  <div className="text-xs text-muted-foreground">{formatRelativeTime(reply.created_at)}</div>
                </div>
                {!reply.is_deleted ? (
                  <div className="flex gap-2">
                    <Button size="sm" variant={reply.liked_by_me ? "default" : "ghost"} onClick={() => onLikeReply(reply.id)}>
                      추천 {reply.like_count}
                    </Button>
                    {currentUserId === reply.author.id || admin ? (
                      <Button size="sm" variant="ghost" onClick={() => onDeleteReply(reply.id)}>
                        삭제
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                {reply.is_deleted ? <span className="italic text-muted-foreground">삭제된 댓글입니다.</span> : reply.content}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
