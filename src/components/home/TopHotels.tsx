import { useEffect, useState } from "react";
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

export function TopHotels() {
  const [hotels, setHotels] = useState<TopHotel[]>([]);
  const [title, setTitle] = useState("다낭 인기 숙소");
  const [subtitle, setSubtitle] = useState("럭키다낭 + Agoda 연동");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/listings/top?category=%EC%88%99%EC%86%8C&city=danang&limit=6", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load top hotels: ${response.status}`);
        }
        return response.json() as Promise<{ items?: TopHotel[]; title?: string; subtitle?: string }>;
      })
      .then((payload) => {
        setHotels(payload.items ?? []);
        if (payload.title) setTitle(payload.title);
        if (payload.subtitle) setSubtitle(payload.subtitle);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setHotels([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  if (loading || hotels.length === 0) {
    return null;
  }

  return (
    <section className="bg-muted/30 py-16">
      <div className="container">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-[28px] font-[800] text-foreground md:text-[32px]">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <a href={ROUTES.compare({ city: "danang" })} className="text-sm font-medium text-primary hover:underline">
            전체 숙소 보기 →
          </a>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {hotels.map((hotel) => (
            <article key={hotel.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-lg">
              {hotel.thumbnail_url ? (
                <img
                  src={hotel.thumbnail_url}
                  alt={hotel.name}
                  className="h-48 w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="h-48 bg-muted" />
              )}
              <div className="space-y-3 p-5">
                <div>
                  <h3 className="line-clamp-1 text-lg font-bold text-foreground">{hotel.name}</h3>
                  <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                    <span>⭐ {typeof hotel.rating === "number" ? hotel.rating.toFixed(1) : "-"}</span>
                    <span>·</span>
                    <span>리뷰 {hotel.review_count ?? 0}</span>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">1박 기준 </span>
                  <span className="text-xl font-bold text-primary">
                    {hotel.currency === "KRW" ? "₩" : "$"}
                    {hotel.price_from ? hotel.price_from.toLocaleString() : "-"}
                  </span>
                </div>
                <a
                  href={resolveHotelLink(hotel)}
                  target="_blank"
                  rel="noopener sponsored"
                  className="block rounded-lg bg-primary px-4 py-3 text-center font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
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
      </div>
    </section>
  );
}
