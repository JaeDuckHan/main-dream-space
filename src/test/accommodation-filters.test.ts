import { describe, expect, it } from "vitest";
import { filtersFromSearchParams, filtersToSearchParams } from "@/lib/accommodation-filters";

describe("accommodation filters", () => {
  it("reads compare filters from URL params", () => {
    const filters = filtersFromSearchParams(new URLSearchParams("district=My+Khe&price_max=80&type=hotel&sort=rating_desc"));

    expect(filters).toEqual({
      district: "My Khe",
      priceMin: undefined,
      priceMax: 80,
      type: "hotel",
      sort: "rating_desc",
    });
  });

  it("writes compare filters to URL params", () => {
    const params = filtersToSearchParams({
      district: "An Thuong",
      priceMin: 20,
      priceMax: 70,
      type: "apartment",
      sort: "price_asc",
    });

    expect(params.toString()).toBe("district=An+Thuong&price_min=20&price_max=70&type=apartment&sort=price_asc");
  });
});
