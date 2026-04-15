// src/pages/PlannerShare.tsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

interface SharedPlan {
  id: string;
  title: string;
  data: {
    city: string;
    party: string;
    budget: number;
    startDate: string;
    endDate: string;
  };
  created_at: string;
}

export default function PlannerShare() {
  const { id } = useParams<{ id: string }>();
  const [plan, setPlan] = useState<SharedPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/planner/plans/${id}`)
      .then(r => {
        if (!r.ok) { setNotFound(true); return null; }
        return r.json();
      })
      .then(data => { if (data) setPlan(data); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">불러오는 중...</div>;
  if (notFound || !plan) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <p className="text-muted-foreground">플랜을 찾을 수 없습니다.</p>
      <Link to="/planner" className="text-primary hover:underline text-sm">내 플랜 만들기</Link>
    </div>
  );

  const { city, party, budget, startDate, endDate } = plan.data;

  return (
    <>
      <Navbar />
      <main className="container py-10 max-w-xl">
        <div className="mb-6">
          <p className="text-sm text-muted-foreground mb-1">{new Date(plan.created_at).toLocaleDateString("ko")} 공유된 플랜</p>
          <h1 className="text-2xl font-bold text-foreground">{plan.title || `${city} 한달살기 플랜`}</h1>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-8">
          {[
            { label: "도시", value: city },
            { label: "동행", value: party },
            { label: "예산", value: `${budget}만원/월` },
            { label: "기간", value: startDate && endDate ? `${startDate} ~ ${endDate}` : "미정" },
          ].map(({ label, value }) => (
            <div key={label} className="p-4 rounded-lg border border-border bg-card">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className="text-sm font-semibold text-foreground">{value}</p>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">나도 {city} 한달살기 플랜 만들어볼까요?</p>
          <Link
            to="/planner"
            className="inline-block px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            무료로 내 플랜 만들기
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
