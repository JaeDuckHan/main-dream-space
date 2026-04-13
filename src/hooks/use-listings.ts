import { useEffect, useState } from "react";

export type ListingCategory = "accommodation" | "restaurant" | "massage" | "real_estate" | "tour";
export type ListingStatus = "draft" | "pending" | "approved" | "rejected" | "archived";

export interface Listing {
  id: number;
  slug: string;
  category: ListingCategory;
  name: string;
  name_ko: string | null;
  district: string;
  address: string;
  rating: number | null;
  review_count: number;
  thumbnail_url: string | null;
  google_maps_url: string;
  category_data: Record<string, unknown>;
  agoda_url: string | null;
  status: ListingStatus;
  rejection_reason?: string | null;
  created_at?: string;
  owner_email?: string | null;
}

interface ListingsResponse {
  total: number;
  items: Listing[];
}

export function useListings(params: {
  category?: ListingCategory;
  district?: string;
  priceMin?: number;
  priceMax?: number;
  sort?: "price_asc" | "price_desc" | "rating_desc" | "newest";
  limit?: number;
  offset?: number;
}) {
  const [data, setData] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const search = new URLSearchParams();

    if (params.category) search.set("category", params.category);
    if (params.district) search.set("district", params.district);
    if (typeof params.priceMin === "number") search.set("price_min", String(params.priceMin));
    if (typeof params.priceMax === "number") search.set("price_max", String(params.priceMax));
    if (params.sort) search.set("sort", params.sort);
    if (typeof params.limit === "number") search.set("limit", String(params.limit));
    if (typeof params.offset === "number") search.set("offset", String(params.offset));

    setLoading(true);
    setError(null);

    fetch(`/api/listings?${search.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load listings: ${response.status}`);
        }
        return (await response.json()) as ListingsResponse;
      })
      .then((payload) => {
        setData(payload.items);
        setTotal(payload.total);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Unknown error");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [params.category, params.district, params.priceMin, params.priceMax, params.sort, params.limit, params.offset]);

  return { data, total, loading, error };
}
