// server/src/routes/orders.ts
import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth } from "../lib/auth.js";
import { sendPendingPaymentAlimtalk } from "../lib/alimtalk.js";

const router = Router();

const createOrderSchema = z.object({
  product_id: z.number().int().positive(),
  selected_option_ids: z.array(z.number().int().positive()).default([]),
  orderer_name: z.string().min(1).max(100),
  orderer_phone: z.string().min(1).max(30),
  orderer_email: z.string().email().max(200),
  booking_data: z.record(z.string(), z.unknown()).default({}),
  memo: z.string().max(1000).optional(),
});

// 주문 생성
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const data = createOrderSchema.parse(req.body);
    const userId = req.authUser!.id;

    // 상품 조회 + 활성 확인
    const products = await query<{ id: number; base_price: number; title: string }>(
      `SELECT id, base_price, title FROM products WHERE id = $1 AND is_active = TRUE`,
      [data.product_id],
    );
    if (!products[0]) return res.status(404).json({ error: "Product not found" });
    const product = products[0];

    // 선택 옵션 조회
    let optionRows: { id: number; label: string; price_delta: number }[] = [];
    if (data.selected_option_ids.length > 0) {
      optionRows = await query<{ id: number; label: string; price_delta: number }>(
        `SELECT id, label, price_delta FROM product_options
         WHERE id = ANY($1) AND product_id = $2`,
        [data.selected_option_ids, data.product_id],
      );
    }

    if (optionRows.length !== data.selected_option_ids.length) {
      return res.status(400).json({ error: "Invalid options for this product" });
    }

    // 총액 계산
    const total_price =
      product.base_price +
      optionRows.reduce((sum, o) => sum + o.price_delta, 0);

    // 주문 생성
    const orderRows = await query<{ id: number }>(
      `INSERT INTO orders
         (user_id, product_id, total_price, orderer_name, orderer_phone, orderer_email, booking_data, memo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        userId, data.product_id, total_price,
        data.orderer_name, data.orderer_phone, data.orderer_email,
        JSON.stringify(data.booking_data),
        data.memo ?? null,
      ],
    );
    if (!orderRows[0]) {
      return res.status(500).json({ error: "Failed to create order" });
    }
    const orderId = orderRows[0].id;

    // 옵션 스냅샷 저장
    for (const opt of optionRows) {
      await query(
        `INSERT INTO order_options (order_id, option_id, label, price_delta) VALUES ($1, $2, $3, $4)`,
        [orderId, opt.id, opt.label, opt.price_delta],
      );
    }

    // 알림톡: pending_payment (은행 정보 포함, 비동기 fire-and-forget)
    const settingsRows = await query<{ key: string; value: string }>(
      "SELECT key, value FROM site_settings WHERE key = ANY($1)",
      [["bank_name", "bank_account", "bank_holder", "bank_notice", "company_email"]],
    );
    const s = Object.fromEntries(settingsRows.map((r) => [r.key, r.value]));
    sendPendingPaymentAlimtalk(
      {
        id: orderId,
        orderer_name: data.orderer_name,
        orderer_phone: data.orderer_phone,
        product_title: product.title,
        total_price,
      },
      {
        bank_name: s.bank_name ?? "",
        bank_account: s.bank_account ?? "",
        bank_holder: s.bank_holder ?? "",
        bank_notice: s.bank_notice ?? "",
        company_email: s.company_email ?? "",
      },
    ).catch(console.error);

    res.status(201).json({ id: orderId, status: "pending_payment", total_price });
  } catch (error) {
    next(error);
  }
});

// 내 주문 목록
router.get("/my", requireAuth, async (req, res, next) => {
  try {
    const userId = req.authUser!.id;

    const items = await query<Record<string, unknown>>(
      `SELECT
         o.id, o.status, o.total_price, o.orderer_name, o.orderer_phone, o.orderer_email,
         o.booking_data, o.memo, o.admin_memo, o.created_at,
         p.title AS product_title, p.category AS product_category,
         p.slug AS product_slug, p.thumbnail_url AS product_thumbnail,
         COALESCE(
           json_agg(
             json_build_object('label', oo.label, 'price_delta', oo.price_delta)
           ) FILTER (WHERE oo.id IS NOT NULL),
           '[]'
         ) AS options
       FROM orders o
       JOIN products p ON p.id = o.product_id
       LEFT JOIN order_options oo ON oo.order_id = o.id
       WHERE o.user_id = $1
       GROUP BY o.id, p.id
       ORDER BY o.created_at DESC`,
      [userId],
    );

    res.json({ items });
  } catch (error) {
    next(error);
  }
});

export default router;
