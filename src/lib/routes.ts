export const ROUTES = {
  home: "/",
  compare: (params?: { q?: string; city?: string; budget?: number }) => {
    const search = new URLSearchParams();

    if (params?.q) search.set("q", params.q);
    if (params?.city) search.set("city", params.city);
    if (typeof params?.budget === "number") search.set("budget", String(params.budget));

    const query = search.toString();
    return query ? `/compare?${query}` : "/compare";
  },
  listing: (id: string | number) => `/directory?listing=${id}`,
  directory: (category?: string) => (category ? `/directory?category=${category}` : "/directory"),
  cities: (slug: string) => `/compare?city=${slug}`,
} as const;

export const CITY_SLUGS = ["hochiminh", "hanoi", "danang", "nhatrang", "phuquoc"] as const;
export type CitySlug = (typeof CITY_SLUGS)[number];

export type Intent = "monthly" | "retire";

export const INTENT_CONFIG: Record<Intent, {
  label: string;
  heroTitle: string;
  heroSubtitle: string;
  badgeColor: string;
  bgClass: string;
}> = {
  monthly: {
    label: "한달살기",
    heroTitle: "다낭 한달살기, 월세·생활비·비자 한 번에",
    heroSubtitle: "1개월 이상 장기 숙소 + 현지 생활비 예산 가이드",
    badgeColor: "bg-blue-100 text-blue-700",
    bgClass: "bg-gradient-to-r from-blue-700 to-blue-900",
  },
  retire: {
    label: "은퇴·장기체류",
    heroTitle: "다낭 은퇴·장기체류, 안정적인 시작",
    heroSubtitle: "비자·의료·주거·커뮤니티까지 — 50대 이상 체류자 후기 기반",
    badgeColor: "bg-emerald-100 text-emerald-700",
    bgClass: "bg-gradient-to-r from-emerald-600 to-teal-900",
  },
};

export const CITY_LABELS: Record<CitySlug, string> = {
  hochiminh: "호치민",
  hanoi: "하노이",
  danang: "다낭",
  nhatrang: "나트랑",
  phuquoc: "푸꾸옥",
};
