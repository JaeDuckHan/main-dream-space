import { useState, useMemo } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

type CityKey = "다낭" | "호치민" | "하노이" | "나트랑" | "푸꾸옥";
const cityKeys: CityKey[] = ["다낭", "호치민", "하노이", "나트랑", "푸꾸옥"];

interface CityData {
  title: string;
  keyStats: { label: string; value: string; sub: string }[];
  costRows: { item: string; budget: string; budgetNote: string; normal: string; normalNote: string; premium: string; premiumNote: string }[];
  totals: { budget: string; budgetMonthly: string; normal: string; normalMonthly: string; premium: string; premiumMonthly: string };
  hasServices: boolean;
}

const allCityData: Record<CityKey, CityData> = {
  다낭: {
    title: "다낭 은퇴·장기체류",
    keyStats: [
      { label: "연간 생활비", value: "1,560만원", sub: "($11,160) · 1인 기준" },
      { label: "장기 임대 월세", value: "63만원", sub: "($450) · 아파트 방2" },
      { label: "비자", value: "90일 × 반복", sub: "e-visa 갱신 또는 장기비자" },
      { label: "한국어 병원", value: "3곳+", sub: "다낭 시내 기준" },
      { label: "한인 커뮤니티", value: "한인회·동호회 활발", sub: "골프·봉사·식사 모임" },
      { label: "기후", value: "건기 2-8월", sub: "연평균 26°C, 온난" },
    ],
    costRows: [
      { item: "숙소 (월세)", budget: "420만원", budgetNote: "(원룸)", normal: "756만원", normalNote: "(아파트 방2)", premium: "1,200만원", premiumNote: "(고급 아파트)" },
      { item: "식비", budget: "252만원", budgetNote: "(로컬 위주)", normal: "420만원", normalNote: "(한식 반반)", premium: "672만원", premiumNote: "(외식 포함)" },
      { item: "교통", budget: "84만원", budgetNote: "(도보+그랩)", normal: "132만원", normalNote: "(오토바이)", premium: "252만원", premiumNote: "(자가용)" },
      { item: "통신", budget: "36만원", budgetNote: "", normal: "36만원", normalNote: "", premium: "36만원", premiumNote: "" },
      { item: "여가", budget: "168만원", budgetNote: "(기본)", normal: "252만원", normalNote: "(골프 월2회)", premium: "504만원", premiumNote: "(골프 주1회+여행)" },
      { item: "의료보험", budget: "120만원", budgetNote: "(현지 보험)", normal: "180만원", normalNote: "(글로벌 기본)", premium: "300만원", premiumNote: "(글로벌 종합)" },
      { item: "비자 비용", budget: "30만원", budgetNote: "(e-visa 반복)", normal: "30만원", normalNote: "(e-visa 반복)", premium: "60만원", premiumNote: "(비즈니스비자)" },
      { item: "연 1회 귀국항공", budget: "100만원", budgetNote: "", normal: "100만원", normalNote: "", premium: "150만원", premiumNote: "" },
    ],
    totals: { budget: "1,210만원", budgetMonthly: "101만원", normal: "1,906만원", normalMonthly: "159만원", premium: "3,174만원", premiumMonthly: "265만원" },
    hasServices: true,
  },
  호치민: {
    title: "호치민 은퇴·장기체류",
    keyStats: [
      { label: "연간 생활비", value: "2,760만원", sub: "($19,710) · 1인" },
      { label: "장기 임대 월세", value: "91만원", sub: "($650) · 아파트 방2" },
      { label: "비자", value: "90일 × 반복", sub: "" },
      { label: "한국어 병원", value: "5곳+", sub: "" },
      { label: "한인 커뮤니티", value: "매우 활발", sub: "" },
      { label: "기후", value: "연중 고온", sub: "28°C" },
    ],
    costRows: [
      { item: "숙소 (월세)", budget: "672만원", budgetNote: "(원룸)", normal: "1,092만원", normalNote: "(아파트 방2)", premium: "1,680만원", premiumNote: "(고급 아파트)" },
      { item: "식비", budget: "336만원", budgetNote: "(로컬 위주)", normal: "588만원", normalNote: "(한식 반반)", premium: "924만원", premiumNote: "(외식 포함)" },
      { item: "교통", budget: "132만원", budgetNote: "(도보+그랩)", normal: "168만원", normalNote: "(오토바이)", premium: "336만원", premiumNote: "(자가용)" },
      { item: "통신", budget: "36만원", budgetNote: "", normal: "36만원", normalNote: "", premium: "36만원", premiumNote: "" },
      { item: "여가", budget: "252만원", budgetNote: "", normal: "336만원", normalNote: "", premium: "672만원", premiumNote: "" },
      { item: "의료보험", budget: "120만원", budgetNote: "(현지 보험)", normal: "180만원", normalNote: "(글로벌 기본)", premium: "300만원", premiumNote: "(글로벌 종합)" },
      { item: "비자 비용", budget: "30만원", budgetNote: "(e-visa 반복)", normal: "30만원", normalNote: "(e-visa 반복)", premium: "60만원", premiumNote: "(비즈니스비자)" },
      { item: "연 1회 귀국항공", budget: "100만원", budgetNote: "", normal: "100만원", normalNote: "", premium: "150만원", premiumNote: "" },
    ],
    totals: { budget: "1,678만원", budgetMonthly: "140만원", normal: "2,760만원", normalMonthly: "230만원", premium: "4,158만원", premiumMonthly: "347만원" },
    hasServices: false,
  },
  하노이: {
    title: "하노이 은퇴·장기체류",
    keyStats: [
      { label: "연간 생활비", value: "2,400만원", sub: "($17,140) · 1인" },
      { label: "장기 임대 월세", value: "84만원", sub: "($600) · 아파트 방2" },
      { label: "비자", value: "90일 × 반복", sub: "" },
      { label: "한국어 병원", value: "4곳+", sub: "" },
      { label: "한인 커뮤니티", value: "활발", sub: "" },
      { label: "기후", value: "사계절", sub: "24°C (겨울 10-15°C)" },
    ],
    costRows: [
      { item: "숙소 (월세)", budget: "588만원", budgetNote: "(원룸)", normal: "1,008만원", normalNote: "(아파트 방2)", premium: "1,512만원", premiumNote: "(고급 아파트)" },
      { item: "식비", budget: "300만원", budgetNote: "(로컬 위주)", normal: "504만원", normalNote: "(한식 반반)", premium: "840만원", premiumNote: "(외식 포함)" },
      { item: "교통", budget: "108만원", budgetNote: "(도보+그랩)", normal: "168만원", normalNote: "(오토바이)", premium: "300만원", premiumNote: "(자가용)" },
      { item: "통신", budget: "36만원", budgetNote: "", normal: "36만원", normalNote: "", premium: "36만원", premiumNote: "" },
      { item: "여가", budget: "216만원", budgetNote: "", normal: "300만원", normalNote: "", premium: "588만원", premiumNote: "" },
      { item: "의료보험", budget: "120만원", budgetNote: "(현지 보험)", normal: "180만원", normalNote: "(글로벌 기본)", premium: "300만원", premiumNote: "(글로벌 종합)" },
      { item: "비자 비용", budget: "30만원", budgetNote: "(e-visa 반복)", normal: "30만원", normalNote: "(e-visa 반복)", premium: "60만원", premiumNote: "(비즈니스비자)" },
      { item: "연 1회 귀국항공", budget: "100만원", budgetNote: "", normal: "100만원", normalNote: "", premium: "150만원", premiumNote: "" },
    ],
    totals: { budget: "1,498만원", budgetMonthly: "125만원", normal: "2,400만원", normalMonthly: "200만원", premium: "3,786만원", premiumMonthly: "316만원" },
    hasServices: false,
  },
  나트랑: {
    title: "나트랑 은퇴·장기체류",
    keyStats: [
      { label: "연간 생활비", value: "1,536만원", sub: "($10,970) · 1인" },
      { label: "장기 임대 월세", value: "49만원", sub: "($350) · 아파트 방2" },
      { label: "비자", value: "90일 × 반복", sub: "" },
      { label: "한국어 병원", value: "1곳", sub: "" },
      { label: "한인 커뮤니티", value: "소규모", sub: "" },
      { label: "기후", value: "온난 해변", sub: "27°C" },
    ],
    costRows: [
      { item: "숙소 (월세)", budget: "336만원", budgetNote: "(원룸)", normal: "588만원", normalNote: "(아파트 방2)", premium: "924만원", premiumNote: "(고급 아파트)" },
      { item: "식비", budget: "216만원", budgetNote: "(로컬 위주)", normal: "336만원", normalNote: "(한식 반반)", premium: "588만원", premiumNote: "(외식 포함)" },
      { item: "교통", budget: "60만원", budgetNote: "(도보+그랩)", normal: "108만원", normalNote: "(오토바이)", premium: "216만원", premiumNote: "(자가용)" },
      { item: "통신", budget: "36만원", budgetNote: "", normal: "36만원", normalNote: "", premium: "36만원", premiumNote: "" },
      { item: "여가", budget: "132만원", budgetNote: "", normal: "216만원", normalNote: "", premium: "420만원", premiumNote: "" },
      { item: "의료보험", budget: "120만원", budgetNote: "(현지 보험)", normal: "180만원", normalNote: "(글로벌 기본)", premium: "300만원", premiumNote: "(글로벌 종합)" },
      { item: "비자 비용", budget: "30만원", budgetNote: "(e-visa 반복)", normal: "30만원", normalNote: "(e-visa 반복)", premium: "60만원", premiumNote: "(비즈니스비자)" },
      { item: "연 1회 귀국항공", budget: "100만원", budgetNote: "", normal: "100만원", normalNote: "", premium: "150만원", premiumNote: "" },
    ],
    totals: { budget: "1,030만원", budgetMonthly: "86만원", normal: "1,536만원", normalMonthly: "128만원", premium: "2,694만원", premiumMonthly: "225만원" },
    hasServices: false,
  },
  푸꾸옥: {
    title: "푸꾸옥 은퇴·장기체류",
    keyStats: [
      { label: "연간 생활비", value: "1,812만원", sub: "($12,940) · 1인" },
      { label: "장기 임대 월세", value: "70만원", sub: "($500) · 아파트 방2" },
      { label: "비자", value: "30일 무비자", sub: "푸꾸옥 한정, 장기는 별도" },
      { label: "한국어 병원", value: "없음", sub: "" },
      { label: "한인 커뮤니티", value: "거의 없음", sub: "" },
      { label: "기후", value: "열대 섬", sub: "28°C" },
    ],
    costRows: [
      { item: "숙소 (월세)", budget: "420만원", budgetNote: "(원룸)", normal: "840만원", normalNote: "(아파트 방2)", premium: "1,344만원", premiumNote: "(고급 아파트)" },
      { item: "식비", budget: "252만원", budgetNote: "(로컬 위주)", normal: "420만원", normalNote: "(한식 반반)", premium: "672만원", premiumNote: "(외식 포함)" },
      { item: "교통", budget: "84만원", budgetNote: "(도보+그랩)", normal: "132만원", normalNote: "(오토바이)", premium: "252만원", premiumNote: "(자가용)" },
      { item: "통신", budget: "36만원", budgetNote: "", normal: "36만원", normalNote: "", premium: "36만원", premiumNote: "" },
      { item: "여가", budget: "168만원", budgetNote: "", normal: "252만원", normalNote: "", premium: "504만원", premiumNote: "" },
      { item: "의료보험", budget: "120만원", budgetNote: "(현지 보험)", normal: "180만원", normalNote: "(글로벌 기본)", premium: "300만원", premiumNote: "(글로벌 종합)" },
      { item: "비자 비용", budget: "60만원", budgetNote: "", normal: "60만원", normalNote: "", premium: "60만원", premiumNote: "" },
      { item: "연 1회 귀국항공", budget: "120만원", budgetNote: "", normal: "120만원", normalNote: "", premium: "180만원", premiumNote: "" },
    ],
    totals: { budget: "1,260만원", budgetMonthly: "105만원", normal: "1,812만원", normalMonthly: "151만원", premium: "3,348만원", premiumMonthly: "279만원" },
    hasServices: false,
  },
};

const cityComparison = [
  { name: "다낭", cost: "1,906만원", rent: "63만원", hospital: "3곳+", community: "활발", note: "해변+골프. 은퇴자 1순위.", highlight: true },
  { name: "호치민", cost: "2,760만원", rent: "91만원", hospital: "5곳+", community: "매우 활발", note: "대도시. 인프라 최고. 비용 높음.", highlight: false },
  { name: "나트랑", cost: "1,536만원", rent: "49만원", hospital: "1곳", community: "소규모", note: "가장 저렴. 조용한 해변.", highlight: false },
  { name: "하노이", cost: "2,400만원", rent: "84만원", hospital: "4곳+", community: "활발", note: "사계절. 문화 풍부. 겨울 추움.", highlight: false },
  { name: "푸꾸옥", cost: "1,812만원", rent: "70만원", hospital: "없음", community: "거의 없음", note: "섬. 리조트. 한인 인프라 부족.", highlight: false },
];

const retireServices = [
  { icon: "🏥", category: "병원·의료", name: "(업체명 — 등록 대기 중)", desc: "한국어 가능 병원·치과 정보를 준비하고 있습니다.", tags: [] as string[], verified: "", cta: "업체 등록 문의 →" },
  { icon: "🛡️", category: "보험", name: "VN케어 보험컨설팅", desc: "글로벌 의료보험, 장기체류보험 비교 상담.", tags: ["다낭", "보험", "한국어 응대"], verified: "2026.04", cta: "" },
  { icon: "🏠", category: "장기 임대", name: "다낭 하우스 에이전시", desc: "장기 임대 아파트, 가구 포함, 계약 대행.", tags: ["다낭", "장기임대", "한국어 응대"], verified: "2026.04", cta: "" },
  { icon: "📋", category: "비자", name: "비자플러스", desc: "e-visa 갱신, 장기비자 상담, 변경 대행.", tags: ["다낭", "비자대행", "한국어 응대"], verified: "2026.04", cta: "" },
];

const retireGuides = [
  { icon: "🏥", title: "병원·의료", desc: "한국어 가능 병원, 정기검진, 응급 연락처", link: "/retire/medical" },
  { icon: "🛡️", title: "보험 비교", desc: "현지 보험 vs 글로벌 보험, 나이별 비교", link: "/retire/insurance" },
  { icon: "📋", title: "비자 옵션", desc: "90일 e-visa 반복, 비즈니스비자, 장기비자", link: "/retire/visa" },
  { icon: "💰", title: "연간 비용 상세", desc: "항목별 상세 내역, 절약 팁", link: "/retire/cost" },
  { icon: "❓", title: "자주 묻는 질문", desc: "송금, 세금, 한인회, 반려동물 등", link: "/retire/faq" },
];

/* ── Retirement Calculator ── */
type Housing = "원룸" | "아파트(방2)" | "고급 아파트";
type Food = "로컬 위주" | "한식 반반" | "외식 포함";
type Transport = "도보+그랩" | "오토바이" | "자가용";
type Golf = "안 함" | "월 2회" | "주 1회";
type Insurance = "현지 보험" | "글로벌 기본" | "글로벌 종합";

const housingList: Housing[] = ["원룸", "아파트(방2)", "고급 아파트"];
const foodList: Food[] = ["로컬 위주", "한식 반반", "외식 포함"];
const transportList: Transport[] = ["도보+그랩", "오토바이", "자가용"];
const golfList: Golf[] = ["안 함", "월 2회", "주 1회"];
const insuranceList: Insurance[] = ["현지 보험", "글로벌 기본", "글로벌 종합"];

const retireCalcData: Record<CityKey, {
  rent: number[]; food: number[]; transport: number[]; telecom: number;
  leisure: number[]; insurance: number[]; visa: number[]; flight: number;
}> = {
  다낭: { rent: [420, 756, 1200], food: [252, 420, 672], transport: [84, 132, 252], telecom: 36, leisure: [168, 252, 504], insurance: [120, 180, 300], visa: [30, 30, 60], flight: 100 },
  호치민: { rent: [672, 1092, 1680], food: [336, 588, 924], transport: [132, 168, 336], telecom: 36, leisure: [252, 336, 672], insurance: [120, 180, 300], visa: [30, 30, 60], flight: 100 },
  하노이: { rent: [588, 1008, 1512], food: [300, 504, 840], transport: [108, 168, 300], telecom: 36, leisure: [216, 300, 588], insurance: [120, 180, 300], visa: [30, 30, 60], flight: 100 },
  나트랑: { rent: [336, 588, 924], food: [216, 336, 588], transport: [60, 108, 216], telecom: 36, leisure: [132, 216, 420], insurance: [120, 180, 300], visa: [30, 30, 60], flight: 100 },
  푸꾸옥: { rent: [420, 840, 1344], food: [252, 420, 672], transport: [84, 132, 252], telecom: 36, leisure: [168, 252, 504], insurance: [120, 180, 300], visa: [60, 60, 60], flight: 120 },
};

function toUSD(manwon: number): number {
  return Math.round((manwon * 10000) / 1400);
}

const RetireCalculator = ({ city }: { city: CityKey }) => {
  const [housing, setHousing] = useState<Housing>("아파트(방2)");
  const [food, setFood] = useState<Food>("한식 반반");
  const [transport, setTransport] = useState<Transport>("오토바이");
  const [golf, setGolf] = useState<Golf>("월 2회");
  const [insurance, setInsurance] = useState<Insurance>("글로벌 기본");

  const breakdown = useMemo(() => {
    const c = retireCalcData[city];
    const hi = housingList.indexOf(housing);
    const fi = foodList.indexOf(food);
    const ti = transportList.indexOf(transport);
    const gi = golfList.indexOf(golf);
    const ii = insuranceList.indexOf(insurance);
    return {
      숙소: c.rent[hi],
      식비: c.food[fi],
      교통: c.transport[ti],
      통신: c.telecom,
      여가: c.leisure[gi],
      의료보험: c.insurance[ii],
      비자: c.visa[Math.min(ti, 2)],
      귀국항공: c.flight,
    };
  }, [city, housing, food, transport, golf, insurance]);

  const total = useMemo(() => Object.values(breakdown).reduce((a, b) => a + b, 0), [breakdown]);
  const monthly = Math.round(total / 12);

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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-card rounded-xl border border-border p-6 space-y-6">
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
        <div>
          <label className="text-[15px] font-semibold text-foreground mb-2 block">골프</label>
          <ChipGroup items={golfList} value={golf} onChange={(v) => setGolf(v as Golf)} />
        </div>
        <div>
          <label className="text-[15px] font-semibold text-foreground mb-2 block">의료보험</label>
          <ChipGroup items={insuranceList} value={insurance} onChange={(v) => setInsurance(v as Insurance)} />
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 flex flex-col">
        <p className="text-[15px] text-muted-foreground mb-1">연간 예상 비용</p>
        <p className="text-[36px] font-[800] text-foreground font-number leading-tight">
          {total.toLocaleString()}만원
        </p>
        <p className="text-[16px] text-muted-foreground font-number">
          (월 {monthly.toLocaleString()}만원)
        </p>
        <p className="text-[16px] text-muted-foreground font-number mb-6">
          (${toUSD(total).toLocaleString()})
        </p>

        <div className="space-y-4 flex-1">
          {Object.entries(breakdown).map(([label, value]) => (
            <div key={label} className="flex justify-between items-center">
              <span className="text-[15px] text-muted-foreground">{label}</span>
              <span className="text-[15px] font-semibold text-foreground font-number">
                {value.toLocaleString()}만원
                {label === "숙소" && <span className="text-muted-foreground font-normal text-[13px] ml-1">(월 {Math.round(value / 12)}만원)</span>}
                {label === "식비" && <span className="text-muted-foreground font-normal text-[13px] ml-1">(월 {Math.round(value / 12)}만원)</span>}
              </span>
            </div>
          ))}
        </div>

        <div className="border-t border-border mt-4 pt-4">
          <div className="flex justify-between items-center">
            <span className="text-[16px] font-bold text-foreground">연간 합계</span>
            <span className="text-[18px] font-[700] text-foreground font-number">{total.toLocaleString()}만원</span>
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
  );
};

/* ── Main Page ── */
const Retire = () => {
  const [activeCity, setActiveCity] = useState<CityKey>("다낭");
  const data = allCityData[activeCity];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        {/* 섹션 1: 페이지 헤더 + 섹션 2: 핵심 숫자 — 베이지 배경 */}
        <section className="pt-12 pb-20" style={{ backgroundColor: "#F5F1EB" }}>
          <div className="container">
            <h1 className="text-[32px] md:text-[40px] font-[800] text-foreground">{data.title}</h1>
            <div className="flex flex-wrap gap-2 mt-4">
              {cityKeys.map((c) => (
                <button
                  key={c}
                  onClick={() => setActiveCity(c)}
                  className={`px-4 py-1.5 text-[15px] rounded-full font-medium transition-colors ${
                    c === activeCity
                      ? "bg-primary text-primary-foreground"
                      : "bg-white/70 text-muted-foreground hover:bg-white"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-8">
              {data.keyStats.map((stat) => (
                <div key={stat.label} className="bg-white/80 backdrop-blur-sm rounded-xl border border-border p-5">
                  <p className="text-[14px] text-muted-foreground">{stat.label}</p>
                  <p className="text-[28px] font-[800] text-foreground font-number leading-tight mt-1">{stat.value}</p>
                  <p className="text-[14px] text-muted-foreground mt-1">{stat.sub}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[13px] text-muted-foreground text-center">
              ※ 2026년 4월 기준. Numbeo + 현지 확인. 환율 <span className="font-number">1$ ≈ ₩1,400</span>
            </p>
          </div>
        </section>

        {/* 섹션 3: 연간 비용 비교표 */}
        <section className="py-20 bg-background">
          <div className="container">
            <h2 className="text-[28px] md:text-[32px] font-[800] text-foreground mb-8">1년 얼마나 드나</h2>

            <div className="bg-card rounded-xl border border-border overflow-x-auto">
              <table className="w-full text-left min-w-[600px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="p-4 text-[15px] font-semibold text-foreground w-[140px]"></th>
                    <th className="p-4 text-[15px] font-semibold text-foreground text-center">절약형</th>
                    <th className="p-4 text-[15px] font-semibold text-primary text-center bg-accent/50">보통형</th>
                    <th className="p-4 text-[15px] font-semibold text-foreground text-center">여유형</th>
                  </tr>
                </thead>
                <tbody>
                  {data.costRows.map((row) => (
                    <tr key={row.item} className="border-b border-border last:border-0">
                      <td className="p-4 text-[15px] font-medium text-foreground">{row.item}</td>
                      <td className="p-4 text-center">
                        <span className="text-[16px] font-[700] text-foreground font-number">{row.budget}</span>
                        {row.budgetNote && <p className="text-[13px] text-muted-foreground">{row.budgetNote}</p>}
                      </td>
                      <td className="p-4 text-center bg-accent/30">
                        <span className="text-[16px] font-[700] text-foreground font-number">{row.normal}</span>
                        {row.normalNote && <p className="text-[13px] text-muted-foreground">{row.normalNote}</p>}
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-[16px] font-[700] text-foreground font-number">{row.premium}</span>
                        {row.premiumNote && <p className="text-[13px] text-muted-foreground">{row.premiumNote}</p>}
                      </td>
                    </tr>
                  ))}
                  {/* 합계 */}
                  <tr className="border-t-2 border-border bg-muted/50">
                    <td className="p-4 text-[16px] font-bold text-foreground">연간 합계</td>
                    <td className="p-4 text-center">
                      <span className="text-[20px] font-[800] text-foreground font-number">{data.totals.budget}</span>
                      <p className="text-[14px] text-muted-foreground font-number">월 {data.totals.budgetMonthly}</p>
                    </td>
                    <td className="p-4 text-center bg-accent/30">
                      <span className="text-[24px] font-[800] text-primary font-number">{data.totals.normal}</span>
                      <p className="text-[14px] text-muted-foreground font-number">월 {data.totals.normalMonthly}</p>
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-[20px] font-[800] text-foreground font-number">{data.totals.premium}</span>
                      <p className="text-[14px] text-muted-foreground font-number">월 {data.totals.premiumMonthly}</p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4 space-y-1 text-[13px] text-muted-foreground">
              <p>※ 1인 기준. 커플은 숙소·교통 공유로 1인당 20-30% 절감.</p>
              <p>※ 골프: 다낭 주변 그린피 평균 70만~100만원/회.</p>
              <p>※ 의료보험: 나이·기존 질환에 따라 차이 큼. 상담 권장.</p>
            </div>

            {activeCity === "푸꾸옥" && (
              <p className="mt-2 text-[13px] text-destructive font-medium">
                ※ 푸꾸옥은 한국어 병원·한인 커뮤니티가 거의 없어 장기체류에는 주의 필요.
              </p>
            )}
          </div>
        </section>

        {/* 섹션 4: 생활비 계산기 */}
        <section id="calculator" className="py-20 bg-muted/50">
          <div className="container">
            <h2 className="text-[28px] md:text-[32px] font-[800] text-foreground mb-8">내 연간 생활비 계산</h2>
            <RetireCalculator city={activeCity} />
          </div>
        </section>

        {/* 섹션 5: 다른 도시 비교 */}
        <section className="py-20 bg-background">
          <div className="container">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-[28px] md:text-[32px] font-[800] text-foreground">다른 도시 장기체류와 비교</h2>
              <a href="#" className="text-[15px] font-medium text-primary hover:underline flex items-center gap-1">
                도시비교 전체 <ArrowRight size={14} />
              </a>
            </div>

            <div className="bg-card rounded-xl border border-border overflow-x-auto">
              <table className="w-full text-left min-w-[700px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="p-4 text-[15px] font-semibold text-foreground">도시</th>
                    <th className="p-4 text-[15px] font-semibold text-foreground">연간 생활비</th>
                    <th className="p-4 text-[15px] font-semibold text-foreground">월세 (아파트)</th>
                    <th className="p-4 text-[15px] font-semibold text-foreground">한국어 병원</th>
                    <th className="p-4 text-[15px] font-semibold text-foreground">한인 커뮤니티</th>
                    <th className="p-4 text-[15px] font-semibold text-foreground">특징</th>
                  </tr>
                </thead>
                <tbody>
                  {cityComparison.map((c) => (
                    <tr
                      key={c.name}
                      className={`border-b border-border last:border-0 ${c.highlight ? "bg-[hsl(210,79%,95%)] font-semibold" : ""}`}
                    >
                      <td className="p-4 text-[15px] font-bold text-foreground">{c.name}</td>
                      <td className="p-4 text-[15px] font-[700] text-foreground font-number">{c.cost}</td>
                      <td className="p-4 text-[15px] font-[700] text-foreground font-number">{c.rent}</td>
                      <td className="p-4 text-[15px] text-foreground">{c.hospital}</td>
                      <td className="p-4 text-[15px] text-foreground">{c.community}</td>
                      <td className="p-4 text-[15px] text-muted-foreground">{c.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 섹션 6: 현지 서비스 (다낭만) / 준비중 안내 */}
        {data.hasServices ? (
          <section className="py-20 bg-muted/50">
            <div className="container">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-[28px] md:text-[32px] font-[800] text-foreground">다낭 현지 서비스</h2>
                <a href="#" className="text-[15px] font-medium text-primary hover:underline flex items-center gap-1">
                  전체 업체 보기 <ArrowRight size={14} />
                </a>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {retireServices.map((s) => (
                  <div key={s.name} className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3">
                      <span className="text-[56px] leading-none">{s.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-muted-foreground">{s.category}</p>
                        <h3 className="text-[18px] font-bold text-foreground">{s.name}</h3>
                      </div>
                    </div>
                    <p className="mt-3 text-[15px] text-muted-foreground leading-relaxed">{s.desc}</p>
                    {s.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {s.tags.map((tag) => (
                          <span key={tag} className="px-2 py-0.5 text-[13px] rounded-full bg-accent text-accent-foreground font-medium">{tag}</span>
                        ))}
                      </div>
                    )}
                    {s.verified && <p className="mt-3 text-[13px] text-muted-foreground">✓ 운영자 확인 {s.verified}</p>}
                    {s.cta && (
                      <a href="#" className="inline-flex items-center gap-1 mt-3 text-[15px] font-medium text-primary hover:underline">
                        {s.cta}
                      </a>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[13px] text-muted-foreground text-center">※ 유료 등록 업체 포함</p>
            </div>
          </section>
        ) : (
          <section className="py-20 bg-muted/50">
            <div className="container text-center">
              <p className="text-[16px] text-muted-foreground">
                이 도시의 검증 업체는 준비 중입니다.
              </p>
              <button
                onClick={() => setActiveCity("다낭")}
                className="inline-flex items-center gap-1 mt-3 text-[15px] font-medium text-primary hover:underline"
              >
                다낭 현지 서비스 보기 <ArrowRight size={14} />
              </button>
            </div>
          </section>
        )}

        {/* 섹션 7: 가이드 (다낭만) */}
        {data.hasServices && (
          <section className="py-20 bg-background">
            <div className="container">
              <h2 className="text-[28px] md:text-[32px] font-[800] text-foreground mb-8">다낭 장기체류 가이드</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {retireGuides.map((g) => (
                  <Link
                    key={g.title}
                    to={g.link}
                    className="bg-card rounded-xl border border-border p-5 hover:shadow-md hover:-translate-y-1 transition-all duration-200 group"
                  >
                    <span className="text-[48px] leading-none">{g.icon}</span>
                    <h3 className="text-[18px] font-bold text-foreground mt-3">{g.title}</h3>
                    <p className="text-[15px] text-muted-foreground mt-1 leading-relaxed">{g.desc}</p>
                    <span className="inline-flex items-center gap-1 mt-3 text-[15px] font-medium text-primary group-hover:underline">
                      자세히 보기 <ArrowRight size={14} />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* 섹션 8: 뉴스레터 */}
        <section className="py-20 bg-primary">
          <div className="container max-w-xl text-center">
            <h2 className="text-[24px] md:text-[28px] font-bold text-primary-foreground">
              {activeCity} 장기체류 최신 정보
            </h2>
            <p className="mt-2 text-[16px] text-primary-foreground/80">
              비자 변경, 의료 정보, 생활비 변동 — 매주 월요일 보내드립니다
            </p>
            <div className="mt-6 flex gap-2">
              <input
                type="email"
                placeholder="이메일 주소"
                className="flex-1 px-4 py-3 text-[15px] bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20 rounded-lg text-primary-foreground placeholder:text-primary-foreground/50 outline-none focus:ring-2 focus:ring-primary-foreground/30"
              />
              <button className="px-6 py-3 text-[15px] font-semibold bg-primary-foreground text-primary rounded-lg hover:bg-primary-foreground/90 transition-colors">
                무료 구독
              </button>
            </div>
          </div>
        </section>

        {/* 출처·기준 */}
        <section className="py-10 bg-background border-t border-border">
          <div className="container">
            <h3 className="text-[16px] font-semibold text-foreground mb-3">이 페이지의 데이터 기준</h3>
            <ul className="space-y-1 text-[14px] text-muted-foreground">
              <li>생활비: Numbeo + {activeCity} 현지 확인 (2026.04)</li>
              <li>월세: 현지 부동산 에이전트 3곳 평균, 장기 계약(6개월+) 기준 (2026.04)</li>
              <li>의료보험: 현지 보험사 + 글로벌 보험(Cigna, Allianz) 견적 참조</li>
              <li>한국어 병원: 운영자 직접 확인 (2026.04)</li>
              <li>비자: 베트남 출입국관리국 (2023.08 시행, 2026.04 확인)</li>
              <li>환율: <span className="font-number">1$ ≈ ₩1,400</span></li>
            </ul>
            <p className="mt-2 text-[14px] text-muted-foreground">마지막 업데이트: 2026.04.09</p>
            <a href="/about/methodology" className="inline-flex items-center gap-1 mt-2 text-[14px] font-medium text-primary hover:underline">
              데이터 산출 기준 상세 <ArrowRight size={14} />
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Retire;
