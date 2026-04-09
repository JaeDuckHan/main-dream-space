import { ArrowRight } from "lucide-react";

const CalculatorSection = () => {
  return (
    <section className="py-12 bg-muted/50">
      <div className="container">
        <h2 className="text-xl md:text-2xl font-bold text-foreground mb-6">생활비 계산기</h2>
        <a
          href="#"
          className="block bg-card rounded-xl border border-border p-6 md:p-8 hover:shadow-md transition-shadow group"
        >
          <div className="flex items-start gap-4">
            <span className="text-3xl">💰</span>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                내 생활비 계산해보기
              </h3>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                도시, 숙소 유형, 식사 스타일, 교통수단을 고르면
                <br className="hidden sm:block" />
                예상 월 생활비가 바로 나옵니다
              </p>
              <span className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-primary">
                계산하러 가기 <ArrowRight size={14} />
              </span>
            </div>
          </div>
        </a>
      </div>
    </section>
  );
};

export default CalculatorSection;
