import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const categoryColors: Record<string, string> = {
  "비자/정책": "#3B82F6",
  "생활비/물가": "#10B981",
  "한달살기 팁": "#F59E0B",
  "날씨/시기": "#06B6D4",
  "교통/이동": "#8B5CF6",
  "음식/맛집": "#EF4444",
};

interface Article {
  title: string;
  summary: string;
  content: string;
  category: string;
  image_url: string | null;
  image_credit: string | null;
  source_name: string | null;
  source_url: string | null;
  published_at: string;
}

function formatDate(str: string) {
  return new Date(str).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

function renderContent(text: string) {
  const parts = text.split("\n\n---\n");
  const body = parts[0];
  const footer = parts[1] || "";

  const bodyHtml = body.split("\n\n").filter(Boolean).map((p, i) => (
    <p key={i} className="mb-5">{p}</p>
  ));

  const footerLines = footer.split("\n").filter(Boolean);

  return (
    <>
      {bodyHtml}
      {footerLines.length > 0 && (
        <div className="mt-8 p-4 bg-muted/50 rounded-lg border border-border text-[13px] text-muted-foreground leading-relaxed">
          <p className="font-semibold text-foreground mb-2">참고 / 출처</p>
          {footerLines.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      )}
    </>
  );
}

const InsightDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/insight/${slug}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setArticle)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [slug]);

  const color = article ? (categoryColors[article.category] || "#6B7280") : "#6B7280";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container py-8 max-w-[760px]">
        <Link to="/insight" className="inline-flex items-center gap-1 text-[14px] font-semibold text-primary hover:underline mb-6">
          ← 뉴스 목록
        </Link>

        {loading && (
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/4" />
            <div className="h-[300px] bg-muted rounded-xl" />
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => <div key={i} className="h-4 bg-muted rounded" />)}
            </div>
          </div>
        )}

        {error && (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-4xl mb-4">⚠️</p>
            <p className="font-semibold text-foreground mb-2">기사를 불러오지 못했습니다</p>
            <Link to="/insight" className="text-primary font-semibold hover:underline">목록으로 돌아가기</Link>
          </div>
        )}

        {article && (
          <>
            <span className="inline-block px-3 py-1 text-[12px] font-semibold rounded-full text-white mb-4" style={{ backgroundColor: color }}>
              {article.category}
            </span>
            <h1 className="text-[28px] md:text-[36px] font-[900] text-foreground leading-tight tracking-tight mb-4">
              {article.title}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-[13px] text-muted-foreground border-b border-border pb-5 mb-6">
              <span>📅 {formatDate(article.published_at)}</span>
              {article.source_name && <span>📰 {article.source_name}</span>}
            </div>

            {article.image_url && (
              <div className="mb-6">
                <img
                  src={article.image_url}
                  alt={article.title}
                  className="w-full max-h-[420px] object-cover rounded-xl"
                  onError={(e) => (e.currentTarget.parentElement!.remove())}
                />
                {article.image_credit && (
                  <p className="text-[12px] text-muted-foreground/60 mt-2 text-right">이미지: {article.image_credit}</p>
                )}
              </div>
            )}

            <div className="text-[17px] text-foreground/90 leading-[1.85]">
              {renderContent(article.content || article.summary || "")}
            </div>

            {article.source_url && (
              <a
                href={article.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-8 px-5 py-3 border border-border rounded-lg text-[14px] font-semibold text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                원문 기사 보기 →
              </a>
            )}

            <div className="mt-12 p-6 rounded-xl text-white text-center" style={{ backgroundColor: "#1A1A2E" }}>
              <p className="font-[800] text-[18px] mb-2">다낭 한달살기, 어디서 시작할지 모르겠다면?</p>
              <Link to="/planner" className="inline-block mt-3 px-6 py-2.5 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90 transition-colors">
                내 맞춤 플랜 만들기 →
              </Link>
            </div>
          </>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default InsightDetail;
