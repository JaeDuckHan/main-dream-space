# 기획상품 + 픽업 서비스 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자가 기획상품/픽업 상품을 등록하고, 사용자가 목록/상세 페이지에서 상품을 조회하며 옵션을 선택할 수 있는 기능 구현

**Architecture:** `products` + `product_options` 테이블로 패키지/픽업 상품 통합 관리. 백엔드는 공개 API + 관리자 CRUD API 분리. 프론트엔드는 관리자 페이지(AdminProducts), 사용자 목록(/products), 사용자 상세(/products/:slug), 홈 섹션(FeaturedProducts) 총 4개 화면.

**Tech Stack:** Express, PostgreSQL, Zod, React, React Router, Shadcn UI (Sheet, Dialog, Tabs, Badge), TypeScript, Tailwind

---

## 파일 구조

| 파일 | 작업 |
|------|------|
| `server/migrations/009_products.sql` | CREATE — products, product_options 테이블 |
| `server/src/routes/products.ts` | CREATE — 공개 GET API |
| `server/src/routes/admin-products.ts` | CREATE — 관리자 CRUD API |
| `server/src/index.ts` | MODIFY — 새 라우트 등록 |
| `src/pages/admin/AdminProducts.tsx` | CREATE — /admin/products |
| `src/components/admin/AdminLayout.tsx` | MODIFY — 기획/픽업 상품 사이드바 활성화 |
| `src/pages/Products.tsx` | CREATE — /products |
| `src/pages/ProductDetail.tsx` | CREATE — /products/:slug |
| `src/components/home/FeaturedProducts.tsx` | CREATE — 홈 상품 섹션 |
| `src/pages/Index.tsx` | MODIFY — FeaturedProducts 삽입 |
| `src/App.tsx` | MODIFY — 새 라우트 추가 |

---

## Task 1: DB 마이그레이션

**Files:**
- Create: `server/migrations/009_products.sql`

- [ ] **Step 1: 마이그레이션 파일 생성**

```sql
-- server/migrations/009_products.sql
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(120) NOT NULL UNIQUE,
  category VARCHAR(20) NOT NULL CHECK (category IN ('package', 'pickup')),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  thumbnail_url VARCHAR(500),
  base_price INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active, sort_order);

DROP TRIGGER IF EXISTS trg_products_updated ON products;
CREATE TRIGGER trg_products_updated
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS product_options (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label VARCHAR(100) NOT NULL,
  price_delta INT NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_product_options_product ON product_options(product_id, sort_order);
```

- [ ] **Step 2: 마이그레이션 실행**

```bash
cd server
node scripts/run-sql.mjs migrations/009_products.sql
```
Expected: 오류 없이 실행 완료

- [ ] **Step 3: 커밋**

```bash
git add server/migrations/009_products.sql
git commit -m "feat: products and product_options migration"
```

---

## Task 2: 백엔드 — 공개 products API

**Files:**
- Create: `server/src/routes/products.ts`

- [ ] **Step 1: 파일 생성**

```typescript
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
```

- [ ] **Step 2: 커밋**

```bash
git add server/src/routes/products.ts
git commit -m "feat: public products API (list, detail)"
```

---

## Task 3: 백엔드 — 관리자 products CRUD API

**Files:**
- Create: `server/src/routes/admin-products.ts`

- [ ] **Step 1: 파일 생성**

```typescript
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
```

- [ ] **Step 2: 커밋**

```bash
git add server/src/routes/admin-products.ts
git commit -m "feat: admin products CRUD API"
```

---

## Task 4: 백엔드 — index.ts 라우트 등록

**Files:**
- Modify: `server/src/index.ts`

- [ ] **Step 1: import 추가** (adminStatsRoutes import 아래에)

```typescript
import productRoutes from "./routes/products.js";
import adminProductRoutes from "./routes/admin-products.js";
```

- [ ] **Step 2: app.use 등록** (`app.use("/api/admin/stats", adminStatsRoutes);` 아래에)

```typescript
app.use("/api/products", productRoutes);
app.use("/api/admin/products", adminProductRoutes);
```

- [ ] **Step 3: 커밋**

```bash
git add server/src/index.ts
git commit -m "feat: register products and admin-products routes"
```

---

## Task 5: 관리자 — AdminProducts 페이지 + 사이드바 활성화

**Files:**
- Create: `src/pages/admin/AdminProducts.tsx`
- Modify: `src/components/admin/AdminLayout.tsx`

- [ ] **Step 1: AdminProducts 파일 생성**

```tsx
// src/pages/admin/AdminProducts.tsx
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ProductOption {
  id: number;
  label: string;
  price_delta: number;
  sort_order: number;
}

interface Product {
  id: number;
  slug: string;
  category: "package" | "pickup";
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  base_price: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  options: ProductOption[];
}

const CATEGORY_BADGE: Record<string, { label: string; className: string }> = {
  package: { label: "패키지", className: "bg-blue-100 text-blue-700" },
  pickup: { label: "픽업", className: "bg-green-100 text-green-700" },
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

const emptyForm = {
  slug: "",
  category: "package" as const,
  title: "",
  description: "",
  thumbnail_url: "",
  base_price: 0,
  sort_order: 0,
  is_active: true,
};

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [newOption, setNewOption] = useState({ label: "", price_delta: 0 });
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const fetchProducts = () => {
    fetch("/api/admin/products", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setProducts(d.items ?? []));
  };

  useEffect(() => { fetchProducts(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setSheetOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      slug: p.slug,
      category: p.category,
      title: p.title,
      description: p.description ?? "",
      thumbnail_url: p.thumbnail_url ?? "",
      base_price: p.base_price,
      sort_order: p.sort_order,
      is_active: p.is_active,
    });
    setSheetOpen(true);
  };

  const handleTitleChange = (title: string) => {
    setForm((f) => ({ ...f, title, slug: editing ? f.slug : slugify(title) }));
  };

  const saveProduct = async () => {
    const url = editing ? `/api/admin/products/${editing.id}` : "/api/admin/products";
    const method = editing ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, base_price: Number(form.base_price), sort_order: Number(form.sort_order) }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "저장에 실패했습니다.");
      return;
    }
    setSheetOpen(false);
    fetchProducts();
  };

  const toggleActive = async (p: Product) => {
    await fetch(`/api/admin/products/${p.id}/toggle`, { method: "PATCH", credentials: "include" });
    fetchProducts();
  };

  const deleteProduct = async () => {
    if (!deleteTarget) return;
    await fetch(`/api/admin/products/${deleteTarget.id}`, { method: "DELETE", credentials: "include" });
    setDeleteTarget(null);
    fetchProducts();
  };

  const addOption = async () => {
    if (!editing || !newOption.label.trim()) return;
    await fetch(`/api/admin/products/${editing.id}/options`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newOption.label, price_delta: Number(newOption.price_delta) }),
    });
    setNewOption({ label: "", price_delta: 0 });
    // 옵션 목록 갱신 — editing 상품 다시 로드
    const res = await fetch("/api/admin/products", { credentials: "include" });
    const d = await res.json();
    setProducts(d.items ?? []);
    const updated = (d.items ?? []).find((p: Product) => p.id === editing.id);
    if (updated) setEditing(updated);
  };

  const removeOption = async (optionId: number) => {
    await fetch(`/api/admin/products/options/${optionId}`, { method: "DELETE", credentials: "include" });
    const res = await fetch("/api/admin/products", { credentials: "include" });
    const d = await res.json();
    setProducts(d.items ?? []);
    if (editing) {
      const updated = (d.items ?? []).find((p: Product) => p.id === editing.id);
      if (updated) setEditing(updated);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">기획/픽업 상품 관리</h1>
          <p className="mt-1 text-sm text-slate-500">전체 {products.length}개</p>
        </div>
        <Button onClick={openCreate}>+ 상품 등록</Button>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">상품</th>
              <th className="px-4 py-3 text-left font-medium">카테고리</th>
              <th className="px-4 py-3 text-left font-medium">기본가</th>
              <th className="px-4 py-3 text-left font-medium">상태</th>
              <th className="px-4 py-3 text-left font-medium">액션</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const cat = CATEGORY_BADGE[p.category];
              return (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.title}</div>
                    <div className="text-xs text-slate-400">{p.slug}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={cat.className}>{cat.label}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {p.base_price.toLocaleString("ko-KR")}원
                  </td>
                  <td className="px-4 py-3">
                    <span className={p.is_active ? "text-emerald-600" : "text-slate-400"}>
                      ● {p.is_active ? "공개" : "숨김"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(p)}>수정</Button>
                      <Button size="sm" variant="outline" onClick={() => void toggleActive(p)}>
                        {p.is_active ? "숨김" : "공개"}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setDeleteTarget(p)}>삭제</Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 등록/수정 Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-96 overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? "상품 수정" : "상품 등록"}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div>
              <Label>상품명</Label>
              <Input value={form.title} onChange={(e) => handleTitleChange(e.target.value)} placeholder="다낭 3박4일 패키지" />
            </div>
            <div>
              <Label>Slug</Label>
              <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder="danang-3nights" />
            </div>
            <div>
              <Label>카테고리</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v as "package" | "pickup" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="package">패키지</SelectItem>
                  <SelectItem value="pickup">픽업</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>설명</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} />
            </div>
            <div>
              <Label>썸네일 URL</Label>
              <Input value={form.thumbnail_url} onChange={(e) => setForm((f) => ({ ...f, thumbnail_url: e.target.value }))} placeholder="https://..." />
            </div>
            <div>
              <Label>기본가 (원)</Label>
              <Input type="number" value={form.base_price} onChange={(e) => setForm((f) => ({ ...f, base_price: Number(e.target.value) }))} />
            </div>
            <div>
              <Label>정렬 순서</Label>
              <Input type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
              <Label>공개</Label>
            </div>

            {editing && (
              <div className="border-t border-slate-100 pt-4">
                <Label className="text-sm font-semibold">옵션 관리</Label>
                <div className="mt-2 space-y-2">
                  {editing.options.map((o) => (
                    <div key={o.id} className="flex items-center justify-between rounded border border-slate-100 p-2 text-xs">
                      <span>{o.label} (+{o.price_delta.toLocaleString("ko-KR")}원)</span>
                      <button className="text-red-500" onClick={() => void removeOption(o.id)}>×</button>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <Input
                    className="flex-1"
                    placeholder="옵션명"
                    value={newOption.label}
                    onChange={(e) => setNewOption((o) => ({ ...o, label: e.target.value }))}
                  />
                  <Input
                    className="w-24"
                    type="number"
                    placeholder="추가금액"
                    value={newOption.price_delta}
                    onChange={(e) => setNewOption((o) => ({ ...o, price_delta: Number(e.target.value) }))}
                  />
                  <Button size="sm" onClick={() => void addOption()}>추가</Button>
                </div>
              </div>
            )}

            <Button className="w-full" onClick={() => void saveProduct()}>저장</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* 삭제 확인 */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>상품 삭제</DialogTitle>
            <DialogDescription>"{deleteTarget?.title}" 상품을 영구 삭제합니다. 계속하시겠습니까?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>취소</Button>
            <Button variant="destructive" onClick={() => void deleteProduct()}>삭제</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: AdminLayout 사이드바 활성화**

`src/components/admin/AdminLayout.tsx`에서 navItems 배열을 찾아 수정:

```tsx
// 변경 전:
{ href: "/admin/products", label: "기획상품", icon: "🎁", disabled: true },
{ href: "/admin/pickup", label: "픽업 서비스", icon: "🚗", disabled: true },

// 변경 후:
{ href: "/admin/products", label: "기획/픽업 상품", icon: "🎁" },
```

"픽업 서비스" 행은 완전히 제거하고 "기획상품" 행을 위와 같이 수정.

- [ ] **Step 3: 커밋**

```bash
git add src/pages/admin/AdminProducts.tsx src/components/admin/AdminLayout.tsx
git commit -m "feat: AdminProducts page and sidebar activation"
```

---

## Task 6: 사용자 — Products 목록 페이지

**Files:**
- Create: `src/pages/Products.tsx`

- [ ] **Step 1: 파일 생성**

```tsx
// src/pages/Products.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Footer from "@/components/Footer";

interface Product {
  id: number;
  slug: string;
  category: "package" | "pickup";
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  base_price: number;
}

const CATEGORY_FILTERS = [
  { value: "", label: "전체" },
  { value: "package", label: "패키지" },
  { value: "pickup", label: "픽업" },
] as const;

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter) params.set("category", filter);
    fetch(`/api/products?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setProducts(d.items ?? []))
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <div className="min-h-screen bg-background">
      <main className="container py-12">
        <h1 className="text-3xl font-bold">럭키다낭 기획 상품</h1>
        <p className="mt-2 text-muted-foreground">다낭 체류를 더 편리하게 만드는 패키지와 픽업 서비스</p>

        {/* 카테고리 필터 */}
        <div className="mt-6 flex gap-2">
          {CATEGORY_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                filter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* 상품 그리드 */}
        {loading ? (
          <div className="mt-12 text-center text-muted-foreground">로딩 중...</div>
        ) : products.length === 0 ? (
          <div className="mt-12 text-center text-muted-foreground">준비 중인 상품입니다.</div>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <div key={p.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
                <div className="h-48 w-full bg-muted">
                  {p.thumbnail_url ? (
                    <img src={p.thumbnail_url} alt={p.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-4xl">
                      {p.category === "pickup" ? "🚗" : "🏖️"}
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h2 className="font-semibold">{p.title}</h2>
                  {p.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                  )}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {p.base_price.toLocaleString("ko-KR")}원~
                    </span>
                    <Link
                      to={`/products/${p.slug}`}
                      className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90"
                    >
                      자세히 보기
                    </Link>
                  </div>
                </div>
              </div>
            ))}
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
git add src/pages/Products.tsx
git commit -m "feat: Products listing page"
```

---

## Task 7: 사용자 — ProductDetail 상세 페이지

**Files:**
- Create: `src/pages/ProductDetail.tsx`

- [ ] **Step 1: 파일 생성**

```tsx
// src/pages/ProductDetail.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  description: string | null;
  thumbnail_url: string | null;
  base_price: number;
  options: ProductOption[];
}

interface PickupForm {
  date: string;
  num_people: string;
  pickup_type: "airport_to_hotel" | "hotel_to_airport";
  flight_no: string;
  flight_time: string;
  hotel_name: string;
  memo: string;
}

const emptyPickup: PickupForm = {
  date: "",
  num_people: "1",
  pickup_type: "airport_to_hotel",
  flight_no: "",
  flight_time: "",
  hotel_name: "",
  memo: "",
};

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOptions, setSelectedOptions] = useState<Set<number>>(new Set());
  const [pickupForm, setPickupForm] = useState<PickupForm>(emptyPickup);
  const [loginDialog, setLoginDialog] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetch(`/api/products/${slug}`)
      .then((r) => {
        if (!r.ok) { navigate("/products"); return null; }
        return r.json();
      })
      .then((d) => { if (d) setProduct(d); })
      .finally(() => setLoading(false));
  }, [slug, navigate]);

  const toggleOption = (optionId: number) => {
    setSelectedOptions((prev) => {
      const next = new Set(prev);
      if (next.has(optionId)) { next.delete(optionId); } else { next.add(optionId); }
      return next;
    });
  };

  const totalPrice = product
    ? product.base_price +
      product.options
        .filter((o) => selectedOptions.has(o.id))
        .reduce((sum, o) => sum + o.price_delta, 0)
    : 0;

  const handleOrder = () => {
    if (!user) { setLoginDialog(true); return; }
    // 서브시스템 3 연결 전까지 안내
    alert("주문 기능은 준비 중입니다.");
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">로딩 중...</div>;
  }

  if (!product) return null;

  return (
    <div className="min-h-screen bg-background">
      <main className="container max-w-2xl py-12">
        {/* 썸네일 */}
        <div className="h-64 w-full overflow-hidden rounded-xl bg-muted">
          {product.thumbnail_url ? (
            <img src={product.thumbnail_url} alt={product.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-6xl">
              {product.category === "pickup" ? "🚗" : "🏖️"}
            </div>
          )}
        </div>

        {/* 상품 정보 */}
        <h1 className="mt-6 text-2xl font-bold">{product.title}</h1>
        {product.description && (
          <p className="mt-3 text-muted-foreground leading-relaxed">{product.description}</p>
        )}

        {/* 옵션 선택 */}
        {product.options.length > 0 && (
          <div className="mt-8">
            <h2 className="font-semibold">옵션 선택</h2>
            <div className="mt-3 space-y-3">
              {product.options.map((o) => (
                <div key={o.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <Checkbox
                    id={`option-${o.id}`}
                    checked={selectedOptions.has(o.id)}
                    onCheckedChange={() => toggleOption(o.id)}
                  />
                  <Label htmlFor={`option-${o.id}`} className="flex-1 cursor-pointer">
                    {o.label}
                  </Label>
                  <span className="text-sm font-medium text-primary">
                    +{o.price_delta.toLocaleString("ko-KR")}원
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 픽업 전용 추가 입력 폼 */}
        {product.category === "pickup" && (
          <div className="mt-8 rounded-xl border border-border p-5 space-y-4">
            <h2 className="font-semibold">픽업 예약 정보</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>날짜</Label>
                <Input type="date" value={pickupForm.date} onChange={(e) => setPickupForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <Label>인원 수</Label>
                <Input type="number" min="1" value={pickupForm.num_people} onChange={(e) => setPickupForm((f) => ({ ...f, num_people: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>픽업 타입</Label>
              <div className="mt-2 flex gap-4">
                {[
                  { value: "airport_to_hotel", label: "공항 → 호텔" },
                  { value: "hotel_to_airport", label: "호텔 → 공항" },
                ].map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="pickup_type"
                      value={opt.value}
                      checked={pickupForm.pickup_type === opt.value}
                      onChange={() => setPickupForm((f) => ({ ...f, pickup_type: opt.value as PickupForm["pickup_type"] }))}
                    />
                    <span className="text-sm">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>항공편 번호</Label>
                <Input value={pickupForm.flight_no} onChange={(e) => setPickupForm((f) => ({ ...f, flight_no: e.target.value }))} placeholder="VJ123" />
              </div>
              <div>
                <Label>도착/출발 시간</Label>
                <Input type="time" value={pickupForm.flight_time} onChange={(e) => setPickupForm((f) => ({ ...f, flight_time: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>호텔명</Label>
              <Input value={pickupForm.hotel_name} onChange={(e) => setPickupForm((f) => ({ ...f, hotel_name: e.target.value }))} placeholder="Hyatt Regency Da Nang" />
            </div>
            <div>
              <Label>요청사항</Label>
              <Textarea value={pickupForm.memo} onChange={(e) => setPickupForm((f) => ({ ...f, memo: e.target.value }))} rows={2} placeholder="유아 좌석 필요 등" />
            </div>
          </div>
        )}

        {/* 총 금액 + 주문 버튼 */}
        <div className="mt-8 rounded-xl border border-border bg-slate-50 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">총 금액</span>
            <span className="text-2xl font-bold text-primary">{totalPrice.toLocaleString("ko-KR")}원</span>
          </div>
          <Button className="mt-4 w-full" size="lg" onClick={handleOrder}>
            주문하기
          </Button>
        </div>
      </main>
      <Footer />

      {/* 로그인 유도 다이얼로그 */}
      <Dialog open={loginDialog} onOpenChange={setLoginDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>로그인이 필요합니다</DialogTitle>
            <DialogDescription>주문하려면 먼저 로그인해주세요.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLoginDialog(false)}>취소</Button>
            <Button onClick={() => { setLoginDialog(false); navigate("/login"); }}>로그인</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/pages/ProductDetail.tsx
git commit -m "feat: ProductDetail page with options and pickup form"
```

---

## Task 8: 홈 섹션 + Index.tsx 삽입

**Files:**
- Create: `src/components/home/FeaturedProducts.tsx`
- Modify: `src/pages/Index.tsx`

- [ ] **Step 1: FeaturedProducts 컴포넌트 생성**

```tsx
// src/components/home/FeaturedProducts.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

interface Product {
  id: number;
  slug: string;
  category: "package" | "pickup";
  title: string;
  thumbnail_url: string | null;
  base_price: number;
}

export function FeaturedProducts() {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    fetch("/api/products?limit=4")
      .then((r) => r.json())
      .then((d) => setProducts(d.items ?? []));
  }, []);

  if (products.length === 0) return null;

  return (
    <section className="py-16 bg-slate-50">
      <div className="container">
        <div className="flex items-center justify-between">
          <h2 className="text-[22px] font-bold">럭키다낭 기획 상품</h2>
          <Link to="/products" className="text-sm text-primary hover:underline">
            전체 보기 →
          </Link>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((p) => (
            <Link
              key={p.id}
              to={`/products/${p.slug}`}
              className="overflow-hidden rounded-xl border border-border bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="h-36 w-full bg-muted">
                {p.thumbnail_url ? (
                  <img src={p.thumbnail_url} alt={p.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-3xl">
                    {p.category === "pickup" ? "🚗" : "🏖️"}
                  </div>
                )}
              </div>
              <div className="p-3">
                <div className="font-medium text-sm leading-snug">{p.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {p.base_price.toLocaleString("ko-KR")}원~
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Index.tsx 수정**

`src/pages/Index.tsx`의 import 블록에 추가:
```tsx
import { FeaturedProducts } from "@/components/home/FeaturedProducts";
```

`<ServicesSection />` 바로 다음 줄에 삽입:
```tsx
<ServicesSection />
<FeaturedProducts />
<WeeklyUpdates />
```

- [ ] **Step 3: 커밋**

```bash
git add src/components/home/FeaturedProducts.tsx src/pages/Index.tsx
git commit -m "feat: FeaturedProducts home section"
```

---

## Task 9: App.tsx 라우트 추가

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: import 추가**

```tsx
import Products from "./pages/Products.tsx";
import ProductDetail from "./pages/ProductDetail.tsx";
import AdminProducts from "./pages/admin/AdminProducts.tsx";
```

- [ ] **Step 2: AppShell 라우트에 Products 추가** (`/directory` 라우트 아래에)

```tsx
<Route path="/products" element={<Products />} />
<Route path="/products/:slug" element={<ProductDetail />} />
```

- [ ] **Step 3: AdminLayout 라우트에 AdminProducts 추가** (`/admin/listings` 아래에)

```tsx
<Route path="/admin/products" element={<AdminProducts />} />
```

- [ ] **Step 4: 빌드 확인**

```bash
npm run build 2>&1 | tail -5
```
Expected: `✓ built in` — 타입 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add src/App.tsx
git commit -m "feat: wire /products and /admin/products routes"
```

---

## Task 10: 동작 확인 체크리스트

- [ ] DB 마이그레이션 실행 확인 (`products`, `product_options` 테이블 존재)
- [ ] `GET /api/products` → 빈 배열 반환 (테이블 비어 있음)
- [ ] `/admin/products` → 상품 등록 Sheet 열림
- [ ] 상품 등록 → 제목 입력 시 slug 자동 생성 확인
- [ ] 등록 후 목록에 표시 → 수정 → 저장 동작
- [ ] 옵션 추가 (수정 Sheet에서) → 목록에 반영
- [ ] 공개/숨김 토글 → 상태 변경 확인
- [ ] `/products` → 등록한 상품 카드 표시
- [ ] 카테고리 필터 (패키지/픽업) 동작
- [ ] `/products/:slug` → 상세 페이지 → 옵션 체크 → 총 금액 실시간 변동
- [ ] 픽업 상품 상세 → 픽업 예약 폼 표시 확인
- [ ] 로그인 안 된 상태 → "주문하기" → 로그인 다이얼로그
- [ ] 홈(`/`) → FeaturedProducts 섹션 표시 (상품 없으면 섹션 안 보임)
- [ ] AdminLayout 사이드바 → "기획/픽업 상품" 활성 메뉴 확인

- [ ] **최종 커밋**

```bash
git add -A
git commit -m "feat: 기획상품 + 픽업 서비스 서브시스템 2 완료"
```
