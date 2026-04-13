import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth } from "../lib/auth.js";
import {
  buildListingWhereClause,
  generateUniqueSlug,
  getListingOrderBy,
  injectAffiliate,
  listingCategorySchema,
  validateListingPayload,
  verifyGooglePlace,
} from "../lib/listings.js";

const router = Router();

const publicFiltersSchema = z.object({
  category: listingCategorySchema.optional(),
  district: z.string().optional(),
  price_min: z.coerce.number().nonnegative().optional(),
  price_max: z.coerce.number().nonnegative().optional(),
  sort: z.enum(["price_asc", "price_desc", "rating_desc", "newest"]).optional().default("price_asc"),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

function normalizeListingRow<T extends Record<string, unknown>>(row: T) {
  return {
    ...row,
    rating: row.rating === null || row.rating === undefined ? null : Number(row.rating),
    agoda_url: injectAffiliate((row.agoda_url as string | null | undefined) ?? null),
  };
}

router.get("/", async (req, res, next) => {
  try {
    const filters = publicFiltersSchema.parse(req.query);
    const { whereSql, params } = buildListingWhereClause({
      category: filters.category,
      district: filters.district,
      priceMin: filters.price_min,
      priceMax: filters.price_max,
    });

    const countRows = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM listings l
       WHERE ${whereSql}`,
      params,
    );

    const orderBy = getListingOrderBy(filters.sort);
    const listParams = [...params, filters.limit, filters.offset];
    const items = await query<Record<string, unknown>>(
      `SELECT
         l.id,
         l.slug,
         l.category,
         l.name,
         l.name_ko,
         l.name_en,
         l.district,
         l.address,
         l.rating::float8 AS rating,
         l.review_count,
         l.thumbnail_url,
         l.google_maps_url,
         l.category_data,
         l.agoda_url,
         l.status,
         l.created_at
       FROM listings l
       WHERE ${whereSql}
       ORDER BY ${orderBy}
       LIMIT $${listParams.length - 1}
       OFFSET $${listParams.length}`,
      listParams,
    );

    res.json({
      total: Number(countRows[0]?.count ?? 0),
      items: items.map((item) => normalizeListingRow(item)),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/top", async (req, res, next) => {
  try {
    const queryParams = z.object({
      category: z.string().optional().default("숙소"),
      city: z.string().optional().default("danang"),
      limit: z.coerce.number().int().min(1).max(10).optional().default(3),
    }).parse(req.query);

    if (queryParams.city !== "danang") {
      return res.json({ items: [] });
    }

    const normalizedCategory = queryParams.category === "숙소" ? "accommodation" : queryParams.category;

    if (normalizedCategory === "accommodation") {
      const items = await query<Record<string, unknown>>(
        `SELECT
           a.id,
           a.name,
           a.thumbnail_url,
           a.price_min_usd AS price_from,
           'USD'::text AS currency,
           a.rating::float8 AS rating,
           a.review_count,
           a.agoda_url AS agoda_deeplink,
           jsonb_build_object('agoda_url', a.agoda_url) AS category_data
         FROM accommodations a
         WHERE a.is_active = TRUE
         ORDER BY a.rating DESC NULLS LAST, a.review_count DESC NULLS LAST, a.price_min_usd ASC
         LIMIT $1`,
        [queryParams.limit],
      );

      return res.json({
        items: items.map((item) => ({
          ...item,
          rating: item.rating === null || item.rating === undefined ? null : Number(item.rating),
          agoda_deeplink: injectAffiliate((item.agoda_deeplink as string | null | undefined) ?? null),
        })),
      });
    }

    return res.json({ items: [] });
  } catch (error) {
    console.error("[listings/top] error", error);
    return res.status(500).json({ items: [] });
  }
});

router.get("/compare", async (req, res, next) => {
  try {
    const { ids } = z.object({ ids: z.string().min(1) }).parse(req.query);
    const parsedIds = ids
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0)
      .slice(0, 4);

    if (parsedIds.length === 0) {
      return res.status(400).json({ error: "At least one valid id is required" });
    }

    const items = await query<Record<string, unknown>>(
      `SELECT
         l.id,
         l.slug,
         l.category,
         l.name,
         l.name_ko,
         l.name_en,
         l.district,
         l.address,
         l.rating::float8 AS rating,
         l.review_count,
         l.thumbnail_url,
         l.image_urls,
         l.google_maps_url,
         l.category_data,
         l.agoda_url
       FROM listings l
       WHERE l.id = ANY($1::int[])
         AND l.status = 'approved'
         AND l.is_active = TRUE
       ORDER BY array_position($1::int[], l.id)`,
      [parsedIds],
    );

    res.json({ items: items.map((item) => normalizeListingRow(item)) });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const items = await query<Record<string, unknown>>(
      `SELECT
         l.id,
         l.slug,
         l.category,
         l.name,
         l.name_ko,
         l.district,
         l.address,
         l.thumbnail_url,
         l.google_maps_url,
         l.status,
         l.rejection_reason,
         l.created_at,
         l.updated_at
       FROM listings l
       WHERE l.owner_id = $1
       ORDER BY l.created_at DESC`,
      [req.authUser!.id],
    );

    res.json({ items });
  } catch (error) {
    next(error);
  }
});

router.get("/:slug", async (req, res, next) => {
  try {
    const { slug } = z.object({ slug: z.string().min(1) }).parse(req.params);
    const items = await query<Record<string, unknown>>(
      `SELECT
         l.id,
         l.slug,
         l.category,
         l.name,
         l.name_ko,
         l.name_en,
         l.district,
         l.address,
         l.lat::text,
         l.lng::text,
         l.rating::float8 AS rating,
         l.review_count,
         l.thumbnail_url,
         l.image_urls,
         l.google_maps_url,
         l.google_maps_place_id,
         l.phone,
         l.contact_email,
         l.website,
         l.kakao_channel,
         l.description,
         l.description_ko,
         l.category_data,
         l.agoda_url
       FROM listings l
       WHERE l.slug = $1
         AND l.status = 'approved'
         AND l.is_active = TRUE
       LIMIT 1`,
      [slug],
    );

    const item = items[0];
    if (!item) {
      return res.status(404).json({ error: "Listing not found" });
    }

    res.json(normalizeListingRow(item));
  } catch (error) {
    next(error);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const payload = validateListingPayload(req.body);
    const verification = await verifyGooglePlace({
      name: payload.name,
      address: payload.address,
      googleMapsUrl: payload.google_maps_url,
      providedPlaceId: payload.google_maps_place_id ?? null,
    });

    if (!verification.googleMapsPlaceId) {
      return res.status(400).json({
        error: "google_maps_place_id could not be resolved. Configure GOOGLE_PLACES_API_KEY or provide a place id.",
      });
    }

    const slug = await generateUniqueSlug(payload.name, payload.district);
    const inserted = await query<{ id: number; slug: string }>(
      `INSERT INTO listings (
         slug, category, name, name_ko, name_en, district, address, lat, lng,
         google_maps_url, google_maps_place_id, phone, contact_email, website, kakao_channel,
         thumbnail_url, image_urls, description, description_ko,
         korean_friendly, korean_speaking_staff, korean_menu_signage,
         category_data, agoda_url, agoda_hotel_id, booking_url, tripcom_url,
         owner_id, status, source, place_id_verified, url_verified, last_verified_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9,
         $10, $11, $12, $13, $14, $15,
         $16, $17::jsonb, $18, $19,
         $20, $21, $22,
         $23::jsonb, $24, $25, $26, $27,
         $28, 'pending', 'self_registered', $29, $30, $31
       )
       RETURNING id, slug`,
      [
        slug,
        payload.category,
        payload.name,
        payload.name_ko,
        payload.name_en,
        payload.district,
        verification.address,
        verification.lat ?? payload.lat ?? null,
        verification.lng ?? payload.lng ?? null,
        payload.google_maps_url,
        verification.googleMapsPlaceId,
        payload.phone,
        payload.contact_email,
        payload.website,
        payload.kakao_channel,
        payload.thumbnail_url ?? payload.image_urls[0]?.url ?? null,
        JSON.stringify(payload.image_urls),
        payload.description,
        payload.description_ko,
        payload.korean_friendly ?? false,
        payload.korean_speaking_staff ?? false,
        payload.korean_menu_signage ?? false,
        JSON.stringify(payload.category_data),
        payload.agoda_url,
        payload.agoda_hotel_id,
        payload.booking_url,
        payload.tripcom_url,
        req.authUser!.id,
        verification.placeIdVerified,
        verification.urlVerified,
        verification.verifiedAt,
      ],
    );

    res.status(201).json({
      id: inserted[0].id,
      slug: inserted[0].slug,
      verification_mode: verification.verificationMode,
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    const currentRows = await query<{ owner_id: number | null; status: string }>(
      `SELECT owner_id, status
       FROM listings
       WHERE id = $1
       LIMIT 1`,
      [id],
    );

    const current = currentRows[0];
    if (!current) {
      return res.status(404).json({ error: "Listing not found" });
    }

    if (current.owner_id !== req.authUser!.id) {
      return res.status(403).json({ error: "You can only edit your own listings" });
    }

    const payload = validateListingPayload(req.body);
    const verification = await verifyGooglePlace({
      name: payload.name,
      address: payload.address,
      googleMapsUrl: payload.google_maps_url,
      providedPlaceId: payload.google_maps_place_id ?? null,
    });

    if (!verification.googleMapsPlaceId) {
      return res.status(400).json({
        error: "google_maps_place_id could not be resolved. Configure GOOGLE_PLACES_API_KEY or provide a place id.",
      });
    }

    const slug = await generateUniqueSlug(payload.name, payload.district, id);

    await query(
      `UPDATE listings
       SET
         slug = $2,
         category = $3,
         name = $4,
         name_ko = $5,
         name_en = $6,
         district = $7,
         address = $8,
         lat = $9,
         lng = $10,
         google_maps_url = $11,
         google_maps_place_id = $12,
         phone = $13,
         contact_email = $14,
         website = $15,
         kakao_channel = $16,
         thumbnail_url = $17,
         image_urls = $18::jsonb,
         description = $19,
         description_ko = $20,
         korean_friendly = $21,
         korean_speaking_staff = $22,
         korean_menu_signage = $23,
         category_data = $24::jsonb,
         agoda_url = $25,
         agoda_hotel_id = $26,
         booking_url = $27,
         tripcom_url = $28,
         status = 'pending',
         rejection_reason = NULL,
         place_id_verified = $29,
         url_verified = $30,
         last_verified_at = $31
       WHERE id = $1`,
      [
        id,
        slug,
        payload.category,
        payload.name,
        payload.name_ko,
        payload.name_en,
        payload.district,
        verification.address,
        verification.lat ?? payload.lat ?? null,
        verification.lng ?? payload.lng ?? null,
        payload.google_maps_url,
        verification.googleMapsPlaceId,
        payload.phone,
        payload.contact_email,
        payload.website,
        payload.kakao_channel,
        payload.thumbnail_url ?? payload.image_urls[0]?.url ?? null,
        JSON.stringify(payload.image_urls),
        payload.description,
        payload.description_ko,
        payload.korean_friendly ?? false,
        payload.korean_speaking_staff ?? false,
        payload.korean_menu_signage ?? false,
        JSON.stringify(payload.category_data),
        payload.agoda_url,
        payload.agoda_hotel_id,
        payload.booking_url,
        payload.tripcom_url,
        verification.placeIdVerified,
        verification.urlVerified,
        verification.verifiedAt,
      ],
    );

    res.json({ ok: true, slug });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    await query(
      `UPDATE listings
       SET status = 'archived', is_active = FALSE
       WHERE id = $1 AND owner_id = $2`,
      [id, req.authUser!.id],
    );

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
