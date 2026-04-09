import { ArrowRight } from "lucide-react";

interface Service {
  icon: string;
  name: string;
  category: string;
  description: string;
  tags: string[];
  verified: string;
}

const services: Service[] = [
  {
    icon: "🏠",
    name: "다낭 하우스 에이전시",
    category: "월세 · 한달살기 숙소 · 장기체류",
    description: "한국어 상담. 다낭 한달살기 원룸부터 가족형 아파트까지.",
    tags: ["다낭", "월세", "한국어 응대"],
    verified: "2026.04 확인",
  },
  {
    icon: "🛡️",
    name: "VN케어 보험컨설팅",
    category: "여행자보험 · 장기체류보험 · 의료보험",
    description: "한국 보험사 제휴. 1개월~1년 체류 보험 비교 상담.",
    tags: ["다낭", "보험", "한국어 응대"],
    verified: "2026.04 확인",
  },
  {
    icon: "📋",
    name: "비자플러스",
    category: "관광비자 · 장기비자 · e-visa 대행",
    description: "비자 종류별 대행. 연장, 변경까지.",
    tags: ["다낭", "비자대행", "한국어 응대"],
    verified: "2026.04 확인",
  },
];

const ServicesSection = () => {
  return (
    <section className="py-16 bg-background">
      <div className="container">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl md:text-2xl font-bold text-foreground">다낭 현지 검증 서비스</h2>
          <a href="#" className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
            전체 업체 보기 <ArrowRight size={14} />
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {services.map((s) => (
            <div
              key={s.name}
              className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{s.icon}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-foreground">{s.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.category}</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{s.description}</p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {s.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 text-xs rounded-full bg-accent text-accent-foreground font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">✓ 운영자 확인 {s.verified}</p>
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-muted-foreground text-center">※ 유료 등록 업체 포함</p>
      </div>
    </section>
  );
};

export default ServicesSection;
