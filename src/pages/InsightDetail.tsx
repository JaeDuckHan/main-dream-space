import React, { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/use-auth";

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

// ── 인라인 파서: [텍스트](URL) → <a>, **굵게** → <strong> ──────────────
function parseInline(text: string): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  // 링크와 굵게를 순서대로 처리
  const regex = /(\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) result.push(text.slice(last, m.index));
    if (m[0].startsWith('[')) {
      result.push(
        <a key={m.index} href={m[3]} target="_blank" rel="noopener noreferrer"
           className="text-primary underline underline-offset-2 hover:opacity-75 break-words">
          {m[2]}
        </a>
      );
    } else {
      result.push(<strong key={m.index} className="font-[700]">{m[4]}</strong>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) result.push(text.slice(last));
  return result.length ? result : [text];
}

// ── 블록 타입 정의 ────────────────────────────────────────────────────────
type MdBlock =
  | { t: 'h1' | 'h2' | 'h3'; text: string }
  | { t: 'p';  text: string }
  | { t: 'ul'; items: string[] }
  | { t: 'ol'; items: string[] }
  | { t: 'image'; src: string; alt: string }
  | { t: 'divider' }
  | { t: 'quote';   text: string }
  | { t: 'callout'; icon: string; text: string }
  | { t: 'code';    text: string };

// ── 마크다운 텍스트 → 블록 배열 ──────────────────────────────────────────
function parseBlocks(raw: string): MdBlock[] {
  // \n\n 기준으로 분리. 단, ``` 코드 블록은 통째로 보존
  const chunks: string[] = [];
  let buf = '';
  let inCode = false;
  for (const line of raw.split('\n')) {
    if (line.startsWith('```')) {
      inCode = !inCode;
      buf += line + '\n';
      if (!inCode) { chunks.push(buf.trim()); buf = ''; }
      continue;
    }
    if (inCode) { buf += line + '\n'; continue; }
    if (line === '') {
      if (buf.trim()) { chunks.push(buf.trim()); buf = ''; }
    } else {
      buf += (buf ? '\n' : '') + line;
    }
  }
  if (buf.trim()) chunks.push(buf.trim());

  const blocks: MdBlock[] = [];

  const last = () => blocks[blocks.length - 1];

  for (const chunk of chunks) {
    // 코드 블록
    if (chunk.startsWith('```')) {
      const code = chunk.replace(/^```[^\n]*\n?/, '').replace(/\n?```$/, '');
      blocks.push({ t: 'code', text: code });
      continue;
    }

    // 이미지 (단독 라인)
    const imgM = chunk.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (imgM) { blocks.push({ t: 'image', alt: imgM[1], src: imgM[2] }); continue; }

    // 구분선
    if (chunk === '---') { blocks.push({ t: 'divider' }); continue; }

    // 제목
    if (chunk.startsWith('# '))   { blocks.push({ t: 'h1', text: chunk.slice(2) }); continue; }
    if (chunk.startsWith('## '))  { blocks.push({ t: 'h2', text: chunk.slice(3) }); continue; }
    if (chunk.startsWith('### ')) { blocks.push({ t: 'h3', text: chunk.slice(4) }); continue; }

    // 콜아웃: "> 💡 ..." 또는 "> ⚠️ ..."
    if (chunk.startsWith('> ')) {
      const inner = chunk.slice(2);
      const callM = inner.match(/^([\p{Emoji_Presentation}\p{Extended_Pictographic}])\s+(.+)$/su);
      if (callM) {
        blocks.push({ t: 'callout', icon: callM[1], text: callM[2] });
      } else {
        const prev = last();
        if (prev?.t === 'quote') prev.text += '\n' + inner;
        else blocks.push({ t: 'quote', text: inner });
      }
      continue;
    }

    // 글머리 목록 — 청크 내 여러 줄 지원
    const ulLines = chunk.split('\n').filter(l => l.startsWith('- '));
    if (ulLines.length > 0 && ulLines.length === chunk.split('\n').filter(Boolean).length) {
      const items = ulLines.map(l => l.slice(2));
      const prev = last();
      if (prev?.t === 'ul') prev.items.push(...items);
      else blocks.push({ t: 'ul', items });
      continue;
    }

    // 번호 목록 — 청크 내 여러 줄 지원, 순번 재계산
    const olLines = chunk.split('\n').filter(l => /^\d+\.\s/.test(l));
    if (olLines.length > 0 && olLines.length === chunk.split('\n').filter(Boolean).length) {
      const items = olLines.map(l => l.replace(/^\d+\.\s*/, ''));
      const prev = last();
      if (prev?.t === 'ol') prev.items.push(...items);
      else blocks.push({ t: 'ol', items });
      continue;
    }

    // 일반 단락
    blocks.push({ t: 'p', text: chunk });
  }

  return blocks;
}

// ── 블록 → JSX ───────────────────────────────────────────────────────────
function renderBlocks(blocks: MdBlock[]): React.ReactNode {
  return blocks.map((b, i) => {
    switch (b.t) {
      case 'h1': return <h2 key={i} className="text-[24px] font-[900] mt-10 mb-3 text-foreground">{parseInline(b.text)}</h2>;
      case 'h2': return <h3 key={i} className="text-[20px] font-[800] mt-8 mb-2 text-foreground">{parseInline(b.text)}</h3>;
      case 'h3': return <h4 key={i} className="text-[17px] font-[700] mt-6 mb-2 text-foreground">{parseInline(b.text)}</h4>;

      case 'p':
        return <p key={i} className="mb-5 leading-[1.9] text-foreground/90">{parseInline(b.text)}</p>;

      case 'ul':
        return (
          <ul key={i} className="my-4 pl-6 space-y-1.5 list-disc marker:text-primary">
            {b.items.map((item, j) => (
              <li key={j} className="leading-relaxed">{parseInline(item)}</li>
            ))}
          </ul>
        );

      case 'ol':
        return (
          <ol key={i} className="my-4 pl-6 space-y-1.5 list-decimal marker:text-primary marker:font-[700]">
            {b.items.map((item, j) => (
              <li key={j} className="leading-relaxed">{parseInline(item)}</li>
            ))}
          </ol>
        );

      case 'image':
        return (
          <figure key={i} className="my-7">
            <img src={b.src} alt={b.alt}
                 className="w-full rounded-xl object-cover max-h-[460px]"
                 onError={e => (e.currentTarget.parentElement!.remove())} />
            {b.alt && <figcaption className="text-[12px] text-muted-foreground/60 mt-2 text-center">{b.alt}</figcaption>}
          </figure>
        );

      case 'divider':
        return <hr key={i} className="my-8 border-border" />;

      case 'quote':
        return (
          <blockquote key={i} className="my-5 pl-4 border-l-4 border-primary/40 text-muted-foreground italic leading-relaxed">
            {parseInline(b.text)}
          </blockquote>
        );

      case 'callout':
        return (
          <div key={i} className="my-5 flex gap-3 p-4 bg-muted/60 rounded-xl border border-border text-[15px] leading-relaxed">
            <span className="text-[20px] shrink-0 mt-0.5">{b.icon}</span>
            <span>{parseInline(b.text)}</span>
          </div>
        );

      case 'code':
        return (
          <pre key={i} className="my-5 p-4 bg-muted rounded-xl overflow-x-auto text-[13px] leading-relaxed font-mono">
            <code>{b.text}</code>
          </pre>
        );

      default: return null;
    }
  });
}

// ── 전체 content 렌더 (출처 푸터 분리) ──────────────────────────────────
// heroUrl: article.image_url — 본문 첫 이미지가 이것과 같으면 중복이므로 제거
function renderContent(text: string, heroUrl?: string | null) {
  const [body, footerRaw = ""] = text.split("\n\n---\n참고/출처");
  let blocks = parseBlocks(body);

  // 본문 첫 번째 image 블록이 상단 대표 이미지와 같으면 제거
  if (heroUrl) {
    const firstImgIdx = blocks.findIndex(b => b.t === 'image');
    if (firstImgIdx !== -1) {
      const firstImg = blocks[firstImgIdx] as { t: 'image'; src: string; alt: string };
      if (firstImg.src === heroUrl) {
        blocks = [...blocks.slice(0, firstImgIdx), ...blocks.slice(firstImgIdx + 1)];
      }
    }
  }

  const footerLines = footerRaw.split("\n").filter(Boolean);

  return (
    <>
      {renderBlocks(blocks)}
      {footerLines.length > 0 && (
        <div className="mt-10 p-4 bg-muted/50 rounded-xl border border-border text-[13px] text-muted-foreground leading-[1.8]">
          <p className="font-[700] text-foreground mb-2 text-[14px]">참고 / 출처</p>
          {footerLines.map((line, i) => <p key={i}>{parseInline(line)}</p>)}
        </div>
      )}
    </>
  );
}

// ── 댓글 타입 ────────────────────────────────────────────────────────────
interface Comment {
  id: number;
  content: string;
  created_at: string;
  user_id: number;
  display_name: string | null;
  avatar_url: string | null;
}

// ── 댓글 섹션 ────────────────────────────────────────────────────────────
function CommentSection({ slug }: { slug: string }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch(`/api/insight/${slug}/comments`)
      .then(r => r.json())
      .then(data => Array.isArray(data) && setComments(data))
      .catch(() => {});
  }, [slug]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/insight/${slug}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: text.trim() }),
      });
      if (!res.ok) throw new Error();
      const comment = await res.json();
      setComments(prev => [...prev, comment]);
      setText("");
    } catch {
      alert("댓글 작성에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteComment = async (id: number) => {
    if (!confirm("댓글을 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/insight/comments/${id}`, {
        method: "DELETE", credentials: "include",
      });
      if (!res.ok) throw new Error();
      setComments(prev => prev.filter(c => c.id !== id));
    } catch {
      alert("삭제에 실패했습니다.");
    }
  };

  return (
    <div className="mt-12 border-t border-border pt-10">
      <h3 className="text-[18px] font-[800] mb-6">댓글 {comments.length > 0 && <span className="text-primary">{comments.length}</span>}</h3>

      {/* 댓글 목록 */}
      {comments.length === 0
        ? <p className="text-[14px] text-muted-foreground mb-6">아직 댓글이 없습니다. 첫 번째 댓글을 남겨보세요.</p>
        : <div className="space-y-4 mb-8">
            {comments.map(c => (
              <div key={c.id} className="flex gap-3 group">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-[13px] font-[700] shrink-0 overflow-hidden">
                  {c.avatar_url
                    ? <img src={c.avatar_url} alt="" className="w-full h-full object-cover" />
                    : (c.display_name?.[0] ?? "?").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[13px] font-[700]">{c.display_name ?? "회원"}</span>
                    <span className="text-[11px] text-muted-foreground">{formatDate(c.created_at)}</span>
                  </div>
                  <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">{c.content}</p>
                </div>
                {user && (user.id === c.user_id || user.role === "admin") && (
                  <button onClick={() => deleteComment(c.id)}
                          className="text-[12px] text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1">
                    삭제
                  </button>
                )}
              </div>
            ))}
          </div>
      }

      {/* 댓글 입력 */}
      {user ? (
        <form onSubmit={submit} className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-[13px] font-[700] shrink-0 overflow-hidden">
            {user.avatar_url
              ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
              : (user.display_name?.[0] ?? "?").toUpperCase()}
          </div>
          <div className="flex-1">
            <textarea ref={textareaRef} value={text} onChange={e => setText(e.target.value)}
                      rows={3} maxLength={1000} placeholder="댓글을 작성하세요... (최대 1000자)"
                      className="w-full px-3 py-2 text-[14px] border border-border rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/40" />
            <div className="flex justify-between items-center mt-2">
              <span className="text-[11px] text-muted-foreground">{text.length} / 1000</span>
              <button type="submit" disabled={submitting || !text.trim()}
                      className="px-4 py-1.5 bg-primary text-white text-[13px] font-[700] rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors">
                {submitting ? "작성 중…" : "댓글 작성"}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <Link to="/login" className="block text-center py-4 border border-dashed border-border rounded-xl text-[14px] text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors">
          로그인 후 댓글을 작성할 수 있습니다 →
        </Link>
      )}
    </div>
  );
}

// ── 메인 컴포넌트 ────────────────────────────────────────────────────────
const InsightDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
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

  const handleDelete = async () => {
    if (!confirm("기사를 삭제하시겠습니까? 되돌릴 수 없습니다.")) return;
    try {
      const res = await fetch(`/api/insight/${slug}`, {
        method: "DELETE", credentials: "include",
      });
      if (!res.ok) throw new Error();
      navigate("/insight");
    } catch {
      alert("삭제에 실패했습니다.");
    }
  };

  const color = article ? (categoryColors[article.category] || "#6B7280") : "#6B7280";
  const isAdmin = user?.role === "admin";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container py-8 max-w-[760px]">
        <div className="flex items-center justify-between mb-6">
          <Link to="/insight" className="inline-flex items-center gap-1 text-[14px] font-semibold text-primary hover:underline">
            ← 뉴스 목록
          </Link>
          {/* 관리자 버튼 */}
          {isAdmin && article && (
            <div className="flex gap-2">
              <Link to={`/insight/${slug}/edit`}
                    className="px-3 py-1.5 text-[12px] font-[700] border border-border rounded-lg hover:border-primary hover:text-primary transition-colors">
                ✏️ 수정
              </Link>
              <button onClick={handleDelete}
                      className="px-3 py-1.5 text-[12px] font-[700] border border-border rounded-lg hover:border-destructive hover:text-destructive transition-colors">
                🗑 삭제
              </button>
            </div>
          )}
        </div>

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
            <span className="inline-block px-3 py-1 text-[12px] font-semibold rounded-full text-white mb-4"
                  style={{ backgroundColor: color }}>
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
                <img src={article.image_url} alt={article.title}
                     className="w-full max-h-[420px] object-cover rounded-xl"
                     onError={e => (e.currentTarget.parentElement!.remove())} />
                {article.image_credit && (
                  <p className="text-[12px] text-muted-foreground/60 mt-2 text-right">이미지: {article.image_credit}</p>
                )}
              </div>
            )}

            <div className="text-[17px] text-foreground/90">
              {renderContent(article.content || article.summary || "", article.image_url)}
            </div>

            {article.source_url && (
              <a href={article.source_url} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-2 mt-8 px-5 py-3 border border-border rounded-lg text-[14px] font-semibold text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                원문 기사 보기 →
              </a>
            )}

            <div className="mt-12 p-6 rounded-xl text-white text-center" style={{ backgroundColor: "#1A1A2E" }}>
              <p className="font-[800] text-[18px] mb-2">다낭 한달살기, 어디서 시작할지 모르겠다면?</p>
              <Link to="/planner"
                    className="inline-block mt-3 px-6 py-2.5 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90 transition-colors">
                내 맞춤 플랜 만들기 →
              </Link>
            </div>

            {/* 댓글 섹션 */}
            <CommentSection slug={slug!} />
          </>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default InsightDetail;
