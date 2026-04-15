// server/src/routes/products.ts
import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";

const router = Router();

// 상품 목록 (공개, is_active만)
router.get("/", async (req, res, next) => {
  try {
    const { category, limit } = z.object({
      category: z.enum(["package", "pickup"]).optional(),
      limit: z.coerce.number().int().positive().max(50).default(20),
    }).parse(req.query);

    const conditions = ["p.is_active = TRUE"];
    const params: unknown[] = [];

    if (category) {
      params.push(category);
      conditions.push(`p.category = $${params.length}`);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;
    params.push(limit);

    const items = await query<Record<string, unknown>>(
      `SELECT
         p.id, p.slug, p.category, p.title, p.description,
         p.thumbnail_url, p.base_price, p.sort_order,
         COALESCE(
           json_agg(
             json_build_object('id', o.id, 'label', o.label, 'price_delta', o.price_delta, 'sort_order', o.sort_order)
             ORDER BY o.sort_order
           ) FILTER (WHERE o.id IS NOT NULL),
           '[]'
         ) AS options
       FROM products p
       LEFT JOIN product_options o ON o.product_id = p.id
       ${where}
       GROUP BY p.id
       ORDER BY p.sort_order ASC, p.created_at DESC
       LIMIT $${params.length}`,
      params,
    );

    res.json({ items });
  } catch (error) {
    next(error);
  }
});

// 상품 상세 (slug 기준)
router.get("/:slug", async (req, res, next) => {
  try {
    const { slug } = z.object({ slug: z.string().min(1) }).parse(req.params);

    const rows = await query<Record<string, unknown>>(
      `SELECT
         p.id, p.slug, p.category, p.title, p.description,
         p.thumbnail_url, p.base_price, p.sort_order,
         COALESCE(
           json_agg(
             json_build_object('id', o.id, 'label', o.label, 'price_delta', o.price_delta, 'sort_order', o.sort_order)
             ORDER BY o.sort_order
           ) FILTER (WHERE o.id IS NOT NULL),
           '[]'
         ) AS options
       FROM products p
       LEFT JOIN product_options o ON o.product_id = p.id
       WHERE p.slug = $1 AND p.is_active = TRUE
       GROUP BY p.id`,
      [slug],
    );

    if (!rows[0]) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

export default router;
