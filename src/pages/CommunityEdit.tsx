import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { RequireAuth } from "@/components/RequireAuth";
import CommunityEditorForm from "@/components/community/CommunityEditorForm";
import { communityFetch, type CommunityPostDetail } from "@/lib/community";

export default function CommunityEdit() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [post, setPost] = useState<CommunityPostDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    communityFetch<CommunityPostDetail>(`/api/community/posts/${id}`)
      .then(setPost)
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <RequireAuth>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container max-w-5xl py-10">
          <h1 className="text-2xl font-bold mb-6">게시글 수정</h1>
          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">게시글을 불러오는 중입니다.</div>
          ) : post ? (
            <CommunityEditorForm
              mode="edit"
              postId={post.id}
              initialCategory={post.category}
              initialTitle={post.title}
              initialContent={post.content}
              onSuccess={(postId) => navigate(`/community/${postId}`)}
            />
          ) : (
            <div className="py-10 text-center text-sm text-muted-foreground">게시글을 찾을 수 없습니다.</div>
          )}
        </main>
        <Footer />
      </div>
    </RequireAuth>
  );
}
