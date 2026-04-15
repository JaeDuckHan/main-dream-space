// src/pages/PlannerExplore.tsx
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

interface PublicPlan {
  id: string;
  title: string;
  data: {
    city: string;
    party: string;
    budget: number;
    startDate: string;
    endDate: string;
    checklist: Record<string, boolean>;
  };
  created_at: string;
}

const CITIES = ["전체", "다낭", "호치민", "하노이", "나트랑", "푸꾸옥"];
const PARTIES = ["전체", "혼자", "커플", "가족", "친구"];

export default function PlannerExplore() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const city = searchParams.get("city") || "";
  const party = searchParams.get("party") || "";

  useEffect(() => {
    setLoading(true);
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (city) params.set("city", city);
    if (party) params.set("party", party);
    params.set("limit", "20");

    fetch(`/api/planner/plans/public?${params}`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
      .then((data: PublicPlan[]) => setPlans(data))
      .catch((e) => { if ((e as Error).name !== "AbortError") setPlans([]); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });

    return () => controller.abort();
  }, [city, party]);

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value && value !== "전체") next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  const getCheckedRatio = (checklist: Record<string, boolean>) => {
    const vals = Object.values(checklist || {});
    if (!vals.length) return 0;
    return Math.round((vals.filter(Boolean).length / vals.length) * 100);
  };

  return (
    <>
      <Navbar />
      <main className="container py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">다른 사람 플랜 구경하기</h1>
          <p className="text-sm text-muted-foreground mt-1">실제로 계획한 한달살기 플랜들을 확인해보세요</p>
        </div>

        {/* 필터 */}
        <div className="flex flex-wrap gap-2 mb-6">
          <div className="flex gap-1.5">
            {CITIES.map(c => (
              <button
                key={c}
                onClick={() => setFilter("city", c)}
                className={`px-3 py-1.5 text-[12px] rounded-full border transition-colors ${
                  (city || "전체") === c
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {PARTIES.map(p => (
              <button
                key={p}
                onClick={() => setFilter("party", p)}
                className={`px-3 py-1.5 text-[12px] rounded-full border transition-colors ${
                  (party || "전체") === p
                    ? "bg-foreground text-background border-foreground"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* 플랜 목록 */}
        {loading ? (
          <p className="text-muted-foreground text-sm">불러오는 중...</p>
        ) : plans.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground">아직 공유된 플랜이 없어요.</p>
            <Link to="/planner" className="mt-4 inline-block text-primary hover:underline text-sm">
              첫 번째로 플랜 만들기
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map(plan => {
              const ratio = getCheckedRatio(plan.data?.checklist);
              return (
                <Link
                  key={plan.id}
                  to={`/planner/share/${plan.id}`}
                  className="p-5 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-sm transition-all"
                >
                  <h3 className="text-[14px] font-semibold text-foreground mb-3 line-clamp-1">
                    {plan.title || `${plan.data?.city ?? ""} 한달살기 플랜`}
                  </h3>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {[plan.data?.city ?? "", plan.data?.party ?? "", `${plan.data?.budget ?? 0}만원`].map((tag, i) => (
                      <span key={`${plan.id}-tag-${i}`} className="px-2 py-0.5 text-[11px] bg-muted text-muted-foreground rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                  {ratio > 0 && (
                    <div>
                      <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                        <span>체크리스트</span>
                        <span>{ratio}% 완료</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${ratio}%` }} />
                      </div>
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-3">
                    {new Date(plan.created_at).toLocaleDateString("ko-KR")}
                  </p>
                </Link>
              );
            })}
          </div>
        )}

        <div className="mt-10 text-center">
          <Link
            to="/planner"
            className="inline-block px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
          >
            내 플랜 만들기
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
