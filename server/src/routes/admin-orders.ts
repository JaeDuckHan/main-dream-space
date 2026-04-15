// server/src/routes/admin-orders.ts
import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAdmin } from "../lib/auth.js";
import {
  sendPaymentCheckingEmail,
  sendOrderConfirmedEmail,
  sendOrderCancelledEmail,
} from "../lib/email.js";
import {
  sendPaymentCheckingAlimtalk,
  sendOrderConfirmedAlimtalk,
  sendOrderCancelledAlimtalk,
} from "../lib/alimtalk.js";

const router = Router();

// 주문 목록
router.get("/", requireAdmin, async (req, res, next) => {
  try {
    const { status, page, limit } = z.object({
      status: z.enum(["pending_payment", "payment_checking", "confirmed", "cancelled"]).optional(),
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(50).default(20),
    }).parse(req.query);

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (status) {
      params.push(status);
      conditions.push(`o.status = $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(limit);
    params.push((page - 1) * limit);

    const items = await query<Record<string, unknown>>(
      `SELECT
         o.id, o.status, o.total_price, o.orderer_name, o.orderer_phone, o.orderer_email,
         o.booking_data, o.memo, o.admin_memo, o.created_at,
         p.title AS product_title, p.category AS product_category, p.slug AS product_slug
       FROM orders o
       JOIN products p ON p.id = o.product_id
       ${where}
       ORDER BY o.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    const countParams: unknown[] = [];
    const countConditions: string[] = [];
    if (status) {
      countParams.push(status);
      countConditions.push(`status = $${countParams.length}`);
    }
    const countWhere = countConditions.length > 0 ? `WHERE ${countConditions.join(" AND ")}` : "";
    const countRows = await query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM orders ${countWhere}`,
      countParams,
    );
    const total = Number(countRows[0]?.count ?? 0);

    res.json({ items, total });
  } catch (error) {
    next(error);
  }
});

// 주문 상세
router.get("/:id", requireAdmin, async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);

    const rows = await query<Record<string, unknown>>(
      `SELECT
         o.id, o.status, o.total_price, o.orderer_name, o.orderer_phone, o.orderer_email,
         o.booking_data, o.memo, o.admin_memo, o.created_at, o.updated_at,
         p.title AS product_title, p.category AS product_category, p.slug AS product_slug,
         COALESCE(
           json_agg(
             json_build_object('label', oo.label, 'price_delta', oo.price_delta)
           ) FILTER (WHERE oo.id IS NOT NULL),
           '[]'
         ) AS options
       FROM orders o
       JOIN products p ON p.id = o.product_id
       LEFT JOIN order_options oo ON oo.order_id = o.id
       WHERE o.id = $1
       GROUP BY o.id, p.id`,
      [id],
    );

    if (!rows[0]) return res.status(404).json({ error: "Order not found" });
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

// 상태 변경 + 이메일 트리거
router.patch("/:id/status", requireAdmin, async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    const { status } = z.object({
      status: z.enum(["payment_checking", "confirmed", "cancelled"]),
    }).parse(req.body);

    const rows = await query<{
      id: number; status: string; orderer_email: string;
      orderer_name: string; orderer_phone: string; product_title: string; total_price: number;
    }>(
      `UPDATE orders o
       SET status = $1
       FROM products p
       WHERE o.id = $2 AND p.id = o.product_id
       RETURNING o.id, o.status, o.orderer_email, o.orderer_name, o.orderer_phone,
                 o.total_price, p.title AS product_title`,
      [status, id],
    );

    if (!rows[0]) return res.status(404).json({ error: "Order not found" });

    const order = rows[0];
    const emailData = {
      id: order.id,
      orderer_email: order.orderer_email,
      orderer_name: order.orderer_name,
      product_title: order.product_title,
      total_price: order.total_price,
    };

    // 이메일 발송 (비동기, 실패해도 응답에 영향 없음)
    if (status === "payment_checking") {
      sendPaymentCheckingEmail(emailData).catch(console.error);
    } else if (status === "confirmed") {
      sendOrderConfirmedEmail(emailData).catch(console.error);
    } else if (status === "cancelled") {
      sendOrderCancelledEmail(emailData).catch(console.error);
    }

    // 알림톡 발송 (비동기, 실패해도 응답에 영향 없음)
    const alimtalkOrder = {
      id: order.id,
      orderer_name: order.orderer_name,
      orderer_phone: order.orderer_phone,
      product_title: order.product_title,
      total_price: order.total_price,
    };
    (async () => {
      const settingsRows = await query<{ key: string; value: string }>(
        "SELECT key, value FROM site_settings WHERE key = 'company_email'",
        [],
      );
      const companyEmail = settingsRows[0]?.value ?? "";
      if (status === "payment_checking") {
        await sendPaymentCheckingAlimtalk(alimtalkOrder, companyEmail);
      } else if (status === "confirmed") {
        await sendOrderConfirmedAlimtalk(alimtalkOrder, companyEmail);
      } else if (status === "cancelled") {
        await sendOrderCancelledAlimtalk(alimtalkOrder, companyEmail);
      }
    })().catch(console.error);

    res.json({ ok: true, status });
  } catch (error) {
    next(error);
  }
});

// 관리자 메모 저장
router.patch("/:id/memo", requireAdmin, async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    const { admin_memo } = z.object({ admin_memo: z.string().max(2000) }).parse(req.body);

    const rows = await query<{ id: number }>(
      `UPDATE orders SET admin_memo = $1 WHERE id = $2 RETURNING id`,
      [admin_memo, id],
    );
    if (!rows[0]) return res.status(404).json({ error: "Order not found" });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
