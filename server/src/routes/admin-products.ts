// server/src/routes/admin-products.ts
import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAdmin } from "../lib/auth.js";

const router = Router();

const productSchema = z.object({
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/, "slug는 소문자, 숫자, 하이픈만 가능"),
  category: z.enum(["package", "pickup"]),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  thumbnail_url: z.string().url().optional().or(z.literal("")),
  base_price: z.number().int().min(0),
  sort_order: z.number().int().default(0),
  is_active: z.boolean().default(true),
});

// 관리자 전체 목록
router.get("/", requireAdmin, async (_req, res, next) => {
  try {
    const items = await query<Record<string, unknown>>(
      `SELECT
         p.id, p.slug, p.category, p.title, p.thumbnail_url,
         p.base_price, p.is_active, p.sort_order, p.created_at,
         COALESCE(
           json_agg(
             json_build_object('id', o.id, 'label', o.label, 'price_delta', o.price_delta, 'sort_order', o.sort_order)
             ORDER BY o.sort_order
           ) FILTER (WHERE o.id IS NOT NULL),
           '[]'
         ) AS options
       FROM products p
       LEFT JOIN product_options o ON o.product_id = p.id
       GROUP BY p.id
       ORDER BY p.sort_order ASC, p.created_at DESC`,
    );
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

// 상품 등록
router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const data = productSchema.parse(req.body);
    const rows = await query<{ id: number; slug: string }>(
      `INSERT INTO products (slug, category, title, description, thumbnail_url, base_price, sort_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, slug`,
      [data.slug, data.category, data.title, data.description ?? null,
       data.thumbnail_url || null, data.base_price, data.sort_order, data.is_active],
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    next(error);
  }
});

// 상품 수정
router.put("/:id", requireAdmin, async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    const data = productSchema.parse(req.body);
    await query(
      `UPDATE products
       SET slug=$1, category=$2, title=$3, description=$4, thumbnail_url=$5,
           base_price=$6, sort_order=$7, is_active=$8
       WHERE id=$9`,
      [data.slug, data.category, data.title, data.description ?? null,
       data.thumbnail_url || null, data.base_price, data.sort_order, data.is_active, id],
    );
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// 공개/숨김 토글
router.patch("/:id/toggle", requireAdmin, async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    const rows = await query<{ is_active: boolean }>(
      `UPDATE products SET is_active = NOT is_active WHERE id = $1 RETURNING is_active`,
      [id],
    );
    if (!rows[0]) return res.status(404).json({ error: "Product not found" });
    res.json({ ok: true, is_active: rows[0].is_active });
  } catch (error) {
    next(error);
  }
});

// 상품 삭제 (orders 테이블 없을 때는 무조건 허용)
router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    await query(`DELETE FROM products WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// 옵션 추가
router.post("/:id/options", requireAdmin, async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    const { label, price_delta, sort_order } = z.object({
      label: z.string().min(1).max(100),
      price_delta: z.number().int().min(0),
      sort_order: z.number().int().default(0),
    }).parse(req.body);

    const rows = await query<{ id: number; label: string; price_delta: number; sort_order: number }>(
      `INSERT INTO product_options (product_id, label, price_delta, sort_order)
       VALUES ($1, $2, $3, $4)
       RETURNING id, label, price_delta, sort_order`,
      [id, label, price_delta, sort_order],
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    next(error);
  }
});

// 옵션 삭제
router.delete("/options/:optionId", requireAdmin, async (req, res, next) => {
  try {
    const { optionId } = z.object({ optionId: z.coerce.number().int().positive() }).parse(req.params);
    await query(`DELETE FROM product_options WHERE id = $1`, [optionId]);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
