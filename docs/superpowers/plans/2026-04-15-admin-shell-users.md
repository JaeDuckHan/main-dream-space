# 관리자 쉘 + 회원 관리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/admin/*` 전용 사이드바 레이아웃 + 대시보드 홈 + 회원 관리 페이지 구현

**Architecture:** 기존 AppShell과 분리된 AdminLayout 컴포넌트를 신규 생성하고, `/admin/*` 라우트를 AdminLayout으로 감싼다. 백엔드는 기존 admin-listings 패턴과 동일하게 `server/src/routes/admin-users.ts`를 추가한다. `users` 테이블에 `is_active` 컬럼이 이미 존재하므로 DB 마이그레이션은 불필요하다.

**Tech Stack:** React + React Router, Shadcn UI (Sheet, Tabs, Badge, Table, Dialog), Express, PostgreSQL, Zod, TypeScript, Bun

---

## 파일 구조

| 파일 | 작업 | 설명 |
|------|------|------|
| `server/src/routes/admin-users.ts` | CREATE | 회원 목록/상세/역할변경/상태변경 API |
| `server/src/routes/admin-stats.ts` | CREATE | 대시보드 현황 수치 API |
| `server/src/index.ts` | MODIFY | admin-users, admin-stats 라우트 등록 |
| `src/components/admin/AdminLayout.tsx` | CREATE | 사이드바 포함 관리자 레이아웃 |
| `src/pages/admin/AdminHome.tsx` | CREATE | `/admin` 대시보드 홈 |
| `src/pages/admin/AdminUsers.tsx` | CREATE | `/admin/users` 회원 관리 |
| `src/pages/admin/AdminListings.tsx` | MOVE | 기존 `src/pages/AdminListings.tsx` 이동 |
| `src/App.tsx` | MODIFY | `/admin/*` 라우트 AdminLayout으로 교체 |

---

## Task 1: 백엔드 — admin-stats 라우트

**Files:**
- Create: `server/src/routes/admin-stats.ts`

- [ ] **Step 1: 파일 생성**

```typescript
// server/src/routes/admin-stats.ts
import { Router } from "express";
import { query } from "../db.js";
import { requireAdmin } from "../lib/auth.js";

const router = Router();

router.get("/", requireAdmin, async (_req, res, next) => {
  try {
    const [listingsRow, usersRow, ordersRow] = await Promise.all([
      query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM listings WHERE status = 'pending'`,
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM users`,
      ),
      // orders 테이블은 서브시스템 3에서 추가됨 — 지금은 0 반환
      Promise.resolve([{ count: "0" }]),
    ]);

    res.json({
      pending_listings: Number(listingsRow[0]?.count ?? 0),
      total_users: Number(usersRow[0]?.count ?? 0),
      monthly_orders: 0,
      pending_payments: 0,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
```

- [ ] **Step 2: 커밋**

```bash
git add server/src/routes/admin-stats.ts
git commit -m "feat: admin stats API endpoint"
```

---

## Task 2: 백엔드 — admin-users 라우트

**Files:**
- Create: `server/src/routes/admin-users.ts`

- [ ] **Step 1: 파일 생성**

```typescript
// server/src/routes/admin-users.ts
import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAdmin } from "../lib/auth.js";

const router = Router();

// 회원 목록
router.get("/", requireAdmin, async (req, res, next) => {
  try {
    const { search, role, status, page, limit } = z.object({
      search: z.string().optional(),
      role: z.enum(["user", "admin"]).optional(),
      status: z.enum(["active", "inactive"]).optional(),
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(100).default(20),
    }).parse(req.query);

    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(u.email ILIKE $${params.length} OR u.display_name ILIKE $${params.length})`);
    }
    if (role) {
      params.push(role);
      conditions.push(`u.role = $${params.length}`);
    }
    if (status === "active") {
      conditions.push(`u.is_active = TRUE`);
    } else if (status === "inactive") {
      conditions.push(`u.is_active = FALSE`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const [totalRows, items] = await Promise.all([
      query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM users u ${where}`,
        params,
      ),
      query<Record<string, unknown>>(
        `SELECT
           u.id,
           u.email,
           u.display_name,
           u.avatar_url,
           u.role,
           u.is_active,
           u.created_at,
           u.last_login_at,
           COALESCE(
             json_agg(DISTINCT oa.provider) FILTER (WHERE oa.provider IS NOT NULL),
             '[]'
           ) AS providers
         FROM users u
         LEFT JOIN user_oauth_accounts oa ON oa.user_id = u.id
         ${where}
         GROUP BY u.id
         ORDER BY u.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      ),
    ]);

    res.json({ total: Number(totalRows[0]?.count ?? 0), items });
  } catch (error) {
    next(error);
  }
});

// 회원 상세 (글 + 업체 + 주문 목록 포함)
router.get("/:id", requireAdmin, async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);

    const userRows = await query<Record<string, unknown>>(
      `SELECT
         u.id, u.email, u.display_name, u.avatar_url, u.role,
         u.is_active, u.created_at, u.last_login_at,
         COALESCE(
           json_agg(DISTINCT oa.provider) FILTER (WHERE oa.provider IS NOT NULL),
           '[]'
         ) AS providers
       FROM users u
       LEFT JOIN user_oauth_accounts oa ON oa.user_id = u.id
       WHERE u.id = $1
       GROUP BY u.id`,
      [id],
    );

    if (!userRows[0]) {
      return res.status(404).json({ error: "User not found" });
    }

    const [posts, listings] = await Promise.all([
      query<Record<string, unknown>>(
        `SELECT id, title, created_at FROM community_posts WHERE author_id = $1 ORDER BY created_at DESC LIMIT 20`,
        [id],
      ),
      query<Record<string, unknown>>(
        `SELECT id, name, name_ko, category, status, created_at FROM listings WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 20`,
        [id],
      ),
    ]);

    res.json({ ...userRows[0], posts, listings, orders: [] });
  } catch (error) {
    next(error);
  }
});

// 역할 변경
router.patch("/:id/role", requireAdmin, async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    const { role } = z.object({ role: z.enum(["user", "admin"]) }).parse(req.body);

    // 본인 역할을 낮추는 것 방지
    if (req.authUser!.id === id && role === "user") {
      return res.status(400).json({ error: "자기 자신의 관리자 권한을 해제할 수 없습니다." });
    }

    await query(`UPDATE users SET role = $1 WHERE id = $2`, [role, id]);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// 활성/비활성 토글
router.patch("/:id/status", requireAdmin, async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    const { active } = z.object({ active: z.boolean() }).parse(req.body);

    if (req.authUser!.id === id && !active) {
      return res.status(400).json({ error: "자기 자신의 계정을 비활성화할 수 없습니다." });
    }

    await query(`UPDATE users SET is_active = $1 WHERE id = $2`, [active, id]);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
```

- [ ] **Step 2: 커밋**

```bash
git add server/src/routes/admin-users.ts
git commit -m "feat: admin users API (list, detail, role, status)"
```

---

## Task 3: 백엔드 — index.ts에 라우트 등록

**Files:**
- Modify: `server/src/index.ts`

- [ ] **Step 1: import 추가 (기존 import 목록 하단에)**

`server/src/index.ts` 상단 import 블록에 추가:
```typescript
import adminUserRoutes from "./routes/admin-users.js";
import adminStatsRoutes from "./routes/admin-stats.js";
```

- [ ] **Step 2: app.use 등록 (adminListingRoutes 바로 아래)**

```typescript
app.use("/api/admin/users", adminUserRoutes);
app.use("/api/admin/stats", adminStatsRoutes);
```

- [ ] **Step 3: 서버 재시작 후 동작 확인**

```bash
# 터미널에서 서버 디렉토리로 이동 후
curl -s http://localhost:3001/api/health
# Expected: {"status":"ok","uptime":...}
```

- [ ] **Step 4: 커밋**

```bash
git add server/src/index.ts
git commit -m "feat: register admin-users and admin-stats routes"
```

---

## Task 4: 프론트엔드 — AdminLayout 컴포넌트

**Files:**
- Create: `src/components/admin/AdminLayout.tsx`

- [ ] **Step 1: 파일 생성**

```tsx
// src/components/admin/AdminLayout.tsx
import { Link, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  disabled?: boolean;
  badge?: number;
}

function AdminSidebar() {
  const { user } = useAuth();
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    fetch("/api/admin/stats", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setPendingCount(d.pending_listings ?? 0))
      .catch(() => {});
  }, []);

  const navItems: NavItem[] = [
    { href: "/admin", label: "대시보드", icon: "📊" },
    { href: "/admin/users", label: "회원 관리", icon: "👥" },
    { href: "/admin/listings", label: "업체 검수", icon: "🏢", badge: pendingCount },
    { href: "/admin/products", label: "기획상품", icon: "🎁", disabled: true },
    { href: "/admin/pickup", label: "픽업 서비스", icon: "🚗", disabled: true },
    { href: "/admin/orders", label: "주문 관리", icon: "📦", disabled: true },
  ];

  return (
    <aside className="flex h-screen w-40 flex-shrink-0 flex-col bg-slate-900 text-slate-400">
      <div className="p-4">
        <div className="text-sm font-bold text-slate-100">🛠 관리자</div>
        <div className="mt-1 truncate text-xs text-slate-500">{user?.email}</div>
      </div>

      <nav className="flex-1 px-2">
        {navItems.map((item) => {
          const isActive = item.href === "/admin"
            ? location.pathname === "/admin"
            : location.pathname.startsWith(item.href);

          return (
            <div key={item.href}>
              {item.disabled ? (
                <div className="flex cursor-not-allowed items-center gap-2 rounded-md px-3 py-2 text-xs text-slate-600">
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              ) : (
                <Link
                  to={item.href}
                  className={cn(
                    "flex items-center justify-between rounded-md px-3 py-2 text-xs transition-colors hover:bg-slate-800 hover:text-slate-100",
                    isActive && "bg-blue-800 text-white",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </span>
                  {item.badge && item.badge > 0 ? (
                    <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-2">
        <Link
          to="/"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-slate-500 hover:bg-slate-800 hover:text-slate-300"
        >
          ← 사이트로 돌아가기
        </Link>
      </div>
    </aside>
  );
}

function AdminLayoutContent() {
  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto bg-slate-50">
        <Outlet />
      </main>
    </div>
  );
}

export default function AdminLayout() {
  return (
    <RequireAuth requireAdmin>
      <AdminLayoutContent />
    </RequireAuth>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/admin/AdminLayout.tsx
git commit -m "feat: AdminLayout with sidebar navigation"
```

---

## Task 5: 프론트엔드 — AdminHome 페이지

**Files:**
- Create: `src/pages/admin/AdminHome.tsx`

- [ ] **Step 1: 파일 생성**

```tsx
// src/pages/admin/AdminHome.tsx
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";

interface AdminStats {
  pending_listings: number;
  total_users: number;
  monthly_orders: number;
  pending_payments: number;
}

export default function AdminHome() {
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats", { credentials: "include" })
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const cards = [
    { label: "전체 회원", value: stats?.total_users ?? "-", color: "text-blue-600" },
    { label: "업체 검수 대기", value: stats?.pending_listings ?? "-", color: "text-amber-500" },
    { label: "이번달 주문", value: stats?.monthly_orders ?? "-", color: "text-emerald-600" },
    { label: "입금 대기", value: stats?.pending_payments ?? "-", color: "text-red-500" },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-800">대시보드</h1>
      <p className="mt-1 text-sm text-slate-500">럭키다낭 관리자 현황</p>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label} className="p-6">
            <div className="text-sm text-slate-500">{card.label}</div>
            <div className={`mt-2 text-3xl font-bold ${card.color}`}>{card.value}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/pages/admin/AdminHome.tsx
git commit -m "feat: AdminHome dashboard with stats cards"
```

---

## Task 6: 프론트엔드 — AdminUsers 페이지

**Files:**
- Create: `src/pages/admin/AdminUsers.tsx`

- [ ] **Step 1: 파일 생성**

```tsx
// src/pages/admin/AdminUsers.tsx
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";

interface UserListItem {
  id: number;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: "user" | "admin";
  is_active: boolean;
  created_at: string;
  providers: string[];
}

interface UserDetail extends UserListItem {
  posts: { id: number; title: string; created_at: string }[];
  listings: { id: number; name: string; name_ko: string | null; category: string; status: string; created_at: string }[];
  orders: unknown[];
}

const PROVIDER_BADGE: Record<string, { label: string; className: string }> = {
  kakao: { label: "카카오", className: "bg-yellow-100 text-yellow-800" },
  google: { label: "구글", className: "bg-green-100 text-green-800" },
  naver: { label: "네이버", className: "bg-emerald-50 text-emerald-700" },
};

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<UserDetail | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ type: "role" | "status"; value: string | boolean } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchUsers = (opts?: { s?: string; role?: string; status?: string; p?: number }) => {
    const params = new URLSearchParams();
    const s = opts?.s ?? search;
    const r = opts?.role ?? roleFilter;
    const st = opts?.status ?? statusFilter;
    const p = opts?.p ?? page;

    if (s) params.set("search", s);
    if (r !== "all") params.set("role", r);
    if (st !== "all") params.set("status", st);
    params.set("page", String(p));

    fetch(`/api/admin/users?${params.toString()}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setUsers(d.items ?? []);
        setTotal(d.total ?? 0);
      });
  };

  useEffect(() => { fetchUsers(); }, [roleFilter, statusFilter, page]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchUsers({ s: value, p: 1 });
    }, 300);
  };

  const openDetail = async (userId: number) => {
    const data = await fetch(`/api/admin/users/${userId}`, { credentials: "include" }).then((r) => r.json());
    setSelected(data);
    setSheetOpen(true);
  };

  const applyRoleChange = async (newRole: "user" | "admin") => {
    if (!selected) return;
    await fetch(`/api/admin/users/${selected.id}/role`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    setConfirmDialog(null);
    setSheetOpen(false);
    fetchUsers();
  };

  const applyStatusChange = async (active: boolean) => {
    if (!selected) return;
    await fetch(`/api/admin/users/${selected.id}/status`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    setConfirmDialog(null);
    setSheetOpen(false);
    fetchUsers();
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-800">회원 관리</h1>
      <p className="mt-1 text-sm text-slate-500">전체 {total}명</p>

      {/* 검색 + 필터 */}
      <div className="mt-6 flex flex-wrap gap-3">
        <Input
          className="w-64"
          placeholder="이름 또는 이메일 검색"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
        <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1); }}>
          <SelectTrigger className="w-32"><SelectValue placeholder="역할" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 역할</SelectItem>
            <SelectItem value="user">user</SelectItem>
            <SelectItem value="admin">admin</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-32"><SelectValue placeholder="상태" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            <SelectItem value="active">활성</SelectItem>
            <SelectItem value="inactive">비활성</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 테이블 */}
      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">회원</th>
              <th className="px-4 py-3 text-left font-medium">가입일</th>
              <th className="px-4 py-3 text-left font-medium">소셜</th>
              <th className="px-4 py-3 text-left font-medium">역할</th>
              <th className="px-4 py-3 text-left font-medium">상태</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                onClick={() => void openDetail(u.id)}
              >
                <td className="px-4 py-3">
                  <div className={`font-medium ${!u.is_active ? "text-slate-400" : ""}`}>
                    {u.display_name ?? "—"}
                  </div>
                  <div className="text-xs text-slate-400">{u.email}</div>
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {new Date(u.created_at).toLocaleDateString("ko-KR")}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {u.providers.map((p) => {
                      const badge = PROVIDER_BADGE[p];
                      return badge ? (
                        <span key={p} className={`rounded px-1.5 py-0.5 text-xs ${badge.className}`}>
                          {badge.label}
                        </span>
                      ) : null;
                    })}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge className={u.role === "admin" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}>
                    {u.role}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <span className={u.is_active ? "text-emerald-600" : "text-slate-400"}>
                    ● {u.is_active ? "활성" : "비활성"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
            이전
          </Button>
          <span className="text-sm text-slate-500">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
            다음
          </Button>
        </div>
      )}

      {/* 회원 상세 Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-80 overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.display_name ?? selected.email}</SheetTitle>
                <p className="text-sm text-slate-500">{selected.email}</p>
              </SheetHeader>

              <div className="mt-4 flex gap-2">
                {selected.id !== me?.id && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                      onClick={() => setConfirmDialog({ type: "role", value: selected.role === "admin" ? "user" : "admin" })}
                    >
                      {selected.role === "admin" ? "admin → user" : "user → admin"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                      onClick={() => setConfirmDialog({ type: "status", value: !selected.is_active })}
                    >
                      {selected.is_active ? "비활성화" : "활성화"}
                    </Button>
                  </>
                )}
              </div>

              <Tabs defaultValue="orders" className="mt-6">
                <TabsList className="w-full">
                  <TabsTrigger value="orders" className="flex-1">주문({selected.orders.length})</TabsTrigger>
                  <TabsTrigger value="posts" className="flex-1">글({selected.posts.length})</TabsTrigger>
                  <TabsTrigger value="listings" className="flex-1">업체({selected.listings.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="orders">
                  <p className="mt-4 text-center text-sm text-slate-400">서브시스템 3 연동 후 표시됩니다.</p>
                </TabsContent>
                <TabsContent value="posts">
                  <div className="mt-2 space-y-2">
                    {selected.posts.length === 0 && (
                      <p className="text-center text-sm text-slate-400">작성한 글이 없습니다.</p>
                    )}
                    {selected.posts.map((p) => (
                      <div key={p.id} className="rounded border border-slate-100 p-2 text-xs">
                        <div className="font-medium">{p.title}</div>
                        <div className="text-slate-400">{new Date(p.created_at).toLocaleDateString("ko-KR")}</div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
                <TabsContent value="listings">
                  <div className="mt-2 space-y-2">
                    {selected.listings.length === 0 && (
                      <p className="text-center text-sm text-slate-400">등록한 업체가 없습니다.</p>
                    )}
                    {selected.listings.map((l) => (
                      <div key={l.id} className="rounded border border-slate-100 p-2 text-xs">
                        <div className="font-medium">{l.name_ko ?? l.name}</div>
                        <div className="text-slate-400">{l.status}</div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* 확인 다이얼로그 */}
      <Dialog open={Boolean(confirmDialog)} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog?.type === "role" ? "역할 변경" : "계정 상태 변경"}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog?.type === "role"
                ? `역할을 "${confirmDialog?.value}"로 변경하시겠습니까?`
                : `계정을 ${confirmDialog?.value ? "활성화" : "비활성화"}하시겠습니까?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>취소</Button>
            <Button
              onClick={() => {
                if (!confirmDialog) return;
                if (confirmDialog.type === "role") {
                  void applyRoleChange(confirmDialog.value as "user" | "admin");
                } else {
                  void applyStatusChange(confirmDialog.value as boolean);
                }
              }}
            >
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/pages/admin/AdminUsers.tsx
git commit -m "feat: AdminUsers page with table, filters, detail sheet"
```

---

## Task 7: 파일 이동 + App.tsx 라우팅 교체

**Files:**
- Move: `src/pages/AdminListings.tsx` → `src/pages/admin/AdminListings.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: 디렉토리 생성 + 파일 이동**

```bash
mkdir -p src/pages/admin
cp src/pages/AdminListings.tsx src/pages/admin/AdminListings.tsx
```

`src/pages/admin/AdminListings.tsx` 상단에서 import 경로 수정:

기존:
```tsx
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
```

AdminLayout이 래퍼 역할을 하므로 `AdminListings.tsx` 내부의 `<Navbar />`, `<Footer />` 제거:

```tsx
// Navbar와 Footer 렌더링 제거 — AdminLayout이 감싸고 있음
// div.min-h-screen 구조도 단순화
export default function AdminListings() {
  return (
    <AdminListingsContent />
  );
}

function AdminListingsContent() {
  // ... 기존 코드 유지, 단 Navbar와 Footer 태그 제거
  return (
    <div className="p-8">
      {/* 기존 main 내용 */}
    </div>
  );
}
```

- [ ] **Step 2: App.tsx 수정**

기존 import 제거 후 추가:
```tsx
// 기존 제거:
// import AdminListings from "./pages/AdminListings.tsx";

// 추가:
import AdminLayout from "./components/admin/AdminLayout.tsx";
import AdminHome from "./pages/admin/AdminHome.tsx";
import AdminUsers from "./pages/admin/AdminUsers.tsx";
import AdminListings from "./pages/admin/AdminListings.tsx";
```

Routes 내부에서 기존 `/admin/listings` 라우트 제거 후 AdminLayout 블록 추가:

```tsx
// AppShell Route 블록에서 제거:
// <Route path="/admin/listings" element={<AdminListings />} />

// AppShell Route 블록 밖에 추가 (</Route> 뒤):
<Route element={<AdminLayout />}>
  <Route path="/admin" element={<AdminHome />} />
  <Route path="/admin/users" element={<AdminUsers />} />
  <Route path="/admin/listings" element={<AdminListings />} />
</Route>
```

- [ ] **Step 3: 기존 AdminListings.tsx 삭제**

```bash
git rm src/pages/AdminListings.tsx
```

- [ ] **Step 4: 빌드 확인**

```bash
bun run build
# Expected: 빌드 성공, 타입 에러 없음
```

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "feat: wire AdminLayout routes, move AdminListings to admin/"
```

---

## Task 8: 동작 확인 체크리스트

- [ ] `http://localhost:5173/admin` → 사이드바 레이아웃 + 현황 카드 4개 표시
- [ ] `http://localhost:5173/admin/users` → 회원 테이블 표시, 검색 동작
- [ ] 회원 행 클릭 → Sheet 열림, 탭 3개 (주문/글/업체) 동작
- [ ] 역할 변경 버튼 클릭 → 확인 다이얼로그 → 변경 후 목록 갱신
- [ ] 비로그인 상태로 `/admin` 접근 → 로그인 페이지 리다이렉트
- [ ] user 권한 계정으로 `/admin` 접근 → 403 또는 리다이렉트
- [ ] 사이드바 "사이트로 돌아가기" 클릭 → `/` 이동
- [ ] 업체 검수 사이드바 항목 → 뱃지 숫자 표시, 클릭 → 기존 검수 화면

- [ ] **최종 커밋 (이슈 있으면 수정 후)**

```bash
git add -A
git commit -m "feat: 관리자 쉘 + 회원 관리 서브시스템 1 완료"
```
