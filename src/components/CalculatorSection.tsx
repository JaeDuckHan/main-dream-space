import { useState, useMemo } from "react";
import { ArrowRight } from "lucide-react";

type City = "호치민" | "하노이" | "다낭" | "나트랑" | "푸꾸옥";
type Housing = "원룸" | "아파트(방2)" | "서비스드레지던스";
type Food = "로컬 위주" | "한식 위주" | "외식 많이";
type Transport = "도보+그랩" | "오토바이 렌트" | "자가용";

const cityList: City[] = ["호치민", "하노이", "다낭", "나트랑", "푸꾸옥"];
const housingList: Housing[] = ["원룸", "아파트(방2)", "서비스드레지던스"];
const foodList: Food[] = ["로컬 위주", "한식 위주", "외식 많이"];
const transportList: Transport[] = ["도보+그랩", "오토바이 렌트", "자가용"];

// Base costs per city (만원)
const baseCosts: Record<City, { rent: number[]; food: number[]; transport: number[]; telecom: number; leisure: number; insurance: number }> = {
  호치민:   { rent: [77, 112, 175], food: [30, 45, 70], transport: [11, 7, 25], telecom: 3, leisure: 25, insurance: 12 },
  하노이:   { rent: [70, 98, 154], food: [28, 42, 63], transport: [10, 6, 22], telecom: 3, leisure: 22, insurance: 11 },
  다낭:     { rent: [49, 77, 140], food: [25, 35, 56], transport: [8, 5, 18], telecom: 3, leisure: 21, insurance: 11 },
  나트랑:   { rent: [42, 63, 112], food: [22, 32, 49], transport: [7, 5, 16], telecom: 3, leisure: 18, insurance: 10 },
  푸꾸옥:   { rent: [56, 84, 147], food: [27, 38, 59], transport: [9, 6, 20], telecom: 3, leisure: 22, insurance: 11 },
};

interface Breakdown {
  숙소: number;
  식비: number;
  교통: number;
  통신: number;
  여가: number;
  보험: number;
}

function calculate(city: City, housing: Housing, food: Food, transport: Transport): Breakdown {
  const c = baseCosts[city];
  const hi = housingList.indexOf(housing);
  const fi = foodList.indexOf(food);
  const ti = transportList.indexOf(transport);

  return {
    숙소: c.rent[hi],
    식비: c.food[fi],
    교통: c.transport[ti],
    통신: c.telecom,
    여가: c.leisure,
    보험: c.insurance,
  };
}

function toUSD(manwon: number): number {
  return Math.round((manwon * 10000) / 1400);
}

const CalculatorSection = () => {
  const [city, setCity] = useState<City>("다낭");
  const [housing, setHousing] = useState<Housing>("원룸");
  const [food, setFood] = useState<Food>("로컬 위주");
  const [transport, setTransport] = useState<Transport>("도보+그랩");

  const breakdown = useMemo(() => calculate(city, housing, food, transport), [city, housing, food, transport]);
  const total = useMemo(() => Object.values(breakdown).reduce((a, b) => a + b, 0), [breakdown]);

  function ChipGroup<T extends string>({ items, value, onChange }: { items: readonly T[]; value: T; onChange: (v: T) => void }) {
    return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item}
          onClick={() => onChange(item)}
          className={`px-3 py-1.5 text-[14px] rounded-lg font-medium transition-colors ${
            value === item
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          {item}
        </button>
      ))}
    </div>
    );
  }

  return (
    <section className="py-20 bg-muted/50">
      <div className="container">
        <h2 className="text-[28px] md:text-[32px] font-[800] text-foreground mb-8">생활비 계산기</h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Input */}
          <div className="bg-card rounded-xl border border-border p-6 space-y-6">
            <div>
              <label className="text-[15px] font-semibold text-foreground mb-2 block">도시 선택</label>
              <ChipGroup items={cityList} value={city} onChange={(v) => setCity(v as City)} />
            </div>
            <div>
              <label className="text-[15px] font-semibold text-foreground mb-2 block">숙소 유형</label>
              <ChipGroup items={housingList} value={housing} onChange={(v) => setHousing(v as Housing)} />
            </div>
            <div>
              <label className="text-[15px] font-semibold text-foreground mb-2 block">식사 스타일</label>
              <ChipGroup items={foodList} value={food} onChange={(v) => setFood(v as Food)} />
            </div>
            <div>
              <label className="text-[15px] font-semibold text-foreground mb-2 block">교통</label>
              <ChipGroup items={transportList} value={transport} onChange={(v) => setTransport(v as Transport)} />
            </div>
          </div>

          {/* Right: Result */}
          <div className="bg-card rounded-xl border border-border p-6 flex flex-col">
            <p className="text-[15px] text-muted-foreground mb-1">예상 월 생활비</p>
            <p className="text-[36px] font-[800] text-foreground font-number leading-tight">
              {total}만원
            </p>
            <p className="text-[16px] text-muted-foreground font-number mb-6">
              (${toUSD(total).toLocaleString()})
            </p>

            <div className="space-y-3 flex-1">
              {Object.entries(breakdown).map(([label, value]) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-[15px] text-muted-foreground">{label}</span>
                  <span className="text-[15px] font-semibold text-foreground font-number">{value}만원</span>
                </div>
              ))}
            </div>

            <div className="border-t border-border mt-4 pt-4">
              <div className="flex justify-between items-center">
                <span className="text-[16px] font-bold text-foreground">합계</span>
                <span className="text-[18px] font-[800] text-foreground font-number">{total}만원</span>
              </div>
            </div>

            <p className="mt-4 text-[13px] text-muted-foreground">
              ※ 1인 기준, Numbeo + 현지 확인
            </p>
            <a href="#" className="inline-flex items-center gap-1 mt-3 text-[15px] font-medium text-primary hover:underline">
              다른 도시와 비교하기 <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CalculatorSection;
