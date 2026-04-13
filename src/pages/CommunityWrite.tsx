import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { RequireAuth } from "@/components/RequireAuth";
import CommunityEditorForm from "@/components/community/CommunityEditorForm";

export default function CommunityWrite() {
  const navigate = useNavigate();

  return (
    <RequireAuth>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container max-w-5xl py-10">
          <h1 className="text-2xl font-bold mb-6">글쓰기</h1>
          <CommunityEditorForm mode="create" onSuccess={(id) => navigate(`/community/${id}`)} />
        </main>
        <Footer />
      </div>
    </RequireAuth>
  );
}
