import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAccommodations, type Accommodation } from "@/hooks/use-accommodations";
import { filtersFromSearchParams, filtersToSearchParams, type AccommodationFilters } from "@/lib/accommodation-filters";
import { INTENT_CONFIG, type Intent } from "@/lib/routes";
import { getSessionId } from "@/lib/session";
import { Trophy, Quote, Info, ExternalLink } from "lucide-react";

/* ── Ranking badges ── */
const rankings = [
  { label: "초보자 한달살기", winner: "다낭 🏆", isDanang: true },
  { label: "생활비 저렴함", winner: "다낭≈나트랑", isDanang: true },
  { label: "디지털노마드", winner: "다낭 🏆", isDanang: true },
  { label: "가족 동반", winner: "다낭 🏆", isDanang: true },
  { label: "혼자 여행자", winner: "다낭 🏆", isDanang: true },
  { label: "항공 접근성", winner: "다낭 🏆", isDanang: true },
  { label: "한인 인프라", winner: "호치민", isDanang: false },
  { label: "한인 많은 곳", winner: "호치민", isDanang: false },
];

/* ── Category anchors ── */
const categories = [
  { id: "all", label: "전체" },
  { id: "cost", label: "💰 생활비" },
  { id: "housing", label: "🏠 거주" },
  { id: "weather", label: "🌤 날씨" },
  { id: "community", label: "👥 커뮤니티" },
  { id: "transport", label: "✈️ 이동" },
];

const cities = ["다낭", "호치민", "하노이", "나트랑", "푸꾸옥"];

/* ── Table data ── */
const costData = [
  { item: "원룸 월세", values: ["33~83만원", "28~110만원", "36~101만원", "28~87만원", "40~95만원"], best: 3 },
  { item: "서비스 아파트", values: ["55~120만원", "65~140만원", "60~130만원", "50~100만원", "70~160만원"], best: 3 },
  { item: "한달 식비", values: ["35~70만원", "40~80만원", "40~75만원", "35~70만원", "45~85만원"], best: 0 },
  { item: "그랩 교통비/월", values: ["8~14만원", "10~18만원", "10~17만원", "8~14만원", "11~19만원"], best: 0 },
  { item: "한인 클리닉 초진", values: ["3~6만원", "3~8만원", "3~7만원", "3~6만원", "4~8만원"], best: 0 },
  { item: "LTE 유심/월", values: ["0.5~1.4만원", "0.5~1.1만원", "0.5~1.4만원", "0.5~1.9만원", "0.6~1.2만원"], best: 1 },
];

const housingData = [
  { item: "무비자 체류", values: ["45일", "45일", "45일", "45일", "45일"], best: -1 },
  { item: "장기 비자", values: ["90일 e-visa", "동일", "동일", "동일", "동일"], best: -1 },
  { item: "e-visa 비용", values: ["단수 $25 / 복수 $50", "동일", "동일", "동일", "동일"], best: -1 },
  { item: "원룸 임대 용이성", values: ["⭐⭐⭐ 쉬움", "⭐⭐ 보통", "⭐⭐ 보통", "⭐⭐ 보통", "⭐ 어려움"], best: 0 },
  { item: "한인 병원/클리닉", values: ["3~5곳", "8곳+", "5~7곳", "1~3곳", "0~1곳"], best: 1 },
  { item: "한인 마트", values: ["있음", "많음", "많음", "있음", "제한적"], best: 1 },
];

const weatherData = [
  { item: "최적 방문 시기", values: ["2~5월", "12~3월", "10~4월", "1~8월", "12~3월"], best: -1 },
  { item: "우기 기간", values: ["9~12월", "5~11월", "5~9월", "9~12월", "5~10월"], best: -1 },
  { item: "연평균 기온", values: ["약 26도", "약 28도", "약 24도", "약 27도", "약 27~28도"], best: -1 },
  { item: "태풍 주의 시기", values: ["9~12월 집중", "거의 없음", "보통", "보통", "거의 없음"], best: -1, danangTooltip: "9~12월 외 기간은 맑고 쾌청해요. 한달살기는 2~5월을 추천드려요." },
];

const communityData = [
  { item: "한인 거주자 수", values: ["1만~2만명", "약 10만명", "3만~5만명", "2천~5천명", "1천명 미만"], best: 1 },
  { item: "카카오채팅 활성도", values: ["활발", "활발", "활발", "보통", "보통~낮음"], best: -1 },
  { item: "한인 소모임 빈도", values: ["주간", "주간", "월~주간", "월간", "거의 없음"], best: 0 },
  { item: "노마드 커뮤니티", values: ["활발", "활발", "보통", "보통", "소규모"], best: 0 },
];

const transportData = [
  { item: "인천 직항", values: ["✅", "✅", "✅", "✅", "✅"], best: -1 },
  { item: "비행시간 (직항)", values: ["약 4h 40m", "약 4h 45m", "약 5h 20m", "약 5h", "약 5h 30m"], best: 0 },
  { item: "편도 항공권 평균", values: ["10~25만원", "11~27만원", "9~24만원", "7~22만원", "11~28만원"], best: 3 },
  { item: "도시 내 이동 편의", values: ["⭐⭐⭐ 좋음", "⭐⭐ 복잡함", "⭐⭐ 보통", "⭐⭐ 보통", "⭐ 불편"], best: 0 },
];

const overallData = [
  { item: "초보자 난이도", values: ["⭐ 쉬움", "⭐⭐ 보통", "⭐⭐⭐ 어려움", "⭐ 쉬움", "⭐⭐ 보통"], best: 0 },
  { item: "혼자 여행자 적합", values: ["⭐⭐⭐ 높음", "⭐⭐⭐ 높음", "⭐⭐ 보통", "⭐⭐ 보통", "⭐⭐ 보통"], best: 0 },
  { item: "가족 동반 적합", values: ["⭐⭐⭐ 높음", "⭐⭐ 보통", "⭐⭐ 보통", "⭐⭐⭐ 높음", "⭐⭐ 보통"], best: 0 },
  { item: "한줄 평가", values: ["가장 균형 좋음", "인프라 최고, 피로도 큼", "문화형, 초보엔 어려움", "조용한 휴양형", "자연 좋지만 불편"], best: 0 },
];

/* ── Reviews ── */
const cityColors: Record<string, string> = {
  다낭: "#3B82F6",
  호치민: "#EF4444",
  하노이: "#10B981",
  나트랑: "#F59E0B",
  푸꾸옥: "#8B5CF6",
};

const reviews = [
  { city: "다낭", text: "미케비치 서비스 아파트 한 달 살았는데,\n아침에 바다 보면서 커피 마시는 게 일상이 됐어요.\n혼자인데 전혀 외롭지 않았고, 한인 모임도 주간으로 있어서 사람 만나기도 좋았어요.", link: "https://blog.naver.com/infocurator_/223827058458", linkText: "다낭 한달살기 후기 원문 보기" },
  { city: "다낭", text: "아이 둘 데리고 한 달 있었는데 생각보다 훨씬 수월했어요.\n그랩 부르면 5분 내로 오고, 한인 마트도 있어서 한국 음식도 해먹었거든요.\n다낭이 가족 첫 한달살기 도시로 딱이라는 걸 느꼈어요.", link: "https://m.blog.naver.com/hahahoho715/224106254891", linkText: "다낭 한달살기 후기 원문 보기" },
  { city: "호치민", text: "혼자 한 달 살면서 총 160만원 썼어요.\n숙소 70만원짜리 깔끔한 원룸 구했고, 나머지는 식비랑 교통비.\n다낭보다 물가 좀 높지만 즐길 거리가 훨씬 많아요.", link: "https://blog.naver.com/hyoyeol/224124726343", linkText: "호치민 한달살기 후기 원문 보기" },
  { city: "호치민", text: "한달살기 도시 중에 인프라는 호치민이 압도적이에요.\n한인 마트, 한식당, 병원까지 다 갖춰져 있어서 불편함이 없었고요.\n다만 교통이 복잡해서 그랩 없이는 이동이 힘들어요.", link: "https://blog.naver.com/hi60s/223936992531", linkText: "호치민 한달살기 후기 원문 보기" },
  { city: "하노이", text: "하노이는 다낭보다 문화적인 깊이가 달라요.\n구시가지 골목 카페에서 작업하는 게 너무 좋았고,\n사계절 있어서 선선할 때 가면 생활하기 딱이에요.", link: "https://m.blog.naver.com/viola520/223338917693", linkText: "하노이 한달살기 후기 원문 보기" },
  { city: "하노이", text: "한달살기 초보라면 하노이는 추천 안 해요.\n오토바이가 워낙 많고 교통이 복잡해서 처음엔 적응이 좀 걸렸거든요.\n대신 익숙해지면 진짜 베트남 느낌 제대로 즐길 수 있어요.", link: "https://blog.naver.com/pnmiro1/223612413254", linkText: "하노이 한달살기 후기 원문 보기" },
  { city: "나트랑", text: "나트랑은 정말 조용해요. 한인이 많지 않아서 오히려 현지 감성이 살아있고,\n바다도 다낭보다 맑은 편이에요. 혼자 힐링하러 가기엔 최고였어요.", link: "https://blog.naver.com/seungmin7605/223924564772", linkText: "나트랑 한달살기 후기 원문 보기" },
  { city: "나트랑", text: "물가는 베트남 5개 도시 중 제일 저렴한 편이에요.\n원룸 40만원대에 구했고, 식비도 다낭보다 확실히 적게 들었어요.\n단점이라면 한인 커뮤니티가 거의 없다는 것.", link: "https://m.blog.naver.com/jjw12181office/223711132197", linkText: "나트랑 한달살기 후기 원문 보기" },
  { city: "푸꾸옥", text: "아이랑 한 달 지냈는데 풀빌라 숙소가 정말 좋았어요.\n그랜드월드 가면 아이가 하루 종일 놀 수 있고,\n섬이라 물도 맑고 공기도 달라요. 가족 여행지로 강추예요.", link: "https://blog.naver.com/wlsdhsla34/223857542399", linkText: "푸꾸옥 한달살기 후기 원문 보기" },
  { city: "푸꾸옥", text: "자연은 베트남 최고인데 생활 편의성이 아쉬워요.\n마트가 멀고, 이동은 거의 스쿠터 의존이라서\n운전 못 하면 좀 불편할 수 있어요. 차분한 분들께 추천.", link: "https://blog.naver.com/leelee9707/224101113073", linkText: "푸꾸옥 한달살기 후기 원문 보기" },
];

/* ── Comparison Table Component ── */
function CompareTable({
  rows,
  note,
}: {
  rows: { item: string; values: string[]; best: number; danangTooltip?: string }[];
  note?: string;
}) {
  return (
    <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
      <table className="w-full min-w-[700px] text-sm border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-3 px-3 font-semibold text-muted-foreground w-[140px]">항목</th>
            {cities.map((c, i) => (
              <th
                key={c}
                className={`text-center py-3 px-3 font-bold ${i === 0 ? "bg-[#EFF6FF]" : ""}`}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
              <td className="py-3 px-3 font-medium text-muted-foreground">{row.item}</td>
              {row.values.map((v, ci) => (
                <td
                  key={ci}
                  className={`text-center py-3 px-3 ${ci === 0 ? "bg-[#EFF6FF]" : ""} ${ci === row.best ? "font-bold text-foreground" : "text-foreground/80"}`}
                >
                  {ci === 0 && row.danangTooltip ? (
                    <span className="inline-flex items-center gap-1">
                      {v}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info size={14} className="text-muted-foreground cursor-help inline" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[240px]">{row.danangTooltip}</TooltipContent>
                      </Tooltip>
                    </span>
                  ) : (
                    v
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {note && <p className="text-xs text-muted-foreground mt-3">{note}</p>}
    </div>
  );
}

/* ── Review Card ── */
function ReviewCard({ review }: { review: (typeof reviews)[0] }) {
  return (
    <Card className="bg-[#F9FAFB] border-0 p-6 relative">
      <Quote size={28} className="absolute top-4 left-4" style={{ color: cityColors[review.city], opacity: 0.3 }} />
      <div className="pt-6">
        <p className="text-base leading-7 whitespace-pre-line text-foreground/90">{review.text}</p>
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/40">
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-full text-white"
            style={{ backgroundColor: cityColors[review.city] }}
          >
            {review.city}
          </span>
          <a
            href={review.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
          >
            {review.linkText} <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </Card>
  );
}

/* ── Page ── */
const sections = [
  { id: "cost", emoji: "💰", title: "생활비", data: costData, note: "환율 기준: 1,000,000 VND ≈ 5.5만원 / 출처: Numbeo, Nomads.com" },
  { id: "housing", emoji: "🏠", title: "거주 & 비자", data: housingData },
  { id: "weather", emoji: "🌤", title: "날씨", data: weatherData },
  { id: "community", emoji: "👥", title: "커뮤니티", data: communityData },
  { id: "transport", emoji: "✈️", title: "이동", data: transportData },
  { id: "overall", emoji: "🏅", title: "종합 평가", data: overallData },
];

const districtOptions = ["My Khe", "An Thuong", "Son Tra", "City Center"];
const typeOptions = [
  { value: "", label: "전체 유형" },
  { value: "hotel", label: "호텔" },
  { value: "resort", label: "리조트" },
  { value: "apartment", label: "아파트" },
  { value: "villa", label: "빌라" },
  { value: "guesthouse", label: "게스트하우스" },
];

const CITY_PARAM_LABELS: Record<string, string> = {
  hochiminh: "호치민",
  hanoi: "하노이",
  danang: "다낭",
  nhatrang: "나트랑",
  phuquoc: "푸꾸옥",
};

export default function Compare() {
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [searchParams, setSearchParams] = useSearchParams();
  const intentParam = searchParams.get("intent") || "";
  const intent = (intentParam || "") as Intent | "";
  const preset = useMemo(() => {
    if (intent && INTENT_CONFIG[intent]) return INTENT_CONFIG[intent];
    return null;
  }, [intent]);
  const [sessionId] = useState(() => getSessionId());
  const [filters, setFilters] = useState<AccommodationFilters>(() => filtersFromSearchParams(searchParams));
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareItems, setCompareItems] = useState<Accommodation[]>([]);
  const [commonAmenities, setCommonAmenities] = useState<string[]>([]);
  const [compareLoading, setCompareLoading] = useState(false);
  const { data: accommodations, total, loading, error } = useAccommodations(filters);
  const cityParam = searchParams.get("city") || "";
  const budgetParam = searchParams.get("budget");
  const queryParam = searchParams.get("q") || "";
  const compareCityLabel = CITY_PARAM_LABELS[cityParam] || "다낭";

  const scrollTo = (id: string) => {
    if (id === "all") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    setFilters(filtersFromSearchParams(searchParams));
  }, [searchParams]);

  useEffect(() => {
    const nextParams = new URLSearchParams();
    const filterParams = filtersToSearchParams(filters);

    if (intentParam) nextParams.set("intent", intentParam);
    if (queryParam) nextParams.set("q", queryParam);
    if (cityParam) nextParams.set("city", cityParam);
    if (budgetParam) nextParams.set("budget", budgetParam);

    filterParams.forEach((value, key) => nextParams.set(key, value));
    setSearchParams(nextParams, { replace: true });
  }, [budgetParam, cityParam, filters, intentParam, queryParam, setSearchParams]);

  useEffect(() => {
    if (!budgetParam) return;

    const parsedBudget = Number(budgetParam);
    if (!Number.isFinite(parsedBudget) || parsedBudget <= 0) return;

    const nightlyBudget = Math.max(20, Math.min(200, Math.round(parsedBudget / 3)));
    setFilters((current) => (current.priceMax === nightlyBudget ? current : { ...current, priceMax: nightlyBudget }));
  }, [budgetParam]);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => accommodations.some((item) => item.id === id)));
  }, [accommodations]);

  useEffect(() => {
    if (!compareOpen || selectedIds.length < 2) return;

    const controller = new AbortController();
    setCompareLoading(true);

    fetch(`/api/accommodations/compare?ids=${selectedIds.join(",")}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to compare accommodations: ${response.status}`);
        }
        return response.json() as Promise<{ items: Accommodation[]; common_amenities: string[] }>;
      })
      .then((payload) => {
        setCompareItems(payload.items);
        setCommonAmenities(payload.common_amenities);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          console.error(err);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setCompareLoading(false);
        }
      });

    return () => controller.abort();
  }, [compareOpen, selectedIds]);

  const updateFilters = (patch: Partial<AccommodationFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
  };

  const toggleCompareSelection = (id: number, checked: boolean) => {
    setSelectedIds((current) => {
      if (checked) {
        if (current.includes(id) || current.length >= 4) return current;
        return [...current, id];
      }
      return current.filter((value) => value !== id);
    });
  };

  const handleAgodaClick = async (acc: Accommodation) => {
    if (!acc.agoda_url) return;

    try {
      await fetch("/api/affiliate/click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          partner: "agoda",
          target_type: "accommodation",
          target_id: acc.id,
        }),
      });
    } catch (err) {
      console.error(err);
    }

    window.open(acc.agoda_url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {preset && (
        <section className={`${preset.bgClass} py-12 text-white`}>
          <div className="mx-auto max-w-7xl px-4">
            <div className={`mb-3 inline-block rounded-full px-3 py-1 text-xs font-semibold ${preset.badgeColor}`}>
              {preset.label}
            </div>
            <h1 className="mb-3 text-3xl font-bold md:text-4xl lg:text-5xl">
              {preset.heroTitle}
            </h1>
            <p className="text-base text-white/85 md:text-lg">{preset.heroSubtitle}</p>
          </div>
        </section>
      )}

      {/* ── Header ── */}
      {!preset && (
        <header className="bg-card border-b border-border">
          <div className="container py-12 md:py-16 text-center">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">베트남 5개 도시 한달살기 비교</h1>
            <p className="mt-3 text-muted-foreground text-base md:text-lg">
              다낭 · 호치민 · 하노이 · 나트랑 · 푸꾸옥 — 실거주 데이터 기준
            </p>
          </div>
        </header>
      )}

      <section className="container py-8 space-y-6">
        <Card className="p-4 md:p-6 border">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
            <div>
              <h2 className="text-xl font-bold text-foreground">{compareCityLabel} 숙소 비교</h2>
              <p className="text-sm text-muted-foreground mt-1">가격대와 지역을 맞춰서 Agoda 예약 링크까지 바로 확인할 수 있습니다.</p>
              {queryParam ? <p className="mt-1 text-xs text-muted-foreground">검색어: {queryParam}</p> : null}
            </div>
            <div className="text-sm text-muted-foreground">
              {loading ? "불러오는 중..." : `${total}개 숙소`}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <label className="text-sm">
              <span className="block text-muted-foreground mb-1">지역</span>
              <select
                value={filters.district ?? ""}
                onChange={(event) => updateFilters({ district: event.target.value || undefined })}
                className="w-full h-10 rounded-md border border-input bg-background px-3"
              >
                <option value="">전체 지역</option>
                {districtOptions.map((district) => (
                  <option key={district} value={district}>{district}</option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="block text-muted-foreground mb-1">유형</span>
              <select
                value={filters.type ?? ""}
                onChange={(event) => updateFilters({ type: (event.target.value || undefined) as AccommodationFilters["type"] })}
                className="w-full h-10 rounded-md border border-input bg-background px-3"
              >
                {typeOptions.map((option) => (
                  <option key={option.label} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="block text-muted-foreground mb-1">최대 1박 가격 ${filters.priceMax ?? 100}</span>
              <input
                type="range"
                min="20"
                max="200"
                step="5"
                value={filters.priceMax ?? 100}
                onChange={(event) => updateFilters({ priceMax: Number(event.target.value) })}
                className="w-full mt-2"
              />
            </label>

            <label className="text-sm">
              <span className="block text-muted-foreground mb-1">정렬</span>
              <select
                value={filters.sort ?? "price_asc"}
                onChange={(event) => updateFilters({ sort: event.target.value as AccommodationFilters["sort"] })}
                className="w-full h-10 rounded-md border border-input bg-background px-3"
              >
                <option value="price_asc">가격 낮은 순</option>
                <option value="price_desc">가격 높은 순</option>
                <option value="rating_desc">평점 높은 순</option>
              </select>
            </label>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap mt-4">
            <p className="text-xs text-muted-foreground">제휴 링크 포함. 예약 전에 최종 `cid` 값은 실제 Agoda 파트너 ID로 확인이 필요합니다.</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCompareOpen(true)}
              disabled={selectedIds.length < 2}
            >
              비교하기 {selectedIds.length > 0 ? `(${selectedIds.length}/4)` : ""}
            </Button>
          </div>
        </Card>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {accommodations.map((acc) => (
            <Card key={acc.id} className="overflow-hidden border">
              {acc.thumbnail_url && (
                <img
                  src={acc.thumbnail_url}
                  alt={acc.name}
                  className="w-full h-44 object-cover"
                />
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <Badge variant="secondary">{acc.district}</Badge>
                      <Badge variant="outline">{acc.type}</Badge>
                    </div>
                    <h3 className="font-bold text-foreground">{acc.name_ko || acc.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      ${acc.price_min_usd}~${acc.price_max_usd} / 1박
                      {typeof acc.rating === "number" && ` · 평점 ${acc.rating.toFixed(1)}`}
                    </p>
                  </div>
                  <Checkbox
                    checked={selectedIds.includes(acc.id)}
                    onCheckedChange={(checked) => toggleCompareSelection(acc.id, checked === true)}
                    aria-label={`${acc.name} compare`}
                  />
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                  {acc.amenities.slice(0, 5).map((amenity) => (
                    <span key={amenity} className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                      {amenity}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between mt-4">
                  <span className="text-xs text-muted-foreground">
                    월 예상 ${acc.price_monthly_usd ?? acc.price_min_usd * 20}
                  </span>
                  <Button
                    type="button"
                    onClick={() => void handleAgodaClick(acc)}
                    disabled={!acc.agoda_url}
                    className="bg-[#3B82F6] hover:bg-[#2563EB] text-white"
                  >
                    Agoda에서 보기
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Ranking Badges ── */}
      <section className="bg-card border-b border-border">
        <div className="container py-6">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
            {rankings.map((r) => (
              <div
                key={r.label}
                className={`flex-shrink-0 snap-start rounded-xl px-5 py-3.5 text-center min-w-[160px] ${
                  r.isDanang ? "border-[3px] border-[#3B82F6] bg-[#EFF6FF]" : "border-2 border-border bg-card"
                }`}
              >
                <p className="text-xs text-muted-foreground font-medium">{r.label}</p>
                <p className="text-sm font-bold mt-1 text-foreground">{r.winner}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Anchor Tabs ── */}
      <div className="sticky top-16 z-40 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="container py-3">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => scrollTo(cat.id)}
                className="flex-shrink-0 px-4 py-2 text-sm font-semibold rounded-lg border border-border bg-background hover:bg-muted hover:text-primary transition-colors"
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Table Sections ── */}
      <div className="container py-8 space-y-12">
        {sections.map((sec) => (
          <section
            key={sec.id}
            ref={(el: HTMLDivElement | null) => { sectionRefs.current[sec.id] = el; }}
            className="scroll-mt-32"
          >
            <h2 className="text-xl font-bold text-foreground mb-4">
              {sec.emoji} {sec.title}
            </h2>
            <Card className="p-4 md:p-6 border">
              <CompareTable rows={sec.data} note={sec.note} />
            </Card>
          </section>
        ))}
      </div>

      {/* ── Reviews ── */}
      <section className="bg-muted/30 border-t border-border">
        <div className="container py-12 md:py-16">
          <h2 className="text-2xl font-bold text-foreground text-center">실제로 살아본 사람들의 이야기</h2>
          <p className="text-muted-foreground text-center mt-2 mb-8">럭키다낭이 직접 검증한 네이버 블로그 후기</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reviews.map((r, i) => (
              <ReviewCard key={i} review={r} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center mt-6">
            ※ 각 후기는 실거주자가 작성한 네이버 블로그 원문으로 연결됩니다.
          </p>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="bg-[#1A1A2E]">
        <div className="container py-12 md:py-16 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-xl md:text-2xl font-bold text-white">다낭이 가장 균형 잡힌 선택이에요</h3>
            <p className="text-white/60 mt-1">한달살기 첫 도전이라면, 다낭부터 시작해보세요.</p>
          </div>
          <div className="flex gap-3">
            <Button asChild className="bg-[#3B82F6] hover:bg-[#2563EB] text-white">
              <a href="/planner">한달살기 플래너 →</a>
            </Button>
            <Button asChild variant="outline" className="border-white/30 text-white hover:bg-white/10">
              <a href="/directory">다낭 업체 찾기 →</a>
            </Button>
          </div>
        </div>
      </section>

      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>숙소 비교</DialogTitle>
          </DialogHeader>
          {compareLoading ? (
            <p className="text-sm text-muted-foreground">비교 데이터를 불러오는 중입니다.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {commonAmenities.map((amenity) => (
                  <Badge key={amenity} variant="secondary">{amenity}</Badge>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-2 font-semibold">항목</th>
                      {compareItems.map((item) => (
                        <th key={item.id} className="text-left py-3 px-2 font-semibold">{item.name_ko || item.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border/50">
                      <td className="py-3 px-2 text-muted-foreground">지역</td>
                      {compareItems.map((item) => <td key={item.id} className="py-3 px-2">{item.district}</td>)}
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-3 px-2 text-muted-foreground">가격</td>
                      {compareItems.map((item) => <td key={item.id} className="py-3 px-2">${item.price_min_usd}~${item.price_max_usd}</td>)}
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-3 px-2 text-muted-foreground">월 예상</td>
                      {compareItems.map((item) => <td key={item.id} className="py-3 px-2">${item.price_monthly_usd ?? "-"}</td>)}
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-3 px-2 text-muted-foreground">평점</td>
                      {compareItems.map((item) => <td key={item.id} className="py-3 px-2">{item.rating?.toFixed(1) ?? "-"}</td>)}
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-3 px-2 text-muted-foreground">편의시설</td>
                      {compareItems.map((item) => (
                        <td key={item.id} className="py-3 px-2">{item.amenities.join(", ")}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
