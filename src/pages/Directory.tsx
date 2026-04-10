import { useState, useRef, lazy, Suspense } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { MapPin, Phone, ExternalLink, List, Map } from "lucide-react";

const DirectoryMap = lazy(() => import("@/components/DirectoryMap"));

type Category = "전체" | "숙소" | "병원" | "한식당" | "부동산" | "비자" | "마트";

interface Business {
  name: string;
  category: Exclude<Category, "전체">;
  location?: string;
  price?: string;
  contact?: string;
  korean: string;
  googleMap?: string;
  extra?: string;
  extraBadge?: string;
  specialty?: string;
  menu?: string;
  feature?: string;
  service?: string;
}

const categoryTabs: { label: string; value: Category }[] = [
  { label: "전체", value: "전체" },
  { label: "🏨 숙소", value: "숙소" },
  { label: "🏥 병원", value: "병원" },
  { label: "🍖 한식당", value: "한식당" },
  { label: "🏠 부동산", value: "부동산" },
  { label: "📋 비자", value: "비자" },
  { label: "🛒 마트", value: "마트" },
];

const categoryColors: Record<Exclude<Category, "전체">, string> = {
  숙소: "bg-[hsl(217,91%,60%)] text-white",
  병원: "bg-[hsl(0,84%,60%)] text-white",
  한식당: "bg-[hsl(38,92%,50%)] text-white",
  부동산: "bg-[hsl(160,60%,45%)] text-white",
  비자: "bg-[hsl(258,90%,66%)] text-white",
  마트: "bg-[hsl(220,9%,46%)] text-white",
};

const businesses: Business[] = [
  // 숙소
  { name: "Monarque Hotel Danang", category: "숙소", location: "미케비치 / 손짜", price: "약 5~10만원/박", contact: "+84 236 3588 888", korean: "문의", googleMap: "https://www.google.com/maps/search/?api=1&query=Monarque%20Hotel%20Danang" },
  { name: "Chicland Hotel Danang Beach", category: "숙소", location: "보응우옌잡 / 손짜", price: "약 7~14만원/박", contact: "+84 236 2232 222", korean: "문의", googleMap: "https://www.google.com/maps/search/?api=1&query=Chicland%20Hotel%20Danang%20Beach" },
  { name: "Altara Suites by Ri-Yaz", category: "숙소", location: "보응우옌잡 / 손짜", price: "약 6~12만원/박, 장기 별도문의", contact: "+84 236 268 7979", korean: "문의", googleMap: "https://www.google.com/maps/search/?api=1&query=Altara%20Suites%20Da%20Nang", extraBadge: "장기체류 추천" },
  { name: "Sanouva Danang Hotel", category: "숙소", location: "판쩌우찐 / 하이쩌우", price: "약 4~9만원/박", contact: "+84 236 3823 468", korean: "문의", googleMap: "https://www.google.com/maps/search/?api=1&query=Sanouva%20Danang%20Hotel" },
  // 병원
  { name: "Family Medical Practice Da Nang", category: "병원", location: "응우옌반린 / 하이쩌우", specialty: "가정의학, 일반진료, 소아, 응급", contact: "+84 23 6358 2699", korean: "부분가능 (통역문의)", googleMap: "https://www.google.com/maps/search/?api=1&query=Family%20Medical%20Practice%20Da%20Nang" },
  { name: "Family Hospital Da Nang", category: "병원", location: "응우옌흐우토 / 하이쩌우", specialty: "내과, 외과, 응급, 영상, 종합검진", contact: "0236 3632 111", korean: "부분가능 (통역문의)", googleMap: "https://www.google.com/maps/search/?api=1&query=Family%20Hospital%20Da%20Nang" },
  { name: "Hoan My Da Nang Hospital", category: "병원", location: "응우옌반린 / 하이쩌우", specialty: "내과, 외과, 산부인과, 응급", contact: "0236 3650 676", korean: "부분가능 (통역문의)", googleMap: "https://www.google.com/maps/search/?api=1&query=Hoan%20My%20Da%20Nang%20Hospital" },
  { name: "Vinmec Da Nang International Hospital", category: "병원", location: "다낭 국제병원권", specialty: "국제진료, 검진, 내외과, 소아", contact: "문의 필요", korean: "부분가능 (국제병원)", googleMap: "https://www.google.com/maps/search/?api=1&query=Vinmec%20Da%20Nang%20International%20Hospital" },
  // 한식당
  { name: "GoGi House Vincom Plaza", category: "한식당", location: "빈컴플라자 / 손짜", menu: "삼겹살, 소고기 세트", price: "약 9천~2.5만원/인", korean: "가능", googleMap: "https://www.google.com/maps/search/?api=1&query=GoGi%20House%20Vincom%20Plaza%20Da%20Nang" },
  { name: "Dookki Vincom Plaza", category: "한식당", location: "빈컴플라자 / 손짜", menu: "떡볶이 무한리필", price: "약 8천~1.1만원/인", korean: "가능", googleMap: "https://www.google.com/maps/search/?api=1&query=Dookki%20Vincom%20Plaza%20Da%20Nang" },
  { name: "KOGI BBQ Da Nang", category: "한식당", location: "안트엉 / 미안", menu: "한식 바비큐, 삼겹살", price: "약 1.1만~2.8만원/인", korean: "가능", googleMap: "https://www.google.com/maps/search/?api=1&query=KOGI%20BBQ%20Da%20Nang" },
  { name: "BHC Chicken Da Nang", category: "한식당", location: "안트엉 / 미안", menu: "후라이드, 양념치킨", price: "약 8천~1.9만원/인", korean: "가능", googleMap: "https://www.google.com/maps/search/?api=1&query=BHC%20Chicken%20Da%20Nang" },
  // 부동산
  { name: "First Real", category: "부동산", specialty: "다낭, 하이쩌우, 해안권 프로젝트", contact: "1900 633 034", korean: "가능", googleMap: "https://www.google.com/maps/search/?api=1&query=First%20Real%20Da%20Nang" },
  { name: "Dat Xanh Mien Trung", category: "부동산", specialty: "다낭, 중부권 분양/중개", contact: "1900 63 68 79", korean: "가능", googleMap: "https://www.google.com/maps/search/?api=1&query=Dat%20Xanh%20Mien%20Trung%20Da%20Nang" },
  { name: "Rever", category: "부동산", specialty: "다낭 포함 전국 아파트/주거", contact: "1800 234 546", korean: "가능", googleMap: "https://www.google.com/maps/search/?api=1&query=Rever%20Da%20Nang" },
  // 비자
  { name: "Visa5s", category: "비자", service: "e-visa, VOA, 연장/초청", contact: "0944 555 010", korean: "가능" },
  { name: "Vietnam-Visa", category: "비자", service: "e-visa, VOA, 한국인 안내", contact: "info@vietnam-visa.com", korean: "가능" },
  { name: "Visana", category: "비자", service: "e-visa, urgent visa, 비즈니스 비자", contact: "1900 3498", korean: "가능" },
  // 마트
  { name: "K-Market / Kmart", category: "마트", location: "안트엉 / 미안", feature: "한국 식재료, 라면, 반찬, 생활용품", korean: "가능", googleMap: "https://www.google.com/maps/search/?api=1&query=K-Market%20An%20Thuong%20Da%20Nang" },
  { name: "Lotte Mart Da Nang", category: "마트", location: "하이쩌우 / 호아끄엉", feature: "대형마트, 식품관, 생활용품", korean: "가능", googleMap: "https://www.google.com/maps/search/?api=1&query=Lotte%20Mart%20Da%20Nang" },
  { name: "MM Mega Market Da Nang", category: "마트", location: "창고형마트권", feature: "대용량 식재료, 수입식품, 사업자 구매 강점", korean: "가능", googleMap: "https://www.google.com/maps/search/?api=1&query=MM%20Mega%20Market%20Da%20Nang" },
];

const Directory = () => {
  const [activeCategory, setActiveCategory] = useState<Category>("전체");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const ctaRef = useRef<HTMLDivElement>(null);

  const filtered = activeCategory === "전체" ? businesses : businesses.filter((b) => b.category === activeCategory);

  const getDescription = (b: Business) => {
    if (b.specialty) return b.specialty;
    if (b.menu) return b.menu;
    if (b.service) return b.service;
    if (b.feature) return b.feature;
    return b.price || "";
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Header */}
      <section className="bg-card border-b border-border">
        <div className="container py-10 md:py-14">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h1 className="text-[28px] md:text-[36px] font-[800] text-foreground">다낭 한인 업체 찾기</h1>
              <p className="mt-2 text-[15px] text-muted-foreground">한국인이 검증한 다낭 현지 업체 모음</p>
            </div>
            <button
              onClick={() => ctaRef.current?.scrollIntoView({ behavior: "smooth" })}
              className="self-start md:self-auto px-5 py-2.5 text-[15px] font-bold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              내 업체 등록하기 →
            </button>
          </div>
        </div>
      </section>

      {/* View Toggle */}
      <div className="container flex gap-2 pt-6 pb-2">
        <button
          onClick={() => setViewMode("list")}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[14px] font-bold transition-colors ${
            viewMode === "list"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          }`}
        >
          <List size={15} /> 리스트 보기
        </button>
        <button
          onClick={() => setViewMode("map")}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[14px] font-bold transition-colors ${
            viewMode === "map"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          }`}
        >
          <Map size={15} /> 지도 보기
        </button>
      </div>

      {/* Category Tabs */}
      <div className="sticky top-16 z-40 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="container flex gap-1 overflow-x-auto py-3 scrollbar-hide">
          {categoryTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveCategory(tab.value)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-[14px] font-bold transition-colors ${
                activeCategory === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Map View */}
      {viewMode === "map" && (
        <section className="container py-10">
          <Suspense fallback={<div className="w-full h-[400px] md:h-[600px] rounded-xl bg-muted animate-pulse" />}>
            <DirectoryMap activeCategory={activeCategory} />
          </Suspense>
        </section>
      )}

      {/* Cards Grid */}
      {viewMode === "list" && (
      <section className="container py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((b) => (
            <div
              key={b.name}
              className="bg-card rounded-xl border border-border p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <span className={`px-2.5 py-0.5 text-[12px] font-bold rounded-full ${categoryColors[b.category]}`}>
                  {b.category}
                </span>
                {b.extraBadge && (
                  <span className="px-2.5 py-0.5 text-[12px] font-bold rounded-full bg-[hsl(160,60%,45%)] text-white">
                    {b.extraBadge}
                  </span>
                )}
              </div>

              <h3 className="text-[17px] font-bold text-foreground leading-snug">{b.name}</h3>

              {b.location && (
                <p className="mt-2 text-[14px] text-muted-foreground flex items-center gap-1">
                  <MapPin size={14} className="flex-shrink-0" /> {b.location}
                </p>
              )}

              <p className="mt-1.5 text-[14px] text-muted-foreground">{getDescription(b)}</p>

              {b.price && b.category !== "숙소" && (
                <p className="mt-1 text-[14px] text-foreground font-medium">{b.price}</p>
              )}
              {b.price && b.category === "숙소" && (
                <p className="mt-1 text-[14px] text-foreground font-medium">{b.price}</p>
              )}

              {b.contact && (
                <p className="mt-1.5 text-[13px] text-muted-foreground flex items-center gap-1">
                  <Phone size={13} className="flex-shrink-0" /> {b.contact}
                </p>
              )}

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                <span className="px-2.5 py-1 text-[12px] font-medium rounded-full bg-accent text-accent-foreground">
                  🇰🇷 한국어: {b.korean}
                </span>
                {b.googleMap && (
                  <a
                    href={b.googleMap}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"
                  >
                    구글맵 <ExternalLink size={13} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-6 text-[13px] text-muted-foreground text-center">
          ※ 업체 정보는 정기적으로 업데이트되며, 방문 전 연락처를 확인해주세요.
        </p>
      </section>

      {/* CTA Banner */}
      <div ref={ctaRef}>
        <section className="bg-[#1A1A2E] py-16">
          <div className="container flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h2 className="text-[24px] md:text-[28px] font-[800] text-white">우리 업체도 올리고 싶으신가요?</h2>
              <p className="mt-2 text-[15px] text-white/70">지금 등록하면 선착순 10곳 첫 달 무료예요.</p>
            </div>
            <a
              href="mailto:hello@luckydanang.com"
              className="px-6 py-3 text-[16px] font-bold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex-shrink-0"
            >
              등록 신청하기 →
            </a>
          </div>
        </section>
      </div>

      <Footer />
    </div>
  );
};

export default Directory;
