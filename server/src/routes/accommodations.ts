import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import type { AccommodationListItem } from "../types.js";

const router = Router();

const filtersSchema = z.object({
  district: z.string().optional(),
  price_min: z.coerce.number().int().nonnegative().optional(),
  price_max: z.coerce.number().int().nonnegative().optional(),
  type: z.enum(["hotel", "resort", "apartment", "villa", "guesthouse"]).optional(),
  sort: z.enum(["price_asc", "price_desc", "rating_desc"]).optional().default("price_asc"),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  amenities: z.string().optional(),
});

function injectAffiliate(url: string | null) {
  if (!url) return null;
  return url.replace("{AFFILIATE_ID}", process.env.AGODA_AFFILIATE_ID || "");
}

function normalizeRating(value: number | string | null) {
  if (value === null || value === undefined) {
    return null;
  }
  return typeof value === "number" ? value : Number(value);
}

function buildWhereClause(filters: z.infer<typeof filtersSchema>) {
  const clauses: string[] = ["is_active = TRUE"];
  const params: unknown[] = [];

  if (filters.district) {
    params.push(filters.district);
    clauses.push(`district = $${params.length}`);
  }

  if (typeof filters.price_min === "number") {
    params.push(filters.price_min);
    clauses.push(`price_min_usd >= $${params.length}`);
  }

  if (typeof filters.price_max === "number") {
    params.push(filters.price_max);
    clauses.push(`price_min_usd <= $${params.length}`);
  }

  if (filters.type) {
    params.push(filters.type);
    clauses.push(`type = $${params.length}`);
  }

  if (filters.amenities) {
    const amenities = filters.amenities
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (amenities.length > 0) {
      params.push(JSON.stringify(amenities));
      clauses.push(`amenities @> $${params.length}::jsonb`);
    }
  }

  return { whereSql: clauses.join(" AND "), params };
}

function getSortClause(sort: z.infer<typeof filtersSchema>["sort"]) {
  switch (sort) {
    case "price_desc":
      return "price_min_usd DESC, rating DESC NULLS LAST";
    case "rating_desc":
      return "rating DESC NULLS LAST, price_min_usd ASC";
    case "price_asc":
    default:
      return "price_min_usd ASC, rating DESC NULLS LAST";
  }
}

router.get("/", async (req, res) => {
  const filters = filtersSchema.parse(req.query);
  const { whereSql, params } = buildWhereClause(filters);
  const orderBy = getSortClause(filters.sort);

  const countRows = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM accommodations WHERE ${whereSql}`,
    params,
  );

  const listParams = [...params, filters.limit];
  const items = await query<AccommodationListItem>(
    `SELECT
       id,
       slug,
       name,
       name_ko,
       type,
       district,
       price_min_usd,
       price_max_usd,
       price_monthly_usd,
       rating::float8 AS rating,
       review_count,
       COALESCE(ARRAY(SELECT jsonb_array_elements_text(amenities)), ARRAY[]::text[]) AS amenities,
       thumbnail_url,
       agoda_url
     FROM accommodations
     WHERE ${whereSql}
     ORDER BY ${orderBy}
     LIMIT $${listParams.length}`,
    listParams,
  );

  return res.json({
    total: Number(countRows[0]?.count ?? 0),
    items: items.map((item) => ({
      ...item,
      rating: normalizeRating(item.rating),
      agoda_url: injectAffiliate(item.agoda_url),
    })),
  });
});

router.get("/compare", async (req, res) => {
  const { ids } = z.object({
    ids: z.string().min(1),
  }).parse(req.query);

  const parsedIds = ids
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0)
    .slice(0, 4);

  if (parsedIds.length === 0) {
    return res.status(400).json({ error: "At least one valid id is required" });
  }

  const items = await query<AccommodationListItem & { image_urls: unknown; common_amenities: string[] }>(
    `SELECT
       id,
       slug,
       name,
       name_ko,
       type,
       district,
       price_min_usd,
       price_max_usd,
       price_monthly_usd,
       rating::float8 AS rating,
       review_count,
       COALESCE(ARRAY(SELECT jsonb_array_elements_text(amenities)), ARRAY[]::text[]) AS amenities,
       thumbnail_url,
       agoda_url
     FROM accommodations
     WHERE id = ANY($1::int[])
     ORDER BY array_position($1::int[], id)`,
    [parsedIds],
  );

  const commonAmenities = items.reduce<string[]>((carry, item, index) => {
    if (index === 0) return [...item.amenities];
    return carry.filter((amenity) => item.amenities.includes(amenity));
  }, []);

  return res.json({
    items: items.map((item) => ({
      ...item,
      rating: normalizeRating(item.rating),
      agoda_url: injectAffiliate(item.agoda_url),
    })),
    common_amenities: commonAmenities,
  });
});

router.get("/:slug", async (req, res) => {
  const { slug } = z.object({ slug: z.string().min(1) }).parse(req.params);

  const items = await query<AccommodationListItem & { address: string | null; lat: string | null; lng: string | null; image_urls: string[] | null }>(
    `SELECT
       id,
       slug,
       name,
       name_ko,
       type,
       district,
       address,
       lat::text,
       lng::text,
       price_min_usd,
       price_max_usd,
       price_monthly_usd,
       rating::float8 AS rating,
       review_count,
       COALESCE(ARRAY(SELECT jsonb_array_elements_text(amenities)), ARRAY[]::text[]) AS amenities,
       thumbnail_url,
       COALESCE(ARRAY(SELECT jsonb_array_elements_text(image_urls)), ARRAY[]::text[]) AS image_urls,
       agoda_url
     FROM accommodations
     WHERE slug = $1
     LIMIT 1`,
    [slug],
  );

  const item = items[0];
  if (!item) {
    return res.status(404).json({ error: "Accommodation not found" });
  }

  return res.json({
    ...item,
    rating: normalizeRating(item.rating),
    agoda_url: injectAffiliate(item.agoda_url),
  });
});

export default router;
