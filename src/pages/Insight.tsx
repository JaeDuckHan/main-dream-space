import { useState } from "react";
import { ExternalLink } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const categories = ["전체", "비자/정책", "생활비/물가", "한달살기 팁", "날씨/시기", "교통/이동", "음식/맛집"] as const;

const categoryColors: Record<string, string> = {
  "비자/정책": "#3B82F6",
  "생활비/물가": "#10B981",
  "한달살기 팁": "#F59E0B",
  "날씨/시기": "#06B6D4",
  "교통/이동": "#8B5CF6",
  "음식/맛집": "#EF4444",
};

interface NewsItem {
  category: string;
  title: string;
  summary: string;
  date: string;
  source_name: string;
  source_url: string;
  image_url: string;
}

const news: NewsItem[] = [
  {
    category: "비자/정책",
    title: "호치민 투자허가 15일 단축",
    summary: "호치민이 특별 메커니즘으로 투자허가 처리 기간을 15일로 줄였습니다. 장기 체류자 입장에선 도시 개발과 외국인 대상 서비스 확장 속도를 가늠할 정책 신호로 볼 만합니다.",
    date: "2026.04",
    source_name: "Vietnam Plus",
    source_url: "https://en.vietnamplus.vn/ho-chi-minh-city-investment-licences-granted-within-15-days-under-special-mechanism-post340851.vnp",
    image_url: "https://mediaen.vietnamplus.vn/images/f579a678cf9e90879541752073c2600520d60f852cb13a68afab08a4d1566e4d53655ca8a5930acb0f718a482917c8d56d47a608fcf7eb6650e8b3409462f9c98e92214f73f8429ff0b91dd87da0d89b13eef6cc120d967710b5ddf888cff623d7f4dff2ff28855f7d2e611312992bcc/potal-thanh-pho-ho-chi-minh-khoi-thong-cua-ngo-cho-phat-trien-8332452.jpg.webp",
  },
  {
    category: "생활비/물가",
    title: "외국인, 임대 아파트 매입 가능?",
    summary: "베트남에서 오래 거주한 외국인이 임대 중인 아파트를 매입할 수 있는지 다룬 기사입니다. 장기 체류자에게는 월세를 계속 낼지, 매입이 가능한지 판단할 때 참고할 수 있는 주거비 핵심 이슈입니다.",
    date: "2026.04",
    source_name: "VN Express",
    source_url: "https://e.vnexpress.net/news/news/can-a-foreigner-working-in-vietnam-buy-an-apartment-they-have-rented-for-years-5056403.html",
    image_url: "https://vcdn1-english.vnecdn.net/2026/03/30/cytonnphotographygjao3ztx9guun-3801-8876-1774850291.jpg?w=680&h=0&q=100&dpr=1&fit=crop&s=EBoXe6VZQslevtHJCLQiNg",
  },
  {
    category: "한달살기 팁",
    title: "호치민 해안 워케이션 확장",
    summary: "호치민 해안 관광 확장 계획을 다룬 기사입니다. 장기 체류나 워케이션 관점에서는 해안권 숙소, 관광 인프라, 여가 동선이 함께 커질 가능성을 보여줘 남부 베트남 체류지 선택에 참고할 만합니다.",
    date: "2026.04",
    source_name: "Vietnam Plus",
    source_url: "https://en.vietnamplus.vn/ho-chi-minh-citys-coastal-tourism-poised-to-take-off-post340848.vnp",
    image_url: "https://mediaen.vietnamplus.vn/images/f579a678cf9e90879541752073c260057d35281a0e23b0eb769784c3120d3cefea4371b5999e067f1e5a761a5f2c4f021f3f88b8de7682f855eb041180fb650b/vnanet-bibb83n.jpg.webp",
  },
  {
    category: "날씨/시기",
    title: "베트남 더위, 5월 초까지",
    summary: "베트남 남부 폭염이 5월 초까지 이어질 수 있다는 보도입니다. 다낭 체류자도 4~5월 낮 시간 외출, 숙소 냉방비, 카페 작업 동선까지 함께 고려해 방문 시기를 잡는 게 실용적입니다.",
    date: "2026.04",
    source_name: "VN Express",
    source_url: "https://e.vnexpress.net/news/news/environment/southern-vietnam-heatwave-set-to-persist-into-early-may-5060422.html",
    image_url: "https://vcdn1-english.vnecdn.net/2026/04/09/1000024508-1775718049-1794-1775718081.jpg?w=680&h=0&q=100&dpr=1&fit=crop&s=ibdBZ7sZPmqXESUHyct5Ng",
  },
  {
    category: "교통/이동",
    title: "4월말 항공권·열차값 급등",
    summary: "연휴 수요로 베트남 국내 항공권과 기차표 가격이 피크 수준까지 올랐다는 기사입니다. 다낭 입출국이나 현지 도시 이동 계획이 있으면 주말·연휴 직전 예약을 피하는 게 비용 절감에 유리합니다.",
    date: "2026.04",
    source_name: "VN Express",
    source_url: "https://e.vnexpress.net/news/news/traffic/april-holiday-travel-surge-pushes-vietnam-s-airfares-train-tickets-to-peak-levels-5060090.html",
    image_url: "https://vcdn1-english.vnecdn.net/2026/04/08/image-1775636358-8323-1775636360.jpg?w=680&h=0&q=100&dpr=1&fit=crop&s=ogi9lMB6tOcnhrtzqHaSbg",
  },
  {
    category: "음식/맛집",
    title: "베트남 자몽, 호주 수입 허용",
    summary: "호주가 베트남산 자몽 수입 조건을 공식화했다는 기사입니다. 베트남 식재료 경쟁력이 커지고 있다는 신호로, 현지 과일 소비와 식문화, 카페·디저트 메뉴에 쓰이는 베트남산 농산물의 가치를 읽는 데 도움이 됩니다.",
    date: "2026.04",
    source_name: "Vietnam Plus",
    source_url: "https://en.vietnamplus.vn/australia-announces-import-conditions-for-vietnamese-pomelos-post340889.vnp",
    image_url: "https://mediaen.vietnamplus.vn/images/f579a678cf9e90879541752073c26005b104691e4cf5a71e2ab8e7766b7f7be8dcd6b1ffab5cf410eb33e1642ead99a0/pomelo.jpg.webp",
  },
];

const NewsCard = ({ item }: { item: NewsItem }) => {
  const [imgError, setImgError] = useState(false);
  const color = categoryColors[item.category] || "#6B7280";

  return (
    <a
      href={item.source_url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block bg-card rounded-xl border border-border overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
    >
      {imgError ? (
        <div
          className="h-[200px] flex items-center justify-center text-white font-bold text-lg"
          style={{ backgroundColor: color }}
        >
          {item.category}
        </div>
      ) : (
        <img
          src={item.image_url}
          alt={item.title}
          className="w-full h-[200px] object-cover"
          onError={() => setImgError(true)}
        />
      )}
      <div className="p-5">
        <span
          className="inline-block px-2.5 py-0.5 text-[12px] font-semibold rounded-full text-white mb-3"
          style={{ backgroundColor: color }}
        >
          {item.category}
        </span>
        <h3 className="text-[18px] font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
          {item.title}
        </h3>
        <p className="text-[14px] text-muted-foreground leading-relaxed line-clamp-3 mb-4">
          {item.summary}
        </p>
        <div className="flex items-center justify-between text-[13px] text-muted-foreground/70">
          <span>{item.date} · {item.source_name}</span>
          <span className="flex items-center gap-1 text-primary font-medium">
            원문 보기 <ExternalLink size={12} />
          </span>
        </div>
      </div>
    </a>
  );
};

const Insight = () => {
  const [active, setActive] = useState("전체");
  const filtered = active === "전체" ? news : news.filter((n) => n.category === active);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Header */}
      <section className="pt-16 pb-10 bg-muted/40">
        <div className="container text-center">
          <h1 className="text-[32px] md:text-[40px] font-[800] text-foreground mb-3">
            다낭 한달살기 뉴스 &amp; 정보
          </h1>
          <p className="text-[16px] text-muted-foreground">
            베트남 최신 소식을 한국어로 정리했어요
          </p>
        </div>
      </section>

      {/* Filter */}
      <div className="container py-6">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setActive(c)}
              className={`shrink-0 px-4 py-2 rounded-full text-[14px] font-semibold transition-colors border ${
                active === c
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:border-primary/40"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="container pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((item) => (
            <NewsCard key={item.title} item={item} />
          ))}
        </div>
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-20">해당 카테고리의 뉴스가 없습니다.</p>
        )}
      </div>

      {/* CTA */}
      <section className="py-16" style={{ backgroundColor: "#1A1A2E" }}>
        <div className="container text-center">
          <h2 className="text-[24px] md:text-[28px] font-[800] text-white mb-3">
            다낭 한달살기, 어디서 시작할지 모르겠다면?
          </h2>
          <a
            href="/planner"
            className="inline-flex items-center gap-2 mt-4 px-6 py-3 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90 transition-colors"
          >
            내 맞춤 플랜 만들기 →
          </a>
        </div>
      </section>

      {/* Disclaimer */}
      <div className="container py-6">
        <p className="text-[13px] text-muted-foreground/60 text-center">
          ※ 각 기사는 원문 출처로 연결됩니다.
        </p>
      </div>

      <Footer />
    </div>
  );
};

export default Insight;
