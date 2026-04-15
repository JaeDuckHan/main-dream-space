# 주문/결제 (무통장 입금) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 무통장 입금 기반 주문 시스템 구축 — 사용자가 상품 주문 후 계좌 안내를 받고, 관리자가 입금 확인·확정하며 이메일 알림을 발송

**Architecture:** `orders` + `order_options` + `site_settings` 테이블. 이메일은 Resend API. 주문서는 `/orders/new?product=:slug` 별도 페이지. 상태 변경은 관리자만 가능.

**Tech Stack:** Express, PostgreSQL, Zod, Resend (`resend` npm), React, React Router, Shadcn UI, TypeScript, Tailwind

---

## 파일 구조

| 파일 | 작업 |
|------|------|
| `server/migrations/010_orders.sql` | CREATE |
| `server/src/lib/email.ts` | CREATE |
| `server/src/routes/settings.ts` | CREATE |
| `server/src/routes/admin-settings.ts` | CREATE |
| `server/src/routes/orders.ts` | CREATE |
| `server/src/routes/admin-orders.ts` | CREATE |
| `server/src/index.ts` | MODIFY |
| `src/pages/OrderNew.tsx` | CREATE |
| `src/pages/MyOrders.tsx` | CREATE |
| `src/pages/admin/AdminOrders.tsx` | CREATE |
| `src/pages/admin/AdminSettings.tsx` | CREATE |
| `src/pages/ProductDetail.tsx` | MODIFY |
| `src/components/admin/AdminLayout.tsx` | MODIFY |
| `src/App.tsx` | MODIFY |

---

## Task 1: DB 마이그레이션

**Files:**
- Create: `server/migrations/010_orders.sql`

- [ ] **Step 1: 마이그레이션 파일 생성**

```sql
-- server/migrations/010_orders.sql
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  product_id INT NOT NULL REFERENCES products(id),
  status VARCHAR(30) NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'payment_checking', 'confirmed', 'cancelled')),
  total_price INT NOT NULL,
  orderer_name VARCHAR(100) NOT NULL,
  orderer_phone VARCHAR(30) NOT NULL,
  orderer_email VARCHAR(200) NOT NULL,
  booking_data JSONB NOT NULL DEFAULT '{}',
  memo TEXT,
  admin_memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_product ON orders(product_id);

DROP TRIGGER IF EXISTS trg_orders_updated ON orders;
CREATE TRIGGER trg_orders_updated
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS order_options (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  option_id INT REFERENCES product_options(id) ON DELETE SET NULL,
  label VARCHAR(100) NOT NULL,
  price_delta INT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_options_order ON order_options(order_id);

CREATE TABLE IF NOT EXISTS site_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_site_settings_updated ON site_settings;
CREATE TRIGGER trg_site_settings_updated
  BEFORE UPDATE ON site_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO site_settings (key, value) VALUES
  ('bank_name', ''),
  ('bank_account', ''),
  ('bank_holder', ''),
  ('bank_notice', '주문 후 24시간 내 입금해주세요'),
  ('company_name', ''),
  ('company_ceo', ''),
  ('company_biz_no', ''),
  ('company_email', ''),
  ('company_address', '')
ON CONFLICT (key) DO NOTHING;
```

- [ ] **Step 2: 마이그레이션 실행**

```bash
cd server && node scripts/run-sql.mjs migrations/010_orders.sql
```
Expected: 오류 없이 완료. DB 미실행 환경이면 파일만 커밋.

- [ ] **Step 3: 커밋**

```bash
git add server/migrations/010_orders.sql
git commit -m "feat: orders, order_options, site_settings migration"
```

---

## Task 2: Resend 설치 + 이메일 유틸

**Files:**
- Modify: `server/package.json` (bun add)
- Create: `server/src/lib/email.ts`

- [ ] **Step 1: resend 패키지 설치**

```bash
cd server && bun add resend
```
Expected: `resend` 패키지가 package.json dependencies에 추가됨.

- [ ] **Step 2: email.ts 생성**

```typescript
// server/src/lib/email.ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? "noreply@luckydanang.com";

export interface OrderEmailData {
  id: number;
  orderer_email: string;
  orderer_name: string;
  product_title: string;
  total_price: number;
}

function formatPrice(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}

export async function sendPaymentCheckingEmail(order: OrderEmailData): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;
  await resend.emails.send({
    from: FROM,
    to: order.orderer_email,
    subject: `[럭키다낭] 입금 확인 중입니다 (#${order.id})`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <h2 style="color:#0f172a">입금 확인 중입니다</h2>
        <p>${order.orderer_name}님, 안녕하세요.</p>
        <p>아래 주문의 입금 내역을 확인 중입니다. 확인 완료 시 별도 안내 드리겠습니다.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px 0;color:#64748b">주문 번호</td><td style="padding:8px 0;font-weight:600">#${order.id}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b">상품명</td><td style="padding:8px 0">${order.product_title}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b">결제 금액</td><td style="padding:8px 0;font-weight:600;color:#1d4ed8">${formatPrice(order.total_price)}</td></tr>
        </table>
        <p style="color:#64748b;font-size:14px">문의: ${FROM}</p>
        <p style="color:#94a3b8;font-size:12px">럭키다낭</p>
      </div>
    `,
  });
}

export async function sendOrderConfirmedEmail(order: OrderEmailData): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;
  await resend.emails.send({
    from: FROM,
    to: order.orderer_email,
    subject: `[럭키다낭] 주문이 확정되었습니다 (#${order.id})`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <h2 style="color:#15803d">주문이 확정되었습니다 ✅</h2>
        <p>${order.orderer_name}님, 안녕하세요.</p>
        <p>주문이 확정되었습니다. 이용해 주셔서 감사합니다.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px 0;color:#64748b">주문 번호</td><td style="padding:8px 0;font-weight:600">#${order.id}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b">상품명</td><td style="padding:8px 0">${order.product_title}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b">결제 금액</td><td style="padding:8px 0;font-weight:600;color:#1d4ed8">${formatPrice(order.total_price)}</td></tr>
        </table>
        <p style="color:#64748b;font-size:14px">문의: ${FROM}</p>
        <p style="color:#94a3b8;font-size:12px">럭키다낭</p>
      </div>
    `,
  });
}

export async function sendOrderCancelledEmail(order: OrderEmailData): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;
  await resend.emails.send({
    from: FROM,
    to: order.orderer_email,
    subject: `[럭키다낭] 주문이 취소되었습니다 (#${order.id})`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <h2 style="color:#dc2626">주문이 취소되었습니다</h2>
        <p>${order.orderer_name}님, 안녕하세요.</p>
        <p>아래 주문이 취소되었습니다. 문의 사항이 있으시면 연락해 주세요.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px 0;color:#64748b">주문 번호</td><td style="padding:8px 0;font-weight:600">#${order.id}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b">상품명</td><td style="padding:8px 0">${order.product_title}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b">결제 금액</td><td style="padding:8px 0">${formatPrice(order.total_price)}</td></tr>
        </table>
        <p style="color:#64748b;font-size:14px">환불 문의: ${FROM}</p>
        <p style="color:#94a3b8;font-size:12px">럭키다낭</p>
      </div>
    `,
  });
}
```

- [ ] **Step 3: 커밋**

```bash
git add server/package.json server/bun.lock server/src/lib/email.ts
git commit -m "feat: Resend email util with order status templates"
```

---

## Task 3: Settings API

**Files:**
- Create: `server/src/routes/settings.ts`
- Create: `server/src/routes/admin-settings.ts`

- [ ] **Step 1: settings.ts 생성 (공개 GET)**

```typescript
// server/src/routes/settings.ts
import { Router } from "express";
import { query } from "../db.js";

const router = Router();

const SETTING_KEYS = [
  "bank_name", "bank_account", "bank_holder", "bank_notice",
  "company_name", "company_ceo", "company_biz_no", "company_email", "company_address",
] as const;

router.get("/", async (_req, res, next) => {
  try {
    const rows = await query<{ key: string; value: string }>(
      `SELECT key, value FROM site_settings WHERE key = ANY($1)`,
      [SETTING_KEYS],
    );
    const result: Record<string, string> = {};
    for (const key of SETTING_KEYS) {
      result[key] = rows.find((r) => r.key === key)?.value ?? "";
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
```

- [ ] **Step 2: admin-settings.ts 생성 (관리자 PUT)**

```typescript
// server/src/routes/admin-settings.ts
import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAdmin } from "../lib/auth.js";

const router = Router();

const ALLOWED_KEYS = new Set([
  "bank_name", "bank_account", "bank_holder", "bank_notice",
  "company_name", "company_ceo", "company_biz_no", "company_email", "company_address",
]);

router.put("/", requireAdmin, async (req, res, next) => {
  try {
    const body = z.record(z.string(), z.string()).parse(req.body);
    const entries = Object.entries(body).filter(([k]) => ALLOWED_KEYS.has(k));
    if (entries.length === 0) return res.json({ ok: true });

    for (const [key, value] of entries) {
      await query(
        `INSERT INTO site_settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, value],
      );
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
```

- [ ] **Step 3: 커밋**

```bash
git add server/src/routes/settings.ts server/src/routes/admin-settings.ts
git commit -m "feat: site settings API (public GET, admin PUT)"
```

---

## Task 4: 사용자 Orders API

**Files:**
- Create: `server/src/routes/orders.ts`

- [ ] **Step 1: orders.ts 생성**

```typescript
// server/src/routes/orders.ts
import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth } from "../lib/auth.js";

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
    const userId = req.session.userId as number;

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
    const orderId = orderRows[0].id;

    // 옵션 스냅샷 저장
    for (const opt of optionRows) {
      await query(
        `INSERT INTO order_options (order_id, option_id, label, price_delta) VALUES ($1, $2, $3, $4)`,
        [orderId, opt.id, opt.label, opt.price_delta],
      );
    }

    res.status(201).json({ id: orderId, status: "pending_payment", total_price });
  } catch (error) {
    next(error);
  }
});

// 내 주문 목록
router.get("/my", requireAuth, async (req, res, next) => {
  try {
    const userId = req.session.userId as number;

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
```

- [ ] **Step 2: 커밋**

```bash
git add server/src/routes/orders.ts
git commit -m "feat: user orders API (create, my list)"
```

---

## Task 5: 관리자 Orders API

**Files:**
- Create: `server/src/routes/admin-orders.ts`

- [ ] **Step 1: admin-orders.ts 생성**

```typescript
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
      orderer_name: string; product_title: string; total_price: number;
    }>(
      `UPDATE orders o
       SET status = $1
       FROM products p
       WHERE o.id = $2 AND p.id = o.product_id
       RETURNING o.id, o.status, o.orderer_email, o.orderer_name, o.total_price,
                 p.title AS product_title`,
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
```

- [ ] **Step 2: 커밋**

```bash
git add server/src/routes/admin-orders.ts
git commit -m "feat: admin orders API with status change and email trigger"
```

---

## Task 6: 백엔드 index.ts 라우트 등록

**Files:**
- Modify: `server/src/index.ts`

- [ ] **Step 1: import 추가** (adminProductRoutes import 아래에)

```typescript
import orderRoutes from "./routes/orders.js";
import adminOrderRoutes from "./routes/admin-orders.js";
import settingsRoutes from "./routes/settings.js";
import adminSettingsRoutes from "./routes/admin-settings.js";
```

- [ ] **Step 2: app.use 등록** (`app.use("/api/admin/products", adminProductRoutes);` 아래에)

```typescript
app.use("/api/orders", orderRoutes);
app.use("/api/admin/orders", adminOrderRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/admin/settings", adminSettingsRoutes);
```

- [ ] **Step 3: 커밋**

```bash
git add server/src/index.ts
git commit -m "feat: register orders and settings routes"
```

---

## Task 7: AdminSettings 페이지

**Files:**
- Create: `src/pages/admin/AdminSettings.tsx`

- [ ] **Step 1: AdminSettings.tsx 생성**

```tsx
// src/pages/admin/AdminSettings.tsx
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const BANK_KEYS = ["bank_name", "bank_account", "bank_holder", "bank_notice"] as const;
const COMPANY_KEYS = ["company_name", "company_ceo", "company_biz_no", "company_email", "company_address"] as const;

const LABELS: Record<string, string> = {
  bank_name: "은행명",
  bank_account: "계좌번호",
  bank_holder: "예금주",
  bank_notice: "입금 안내 문구",
  company_name: "회사명",
  company_ceo: "대표자",
  company_biz_no: "통신판매업신고번호",
  company_email: "이메일",
  company_address: "주소",
};

type SettingsMap = Record<string, string>;

export default function AdminSettings() {
  const [settings, setSettings] = useState<SettingsMap>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d: SettingsMap) => setSettings(d))
      .catch(() => {});
  }, []);

  const handleChange = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        alert("저장에 실패했습니다.");
      }
    } catch {
      alert("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const renderField = (key: string) => (
    <div key={key}>
      <Label className="text-xs text-slate-500">{LABELS[key]}</Label>
      <Input
        value={settings[key] ?? ""}
        onChange={(e) => handleChange(key, e.target.value)}
        placeholder={`미입력 시 표시 안 됨`}
        className="mt-1"
      />
    </div>
  );

  return (
    <div className="p-8 max-w-xl">
      <h1 className="text-2xl font-bold text-slate-800">사이트 설정</h1>
      <p className="mt-1 text-sm text-slate-500 mb-8">입력 항목이 비어 있으면 해당 부분은 표시되지 않습니다.</p>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-700 border-b border-slate-200 pb-2 mb-4">무통장 입금 계좌</h2>
        <div className="space-y-4">
          {BANK_KEYS.map(renderField)}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-700 border-b border-slate-200 pb-2 mb-4">회사 정보 <span className="font-normal text-slate-400">(푸터 표시)</span></h2>
        <div className="space-y-4">
          {COMPANY_KEYS.map(renderField)}
        </div>
      </section>

      <Button onClick={() => void save()} disabled={saving}>
        {saving ? "저장 중..." : "설정 저장"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/pages/admin/AdminSettings.tsx
git commit -m "feat: AdminSettings page"
```

---

## Task 8: AdminOrders 페이지

**Files:**
- Create: `src/pages/admin/AdminOrders.tsx`

- [ ] **Step 1: AdminOrders.tsx 생성**

```tsx
// src/pages/admin/AdminOrders.tsx
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type OrderStatus = "pending_payment" | "payment_checking" | "confirmed" | "cancelled";

interface Order {
  id: number;
  status: OrderStatus;
  total_price: number;
  orderer_name: string;
  orderer_phone: string;
  orderer_email: string;
  booking_data: Record<string, unknown>;
  memo: string | null;
  admin_memo: string | null;
  created_at: string;
  product_title: string;
  product_category: string;
  options: { label: string; price_delta: number }[];
}

const STATUS_BADGE: Record<OrderStatus, { label: string; className: string }> = {
  pending_payment: { label: "결제 대기", className: "bg-yellow-100 text-yellow-800" },
  payment_checking: { label: "확인 중", className: "bg-blue-100 text-blue-700" },
  confirmed: { label: "확정", className: "bg-green-100 text-green-700" },
  cancelled: { label: "취소", className: "bg-red-100 text-red-600" },
};

const BOOKING_LABELS: Record<string, string> = {
  travel_start: "여행 시작일", travel_end: "여행 종료일",
  num_people: "인원 수", date: "날짜",
  pickup_type: "픽업 타입", flight_no: "항공편 번호",
  flight_time: "도착/출발 시간", hotel_name: "호텔명",
};

const PICKUP_TYPE_LABEL: Record<string, string> = {
  airport_to_hotel: "공항 → 호텔",
  hotel_to_airport: "호텔 → 공항",
};

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Order | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [adminMemo, setAdminMemo] = useState("");
  const [savingMemo, setSavingMemo] = useState(false);

  const fetchOrders = () => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    fetch(`/api/admin/orders?${params}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setOrders(d.items ?? []))
      .catch(() => {});
  };

  useEffect(() => { fetchOrders(); }, [statusFilter]);

  const openDetail = (o: Order) => {
    setSelected(o);
    setAdminMemo(o.admin_memo ?? "");
    setSheetOpen(true);
  };

  const changeStatus = async (id: number, status: OrderStatus) => {
    await fetch(`/api/admin/orders/${id}/status`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setSheetOpen(false);
    fetchOrders();
  };

  const saveMemo = async () => {
    if (!selected) return;
    setSavingMemo(true);
    await fetch(`/api/admin/orders/${selected.id}/memo`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ admin_memo: adminMemo }),
    }).catch(() => {});
    setSavingMemo(false);
    fetchOrders();
  };

  const nextActions = (status: OrderStatus): { label: string; next: OrderStatus; variant: "default" | "destructive" | "outline" }[] => {
    if (status === "pending_payment") return [
      { label: "확인 시작", next: "payment_checking", variant: "default" },
      { label: "취소", next: "cancelled", variant: "destructive" },
    ];
    if (status === "payment_checking") return [
      { label: "확정", next: "confirmed", variant: "default" },
      { label: "취소", next: "cancelled", variant: "destructive" },
    ];
    return [];
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">주문 관리</h1>
          <p className="mt-1 text-sm text-slate-500">전체 {orders.length}건</p>
        </div>
      </div>

      <Tabs value={statusFilter} onValueChange={setStatusFilter} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">전체</TabsTrigger>
          <TabsTrigger value="pending_payment">결제 대기</TabsTrigger>
          <TabsTrigger value="payment_checking">확인 중</TabsTrigger>
          <TabsTrigger value="confirmed">확정</TabsTrigger>
          <TabsTrigger value="cancelled">취소</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">#</th>
              <th className="px-4 py-3 text-left font-medium">상품</th>
              <th className="px-4 py-3 text-left font-medium">주문자</th>
              <th className="px-4 py-3 text-left font-medium">금액</th>
              <th className="px-4 py-3 text-left font-medium">상태</th>
              <th className="px-4 py-3 text-left font-medium">주문일</th>
              <th className="px-4 py-3 text-left font-medium">액션</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const badge = STATUS_BADGE[o.status];
              return (
                <tr key={o.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-400 text-xs">#{o.id}</td>
                  <td className="px-4 py-3 font-medium">{o.product_title}</td>
                  <td className="px-4 py-3">
                    <div>{o.orderer_name}</div>
                    <div className="text-xs text-slate-400">{o.orderer_phone}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{o.total_price.toLocaleString("ko-KR")}원</td>
                  <td className="px-4 py-3">
                    <Badge className={badge.className}>{badge.label}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {new Date(o.created_at).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="outline" onClick={() => openDetail(o)}>상세</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-96 overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>주문 #{selected.id}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4 text-sm">
                {/* 주문자 정보 */}
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">주문자</p>
                  <p className="font-medium">{selected.orderer_name}</p>
                  <p className="text-slate-500">{selected.orderer_phone}</p>
                  <p className="text-slate-500">{selected.orderer_email}</p>
                </div>

                {/* 금액 + 옵션 */}
                <div className="rounded-lg bg-slate-50 p-3 space-y-1">
                  <p className="text-xs text-slate-400">상품 / 금액</p>
                  <p className="font-medium">{selected.product_title}</p>
                  {selected.options.map((o, i) => (
                    <p key={i} className="text-xs text-slate-500">+ {o.label} ({o.price_delta.toLocaleString("ko-KR")}원)</p>
                  ))}
                  <p className="font-bold text-blue-600 pt-1">{selected.total_price.toLocaleString("ko-KR")}원</p>
                </div>

                {/* 예약 데이터 */}
                {Object.keys(selected.booking_data).length > 0 && (
                  <div className="rounded-lg bg-slate-50 p-3 space-y-1">
                    <p className="text-xs text-slate-400">예약 정보</p>
                    {Object.entries(selected.booking_data).map(([k, v]) => (
                      <p key={k} className="text-xs">
                        <span className="text-slate-500">{BOOKING_LABELS[k] ?? k}:</span>{" "}
                        <span>{k === "pickup_type" ? PICKUP_TYPE_LABEL[v as string] ?? String(v) : String(v)}</span>
                      </p>
                    ))}
                  </div>
                )}

                {/* 사용자 메모 */}
                {selected.memo && (
                  <div>
                    <p className="text-xs text-slate-400 mb-1">사용자 요청사항</p>
                    <p className="text-slate-600">{selected.memo}</p>
                  </div>
                )}

                {/* 관리자 메모 */}
                <div>
                  <p className="text-xs text-slate-400 mb-1">관리자 메모</p>
                  <Textarea
                    rows={3}
                    value={adminMemo}
                    onChange={(e) => setAdminMemo(e.target.value)}
                    placeholder="내부 메모 (사용자에게 표시됨)"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    disabled={savingMemo}
                    onClick={() => void saveMemo()}
                  >
                    {savingMemo ? "저장 중..." : "메모 저장"}
                  </Button>
                </div>

                {/* 상태 변경 버튼 */}
                {nextActions(selected.status).length > 0 && (
                  <div className="border-t pt-4 flex gap-2">
                    {nextActions(selected.status).map((a) => (
                      <Button
                        key={a.next}
                        variant={a.variant}
                        size="sm"
                        onClick={() => void changeStatus(selected.id, a.next)}
                      >
                        {a.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/pages/admin/AdminOrders.tsx
git commit -m "feat: AdminOrders page with status management and memo"
```

---

## Task 9: AdminLayout 사이드바 + App.tsx 라우트

**Files:**
- Modify: `src/components/admin/AdminLayout.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: AdminLayout.tsx 읽기 후 수정**

`src/components/admin/AdminLayout.tsx`를 읽어 navItems 배열을 찾는다.

"주문 관리" 항목의 `disabled: true` 제거하고, "설정" 항목 추가:
```tsx
{ href: "/admin/orders", label: "주문 관리", icon: "📋" },
// ... 기존 항목들 ...
{ href: "/admin/settings", label: "설정", icon: "⚙️" },
```

- [ ] **Step 2: App.tsx에 import + 라우트 추가**

AdminProducts import 아래에:
```tsx
import AdminOrders from "./pages/admin/AdminOrders";
import AdminSettings from "./pages/admin/AdminSettings";
import OrderNew from "./pages/OrderNew";
import MyOrders from "./pages/MyOrders";
```

AppShell 블록에 (다른 공개 라우트와 함께):
```tsx
<Route path="/orders/new" element={<OrderNew />} />
<Route path="/my/orders" element={<MyOrders />} />
```

AdminLayout 블록에 (다른 admin 라우트와 함께):
```tsx
<Route path="/admin/orders" element={<AdminOrders />} />
<Route path="/admin/settings" element={<AdminSettings />} />
```

- [ ] **Step 3: 커밋**

```bash
git add src/components/admin/AdminLayout.tsx src/App.tsx
git commit -m "feat: add orders and settings routes, activate sidebar"
```

---

## Task 10: OrderNew 주문서 페이지

**Files:**
- Create: `src/pages/OrderNew.tsx`

- [ ] **Step 1: OrderNew.tsx 생성**

```tsx
// src/pages/OrderNew.tsx
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";

interface ProductOption {
  id: number;
  label: string;
  price_delta: number;
}

interface Product {
  id: number;
  slug: string;
  category: "package" | "pickup";
  title: string;
  thumbnail_url: string | null;
  base_price: number;
  options: ProductOption[];
}

interface Settings {
  bank_name: string;
  bank_account: string;
  bank_holder: string;
  bank_notice: string;
}

interface PackageBooking {
  travel_start: string;
  travel_end: string;
  num_people: string;
}

interface PickupBooking {
  date: string;
  num_people: string;
  pickup_type: "airport_to_hotel" | "hotel_to_airport";
  flight_no: string;
  flight_time: string;
  hotel_name: string;
}

export default function OrderNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const productSlug = searchParams.get("product") ?? "";
  const optionIds = (searchParams.get("options") ?? "")
    .split(",")
    .filter(Boolean)
    .map(Number);

  const [product, setProduct] = useState<Product | null>(null);
  const [settings, setSettings] = useState<Settings>({ bank_name: "", bank_account: "", bank_holder: "", bank_notice: "" });
  const [selectedOptionIds, setSelectedOptionIds] = useState<number[]>(optionIds);
  const [ordererName, setOrdererName] = useState("");
  const [ordererPhone, setOrdererPhone] = useState("");
  const [ordererEmail, setOrdererEmail] = useState("");
  const [memo, setMemo] = useState("");
  const [packageBooking, setPackageBooking] = useState<PackageBooking>({ travel_start: "", travel_end: "", num_people: "1" });
  const [pickupBooking, setPickupBooking] = useState<PickupBooking>({
    date: "", num_people: "1", pickup_type: "airport_to_hotel",
    flight_no: "", flight_time: "", hotel_name: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    setOrdererName(user.display_name ?? "");
    setOrdererEmail(user.email ?? "");
  }, [user, navigate]);

  useEffect(() => {
    if (!productSlug) { navigate("/products"); return; }
    fetch(`/api/products/${productSlug}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setProduct)
      .catch(() => navigate("/products"));
  }, [productSlug, navigate]);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d: Settings) => setSettings(d))
      .catch(() => {});
  }, []);

  const selectedOptions = product?.options.filter((o) => selectedOptionIds.includes(o.id)) ?? [];
  const totalPrice = product
    ? product.base_price + selectedOptions.reduce((s, o) => s + o.price_delta, 0)
    : 0;

  const copyAccount = async () => {
    await navigator.clipboard.writeText(settings.bank_account);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const submit = async () => {
    if (!product) return;
    if (!ordererName.trim() || !ordererPhone.trim() || !ordererEmail.trim()) {
      alert("주문자 정보를 모두 입력해주세요.");
      return;
    }
    setSubmitting(true);

    const booking_data = product.category === "package"
      ? { travel_start: packageBooking.travel_start, travel_end: packageBooking.travel_end, num_people: Number(packageBooking.num_people) }
      : { ...pickupBooking, num_people: Number(pickupBooking.num_people) };

    const res = await fetch("/api/orders", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: product.id,
        selected_option_ids: selectedOptionIds,
        orderer_name: ordererName,
        orderer_phone: ordererPhone,
        orderer_email: ordererEmail,
        booking_data,
        memo: memo || undefined,
      }),
    }).catch(() => null);

    setSubmitting(false);
    if (!res?.ok) { alert("주문 중 오류가 발생했습니다."); return; }
    navigate("/my/orders");
  };

  if (!product) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">로딩 중...</div>;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container max-w-lg py-10">
        <h1 className="text-xl font-bold text-slate-800 mb-6">주문서 작성</h1>

        {/* 상품 요약 */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 mb-6">
          <p className="text-xs text-slate-400 mb-2">주문 상품</p>
          <div className="flex gap-3 items-center">
            {product.thumbnail_url ? (
              <img src={product.thumbnail_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-slate-200 flex items-center justify-center text-xl">
                {product.category === "pickup" ? "🚗" : "🏖️"}
              </div>
            )}
            <div className="flex-1">
              <p className="font-semibold text-slate-800">{product.title}</p>
              {selectedOptions.length > 0 && (
                <p className="text-xs text-slate-500">{selectedOptions.map((o) => o.label).join(", ")}</p>
              )}
              <p className="text-sm font-bold text-blue-600 mt-1">{totalPrice.toLocaleString("ko-KR")}원</p>
            </div>
          </div>
        </div>

        {/* 주문자 정보 */}
        <section className="mb-6 space-y-3">
          <h2 className="text-sm font-semibold text-slate-700 border-b pb-1">주문자 정보</h2>
          <div>
            <Label>이름</Label>
            <Input value={ordererName} onChange={(e) => setOrdererName(e.target.value)} placeholder="홍길동" />
          </div>
          <div>
            <Label>연락처</Label>
            <Input value={ordererPhone} onChange={(e) => setOrdererPhone(e.target.value)} placeholder="010-1234-5678" />
          </div>
          <div>
            <Label>이메일</Label>
            <Input value={ordererEmail} onChange={(e) => setOrdererEmail(e.target.value)} placeholder="hong@email.com" />
          </div>
        </section>

        {/* 패키지 예약 정보 */}
        {product.category === "package" && (
          <section className="mb-6 space-y-3">
            <h2 className="text-sm font-semibold text-slate-700 border-b pb-1">패키지 예약 정보</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>여행 시작일</Label>
                <Input type="date" value={packageBooking.travel_start} onChange={(e) => setPackageBooking((b) => ({ ...b, travel_start: e.target.value }))} />
              </div>
              <div>
                <Label>여행 종료일</Label>
                <Input type="date" value={packageBooking.travel_end} onChange={(e) => setPackageBooking((b) => ({ ...b, travel_end: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>인원 수</Label>
              <Input type="number" min="1" value={packageBooking.num_people} onChange={(e) => setPackageBooking((b) => ({ ...b, num_people: e.target.value }))} />
            </div>
          </section>
        )}

        {/* 픽업 예약 정보 */}
        {product.category === "pickup" && (
          <section className="mb-6 space-y-3">
            <h2 className="text-sm font-semibold text-slate-700 border-b pb-1">픽업 예약 정보</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>날짜</Label>
                <Input type="date" value={pickupBooking.date} onChange={(e) => setPickupBooking((b) => ({ ...b, date: e.target.value }))} />
              </div>
              <div>
                <Label>인원 수</Label>
                <Input type="number" min="1" value={pickupBooking.num_people} onChange={(e) => setPickupBooking((b) => ({ ...b, num_people: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>픽업 타입</Label>
              <div className="flex gap-4 mt-1">
                {[
                  { value: "airport_to_hotel", label: "공항 → 호텔" },
                  { value: "hotel_to_airport", label: "호텔 → 공항" },
                ].map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      name="pickup_type"
                      value={opt.value}
                      checked={pickupBooking.pickup_type === opt.value}
                      onChange={() => setPickupBooking((b) => ({ ...b, pickup_type: opt.value as PickupBooking["pickup_type"] }))}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>항공편 번호</Label>
                <Input value={pickupBooking.flight_no} onChange={(e) => setPickupBooking((b) => ({ ...b, flight_no: e.target.value }))} placeholder="VJ123" />
              </div>
              <div>
                <Label>도착/출발 시간</Label>
                <Input type="time" value={pickupBooking.flight_time} onChange={(e) => setPickupBooking((b) => ({ ...b, flight_time: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>호텔명</Label>
              <Input value={pickupBooking.hotel_name} onChange={(e) => setPickupBooking((b) => ({ ...b, hotel_name: e.target.value }))} placeholder="Hyatt Regency Da Nang" />
            </div>
          </section>
        )}

        {/* 요청사항 */}
        <section className="mb-6">
          <Label>요청사항 (선택)</Label>
          <Textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={2} placeholder="기타 요청사항을 입력해주세요" className="mt-1" />
        </section>

        {/* 무통장 입금 안내 */}
        {(settings.bank_name || settings.bank_account || settings.bank_holder) && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-6">
            <p className="text-xs font-semibold text-amber-800 mb-2">무통장 입금 안내</p>
            <div className="space-y-1 text-sm text-amber-900">
              {settings.bank_name && <p>은행: <strong>{settings.bank_name}</strong></p>}
              {settings.bank_account && (
                <div className="flex items-center gap-2">
                  <p>계좌: <strong>{settings.bank_account}</strong></p>
                  <button
                    onClick={() => void copyAccount()}
                    className="text-xs border border-amber-300 rounded px-2 py-0.5 bg-white text-amber-700 hover:bg-amber-100"
                  >
                    {copied ? "복사됨" : "복사"}
                  </button>
                </div>
              )}
              {settings.bank_holder && <p>예금주: <strong>{settings.bank_holder}</strong></p>}
              <p className="font-bold text-amber-800">금액: {totalPrice.toLocaleString("ko-KR")}원</p>
            </div>
            {settings.bank_notice && (
              <p className="text-xs text-amber-700 mt-2">※ {settings.bank_notice}</p>
            )}
          </div>
        )}

        <Button className="w-full" size="lg" disabled={submitting} onClick={() => void submit()}>
          {submitting ? "주문 중..." : "주문 완료"}
        </Button>
      </main>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/pages/OrderNew.tsx
git commit -m "feat: OrderNew page with package/pickup form and bank transfer info"
```

---

## Task 11: MyOrders 사용자 주문 내역

**Files:**
- Create: `src/pages/MyOrders.tsx`

- [ ] **Step 1: MyOrders.tsx 생성**

```tsx
// src/pages/MyOrders.tsx
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router-dom";

type OrderStatus = "pending_payment" | "payment_checking" | "confirmed" | "cancelled";

interface Order {
  id: number;
  status: OrderStatus;
  total_price: number;
  orderer_name: string;
  memo: string | null;
  admin_memo: string | null;
  created_at: string;
  product_title: string;
  product_slug: string;
  product_thumbnail: string | null;
  options: { label: string; price_delta: number }[];
}

interface Settings {
  bank_name: string;
  bank_account: string;
  bank_holder: string;
  bank_notice: string;
}

const STATUS_BADGE: Record<OrderStatus, { label: string; className: string }> = {
  pending_payment: { label: "결제 대기", className: "bg-yellow-100 text-yellow-800" },
  payment_checking: { label: "입금 확인 중", className: "bg-blue-100 text-blue-700" },
  confirmed: { label: "확정", className: "bg-green-100 text-green-700" },
  cancelled: { label: "취소", className: "bg-red-100 text-red-600" },
};

export default function MyOrders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<Settings>({ bank_name: "", bank_account: "", bank_holder: "", bank_notice: "" });
  const [copied, setCopied] = useState<number | null>(null);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    fetch("/api/orders/my", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setOrders(d.items ?? []))
      .catch(() => {});
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d: Settings) => setSettings(d))
      .catch(() => {});
  }, [user, navigate]);

  const copyAccount = async (orderId: number) => {
    await navigator.clipboard.writeText(settings.bank_account);
    setCopied(orderId);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container max-w-2xl py-10">
        <h1 className="text-xl font-bold text-slate-800 mb-6">내 주문 내역</h1>

        {orders.length === 0 ? (
          <p className="text-center text-slate-400 py-16">주문 내역이 없습니다.</p>
        ) : (
          <div className="space-y-4">
            {orders.map((o) => {
              const badge = STATUS_BADGE[o.status];
              return (
                <div key={o.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-semibold text-slate-800">{o.product_title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        #{o.id} · {new Date(o.created_at).toLocaleDateString("ko-KR")} · {o.total_price.toLocaleString("ko-KR")}원
                      </p>
                      {o.options.length > 0 && (
                        <p className="text-xs text-slate-500 mt-0.5">{o.options.map((opt) => opt.label).join(", ")}</p>
                      )}
                    </div>
                    <Badge className={badge.className}>{badge.label}</Badge>
                  </div>

                  {/* 결제 대기 시 계좌 안내 */}
                  {o.status === "pending_payment" && (settings.bank_name || settings.bank_account) && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 mb-3 text-sm text-amber-900">
                      <p className="text-xs font-semibold text-amber-800 mb-1">무통장 입금 안내</p>
                      {settings.bank_name && <p>은행: <strong>{settings.bank_name}</strong></p>}
                      {settings.bank_account && (
                        <div className="flex items-center gap-2">
                          <p>계좌: <strong>{settings.bank_account}</strong></p>
                          <button
                            onClick={() => void copyAccount(o.id)}
                            className="text-xs border border-amber-300 rounded px-2 py-0.5 bg-white hover:bg-amber-100"
                          >
                            {copied === o.id ? "복사됨" : "복사"}
                          </button>
                        </div>
                      )}
                      {settings.bank_holder && <p>예금주: <strong>{settings.bank_holder}</strong></p>}
                      <p className="font-bold mt-1">{o.total_price.toLocaleString("ko-KR")}원</p>
                      {settings.bank_notice && <p className="text-xs text-amber-700 mt-1">※ {settings.bank_notice}</p>}
                    </div>
                  )}

                  {/* 사용자 메모 */}
                  {o.memo && (
                    <div className="mt-2">
                      <p className="text-xs text-slate-400">내 요청사항</p>
                      <p className="text-sm text-slate-600">{o.memo}</p>
                    </div>
                  )}

                  {/* 관리자 메모 */}
                  {o.admin_memo && (
                    <div className="mt-2 rounded-lg bg-slate-50 p-3">
                      <p className="text-xs text-slate-400 mb-1">관리자 메모</p>
                      <p className="text-sm text-slate-600">{o.admin_memo}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/pages/MyOrders.tsx
git commit -m "feat: MyOrders page with bank info and admin memo"
```

---

## Task 12: ProductDetail 주문하기 버튼 연결

**Files:**
- Modify: `src/pages/ProductDetail.tsx`

- [ ] **Step 1: handleOrder 함수 수정**

`src/pages/ProductDetail.tsx`를 읽는다. `handleOrder` 함수를 찾아서 수정:

```tsx
// 기존:
const handleOrder = () => {
  if (!user) { setLoginDialog(true); return; }
  alert("주문 기능은 준비 중입니다.");
};

// 변경 후:
const handleOrder = () => {
  if (!user) { setLoginDialog(true); return; }
  const optionsParam = [...selectedOptions].join(",");
  const url = `/orders/new?product=${product!.slug}${optionsParam ? `&options=${optionsParam}` : ""}`;
  navigate(url);
};
```

- [ ] **Step 2: 커밋**

```bash
git add src/pages/ProductDetail.tsx
git commit -m "feat: wire ProductDetail order button to OrderNew page"
```

---

## Task 13: 빌드 확인 + 최종 검증

- [ ] **Step 1: 빌드 확인**

```bash
cd /d/claude/main-dream-space && bun run build 2>&1 | tail -10
```
Expected: 빌드 성공, 타입 에러 없음

- [ ] **Step 2: 동작 확인 체크리스트 (DB 연결 후)**
  - `node scripts/run-sql.mjs migrations/010_orders.sql` 실행
  - GET /api/settings → 빈 값 반환
  - /admin/settings → 계좌/회사 정보 입력 → 저장
  - GET /api/settings → 저장된 값 반환
  - /products → 상품 클릭 → 상세 → 옵션 선택 → 주문하기 → /orders/new로 이동
  - 주문서 작성 → 주문 완료 → /my/orders로 이동
  - /my/orders → 결제 대기 상태 + 계좌 안내 표시
  - /admin/orders → 주문 목록 → 상세 Sheet → 상태 변경 → 이메일 발송 확인
  - Resend 대시보드에서 이메일 발송 로그 확인

- [ ] **Step 3: 최종 커밋**

```bash
git add -A
git commit -m "feat: SS3 주문/결제 서브시스템 완료"
```
