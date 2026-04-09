import { Search } from "lucide-react";

const cities = ["전체", "호치민", "하노이", "다낭", "나트랑", "푸꾸옥"];

const HeroSection = () => {
  return (
    <section className="relative bg-gradient-to-b from-accent/60 to-background py-16 md:py-24">
      <div className="container text-center">
        <h1 className="text-2xl md:text-4xl font-bold leading-tight text-foreground">
          다낭 한달살기 비용·월세·비자,
          <br />
          5개 도시와 비교하세요.
        </h1>

        <p className="mt-4 text-sm md:text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
          1인 월 생활비 기준 — 다낭 130만원 · 나트랑 112만원 · 푸꾸옥 133만원
          <br />
          <span className="text-xs">
            ※ 렌트 제외, Numbeo + 현지 확인 기반 (1$ ≈ ₩1,400)
          </span>
        </p>

        {/* City chips */}
        <div className="flex flex-wrap justify-center gap-2 mt-8">
          {cities.map((city, i) => (
            <button
              key={city}
              className={`px-4 py-1.5 text-sm rounded-full font-medium transition-colors ${
                i === 0
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground border border-border hover:border-primary hover:text-primary"
              }`}
            >
              {city}
            </button>
          ))}
        </div>

        {/* Search bar */}
        <div className="mt-6 max-w-lg mx-auto flex items-center bg-card border border-border rounded-xl overflow-hidden shadow-sm focus-within:ring-2 focus-within:ring-primary/30">
          <Search size={18} className="ml-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="도시 또는 키워드 — 예: 다낭 월세, 나트랑 생활비"
            className="flex-1 px-3 py-3 text-sm bg-transparent outline-none placeholder:text-muted-foreground/60"
          />
          <button className="px-5 py-3 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            검색
          </button>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          다낭 현지 운영 · 검증 업체 등록 중
        </p>
      </div>
    </section>
  );
};

export default HeroSection;
