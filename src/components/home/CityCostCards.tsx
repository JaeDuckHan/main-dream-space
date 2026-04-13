import { useNavigate } from "react-router-dom";
import { CITY_LABELS, CITY_SLUGS, ROUTES } from "@/lib/routes";

const COST_DATA = {
  hochiminh: { monthly: 192, rent: 77, usd: 1370, usdRent: 550, population: "약 1000만", climate: "열대 고온" },
  hanoi: { monthly: 168, rent: 70, usd: 1200, usdRent: 500, population: "약 900만", climate: "4계절" },
  danang: { monthly: 130, rent: 49, usd: 930, usdRent: 350, population: "약 120만", climate: "온난 해변", highlight: true },
  nhatrang: { monthly: 112, rent: 42, usd: 800, usdRent: 300, population: "약 50만", climate: "온난 해변" },
  phuquoc: { monthly: 133, rent: 56, usd: 950, usdRent: 400, population: "약 15만", climate: "열대 섬" },
} as const;

export function CityCostCards() {
  const navigate = useNavigate();

  return (
    <section className="bg-background py-16">
      <div className="container">
        <div className="mb-8 flex items-center justify-between gap-4">
          <h2 className="text-[28px] font-[800] text-foreground md:text-[32px]">도시별 생활비</h2>
          <button
            type="button"
            onClick={() => navigate(ROUTES.compare())}
            className="text-sm font-medium text-primary transition-colors hover:text-primary/80"
          >
            전체 비교 →
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {CITY_SLUGS.map((slug) => {
            const item = COST_DATA[slug];

            return (
              <button
                key={slug}
                type="button"
                onClick={() => navigate(ROUTES.compare({ city: slug }))}
                className={`group relative rounded-xl border bg-card p-5 text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${
                  item.highlight ? "border-primary" : "border-border"
                }`}
              >
                {item.highlight ? (
                  <span className="absolute right-3 top-3 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                    현지 운영
                  </span>
                ) : null}
                <h3 className="mb-4 text-[20px] font-bold text-foreground">{CITY_LABELS[slug]}</h3>
                <div>
                  <div className="text-[13px] text-muted-foreground">월 생활비</div>
                  <div className="text-[28px] font-[800] leading-tight text-foreground">{item.monthly}만원</div>
                  <div className="text-[13px] text-muted-foreground">${item.usd}</div>
                </div>
                <div className="mt-4">
                  <div className="text-[13px] text-muted-foreground">원룸 월세</div>
                  <div className="text-[22px] font-[700] leading-tight text-foreground">{item.rent}만원</div>
                  <div className="text-[13px] text-muted-foreground">${item.usdRent}</div>
                </div>
                <div className="mt-4 border-t border-border pt-3 text-[13px] text-muted-foreground">
                  {item.population} · {item.climate}
                </div>
                <div className="mt-3 text-xs font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  비교 보기 →
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
