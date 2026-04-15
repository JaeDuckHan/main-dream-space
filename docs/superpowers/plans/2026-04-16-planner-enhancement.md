# 플래너 기능 강화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 플래너에 예산 시뮬레이터·숙소 추천·공유링크·D-day 알림·탐색 기능을 추가해 재방문율과 바이럴을 높인다.

**Architecture:** 기존 `src/pages/Planner.tsx` (localStorage 기반)에 UI 기능을 추가하고, 공유·알림을 위한 새 DB 테이블(`planner_plans`, `planner_reminders`)과 API를 `server/src/routes/planner.ts`에 추가한다. 이메일 알림은 `node-cron` + Resend로 서버 시작 시 등록되는 cron job으로 처리한다.

**Tech Stack:** React 18, TypeScript, Express, PostgreSQL, Zod, node-cron, Resend, shadcn/ui (Slider), Tailwind CSS

---

## 구현 순서

E (예산 시뮬레이터) → C (숙소 추천) → A (공유 링크) → D-UI (D-day 배지) → D-Email (리마인더) → B (플랜 탐색)

---

## File Structure

**신규 생성:**
- `server/migrations/012_planner_plans.sql` — planner_plans + planner_reminders 테이블
- `server/src/jobs/planner-reminders.ts` — cron job (매일 09:00 KST 실행)
- `src/pages/PlannerShare.tsx` — 공개 플랜 읽기 전용 페이지
- `src/pages/PlannerExplore.tsx` — 다른 사람 플랜 탐색 페이지

**수정:**
- `server/src/routes/planner.ts` — plans CRUD + public listing 엔드포인트 추가
- `server/src/index.ts` — cron job 등록
- `src/App.tsx` — `/planner/share/:id`, `/planner/explore` 라우트 추가
- `src/pages/Planner.tsx` — E, C, A, D 기능 추가

---

## Task 1: DB Migration

**Files:**
- Create: `server/migrations/012_planner_plans.sql`

- [ ] **Step 1: migration 파일 작성**

```sql
-- server/migrations/012_planner_plans.sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS planner_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  session_id TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  data JSONB NOT NULL DEFAULT '{}',
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_planner_plans_session ON planner_plans(session_id);
CREATE INDEX IF NOT EXISTS idx_planner_plans_public ON planner_plans(is_public, created_at DESC) WHERE is_public = true;

CREATE TABLE IF NOT EXISTS planner_reminders (
  id SERIAL PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES planner_plans(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  remind_at TIMESTAMPTZ NOT NULL,
  sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_planner_reminders_pending ON planner_reminders(remind_at) WHERE sent = false;
```

- [ ] **Step 2: 서버에서 migration 실행**

```bash
psql $DATABASE_URL -f server/migrations/012_planner_plans.sql
```

Expected: 에러 없이 완료

- [ ] **Step 3: 테이블 확인**

```bash
psql $DATABASE_URL -c "\dt planner_*"
```

Expected: `planner_plans`, `planner_reminders` 두 테이블 표시

---

## Task 2: Feature E — 실시간 예산 시뮬레이터

Planner.tsx의 요약 탭에 비율 슬라이더를 추가한다. 저장은 불필요(표시 전용).

**Files:**
- Modify: `src/pages/Planner.tsx`

**배경:** shadcn의 `Slider` 컴포넌트가 이미 프로젝트에 있다 (`@/components/ui/slider`). 기존 `rec.budget = { 숙소, 식비, 이동, 기타 }` 데이터를 기준값으로 활용한다.

- [ ] **Step 1: Slider import 추가**

`src/pages/Planner.tsx` 상단 import 블록에 추가:

```typescript
import { Slider } from "@/components/ui/slider";
```

- [ ] **Step 2: budgetRatios 상태 추가**

`const [tab, setTab] = ...` 바로 아래(~line 757)에 추가:

```typescript
// Feature E: 예산 시뮬레이터
const [budgetRatios, setBudgetRatios] = useState<{ 숙소: number; 식비: number; 이동: number; 기타: number }>(() => {
  const total = Object.values(rec.budget).reduce((a, b) => a + b, 0);
  return {
    숙소: Math.round((rec.budget.숙소 / total) * 100),
    식비: Math.round((rec.budget.식비 / total) * 100),
    이동: Math.round((rec.budget.이동 / total) * 100),
    기타: 100 - Math.round((rec.budget.숙소 / total) * 100) - Math.round((rec.budget.식비 / total) * 100) - Math.round((rec.budget.이동 / total) * 100),
  };
});
```

- [ ] **Step 3: 슬라이더 핸들러 추가**

`budgetRatios` 상태 바로 아래에 추가:

```typescript
const updateBudgetRatio = (key: keyof typeof budgetRatios, newVal: number) => {
  setBudgetRatios(prev => {
    const diff = newVal - prev[key];
    const others = (Object.keys(prev) as (keyof typeof prev)[]).filter(k => k !== key);
    const totalOther = others.reduce((s, k) => s + prev[k], 0);
    const updated = { ...prev, [key]: newVal };
    if (totalOther > 0) {
      others.forEach(k => {
        updated[k] = Math.max(0, Math.round(prev[k] - (prev[k] / totalOther) * diff));
      });
    }
    // 합계가 100이 되도록 마지막 항목 보정
    const sum = Object.values(updated).reduce((a, b) => a + b, 0);
    updated[others[others.length - 1]] += (100 - sum);
    return updated;
  });
};

const resetBudgetRatios = () => {
  const total = Object.values(rec.budget).reduce((a, b) => a + b, 0);
  setBudgetRatios({
    숙소: Math.round((rec.budget.숙소 / total) * 100),
    식비: Math.round((rec.budget.식비 / total) * 100),
    이동: Math.round((rec.budget.이동 / total) * 100),
    기타: 100 - Math.round((rec.budget.숙소 / total) * 100) - Math.round((rec.budget.식비 / total) * 100) - Math.round((rec.budget.이동 / total) * 100),
  });
};
```

- [ ] **Step 4: 요약 탭에 시뮬레이터 UI 삽입**

요약 탭 내에서 기존 `budgetItems` 바 차트 블록(`{budgetItems.map(...)`) 바로 아래에 추가:

```tsx
{/* Feature E: 예산 시뮬레이터 */}
<div className="mt-6 border-t border-border pt-5">
  <div className="flex items-center justify-between mb-3">
    <span className="text-[13px] font-semibold text-foreground">예산 배분 조정</span>
    <button
      onClick={resetBudgetRatios}
      className="text-[11px] text-primary hover:underline"
    >
      {data.city} 평균으로 초기화
    </button>
  </div>
  {(Object.keys(budgetRatios) as (keyof typeof budgetRatios)[]).map(key => {
    const amount = Math.round((parseInt(budget) || data.budget) * budgetRatios[key] / 100);
    return (
      <div key={key} className="mb-4">
        <div className="flex justify-between text-[12px] text-muted-foreground mb-1">
          <span>{key}</span>
          <span className="font-medium text-foreground">{budgetRatios[key]}% · 약 {amount}만원</span>
        </div>
        <Slider
          value={[budgetRatios[key]]}
          onValueChange={([v]) => updateBudgetRatio(key, v)}
          min={0}
          max={70}
          step={1}
          className="w-full"
        />
      </div>
    );
  })}
  <div className="text-right text-[12px] text-muted-foreground mt-1">
    총 예산 {parseInt(budget) || data.budget}만원 기준
  </div>
</div>
```

- [ ] **Step 5: 브라우저에서 확인**

1. `/planner` 접속
2. 도시/인원/날짜/예산 입력 후 플랜 생성
3. 요약 탭 → 예산 배분 조정 슬라이더 표시 확인
4. 슬라이더 드래그 → 퍼센트·금액 실시간 업데이트 확인
5. "평균으로 초기화" 클릭 → 원래 값 복원 확인

- [ ] **Step 6: 커밋**

```bash
git add src/pages/Planner.tsx
git commit -m "feat: 플래너 실시간 예산 시뮬레이터 추가 (Feature E)"
```

---

## Task 3: Feature C — 조건 맞춤 숙소 추천

Housing 탭에 DB 기반 숙소 추천 카드 3개를 표시한다.

**Files:**
- Modify: `src/pages/Planner.tsx`

**배경:** `listings` 테이블의 `category_data->>'price_monthly_usd'`로 가격 필터링. USD→KRW 환율 1,350 하드코딩. 예산 초과분은 fallback으로 `price_min_usd` 사용.

- [ ] **Step 1: 숙소 추천 타입 + fetch 로직 추가**

Planner.tsx의 상태 선언부 근처에 추가:

```typescript
// Feature C: 숙소 추천
interface ListingRecommendation {
  id: number;
  name: string;
  slug: string;
  address: string | null;
  affiliate_url: string | null;
  category_data: {
    price_min_usd?: number;
    price_monthly_usd?: number;
  };
}

const USD_TO_KRW = 1350;
const [listingRecs, setListingRecs] = useState<ListingRecommendation[]>([]);

useEffect(() => {
  if (!data.city) return;
  const budgetKrw = (data.budget || 150) * 10000;
  fetch(`/api/listings?category=accommodation&city=${encodeURIComponent(data.city)}&limit=20`)
    .then(r => r.json())
    .then((rows: ListingRecommendation[]) => {
      const filtered = rows.filter(r => {
        const monthly = r.category_data?.price_monthly_usd;
        const min = r.category_data?.price_min_usd;
        const priceKrw = (monthly ?? min ?? 9999) * USD_TO_KRW;
        return priceKrw <= budgetKrw * 0.6; // 예산의 60% 이하 숙소
      });
      setListingRecs(filtered.slice(0, 3));
    })
    .catch(() => null);
}, [data.city, data.budget]);
```

- [ ] **Step 2: Housing 탭 최상단에 추천 카드 삽입**

`{/* Tab: Housing */}` 블록 내 `{housingRecs.map(...)}` 섹션 바로 위에 추가:

```tsx
{/* Feature C: DB 숙소 추천 */}
{listingRecs.length > 0 && (
  <div className="mb-6">
    <h4 className="text-[13px] font-semibold text-foreground mb-3">
      예산 맞춤 추천 숙소
      <span className="ml-2 text-[11px] font-normal text-muted-foreground">(예산 {data.budget}만원 기준)</span>
    </h4>
    <div className="space-y-2">
      {listingRecs.map(listing => {
        const monthly = listing.category_data?.price_monthly_usd;
        const min = listing.category_data?.price_min_usd;
        const priceKrw = Math.round(((monthly ?? min ?? 0) * USD_TO_KRW) / 10000);
        return (
          <div key={listing.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors">
            <div>
              <p className="text-[13px] font-medium text-foreground">{listing.name}</p>
              {listing.address && <p className="text-[11px] text-muted-foreground mt-0.5">{listing.address}</p>}
            </div>
            <div className="flex items-center gap-2 ml-3 shrink-0">
              {priceKrw > 0 && (
                <span className="text-[12px] text-primary font-medium">월 {priceKrw}만원~</span>
              )}
              {listing.affiliate_url && (
                <a
                  href={listing.affiliate_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] px-2 py-1 bg-primary text-primary-foreground rounded hover:opacity-90"
                  onClick={() => {
                    fetch("/api/affiliate/click", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ listing_id: listing.id, partner: "agoda" }),
                    }).catch(() => null);
                  }}
                >
                  예약
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  </div>
)}
```

- [ ] **Step 3: `/api/listings` 엔드포인트 city 파라미터 지원 확인**

```bash
curl "http://localhost:3001/api/listings?category=accommodation&city=다낭&limit=5"
```

Expected: JSON 배열 반환. 빈 배열이면 DB에 accommodation 데이터가 없는 것 — 추천 섹션은 숨겨진 상태(listingRecs.length === 0)로 정상.

- [ ] **Step 4: 브라우저에서 확인**

1. 플래너에서 "다낭" 선택 후 플랜 생성
2. Housing 탭 → "예산 맞춤 추천 숙소" 섹션 표시 확인 (DB에 데이터 있을 경우)
3. 예약 버튼 클릭 → affiliate_clicks 기록 + 외부 링크 이동 확인

- [ ] **Step 5: 커밋**

```bash
git add src/pages/Planner.tsx
git commit -m "feat: 플래너 조건 맞춤 숙소 추천 추가 (Feature C)"
```

---

## Task 4: Feature A — 플랜 공유 링크

플랜을 DB에 저장하고 고유 URL을 생성해 공유할 수 있게 한다.

**Files:**
- Modify: `server/src/routes/planner.ts`
- Create: `src/pages/PlannerShare.tsx`
- Modify: `src/App.tsx`
- Modify: `src/pages/Planner.tsx`

### Step 4-1: 백엔드 API 추가

- [ ] **Step 1: planner.ts에 plans 엔드포인트 추가**

`server/src/routes/planner.ts` 파일의 `export default router;` 바로 위에 추가:

```typescript
// ── Plan Share ──────────────────────────────────────────────────────────────

const planDataSchema = z.object({
  city: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  party: z.string(),
  budget: z.number(),
  title: z.string().optional(),
});

// POST /api/planner/plans — 플랜 저장
router.post("/plans", async (req, res, next) => {
  try {
    const body = z.object({
      session_id: z.string().min(1).max(64),
      title: z.string().max(100).default(""),
      data: z.record(z.unknown()),
      is_public: z.boolean().default(false),
    }).parse(req.body);

    const userId = (req as any).authUser?.id ?? null;

    const rows = await query<{ id: string }>(
      `INSERT INTO planner_plans (user_id, session_id, title, data, is_public)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [userId, body.session_id, body.title, JSON.stringify(body.data), body.is_public],
    );

    res.json({ id: rows[0].id });
  } catch (error) {
    next(error);
  }
});

// GET /api/planner/plans/public — 공개 플랜 목록
router.get("/plans/public", async (req, res, next) => {
  try {
    const params = z.object({
      city: z.string().optional(),
      party: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    }).parse(req.query);

    let sql = `SELECT id, title, data, created_at FROM planner_plans WHERE is_public = true`;
    const values: unknown[] = [];

    if (params.city) {
      values.push(params.city);
      sql += ` AND data->>'city' = $${values.length}`;
    }
    if (params.party) {
      values.push(params.party);
      sql += ` AND data->>'party' = $${values.length}`;
    }

    values.push(params.limit);
    sql += ` ORDER BY created_at DESC LIMIT $${values.length}`;

    const rows = await query<{ id: string; title: string; data: Record<string, unknown>; created_at: string }>(sql, values);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/planner/plans/:id — 단일 플랜 조회 (공개만)
router.get("/plans/:id", async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const rows = await query<{ id: string; title: string; data: Record<string, unknown>; created_at: string }>(
      `SELECT id, title, data, created_at FROM planner_plans WHERE id = $1 AND is_public = true`,
      [id],
    );
    if (!rows[0]) return res.status(404).json({ error: "플랜을 찾을 수 없습니다." });
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});
```

- [ ] **Step 2: API 동작 확인**

```bash
# 플랜 저장
curl -s -X POST http://localhost:3001/api/planner/plans \
  -H "Content-Type: application/json" \
  -d '{"session_id":"test-session-1","title":"테스트 플랜","data":{"city":"다낭","party":"커플","budget":200,"startDate":"2026-05-01","endDate":"2026-05-31"},"is_public":true}' | jq .
```

Expected: `{"id":"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"}`

```bash
# 단일 플랜 조회 (위에서 받은 UUID 사용)
curl -s http://localhost:3001/api/planner/plans/<UUID> | jq .city
```

Expected: `"다낭"`

### Step 4-2: 공유 페이지 생성

- [ ] **Step 3: PlannerShare.tsx 생성**

```tsx
// src/pages/PlannerShare.tsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

interface SharedPlan {
  id: string;
  title: string;
  data: {
    city: string;
    party: string;
    budget: number;
    startDate: string;
    endDate: string;
  };
  created_at: string;
}

export default function PlannerShare() {
  const { id } = useParams<{ id: string }>();
  const [plan, setPlan] = useState<SharedPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/planner/plans/${id}`)
      .then(r => {
        if (!r.ok) { setNotFound(true); return null; }
        return r.json();
      })
      .then(data => { if (data) setPlan(data); })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">불러오는 중...</div>;
  if (notFound || !plan) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <p className="text-muted-foreground">플랜을 찾을 수 없습니다.</p>
      <Link to="/planner" className="text-primary hover:underline text-sm">내 플랜 만들기</Link>
    </div>
  );

  const { city, party, budget, startDate, endDate } = plan.data;

  return (
    <>
      <Navbar />
      <main className="container py-10 max-w-xl">
        <div className="mb-6">
          <p className="text-sm text-muted-foreground mb-1">{new Date(plan.created_at).toLocaleDateString("ko")} 공유된 플랜</p>
          <h1 className="text-2xl font-bold text-foreground">{plan.title || `${city} 한달살기 플랜`}</h1>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-8">
          {[
            { label: "도시", value: city },
            { label: "동행", value: party },
            { label: "예산", value: `${budget}만원/월` },
            { label: "기간", value: startDate && endDate ? `${startDate} ~ ${endDate}` : "미정" },
          ].map(({ label, value }) => (
            <div key={label} className="p-4 rounded-lg border border-border bg-card">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className="text-sm font-semibold text-foreground">{value}</p>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">나도 {city} 한달살기 플랜 만들어볼까요?</p>
          <Link
            to="/planner"
            className="inline-block px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            무료로 내 플랜 만들기
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
```

- [ ] **Step 4: App.tsx에 라우트 추가**

`src/App.tsx`에서 기존 `import Planner from "./pages/Planner.tsx"` 아래에 추가:

```typescript
import PlannerShare from "./pages/PlannerShare.tsx";
import PlannerExplore from "./pages/PlannerExplore.tsx";
```

Routes 블록에 `/planner` 라우트 아래에 추가:

```tsx
<Route path="/planner/share/:id" element={<PlannerShare />} />
<Route path="/planner/explore" element={<PlannerExplore />} />
```

*(PlannerExplore는 Task 7에서 구현. 지금은 빈 컴포넌트로 placeholder 추가:)*

`src/pages/PlannerExplore.tsx`를 임시 생성:

```tsx
// src/pages/PlannerExplore.tsx
export default function PlannerExplore() {
  return <div className="container py-10">준비 중</div>;
}
```

### Step 4-3: 공유 버튼 UI 추가

- [ ] **Step 5: Planner.tsx에 공유 버튼 + 저장 로직 추가**

Planner.tsx 상태 선언부에 추가:

```typescript
// Feature A: 공유 링크
const [sharing, setSharing] = useState(false);
const [sharedId, setSharedId] = useState<string | null>(null);
```

`const tabs = [...]` 아래에 공유 핸들러 추가:

```typescript
const handleShare = async () => {
  setSharing(true);
  try {
    const res = await fetch("/api/planner/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: getSessionId(),
        title: `${data.city} ${data.party} 한달살기 플랜`,
        data,
        is_public: true,
      }),
    });
    const json = await res.json() as { id: string };
    const url = `${window.location.origin}/planner/share/${json.id}`;
    await navigator.clipboard.writeText(url);
    setSharedId(json.id);
    toast.success("링크가 복사됐어요!");
  } catch {
    toast.error("공유에 실패했습니다.");
  } finally {
    setSharing(false);
  }
};
```

Planner.tsx에서 `import { toast } from "sonner"` 확인 — 없으면 추가.

탭 목록 바로 위 영역(플래너 헤더)에 공유 버튼 삽입:

```tsx
<div className="flex items-center gap-2 ml-auto">
  {sharedId && (
    <a
      href={`/planner/share/${sharedId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[12px] text-primary hover:underline"
    >
      공유 페이지 보기
    </a>
  )}
  <button
    onClick={() => void handleShare()}
    disabled={sharing}
    className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] rounded-lg border border-border hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-50"
  >
    {sharing ? "저장 중..." : "🔗 공유하기"}
  </button>
</div>
```

- [ ] **Step 6: 브라우저에서 확인**

1. 플래너에서 플랜 생성
2. "공유하기" 버튼 클릭 → "링크가 복사됐어요!" 토스트
3. 복사된 URL `/planner/share/:uuid` 브라우저에서 열기
4. 플랜 정보 표시 + "무료로 내 플랜 만들기" CTA 확인

- [ ] **Step 7: 커밋**

```bash
git add server/src/routes/planner.ts src/pages/PlannerShare.tsx src/pages/PlannerExplore.tsx src/App.tsx src/pages/Planner.tsx
git commit -m "feat: 플래너 공유 링크 기능 추가 (Feature A)"
```

---

## Task 5: Feature D-UI — D-day 카운트다운 배지

출발일 기준 D-day를 플래너 헤더에 표시한다.

**Files:**
- Modify: `src/pages/Planner.tsx`

- [ ] **Step 1: D-day 계산 로직 추가**

`handleShare` 아래에 추가:

```typescript
// Feature D: D-day
const dDay = useMemo(() => {
  if (!data.startDate) return null;
  const start = new Date(data.startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = differenceInDays(start, today);
  return diff;
}, [data.startDate]);
```

(`differenceInDays`는 이미 `date-fns`에서 import 중 — line 17 확인.)

- [ ] **Step 2: 플래너 헤더에 D-day 배지 추가**

공유 버튼과 같은 헤더 영역에 배지 삽입:

```tsx
{dDay !== null && (
  <span className={cn(
    "text-[12px] font-semibold px-2.5 py-1 rounded-full",
    dDay > 14 ? "bg-blue-100 text-blue-700" :
    dDay > 0 ? "bg-orange-100 text-orange-700" :
    dDay === 0 ? "bg-green-100 text-green-700" :
    "bg-slate-100 text-slate-500"
  )}>
    {dDay > 0 ? `D-${dDay}` : dDay === 0 ? "D-Day!" : `D+${Math.abs(dDay)}`}
  </span>
)}
```

- [ ] **Step 3: 브라우저에서 확인**

1. 플래너에서 출발일 설정 후 플랜 생성
2. 헤더에 D-XX 배지 표시 확인
3. 출발일이 14일 이내면 주황색, 당일이면 초록색 확인

- [ ] **Step 4: 커밋**

```bash
git add src/pages/Planner.tsx
git commit -m "feat: 플래너 D-day 카운트다운 배지 추가 (Feature D-UI)"
```

---

## Task 6: Feature D-Email — 리마인더 cron job

출발 D-30/D-14/D-7에 미완료 체크리스트 알림 이메일을 발송한다.

**Files:**
- Create: `server/src/jobs/planner-reminders.ts`
- Modify: `server/src/routes/planner.ts` (이메일 등록 엔드포인트 추가)
- Modify: `server/src/index.ts` (cron job 등록)
- Modify: `src/pages/Planner.tsx` (이메일 입력 모달)

- [ ] **Step 1: node-cron 패키지 설치**

```bash
cd server && bun add node-cron && bun add -d @types/node-cron
```

Expected: `package.json`에 `node-cron` 추가됨

- [ ] **Step 2: planner-reminders.ts 생성**

```typescript
// server/src/jobs/planner-reminders.ts
import cron from "node-cron";
import { query } from "../db.js";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface ReminderRow {
  id: number;
  email: string;
  plan_id: string;
  plan_title: string;
  plan_data: { city: string; startDate: string; checklist: Record<string, boolean> };
  remind_at: string;
}

async function sendPendingReminders() {
  const rows = await query<ReminderRow>(
    `SELECT r.id, r.email, r.plan_id,
            p.title AS plan_title,
            p.data AS plan_data
     FROM planner_reminders r
     JOIN planner_plans p ON p.id = r.plan_id
     WHERE r.sent = false AND r.remind_at <= NOW()`,
    [],
  );

  for (const row of rows) {
    const unchecked = Object.values(row.plan_data.checklist || {}).filter(v => !v).length;
    const startDate = row.plan_data.startDate
      ? new Date(row.plan_data.startDate).toLocaleDateString("ko-KR")
      : "미정";
    const dDay = row.plan_data.startDate
      ? Math.ceil((new Date(row.plan_data.startDate).getTime() - Date.now()) / 86400000)
      : null;

    try {
      await resend.emails.send({
        from: "럭키다낭 <noreply@luckydanang.com>",
        to: row.email,
        subject: `${row.plan_data.city} 출발${dDay ? ` D-${dDay}` : ""}! 체크리스트 ${unchecked}개가 남았어요`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#1a1a1a">${row.plan_title || row.plan_data.city + " 한달살기 플랜"}</h2>
            <p style="color:#555">출발일 <strong>${startDate}</strong>까지 아직 <strong>${unchecked}개</strong>의 체크리스트가 남았어요.</p>
            <a href="${process.env.VITE_SITE_URL || "https://luckydanang.com"}/planner"
               style="display:inline-block;margin-top:16px;padding:12px 24px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
              플래너 확인하기
            </a>
          </div>`,
      });

      await query(`UPDATE planner_reminders SET sent = true WHERE id = $1`, [row.id]);
    } catch (err) {
      console.error(`[planner-reminders] 이메일 발송 실패 id=${row.id}:`, err);
    }
  }
}

export function startPlannerReminderJob() {
  // 매일 오전 9시 KST (00:00 UTC)
  cron.schedule("0 0 * * *", () => {
    sendPendingReminders().catch(err => console.error("[planner-reminders] cron error:", err));
  });
  console.log("[planner-reminders] cron job registered (daily 09:00 KST)");
}
```

- [ ] **Step 3: index.ts에 cron job 등록**

`server/src/index.ts` 상단 import 블록에 추가:

```typescript
import { startPlannerReminderJob } from "./jobs/planner-reminders.js";
```

`app.use(errorHandler);` 바로 아래에 추가:

```typescript
startPlannerReminderJob();
```

- [ ] **Step 4: 이메일 등록 API 추가**

`server/src/routes/planner.ts`의 `export default router;` 바로 위에 추가:

```typescript
// POST /api/planner/plans/:id/reminders — 리마인더 이메일 등록
router.post("/plans/:id/reminders", async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { email } = z.object({ email: z.string().email() }).parse(req.body);

    const plans = await query<{ id: string; data: { startDate?: string } }>(
      `SELECT id, data FROM planner_plans WHERE id = $1`,
      [id],
    );
    if (!plans[0]) return res.status(404).json({ error: "플랜을 찾을 수 없습니다." });

    const startDate = plans[0].data.startDate;
    if (!startDate) return res.status(400).json({ error: "출발일이 설정되지 않았습니다." });

    const start = new Date(startDate);
    const remindDays = [30, 14, 7];
    const now = new Date();

    // 이미 지난 날짜는 등록하지 않음
    const inserts = remindDays
      .map(d => {
        const remindAt = new Date(start);
        remindAt.setDate(remindAt.getDate() - d);
        return remindAt > now ? remindAt : null;
      })
      .filter(Boolean);

    for (const remindAt of inserts) {
      await query(
        `INSERT INTO planner_reminders (plan_id, email, remind_at) VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [id, email, remindAt],
      );
    }

    res.json({ ok: true, scheduled: inserts.length });
  } catch (error) {
    next(error);
  }
});
```

- [ ] **Step 5: 플래너 UI에 이메일 모달 추가**

Planner.tsx에서 공유 후 이메일 입력 모달을 표시한다. 기존 Dialog 컴포넌트를 재사용.

상태 추가:

```typescript
const [showReminderModal, setShowReminderModal] = useState(false);
const [reminderEmail, setReminderEmail] = useState("");
const [reminderPlanId, setReminderPlanId] = useState<string | null>(null);
const [savingReminder, setSavingReminder] = useState(false);
```

`handleShare` 함수에서 `setSharedId(json.id)` 바로 뒤에 추가:

```typescript
setReminderPlanId(json.id);
if (data.startDate) setShowReminderModal(true);
```

리마인더 저장 핸들러 추가:

```typescript
const handleSaveReminder = async () => {
  if (!reminderPlanId || !reminderEmail) return;
  setSavingReminder(true);
  try {
    await fetch(`/api/planner/plans/${reminderPlanId}/reminders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: reminderEmail }),
    });
    toast.success("리마인더가 등록됐어요!");
    setShowReminderModal(false);
  } catch {
    toast.error("등록에 실패했습니다.");
  } finally {
    setSavingReminder(false);
  }
};
```

모달 JSX를 플래너 return 최상단(Navbar 바로 다음)에 추가:

```tsx
<Dialog open={showReminderModal} onOpenChange={setShowReminderModal}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>출발 전 알림 받기</DialogTitle>
    </DialogHeader>
    <p className="text-sm text-muted-foreground">
      출발 D-30, D-14, D-7에 미완료 체크리스트를 이메일로 알려드려요.
    </p>
    <Input
      type="email"
      placeholder="이메일 주소"
      value={reminderEmail}
      onChange={e => setReminderEmail(e.target.value)}
      className="mt-2"
    />
    <DialogFooter>
      <Button variant="outline" onClick={() => setShowReminderModal(false)}>나중에</Button>
      <Button onClick={() => void handleSaveReminder()} disabled={savingReminder || !reminderEmail}>
        {savingReminder ? "등록 중..." : "알림 등록"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- [ ] **Step 6: 서버 재시작 후 확인**

```bash
# 서버 시작 로그에서 확인
# Expected: "[planner-reminders] cron job registered (daily 09:00 KST)"
```

- [ ] **Step 7: 커밋**

```bash
git add server/src/jobs/planner-reminders.ts server/src/routes/planner.ts server/src/index.ts src/pages/Planner.tsx
git commit -m "feat: 플래너 D-day 이메일 리마인더 추가 (Feature D-Email)"
```

---

## Task 7: Feature B — 다른 사람 플랜 탐색

공개된 플랜들을 조건 필터로 탐색하는 페이지를 구현한다.

**Files:**
- Modify: `src/pages/PlannerExplore.tsx` (Task 4에서 임시 생성한 파일 교체)

- [ ] **Step 1: PlannerExplore.tsx 전체 구현**

```tsx
// src/pages/PlannerExplore.tsx
import { useEffect, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

interface PublicPlan {
  id: string;
  title: string;
  data: {
    city: string;
    party: string;
    budget: number;
    startDate: string;
    endDate: string;
    checklist: Record<string, boolean>;
  };
  created_at: string;
}

const CITIES = ["전체", "다낭", "호치민", "하노이", "나트랑", "푸꾸옥"];
const PARTIES = ["전체", "혼자", "커플", "가족", "친구"];

export default function PlannerExplore() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const city = searchParams.get("city") || "";
  const party = searchParams.get("party") || "";

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (city) params.set("city", city);
    if (party) params.set("party", party);
    params.set("limit", "20");

    fetch(`/api/planner/plans/public?${params}`)
      .then(r => r.json())
      .then((data: PublicPlan[]) => setPlans(data))
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, [city, party]);

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value && value !== "전체") next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  const getCheckedRatio = (checklist: Record<string, boolean>) => {
    const vals = Object.values(checklist || {});
    if (!vals.length) return 0;
    return Math.round((vals.filter(Boolean).length / vals.length) * 100);
  };

  return (
    <>
      <Navbar />
      <main className="container py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">다른 사람 플랜 구경하기</h1>
          <p className="text-sm text-muted-foreground mt-1">실제로 계획한 한달살기 플랜들을 확인해보세요</p>
        </div>

        {/* 필터 */}
        <div className="flex flex-wrap gap-2 mb-6">
          <div className="flex gap-1.5">
            {CITIES.map(c => (
              <button
                key={c}
                onClick={() => setFilter("city", c)}
                className={`px-3 py-1.5 text-[12px] rounded-full border transition-colors ${
                  (city || "전체") === c
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {PARTIES.map(p => (
              <button
                key={p}
                onClick={() => setFilter("party", p)}
                className={`px-3 py-1.5 text-[12px] rounded-full border transition-colors ${
                  (party || "전체") === p
                    ? "bg-foreground text-background border-foreground"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* 플랜 목록 */}
        {loading ? (
          <p className="text-muted-foreground text-sm">불러오는 중...</p>
        ) : plans.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground">아직 공유된 플랜이 없어요.</p>
            <Link to="/planner" className="mt-4 inline-block text-primary hover:underline text-sm">
              첫 번째로 플랜 만들기
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map(plan => {
              const ratio = getCheckedRatio(plan.data.checklist);
              return (
                <Link
                  key={plan.id}
                  to={`/planner/share/${plan.id}`}
                  className="p-5 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-sm transition-all"
                >
                  <h3 className="text-[14px] font-semibold text-foreground mb-3 line-clamp-1">
                    {plan.title || `${plan.data.city} 한달살기 플랜`}
                  </h3>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {[plan.data.city, plan.data.party, `${plan.data.budget}만원`].map(tag => (
                      <span key={tag} className="px-2 py-0.5 text-[11px] bg-muted text-muted-foreground rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                  {ratio > 0 && (
                    <div>
                      <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                        <span>체크리스트</span>
                        <span>{ratio}% 완료</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${ratio}%` }} />
                      </div>
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-3">
                    {new Date(plan.created_at).toLocaleDateString("ko-KR")}
                  </p>
                </Link>
              );
            })}
          </div>
        )}

        <div className="mt-10 text-center">
          <Link
            to="/planner"
            className="inline-block px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
          >
            내 플랜 만들기
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
```

- [ ] **Step 2: 플래너 헤더에 탐색 링크 추가**

Planner.tsx 헤더 영역에 공유 버튼 옆에 추가:

```tsx
<Link
  to="/planner/explore"
  className="text-[12px] text-muted-foreground hover:text-foreground transition-colors"
>
  다른 플랜 보기
</Link>
```

- [ ] **Step 3: 브라우저에서 확인**

1. `/planner/explore` 접속
2. 도시/동행 필터 클릭 → URL 파라미터 변경 + 목록 갱신 확인
3. 공유된 플랜이 없으면 "아직 공유된 플랜이 없어요" + "첫 번째로 플랜 만들기" 표시 확인
4. 카드 클릭 → `/planner/share/:id` 페이지 이동 확인

- [ ] **Step 4: 커밋**

```bash
git add src/pages/PlannerExplore.tsx src/pages/Planner.tsx
git commit -m "feat: 다른 사람 플랜 탐색 페이지 추가 (Feature B)"
```

---

## 최종 확인

- [ ] `bun run build` 실행 → 빌드 에러 없음 확인
- [ ] 전체 플로우 테스트: 플랜 생성 → 예산 슬라이더 → 공유 클릭 → URL 복사 → 공유 페이지 접속 → 탐색 페이지에서 카드 표시
- [ ] 서버 재시작 → `[planner-reminders] cron job registered` 로그 확인
