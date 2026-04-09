import { ArrowRight } from "lucide-react";

interface UpdateItem {
  date: string;
  tag: string;
  tagColor: string;
  title: string;
  interpretation: string;
  source: string;
  important: boolean;
}

const updates: UpdateItem[] = [
  {
    date: "2026.04.07",
    tag: "비자",
    tagColor: "bg-accent text-primary",
    title: "베트남 e-visa 90일 체류 유지 중",
    interpretation:
      "2023년 8월 시행. 한달살기 시 비자런 불필요. 단, 입국 목적에 따라 별도 비자가 필요할 수 있음.",
    source: "베트남 출입국관리국 · 최종 확인 2026.04",
    important: true,
  },
  {
    date: "2026.04.06",
    tag: "생활",
    tagColor: "bg-[hsl(var(--kbiz-tag-life))] text-kbiz-green",
    title: "다낭 미케비치 인근 원룸 월세 49만~63만원 구간",
    interpretation:
      "성수기(3-8월) 진입으로 비수기 대비 7만~14만원 상승. 3개월 이상 계약 시 협상 가능.",
    source: "현지 부동산 에이전트 3곳 확인 · 2026.04",
    important: false,
  },
  {
    date: "2026.04.05",
    tag: "부동산",
    tagColor: "bg-[hsl(var(--kbiz-tag-realestate))] text-kbiz-orange",
    title: "푸꾸옥 콘도텔 외국인 매입 규제 완화 검토 중",
    interpretation:
      "관광특구 지역 내 외국인 소유 허용 범위 확대 논의. 확정 아님, 검토 단계.",
    source: "VnExpress · 2026.04.05",
    important: false,
  },
];

const WeeklyUpdates = () => {
  return (
    <section className="py-20 bg-muted/50">
      <div className="container">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-[28px] md:text-[32px] font-[800] text-foreground">이번 주 변경사항</h2>
          <a href="#" className="text-[15px] font-medium text-primary hover:underline flex items-center gap-1">
            전체 보기 <ArrowRight size={14} />
          </a>
        </div>

        <div className="space-y-4">
          {updates.map((item) => (
            <div
              key={item.title}
              className="flex bg-card rounded-xl border border-border overflow-hidden hover:shadow-sm transition-shadow"
            >
              <div
                className={`w-1 shrink-0 ${
                  item.important ? "bg-kbiz-red" : "bg-border"
                }`}
              />
              <div className="p-5 flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[13px] text-muted-foreground font-number">{item.date}</span>
                  <span className={`px-2 py-0.5 text-[13px] font-medium rounded-full ${item.tagColor}`}>
                    {item.tag}
                  </span>
                </div>
                <h3 className="text-[18px] font-bold text-foreground">{item.title}</h3>
                <p className="mt-1.5 text-[15px] text-muted-foreground leading-relaxed">
                  {item.interpretation}
                </p>
                <p className="mt-2 text-[13px] text-muted-foreground/70">출처: {item.source}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WeeklyUpdates;
