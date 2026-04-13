export interface AccommodationFilters {
  district?: string;
  priceMin?: number;
  priceMax?: number;
  type?: "hotel" | "resort" | "apartment" | "villa" | "guesthouse";
  sort?: "price_asc" | "price_desc" | "rating_desc";
}

export function filtersFromSearchParams(searchParams: URLSearchParams): AccommodationFilters {
  const priceMin = searchParams.get("price_min");
  const priceMax = searchParams.get("price_max");
  const type = searchParams.get("type");
  const sort = searchParams.get("sort");
  const district = searchParams.get("district");

  return {
    district: district || undefined,
    priceMin: priceMin ? Number(priceMin) : undefined,
    priceMax: priceMax ? Number(priceMax) : 100,
    type: type && ["hotel", "resort", "apartment", "villa", "guesthouse"].includes(type)
      ? (type as AccommodationFilters["type"])
      : undefined,
    sort: sort && ["price_asc", "price_desc", "rating_desc"].includes(sort)
      ? (sort as AccommodationFilters["sort"])
      : "price_asc",
  };
}

export function filtersToSearchParams(filters: AccommodationFilters) {
  const params = new URLSearchParams();

  if (filters.district) {
    params.set("district", filters.district);
  }

  if (typeof filters.priceMin === "number") {
    params.set("price_min", String(filters.priceMin));
  }

  if (typeof filters.priceMax === "number") {
    params.set("price_max", String(filters.priceMax));
  }

  if (filters.type) {
    params.set("type", filters.type);
  }

  if (filters.sort) {
    params.set("sort", filters.sort);
  }

  return params;
}
