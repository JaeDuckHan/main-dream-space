export type ActionType = "external" | "internal" | "none";
export type AffiliatePartner = "agoda" | "booking" | "tripcom" | "skyscanner" | "none";
export type ClickPartner = Exclude<AffiliatePartner, "none">;
export type ClickTargetType = "checklist_item" | "accommodation";
export type AccommodationType = "hotel" | "resort" | "apartment" | "villa" | "guesthouse";
export type ListingCategory = "accommodation" | "restaurant" | "massage" | "real_estate" | "tour";
export type ListingStatus = "draft" | "pending" | "approved" | "rejected" | "archived";

export interface ChecklistTemplate {
  id: number;
  slug: string;
  title: string;
  description: string | null;
}

export interface ChecklistItemRow {
  id: number;
  title: string;
  description: string | null;
  sort_order: number;
  action_type: ActionType;
  action_url: string | null;
  action_label: string | null;
  affiliate_partner: AffiliatePartner;
  icon: string | null;
  checked: boolean;
}

export interface AccommodationListItem {
  id: number;
  slug: string;
  name: string;
  name_ko: string | null;
  type: AccommodationType;
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

export interface ListingListItem {
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
}
