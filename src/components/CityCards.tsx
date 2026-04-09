import { ArrowRight } from "lucide-react";

interface CityData {
  name: string;
  color: string;
  monthlyCostKRW: string;
  monthlyCostUSD: string;
  rentKRW: string;
  rentUSD: string;
  koreans: string;
  climate: string;
}

const cities: CityData[] = [
  { name: "호치민", color: "bg-kbiz-orange", monthlyCostKRW: "192만원", monthlyCostUSD: "$1,370", rentKRW: "77만원", rentUSD: "$550", koreans: "약 10만명", climate: "연중 고온" },
  { name: "하노이", color: "bg-kbiz-green", monthlyCostKRW: "168만원", monthlyCostUSD: "$1,200", rentKRW: "70만원", rentUSD: "$500", koreans: "약 5만명", climate: "사계절" },
  { name: "다낭", color: "bg-kbiz-city-blue", monthlyCostKRW: "130만원", monthlyCostUSD: "$930", rentKRW: "49만원", rentUSD: "$350", koreans: "약 7천명", climate: "온난 해변" },
  { name: "나트랑", color: "bg-kbiz-red", monthlyCostKRW: "112만원", monthlyCostUSD: "$800", rentKRW: "42만원", rentUSD: "$300", koreans: "약 2천명", climate: "온난 해변" },
  { name: "푸꾸옥", color: "bg-kbiz-purple", monthlyCostKRW: "133만원", monthlyCostUSD: "$950", rentKRW: "56만원", rentUSD: "$400", koreans: "약 500명", climate: "열대 섬" },
];

const CityCards = () => {
  return (
    <section className="py-20 bg-background">
      <div className="container">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-[28px] md:text-[32px] font-[800] text-foreground">도시별 생활비</h2>
          <a href="#" className="text-[15px] font-medium text-primary hover:underline flex items-center gap-1">
            전체 비교 <ArrowRight size={14} />
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {cities.map((city) => (
            <a
              key={city.name}
              href="#"
              className={`group block bg-card rounded-xl overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-200 ${
                city.name === "다낭" ? "border-2 border-[hsl(210,72%,41%)] relative" : "border border-border"
              }`}
            >
              {city.name === "다낭" && (
                <span className="absolute top-3 right-3 px-2 py-0.5 text-[13px] font-medium rounded-full bg-primary text-primary-foreground">현지 운영</span>
              )}
              <div className={`h-1.5 ${city.color}`} />
              <div className="p-5">
                <h3 className="text-[20px] font-bold text-foreground mb-4">{city.name}</h3>
                <div className="space-y-3">
                  <div>
                    <span className="text-[14px] text-muted-foreground">월 생활비</span>
                    <p className="font-[800] text-foreground text-[28px] leading-tight font-number">{city.monthlyCostKRW}</p>
                    <p className="text-[14px] text-muted-foreground font-number">{city.monthlyCostUSD}</p>
                  </div>
                  <div>
                    <span className="text-[14px] text-muted-foreground">원룸 월세</span>
                    <p className="font-[800] text-foreground text-[28px] leading-tight font-number">{city.rentKRW}</p>
                    <p className="text-[14px] text-muted-foreground font-number">{city.rentUSD}</p>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-border">
                    <div>
                      <span className="text-[13px] text-muted-foreground">한인 수</span>
                      <p className="text-[15px] font-medium text-foreground">{city.koreans}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[13px] text-muted-foreground">기후</span>
                      <p className="text-[15px] font-medium text-foreground">{city.climate}</p>
                    </div>
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>

        <p className="mt-4 text-[13px] text-muted-foreground text-center">
          ※ 1인 기준, 렌트 제외. Numbeo + 현지 확인. 환율 <span className="font-number">1$ ≈ ₩1,400</span> 기준
        </p>
      </div>
    </section>
  );
};

export default CityCards;
