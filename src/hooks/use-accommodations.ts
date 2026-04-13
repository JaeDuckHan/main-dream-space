import { useEffect, useState } from "react";
import { filtersToSearchParams, type AccommodationFilters } from "@/lib/accommodation-filters";

export interface Accommodation {
  id: number;
  slug: string;
  name: string;
  name_ko: string | null;
  type: string;
  district: string;
  price_min_usd: number;
  price_max_usd: number;
  price_monthly_usd: number | null;
  rating: number | null;
  review_count: number;
  amenities: string[];
  thumbnail_url: string | null;
  agoda_url: string | null;
}

interface AccommodationResponse {
  total: number;
  items: Accommodation[];
}

export function useAccommodations(filters: AccommodationFilters) {
  const [data, setData] = useState<Accommodation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = filtersToSearchParams(filters);

    setLoading(true);
    setError(null);

    fetch(`/api/accommodations?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load accommodations: ${response.status}`);
        }
        return response.json() as Promise<AccommodationResponse>;
      })
      .then((payload) => {
        setData(payload.items);
        setTotal(payload.total);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setError(err instanceof Error ? err.message : "Unknown error");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [filters.district, filters.priceMin, filters.priceMax, filters.sort, filters.type]);

  return { data, total, loading, error };
}
