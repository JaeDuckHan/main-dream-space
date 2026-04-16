import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { resolveHotelLink } from "@/lib/agoda";
import { ROUTES } from "@/lib/routes";

type TopHotel = {
  id: number;
  name: string;
  thumbnail_url: string | null;
  price_from: number | null;
  currency: string | null;
  rating: number | null;
  review_count: number | null;
  agoda_deeplink?: string | null;
  agoda_url?: string | null;
  category_data?: Record<string, unknown> | null;
};

type Product = {
  id: number;
  slug: string;
  category: "package" | "pickup";
  title: string;
  thumbnail_url: string | null;
  base_price: number;
};

const CATEGORY_LABEL: Record<string, string> = {
  pickup: "공항 픽업",
  package: "패키지",
};

const CATEGORY_EMOJI: Record<string, string> = {
  pickup: "🚗",
  package: "🏖️",
};

export function TopHotels() {
  const [hotels, setHotels] = useState<TopHotel[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [title, setTitle] = useState("다낭 인기 숙소");
  const [subtitle, setSubtitle] = useState("럭키다낭 + Agoda 연동");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      fetch("/api/listings/top?category=%EC%88%99%EC%86%8C&city=danang&limit=3", { signal: controller.signal })
        .then((r) => r.json() as Promise<{ items?: TopHotel[]; title?: string; subtitle?: string }>),
      fetch("/api/products?limit=3", { signal: controller.signal })
        .then((r) => r.json() as Promise<{ items?: Product[] }>),
    ])
      .then(([hotelPayload, productPayload]) => {
        setHotels(hotelPayload.items ?? []);
        if (hotelPayload.title) setTitle(hotelPayload.title);
        if (hotelPayload.subtitle) setSubtitle(hotelPayload.subtitle);
        setProducts(productPayload.items ?? []);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setHotels([]);
          setProducts([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  if (loading || (hotels.length === 0 && products.length === 0)) return null;

  return (
    <section className="bg-muted/30 py-16">
      <div className="container">
        {/* 숙소 */}
        {hotels.length > 0 && (
          <>
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-[28px] font-[800] text-foreground md:text-[32px]">{title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
              </div>
              <a href={ROUTES.compare({ city: "danang" })} className="shrink-0 text-sm font-medium text-primary hover:underline">
                전체 숙소 보기 →
              </a>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {hotels.map((hotel) => (
                <article key={hotel.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-lg">
                  {hotel.thumbnail_url ? (
                    <img src={hotel.thumbnail_url} alt={hotel.name} className="h-44 w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="h-44 bg-muted" />
                  )}
                  <div className="space-y-3 p-4">
                    <div>
                      <h3 className="line-clamp-1 text-base font-bold text-foreground">{hotel.name}</h3>
                      <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                        <span>⭐ {typeof hotel.rating === "number" ? hotel.rating.toFixed(1) : "-"}</span>
                        <span>·</span>
                        <span>리뷰 {hotel.review_count ?? 0}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">1박 기준 </span>
                      <span className="text-lg font-bold text-primary">
                        {hotel.currency === "KRW" ? "₩" : "$"}
                        {hotel.price_from ? hotel.price_from.toLocaleString() : "-"}
                      </span>
                    </div>
                    <a
                      href={resolveHotelLink(hotel)}
                      target="_blank"
                      rel="noopener sponsored"
                      className="block rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                      onClick={() => {
                        (window as { gtag?: (...args: unknown[]) => void }).gtag?.("event", "agoda_outbound", {
                          listing_id: hotel.id,
                          source: "home_top_hotels",
                        });
                      }}
                    >
                      예약하기 →
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {/* 서비스 상품 */}
        {products.length > 0 && (
          <>
            <div className="mb-6 mt-12 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-[28px] font-[800] text-foreground md:text-[32px]">럭키다낭 서비스</h2>
                <p className="mt-1 text-sm text-muted-foreground">한달살기 준비에 필요한 것들</p>
              </div>
              <Link to="/products" className="shrink-0 text-sm font-medium text-primary hover:underline">
                전체 보기 →
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {products.map((p) => (
                <Link
                  key={p.id}
                  to={`/products/${p.slug}`}
                  className="overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-lg"
                >
                  <div className="relative h-44 w-full bg-muted">
                    {p.thumbnail_url ? (
                      <img src={p.thumbnail_url} alt={p.title} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-5xl">
                        {CATEGORY_EMOJI[p.category] ?? "🏖️"}
                      </div>
                    )}
                    <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
                      {CATEGORY_LABEL[p.category] ?? p.category}
                    </span>
                  </div>
                  <div className="space-y-3 p-4">
                    <h3 className="line-clamp-2 text-base font-bold leading-snug text-foreground">{p.title}</h3>
                    <div>
                      <span className="text-xs text-muted-foreground">시작가 </span>
                      <span className="text-lg font-bold text-primary">
                        {p.base_price.toLocaleString("ko-KR")}원
                      </span>
                    </div>
                    <div className="block rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground">
                      자세히 보기 →
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
