import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const cities = ["다낭", "호치민", "하노이", "나트랑", "푸꾸옥"];

const keyStats = [
  { label: "1인 월 생활비", value: "130만원", sub: "($930) · 렌트 제외" },
  { label: "원룸 월세", value: "49만원", sub: "($350) · 시내 기준" },
  { label: "비자", value: "90일", sub: "e-visa · 비자런 불필요" },
  { label: "직항", value: "4시간", sub: "인천-다낭 · 주 150편+" },
  { label: "한인 수", value: "약 7천명", sub: "한국 식당·마트 다수" },
  { label: "기후", value: "연평균 26°C", sub: "건기 2-8월 추천" },
];

const costRows = [
  { item: "숙소", budget: "35만원", budgetNote: "(원룸)", normal: "49만원", normalNote: "(아파트 방2)", premium: "84만원", premiumNote: "(서비스드)" },
  { item: "식비", budget: "21만원", budgetNote: "(로컬 위주)", normal: "35만원", normalNote: "(한식 반반)", premium: "56만원", premiumNote: "(외식 많이)" },
  { item: "교통", budget: "7만원", budgetNote: "(도보+그랩)", normal: "11만원", normalNote: "(오토바이)", premium: "21만원", premiumNote: "(자가용)" },
  { item: "통신", budget: "3만원", budgetNote: "", normal: "3만원", normalNote: "", premium: "3만원", premiumNote: "" },
  { item: "여가", budget: "14만원", budgetNote: "", normal: "21만원", normalNote: "", premium: "42만원", premiumNote: "" },
  { item: "보험", budget: "7만원", budgetNote: "", normal: "11만원", normalNote: "", premium: "14만원", premiumNote: "" },
];
const totals = { budget: "87만원", budgetUSD: "$620", normal: "130만원", normalUSD: "$930", premium: "220만원", premiumUSD: "$1,570" };

const cityComparison = [
  { name: "다낭", cost: "130만원", rent: "49만원", koreans: "약 7천명", note: "해변+한인타운. 균형잡힌 선택.", highlight: true },
  { name: "호치민", cost: "192만원", rent: "77만원", koreans: "약 10만명", note: "대도시. 인프라 최고. 비용 높음.", highlight: false },
  { name: "나트랑", cost: "112만원", rent: "42만원", koreans: "약 2천명", note: "가장 저렴. 조용한 해변.", highlight: false },
  { name: "하노이", cost: "168만원", rent: "70만원", koreans: "약 5만명", note: "사계절. 문화·역사 풍부.", highlight: false },
  { name: "푸꾸옥", cost: "133만원", rent: "56만원", koreans: "약 500명", note: "섬. 리조트 분위기. 한인 적음.", highlight: false },
];

const services = [
  { icon: "🏠", category: "숙소·월세", name: "다낭 하우스 에이전시", desc: "한국어 상담. 원룸부터 가족형까지.", tags: ["다낭", "월세", "한국어 응대"], verified: "2026.04" },
  { icon: "📋", category: "비자", name: "비자플러스", desc: "e-visa, 연장, 변경 대행.", tags: ["다낭", "비자대행", "한국어 응대"], verified: "2026.04" },
  { icon: "🛡️", category: "보험", name: "VN케어 보험컨설팅", desc: "1개월~1년 체류 보험 비교 상담.", tags: ["다낭", "보험", "한국어 응대"], verified: "2026.04" },
];

const guides = [
  { icon: "🏠", title: "숙소 구하기", desc: "유형별 월세, 추천 지역, 구하는 방법", link: "/living/housing" },
  { icon: "📋", title: "비자 안내", desc: "기간별 비자 종류, e-visa 신청 방법", link: "/living/visa" },
  { icon: "✅", title: "준비 체크리스트", desc: "출발 전, 도착 후 해야 할 것 정리", link: "/living/checklist" },
  { icon: "❓", title: "자주 묻는 질문", desc: "치안, 인터넷, 기후, 아이 동반 등", link: "/living/faq" },
];

const Living = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        {/* 섹션 1: 페이지 헤더 */}
        <section className="pt-12 pb-6 bg-background">
          <div className="container">
            <h1 className="text-[32px] md:text-[40px] font-[800] text-foreground">다낭 한달살기</h1>
            <div className="flex flex-wrap gap-2 mt-4">
              {cities.map((c) => (
                <Link
                  key={c}
                  to={c === "다낭" ? "/living" : "#"}
                  className={`px-4 py-1.5 text-[15px] rounded-full font-medium transition-colors ${
                    c === "다낭"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {c}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* 섹션 2: 핵심 숫자 6개 */}
        <section className="py-10 bg-background">
          <div className="container">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {keyStats.map((stat) => (
                <div key={stat.label} className="bg-card rounded-xl border border-border p-5">
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

        {/* 섹션 3: 비용 비교표 */}
        <section className="py-20 bg-muted/50">
          <div className="container">
            <h2 className="text-[28px] md:text-[32px] font-[800] text-foreground mb-8">한 달 얼마나 드나</h2>

            <div className="bg-card rounded-xl border border-border overflow-x-auto">
              <table className="w-full text-left min-w-[600px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="p-4 text-[15px] font-semibold text-foreground w-[100px]"></th>
                    <th className="p-4 text-[15px] font-semibold text-foreground text-center">알뜰형</th>
                    <th className="p-4 text-[15px] font-semibold text-primary text-center bg-accent/50">보통형</th>
                    <th className="p-4 text-[15px] font-semibold text-foreground text-center">여유형</th>
                  </tr>
                </thead>
                <tbody>
                  {costRows.map((row) => (
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
                  <tr className="border-t-2 border-border bg-muted/30">
                    <td className="p-4 text-[16px] font-bold text-foreground">합계</td>
                    <td className="p-4 text-center">
                      <span className="text-[20px] font-[800] text-foreground font-number">{totals.budget}</span>
                      <p className="text-[14px] text-muted-foreground font-number">{totals.budgetUSD}</p>
                    </td>
                    <td className="p-4 text-center bg-accent/30">
                      <span className="text-[20px] font-[800] text-primary font-number">{totals.normal}</span>
                      <p className="text-[14px] text-muted-foreground font-number">{totals.normalUSD}</p>
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-[20px] font-[800] text-foreground font-number">{totals.premium}</span>
                      <p className="text-[14px] text-muted-foreground font-number">{totals.premiumUSD}</p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4 space-y-1 text-[13px] text-muted-foreground">
              <p>※ 1인 기준, 항공료 제외.</p>
              <p>※ 커플/가족은 숙소 공유로 1인당 비용 감소.</p>
              <p>※ 성수기(3-8월) 숙소비 7만~14만원 상승 가능.</p>
            </div>

            <Link
              to="/#calculator"
              className="inline-flex items-center gap-1 mt-4 px-6 py-3 text-[15px] font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              내 생활비 직접 계산해보기 <ArrowRight size={16} />
            </Link>
          </div>
        </section>

        {/* 섹션 4: 다른 도시와 비교 */}
        <section className="py-20 bg-background">
          <div className="container">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-[28px] md:text-[32px] font-[800] text-foreground">다른 도시 한달살기와 비교</h2>
              <a href="#" className="text-[15px] font-medium text-primary hover:underline flex items-center gap-1">
                도시비교 전체 <ArrowRight size={14} />
              </a>
            </div>

            <div className="bg-card rounded-xl border border-border overflow-x-auto">
              <table className="w-full text-left min-w-[600px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="p-4 text-[15px] font-semibold text-foreground">도시</th>
                    <th className="p-4 text-[15px] font-semibold text-foreground">월 생활비</th>
                    <th className="p-4 text-[15px] font-semibold text-foreground">월세</th>
                    <th className="p-4 text-[15px] font-semibold text-foreground">한인 수</th>
                    <th className="p-4 text-[15px] font-semibold text-foreground">특징</th>
                  </tr>
                </thead>
                <tbody>
                  {cityComparison.map((c) => (
                    <tr
                      key={c.name}
                      className={`border-b border-border last:border-0 ${c.highlight ? "bg-accent/40 font-semibold" : ""}`}
                    >
                      <td className="p-4 text-[15px] text-primary font-bold">{c.name}</td>
                      <td className="p-4 text-[15px] font-[700] text-foreground font-number">{c.cost}</td>
                      <td className="p-4 text-[15px] font-[700] text-foreground font-number">{c.rent}</td>
                      <td className="p-4 text-[15px] text-foreground">{c.koreans}</td>
                      <td className="p-4 text-[15px] text-muted-foreground">{c.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 섹션 5: 다낭 현지 서비스 */}
        <section className="py-20 bg-muted/50">
          <div className="container">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-[28px] md:text-[32px] font-[800] text-foreground">다낭 현지 서비스</h2>
              <a href="#" className="text-[15px] font-medium text-primary hover:underline flex items-center gap-1">
                전체 업체 보기 <ArrowRight size={14} />
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {services.map((s) => (
                <div key={s.name} className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3">
                    <span className="text-[56px] leading-none">{s.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-muted-foreground">{s.category}</p>
                      <h3 className="text-[18px] font-bold text-foreground">{s.name}</h3>
                    </div>
                  </div>
                  <p className="mt-3 text-[15px] text-muted-foreground leading-relaxed">{s.desc}</p>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {s.tags.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 text-[13px] rounded-full bg-accent text-accent-foreground font-medium">{tag}</span>
                    ))}
                  </div>
                  <p className="mt-3 text-[13px] text-muted-foreground">✓ 운영자 확인 {s.verified}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[13px] text-muted-foreground text-center">※ 유료 등록 업체 포함</p>
          </div>
        </section>

        {/* 섹션 6: 가이드 */}
        <section className="py-20 bg-background">
          <div className="container">
            <h2 className="text-[28px] md:text-[32px] font-[800] text-foreground mb-8">다낭 한달살기 가이드</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {guides.map((g) => (
                <Link
                  key={g.title}
                  to={g.link}
                  className="bg-card rounded-xl border border-border p-5 hover:shadow-md hover:-translate-y-1 transition-all duration-200 group"
                >
                  <span className="text-[40px]">{g.icon}</span>
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

        {/* 섹션 7: 뉴스레터 */}
        <section className="py-20 bg-muted/50">
          <div className="container max-w-xl text-center">
            <h2 className="text-[28px] font-[700] text-foreground">다낭 한달살기 최신 정보</h2>
            <p className="mt-2 text-[16px] text-muted-foreground">
              월세 변동, 비자 변경, 생활 팁 — 매주 월요일 보내드립니다
            </p>
            <div className="mt-6 flex gap-2">
              <input
                type="email"
                placeholder="이메일 주소"
                className="flex-1 px-4 py-3 text-[15px] bg-card border border-border rounded-lg outline-none focus:ring-2 focus:ring-ring"
              />
              <button className="px-6 py-3 text-[15px] font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                무료 구독
              </button>
            </div>
          </div>
        </section>

        {/* 출처·기준 */}
        <section className="py-10 bg-background border-t border-border">
          <div className="container">
            <h3 className="text-[15px] font-semibold text-foreground mb-3">이 페이지의 데이터 기준</h3>
            <ul className="space-y-1 text-[13px] text-muted-foreground">
              <li>생활비: Numbeo + 다낭 현지 확인 (2026.04)</li>
              <li>월세: 현지 부동산 에이전트 3곳 평균 (2026.04)</li>
              <li>항공편: 인천-다낭 직항, 2026년 운항 스케줄</li>
              <li>비자: 베트남 출입국관리국 (2023.08 시행, 2026.04 확인)</li>
              <li>환율: <span className="font-number">1$ ≈ ₩1,400</span></li>
            </ul>
            <p className="mt-2 text-[13px] text-muted-foreground">마지막 업데이트: 2026.04.09</p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Living;
