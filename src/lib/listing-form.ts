import type { ListingCategory } from "@/hooks/use-listings";

export interface ListingImageInput {
  url: string;
  source: string;
}

export interface ListingFormState {
  category: ListingCategory | "";
  name: string;
  name_ko: string;
  district: string;
  address: string;
  google_maps_url: string;
  google_maps_place_id: string;
  phone: string;
  description: string;
  image_urls: ListingImageInput[];
  category_data: Record<string, unknown>;
}

export const CATEGORY_OPTIONS: Array<{ value: ListingCategory; label: string }> = [
  { value: "accommodation", label: "숙소" },
  { value: "restaurant", label: "식당" },
  { value: "massage", label: "마사지" },
  { value: "real_estate", label: "부동산" },
  { value: "tour", label: "투어" },
];

export const DISTRICT_OPTIONS = ["My Khe", "An Thuong", "Son Tra", "City Center", "Hai Chau", "Hoi An"];

export const initialListingFormState: ListingFormState = {
  category: "",
  name: "",
  name_ko: "",
  district: "",
  address: "",
  google_maps_url: "",
  google_maps_place_id: "",
  phone: "",
  description: "",
  image_urls: [],
  category_data: {},
};

export function getCategoryLabel(category: string) {
  return CATEGORY_OPTIONS.find((item) => item.value === category)?.label ?? category;
}

export function getListingTitle(listing: { name: string; name_ko: string | null }) {
  return listing.name_ko || listing.name;
}
