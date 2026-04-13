const AGODA_SITE_ID = import.meta.env.VITE_AGODA_SITE_ID || "";
const AGODA_BASE = "https://www.agoda.com/partners/partnersearch.aspx";

export function buildAgodaLink(params: {
  cityId?: number;
  hotelId?: number;
  checkIn?: string;
  checkOut?: string;
  rooms?: number;
  adults?: number;
}) {
  const search = new URLSearchParams();

  if (AGODA_SITE_ID) search.set("cid", AGODA_SITE_ID);
  if (params.cityId) search.set("city", String(params.cityId));
  if (params.hotelId) search.set("hid", String(params.hotelId));
  if (params.checkIn) search.set("checkIn", params.checkIn);
  if (params.checkOut) search.set("checkOut", params.checkOut);

  search.set("rooms", String(params.rooms || 1));
  search.set("adults", String(params.adults || 2));

  return `${AGODA_BASE}?${search.toString()}`;
}

export function resolveHotelLink(listing: {
  agoda_deeplink?: string | null;
  agoda_url?: string | null;
  category_data?: Record<string, unknown> | null;
}) {
  const categoryData = listing.category_data ?? {};
  const agodaUrl = typeof categoryData.agoda_url === "string" ? categoryData.agoda_url : null;

  return listing.agoda_deeplink || listing.agoda_url || agodaUrl || buildAgodaLink({ cityId: 17196 });
}
