import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Footer from "@/components/Footer";
import { useListings, type ListingCategory } from "@/hooks/use-listings";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCategoryLabel, getListingTitle } from "@/lib/listing-form";
import { MapPin, ExternalLink, Star } from "lucide-react";

const tabs: Array<{ label: string; value: ListingCategory | "all" }> = [
  { label: "전체", value: "all" },
  { label: "숙소", value: "accommodation" },
  { label: "식당", value: "restaurant" },
  { label: "마사지", value: "massage" },
  { label: "부동산", value: "real_estate" },
  { label: "투어", value: "tour" },
];

const sortOptions = [
  { value: "price_asc", label: "가격 낮은순" },
  { value: "price_desc", label: "가격 높은순" },
  { value: "rating_desc", label: "평점순" },
  { value: "newest", label: "최신순" },
] as const;

const districtOptions = ["all", "My Khe", "An Thuong", "Son Tra", "City Center", "Hai Chau", "Hoi An"];

function getPriceSummary(categoryData: Record<string, unknown>) {
  if (typeof categoryData.price_min_usd === "number" && typeof categoryData.price_max_usd === "number") {
    return `$${categoryData.price_min_usd} - $${categoryData.price_max_usd}`;
  }

  if (typeof categoryData.price_per_person_usd === "number") {
    return `1인 약 $${categoryData.price_per_person_usd}`;
  }

  if (typeof categoryData.price_60min_usd === "number") {
    return `60분 $${categoryData.price_60min_usd}`;
  }

  return null;
}

export default function Directory() {
  const [searchParams] = useSearchParams();
  const [category, setCategory] = useState<ListingCategory | "all">("all");
  const [district, setDistrict] = useState("all");
  const [sort, setSort] = useState<(typeof sortOptions)[number]["value"]>("price_asc");
  const { data, total, loading, error } = useListings({
    category: category === "all" ? undefined : category,
    district: district === "all" ? undefined : district,
    sort,
    limit: 30,
  });

  useEffect(() => {
    const nextCategory = searchParams.get("category");
    if (nextCategory && ["accommodation", "restaurant", "massage", "real_estate", "tour"].includes(nextCategory)) {
      setCategory(nextCategory as ListingCategory);
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-background">
      <section className="border-b border-border bg-card">
        <div className="container py-10 md:py-14">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-[28px] font-[800] text-foreground md:text-[36px]">다낭 비즈니스 디렉토리</h1>
              <p className="mt-2 text-[15px] text-muted-foreground">검수된 숙소, 식당, 마사지, 부동산, 투어 정보를 한곳에서 확인하세요.</p>
            </div>
            <a href="/business/register">
              <Button>내 업체 등록하기</Button>
            </a>
          </div>
        </div>
      </section>

      <section className="container py-6">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setCategory(tab.value)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                category === tab.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Select value={district} onValueChange={setDistrict}>
            <SelectTrigger>
              <SelectValue placeholder="지역 선택" />
            </SelectTrigger>
            <SelectContent>
              {districtOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option === "all" ? "모든 지역" : option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sort} onValueChange={(value) => setSort(value as typeof sort)}>
            <SelectTrigger>
              <SelectValue placeholder="정렬" />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-6 flex items-center justify-between text-sm text-muted-foreground">
          <span>{total}개 업체</span>
          <span>공개 승인된 데이터만 노출됩니다.</span>
        </div>

        {loading ? <div className="py-16 text-center text-muted-foreground">디렉토리 불러오는 중...</div> : null}
        {error ? <div className="py-16 text-center text-destructive">{error}</div> : null}

        {!loading && !error ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.map((listing) => {
              const priceSummary = getPriceSummary(listing.category_data);

              return (
                <Card key={listing.id} className="overflow-hidden p-0">
                  <div className="h-48 bg-muted">
                    {listing.thumbnail_url ? (
                      <img src={listing.thumbnail_url} alt={getListingTitle(listing)} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="space-y-3 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
                        {getCategoryLabel(listing.category)}
                      </span>
                      {listing.rating ? (
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-foreground">
                          <Star size={14} className="fill-current text-amber-500" />
                          {listing.rating.toFixed(1)}
                        </span>
                      ) : null}
                    </div>

                    <div>
                      <h2 className="text-lg font-semibold">{getListingTitle(listing)}</h2>
                      <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin size={14} /> {listing.district}
                      </p>
                    </div>

                    {priceSummary ? <p className="text-sm font-medium text-foreground">{priceSummary}</p> : null}

                    <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                      <span className="text-xs text-muted-foreground">리뷰 {listing.review_count.toLocaleString()}</span>
                      <div className="flex gap-2">
                        <a href={listing.google_maps_url} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="outline">
                            구글맵 <ExternalLink size={14} />
                          </Button>
                        </a>
                        {listing.agoda_url ? (
                          <a href={listing.agoda_url} target="_blank" rel="noreferrer">
                            <Button size="sm">예약</Button>
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : null}
      </section>

      <Footer />
    </div>
  );
}
