import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/hooks/use-auth";

const CATEGORIES = ["관광","음식","날씨","교통","안전","문화","경제","기타"];

interface FormData {
  title: string;
  summary: string;
  content: string;
  category: string;
  image_url: string;
  image_credit: string;
  source_name: string;
  source_url: string;
  publish_slot: "morning" | "afternoon";
}

const EMPTY: FormData = {
  title: "", summary: "", content: "", category: "기타",
  image_url: "", image_credit: "", source_name: "", source_url: "",
  publish_slot: "morning",
};

export default function InsightEdit() {
  const { slug } = useParams<{ slug?: string }>();
  const isEdit = !!slug;
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [form, setForm] = useState<FormData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fetchLoading, setFetchLoading] = useState(isEdit);

  // 수정 모드일 때 기존 데이터 로드
  useEffect(() => {
    if (!isEdit) return;
    fetch(`/api/insight/${slug}`)
      .then(r => r.json())
      .then(data => {
        setForm({
          title:        data.title ?? "",
          summary:      data.summary ?? "",
          content:      data.content ?? "",
          category:     data.category ?? "기타",
          image_url:    data.image_url ?? "",
          image_credit: data.image_credit ?? "",
          source_name:  data.source_name ?? "",
          source_url:   data.source_url ?? "",
          publish_slot: data.publish_slot ?? "morning",
        });
      })
      .catch(() => setError("기사를 불러오지 못했습니다."))
      .finally(() => setFetchLoading(false));
  }, [slug, isEdit]);

  // 권한 체크
  if (!authLoading && user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        관리자만 접근 가능합니다.
      </div>
    );
  }

  const set = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const body = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, v === "" ? null : v])
    );
    try {
      const res = await fetch(
        isEdit ? `/api/insight/${slug}` : "/api/insight",
        { method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body) }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "오류 발생");
      navigate(`/insight/${data.slug}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (fetchLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">불러오는 중…</div>;
  }

  const inputCls = "w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/40";
  const labelCls = "block text-[13px] font-[600] text-foreground mb-1";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-10 max-w-[800px]">
        <h1 className="text-[24px] font-[900] mb-8">{isEdit ? "기사 수정" : "기사 작성"}</h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 제목 */}
          <div>
            <label className={labelCls}>제목 *</label>
            <input className={inputCls} value={form.title} onChange={set("title")} required maxLength={500} placeholder="30자 내외, 클릭하고 싶은 제목"/>
          </div>

          {/* 서머리 */}
          <div>
            <label className={labelCls}>서머리 (한국인 관점 의견형)</label>
            <textarea className={`${inputCls} resize-none`} rows={3} value={form.summary} onChange={set("summary")} maxLength={2000} placeholder="2~3문장. 수치·비교가 있으면 더 좋음"/>
          </div>

          {/* 카테고리 + 슬롯 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>카테고리</label>
              <select className={inputCls} value={form.category} onChange={set("category")}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>발행 슬롯</label>
              <select className={inputCls} value={form.publish_slot} onChange={set("publish_slot")}>
                <option value="morning">morning (KST 09:00)</option>
                <option value="afternoon">afternoon (KST 15:00)</option>
              </select>
            </div>
          </div>

          {/* 대표 이미지 */}
          <div>
            <label className={labelCls}>대표 이미지 URL</label>
            <input className={inputCls} value={form.image_url} onChange={set("image_url")} placeholder="https://images.pexels.com/... (브라우저에서 직접 열어 확인 후 사용)"/>
            {form.image_url && (
              <img src={form.image_url} alt="미리보기" className="mt-2 h-32 w-full object-cover rounded-lg border border-border"
                   onError={e => (e.currentTarget.style.display = "none")} />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>이미지 출처</label>
              <input className={inputCls} value={form.image_credit} onChange={set("image_credit")} placeholder="Pexels / 촬영자명 등"/>
            </div>
            <div>
              <label className={labelCls}>원문 매체명</label>
              <input className={inputCls} value={form.source_name} onChange={set("source_name")} placeholder="VnExpress / Vietnam News 등"/>
            </div>
          </div>

          <div>
            <label className={labelCls}>원문 URL</label>
            <input className={inputCls} value={form.source_url} onChange={set("source_url")} placeholder="https://"/>
          </div>

          {/* 본문 */}
          <div>
            <label className={labelCls}>본문 (마크다운)</label>
            <p className="text-[12px] text-muted-foreground mb-1">
              ## 소제목 &nbsp;|&nbsp; - 목록 &nbsp;|&nbsp; 1. 번호목록 &nbsp;|&nbsp; [링크텍스트](URL) &nbsp;|&nbsp; ![이미지](URL) &nbsp;|&nbsp; &gt; 💡 콜아웃 &nbsp;|&nbsp; --- 구분선
              &nbsp;&nbsp;|&nbsp;&nbsp;구글맵: [📍 위치 보기](place-URL) &nbsp;[⭐ 리뷰 보기](리뷰탭-URL — 리뷰탭 클릭 후 주소창 복사)
            </p>
            <textarea className={`${inputCls} font-mono text-[13px] resize-y`} rows={24}
                      value={form.content} onChange={set("content")} required
                      placeholder="마크다운 형식으로 작성. 가격은 50,000동 (약 2,500원) 형태로 VND+원화 병기."/>
          </div>

          {error && <p className="text-[13px] text-red-500">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving}
                    className="px-6 py-2.5 bg-primary text-white font-[700] rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {saving ? "저장 중…" : isEdit ? "수정 완료" : "기사 저장"}
            </button>
            <button type="button" onClick={() => navigate(-1)}
                    className="px-6 py-2.5 border border-border rounded-lg text-[14px] font-[600] hover:border-primary/40 transition-colors">
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
