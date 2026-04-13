import { z } from "zod";
import { query } from "../db.js";

export const listingCategorySchema = z.enum([
  "accommodation",
  "restaurant",
  "massage",
  "real_estate",
  "tour",
]);

export const listingStatusSchema = z.enum(["draft", "pending", "approved", "rejected", "archived"]);

export type ListingCategory = z.infer<typeof listingCategorySchema>;
export type ListingStatus = z.infer<typeof listingStatusSchema>;

const imageSchema = z.object({
  url: z.string().url(),
  source: z.enum(["official", "google_maps", "agoda", "owner_provided", "self_taken"]).default("owner_provided"),
});

const accommodationDataSchema = z.object({
  subtype: z.enum(["hotel", "resort", "apartment", "villa", "guesthouse"]).optional(),
  price_min_usd: z.coerce.number().int().nonnegative().optional(),
  price_max_usd: z.coerce.number().int().nonnegative().optional(),
  price_monthly_usd: z.coerce.number().int().nonnegative().optional(),
  bedrooms: z.coerce.number().int().nonnegative().optional(),
  max_guests: z.coerce.number().int().nonnegative().optional(),
  amenities: z.array(z.string()).default([]),
  check_in_time: z.string().optional(),
  check_out_time: z.string().optional(),
  cancellation_policy: z.string().optional(),
});

const restaurantDataSchema = z.object({
  cuisine_type: z.string().optional(),
  price_per_person_usd: z.coerce.number().nonnegative().optional(),
  menu_highlights: z.array(z.string()).default([]),
  has_korean_menu: z.boolean().optional(),
  has_korean_staff: z.boolean().optional(),
  delivery_available: z.boolean().optional(),
  delivery_apps: z.array(z.string()).optional(),
  reservation_recommended: z.boolean().optional(),
  alcohol_served: z.boolean().optional(),
  kid_friendly: z.boolean().optional(),
  vegetarian_options: z.boolean().optional(),
  opening_hours: z.record(z.string(), z.string()).optional(),
});

const massageDataSchema = z.object({
  massage_types: z.array(z.string()).default([]),
  price_60min_usd: z.coerce.number().nonnegative().optional(),
  price_90min_usd: z.coerce.number().nonnegative().optional(),
  price_120min_usd: z.coerce.number().nonnegative().optional(),
  korean_speaking: z.boolean().optional(),
  korean_menu: z.boolean().optional(),
  reservation_required: z.boolean().optional(),
  private_room: z.boolean().optional(),
  shower_available: z.boolean().optional(),
});

const realEstateDataSchema = z.object({
  property_types: z.array(z.string()).default([]),
  transaction_types: z.array(z.string()).default([]),
  price_min_usd: z.coerce.number().nonnegative().optional(),
  price_max_usd: z.coerce.number().nonnegative().optional(),
  languages: z.array(z.string()).default([]),
  kakao_consulting: z.boolean().optional(),
  foreigner_friendly: z.boolean().optional(),
});

const tourDataSchema = z.object({
  tour_types: z.array(z.string()).default([]),
  price_adult_usd: z.coerce.number().nonnegative().optional(),
  duration_hours: z.coerce.number().nonnegative().optional(),
  pickup_included: z.boolean().optional(),
  guide_languages: z.array(z.string()).default([]),
  child_friendly: z.boolean().optional(),
});

function getCategoryDataSchema(category: ListingCategory) {
  switch (category) {
    case "accommodation":
      return accommodationDataSchema;
    case "restaurant":
      return restaurantDataSchema;
    case "massage":
      return massageDataSchema;
    case "real_estate":
      return realEstateDataSchema;
    case "tour":
      return tourDataSchema;
  }
}

export const listingWriteSchema = z.object({
  category: listingCategorySchema,
  name: z.string().min(1).max(200),
  name_ko: z.string().max(200).optional().or(z.literal("")),
  name_en: z.string().max(200).optional().or(z.literal("")),
  district: z.string().min(1).max(100),
  address: z.string().min(1),
  google_maps_url: z.string().url(),
  google_maps_place_id: z.string().min(1).max(255).optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  phone: z.string().max(50).optional().or(z.literal("")),
  contact_email: z.string().email().optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
  kakao_channel: z.string().max(255).optional().or(z.literal("")),
  thumbnail_url: z.string().url().optional().or(z.literal("")),
  image_urls: z.array(imageSchema).default([]),
  description: z.string().optional().or(z.literal("")),
  description_ko: z.string().optional().or(z.literal("")),
  korean_friendly: z.boolean().optional(),
  korean_speaking_staff: z.boolean().optional(),
  korean_menu_signage: z.boolean().optional(),
  category_data: z.record(z.string(), z.unknown()).default({}),
  agoda_url: z.string().url().optional().or(z.literal("")),
  agoda_hotel_id: z.string().max(50).optional().or(z.literal("")),
  booking_url: z.string().url().optional().or(z.literal("")),
  tripcom_url: z.string().url().optional().or(z.literal("")),
});

export function validateListingPayload(input: unknown) {
  const parsed = listingWriteSchema.parse(input);
  const categoryDataSchema = getCategoryDataSchema(parsed.category);
  const categoryData = categoryDataSchema.parse(parsed.category_data);

  return {
    ...parsed,
    name_ko: normalizeNullableString(parsed.name_ko),
    name_en: normalizeNullableString(parsed.name_en),
    phone: normalizeNullableString(parsed.phone),
    contact_email: normalizeNullableString(parsed.contact_email),
    website: normalizeNullableString(parsed.website),
    kakao_channel: normalizeNullableString(parsed.kakao_channel),
    thumbnail_url: normalizeNullableString(parsed.thumbnail_url),
    description: normalizeNullableString(parsed.description),
    description_ko: normalizeNullableString(parsed.description_ko),
    agoda_url: normalizeNullableString(parsed.agoda_url),
    agoda_hotel_id: normalizeNullableString(parsed.agoda_hotel_id),
    booking_url: normalizeNullableString(parsed.booking_url),
    tripcom_url: normalizeNullableString(parsed.tripcom_url),
    category_data: categoryData,
  };
}

export function normalizeNullableString(value: string | undefined | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function slugifyPart(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function generateUniqueSlug(name: string, district: string, existingId?: number) {
  const base = [slugifyPart(name), slugifyPart(district)].filter(Boolean).join("-") || "listing";

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate =
      attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6).toLowerCase()}`;
    const rows = await query<{ id: number }>(
      `SELECT id
       FROM listings
       WHERE slug = $1
         AND ($2::int IS NULL OR id <> $2)
       LIMIT 1`,
      [candidate, existingId ?? null],
    );

    if (!rows[0]) {
      return candidate;
    }
  }

  return `${base}-${Date.now().toString(36).slice(-4)}`;
}

export async function verifyGooglePlace(args: {
  name: string;
  address: string;
  googleMapsUrl: string;
  providedPlaceId?: string | null;
}) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  const placeId = args.providedPlaceId ?? extractPlaceIdFromUrl(args.googleMapsUrl);

  if (!apiKey) {
    return {
      googleMapsPlaceId: placeId,
      lat: null,
      lng: null,
      address: args.address,
      placeIdVerified: false,
      urlVerified: false,
      verifiedAt: null as string | null,
      verificationMode: "unverified_no_api_key",
    };
  }

  const resolvedPlaceId = placeId ?? (await searchPlaceId(apiKey, `${args.name} ${args.address}`));
  if (!resolvedPlaceId) {
    throw new Error("Could not resolve google_maps_place_id from the provided listing");
  }

  const detailsUrl = new URL("https://places.googleapis.com/v1/places/" + encodeURIComponent(resolvedPlaceId));
  detailsUrl.searchParams.set("languageCode", "ko");
  const detailsRes = await fetch(detailsUrl, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "id,displayName,location,formattedAddress",
    },
  });

  const detailsJson = await detailsRes.json();
  if (!detailsRes.ok) {
    throw new Error(`Google Places lookup failed: ${JSON.stringify(detailsJson)}`);
  }

  const headRes = await fetch(args.googleMapsUrl, {
    method: "HEAD",
    redirect: "follow",
  }).catch(() => null);

  return {
    googleMapsPlaceId: resolvedPlaceId,
    lat: typeof detailsJson.location?.latitude === "number" ? detailsJson.location.latitude : null,
    lng: typeof detailsJson.location?.longitude === "number" ? detailsJson.location.longitude : null,
    address: detailsJson.formattedAddress ?? args.address,
    placeIdVerified: true,
    urlVerified: Boolean(headRes && headRes.ok),
    verifiedAt: new Date().toISOString(),
    verificationMode: "google_places",
  };
}

async function searchPlaceId(apiKey: string, textQuery: string) {
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id",
    },
    body: JSON.stringify({
      textQuery,
      maxResultCount: 1,
    }),
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(`Google Places search failed: ${JSON.stringify(json)}`);
  }

  return json.places?.[0]?.id ?? null;
}

function extractPlaceIdFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const fromQuery = parsed.searchParams.get("place_id");
    if (fromQuery) return fromQuery;
    const match = url.match(/place\/[^/]+\/data=.*?1s([^!&]+)/);
    if (match?.[1]) return decodeURIComponent(match[1]);
    return null;
  } catch {
    return null;
  }
}

export function injectAffiliate(url: string | null) {
  if (!url) return null;
  return url.replace("{AFFILIATE_ID}", process.env.AGODA_AFFILIATE_ID || "");
}

export function buildListingWhereClause(filters: {
  category?: ListingCategory;
  district?: string;
  priceMin?: number;
  priceMax?: number;
  status?: ListingStatus;
  ownerId?: number;
  includeArchived?: boolean;
}) {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters.ownerId) {
    params.push(filters.ownerId);
    clauses.push(`l.owner_id = $${params.length}`);
  } else if (!filters.includeArchived) {
    clauses.push("l.is_active = TRUE");
    clauses.push("l.status = 'approved'");
  }

  if (filters.status) {
    params.push(filters.status);
    clauses.push(`l.status = $${params.length}`);
  }

  if (filters.category) {
    params.push(filters.category);
    clauses.push(`l.category = $${params.length}`);
  }

  if (filters.district) {
    params.push(filters.district);
    clauses.push(`l.district = $${params.length}`);
  }

  if (typeof filters.priceMin === "number") {
    params.push(filters.priceMin);
    clauses.push(
      `(COALESCE((l.category_data->>'price_min_usd')::numeric, (l.category_data->>'price_per_person_usd')::numeric, (l.category_data->>'price_60min_usd')::numeric, 0) >= $${params.length})`,
    );
  }

  if (typeof filters.priceMax === "number") {
    params.push(filters.priceMax);
    clauses.push(
      `(COALESCE((l.category_data->>'price_min_usd')::numeric, (l.category_data->>'price_per_person_usd')::numeric, (l.category_data->>'price_60min_usd')::numeric, 0) <= $${params.length})`,
    );
  }

  return {
    whereSql: clauses.length > 0 ? clauses.join(" AND ") : "TRUE",
    params,
  };
}

export function getListingOrderBy(sort: string | undefined) {
  switch (sort) {
    case "rating_desc":
      return "l.rating DESC NULLS LAST, l.review_count DESC, l.created_at DESC";
    case "newest":
      return "l.created_at DESC";
    case "price_desc":
      return "COALESCE((l.category_data->>'price_min_usd')::numeric, (l.category_data->>'price_per_person_usd')::numeric, (l.category_data->>'price_60min_usd')::numeric, 0) DESC, l.rating DESC NULLS LAST";
    case "price_asc":
    default:
      return "COALESCE((l.category_data->>'price_min_usd')::numeric, (l.category_data->>'price_per_person_usd')::numeric, (l.category_data->>'price_60min_usd')::numeric, 0) ASC, l.rating DESC NULLS LAST";
  }
}
