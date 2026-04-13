# 스펙 08a+: 메인 페이지 긴급수리 + 수익화 주입

**파일 경로**: `docs/specs/08a-main-page-rescue.md`
**작업자**: Codex
**예상 소요**: 3~4일
**선행 조건**: 02(accommodation-compare) 완료, 03(business-directory) 작업 중이어도 OK

---

## 0. 목표

| 항목 | Before | After |
|---|---|---|
| 클릭 가능한 요소 | 2개 (로고, 로그인) | 20+ |
| 수익 포인트 | 0개 | 5개 (Agoda deeplink) |
| 동작하는 폼 | 0개 | 2개 (검색, 뉴스레터) |
| 거짓 정보 | 1개 (환율 하드코딩) | 0개 |
| 리드 수집 | 0 | 뉴스레터 + 계산기 결과 |

---

## 1. 파일 구조 (변경 범위)

```
src/
├── pages/
│   ├── Home.tsx                    [수정] 전체 리팩토링
│   └── Compare.tsx                 [확인] URL 파라미터 수신 로직
├── components/
│   ├── home/
│   │   ├── HeroSearch.tsx          [수정] 검색 동작 연결
│   │   ├── CityTabs.tsx            [수정] 클릭 → 라우팅
│   │   ├── CityCostCards.tsx       [수정] 카드 → 라우팅
│   │   ├── CostCalculator.tsx      [수정] 결과 CTA 2개 추가
│   │   ├── LocalServices.tsx       [수정] 서비스 → /listings/:id
│   │   ├── WeeklyNews.tsx          [수정] 정적 JSON 연동
│   │   ├── NewsletterForm.tsx      [신규] 구독 폼
│   │   ├── TopHotels.tsx           [신규] 다낭 인기 숙소 TOP3 (수익 핵심)
│   │   └── TrustIndicators.tsx     [신규] 사회적 증거 (조건부)
│   └── layout/
│       └── Navbar.tsx              [수정] 비스펙 메뉴 숨김
├── lib/
│   ├── routes.ts                   [신규] 라우트 상수
│   └── agoda.ts                    [신규] Agoda deeplink 빌더
└── data/
    └── weekly-news.json            [신규] 정적 뉴스 데이터

server/
├── src/
│   ├── routes/
│   │   ├── newsletter.ts           [신규] POST /api/newsletter/subscribe
│   │   ├── listings.ts             [확인] GET /api/listings/top?category=숙소&city=danang&limit=3
│   │   └── stats.ts                [신규] GET /api/stats/summary
│   └── db/
│       └── migrations/
│           └── 008_newsletter.sql  [신규]
```

---

## 2. DB 마이그레이션

### `server/src/db/migrations/008_newsletter.sql`

```sql
-- newsletter_subscribers
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id           BIGSERIAL PRIMARY KEY,
  email        VARCHAR(255) NOT NULL UNIQUE,
  source       VARCHAR(50)  NOT NULL DEFAULT 'main',  -- main, compare, calculator, footer
  status       VARCHAR(20)  NOT NULL DEFAULT 'confirmed',  -- pending, confirmed, unsubscribed
  locale       VARCHAR(10)  NOT NULL DEFAULT 'ko',
  ip_hash      VARCHAR(64),                           -- sha256(ip + salt), 중복가입 방지용
  user_agent   TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_newsletter_status ON newsletter_subscribers(status);
CREATE INDEX IF NOT EXISTS idx_newsletter_created ON newsletter_subscribers(created_at DESC);

-- rate limit용 (같은 IP가 1분에 1회만 구독 요청)
CREATE TABLE IF NOT EXISTS newsletter_rate_limit (
  ip_hash    VARCHAR(64) PRIMARY KEY,
  last_try   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**실행**:
```bash
psql -U dreamspace -d dreamspace -f server/src/db/migrations/008_newsletter.sql
```

---

## 3. 백엔드 구현

### 3.1 `server/src/routes/newsletter.ts` (신규)

```typescript
import { Router } from 'express';
import { pool } from '../db/pool';
import crypto from 'crypto';

const router = Router();
const SALT = process.env.HASH_SALT || 'luckydanang-dev-salt';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip + SALT).digest('hex');
}

router.post('/subscribe', async (req, res) => {
  const { email, source = 'main' } = req.body || {};
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim()
          || req.socket.remoteAddress
          || 'unknown';
  const ipHash = hashIp(ip);
  const ua = req.headers['user-agent']?.slice(0, 500) || '';

  // 검증
  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email)) {
    return res.status(400).json({ ok: false, error: 'INVALID_EMAIL' });
  }
  if (email.length > 255) {
    return res.status(400).json({ ok: false, error: 'EMAIL_TOO_LONG' });
  }

  const client = await pool.connect();
  try {
    // rate limit: 같은 IP 60초 1회
    const rl = await client.query(
      `SELECT last_try FROM newsletter_rate_limit WHERE ip_hash = $1`,
      [ipHash]
    );
    if (rl.rows[0]) {
      const diff = Date.now() - new Date(rl.rows[0].last_try).getTime();
      if (diff < 60_000) {
        return res.status(429).json({ ok: false, error: 'RATE_LIMIT' });
      }
    }
    await client.query(
      `INSERT INTO newsletter_rate_limit(ip_hash, last_try)
       VALUES ($1, NOW())
       ON CONFLICT (ip_hash) DO UPDATE SET last_try = NOW()`,
      [ipHash]
    );

    // 구독 (중복이면 무시, 성공 응답은 동일하게)
    await client.query(
      `INSERT INTO newsletter_subscribers(email, source, status, ip_hash, user_agent, confirmed_at)
       VALUES ($1, $2, 'confirmed', $3, $4, NOW())
       ON CONFLICT (email) DO NOTHING`,
      [email.toLowerCase().trim(), source, ipHash, ua]
    );

    return res.json({ ok: true });
  } catch (err: any) {
    console.error('[newsletter] subscribe error', err);
    return res.status(500).json({ ok: false, error: 'SERVER_ERROR' });
  } finally {
    client.release();
  }
});

export default router;
```

**등록** (`server/src/app.ts` 또는 `index.ts`):
```typescript
import newsletterRouter from './routes/newsletter';
app.use('/api/newsletter', newsletterRouter);
```

### 3.2 `server/src/routes/stats.ts` (신규)

```typescript
import { Router } from 'express';
import { pool } from '../db/pool';

const router = Router();

let cache: { data: any; at: number } | null = null;
const TTL = 5 * 60 * 1000; // 5분

router.get('/summary', async (_req, res) => {
  if (cache && Date.now() - cache.at < TTL) {
    return res.json(cache.data);
  }
  try {
    const [residents, listings, newUsers] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS c FROM residents WHERE is_public = true`).catch(() => ({ rows: [{ c: 0 }] })),
      pool.query(`SELECT COUNT(*)::int AS c FROM listings WHERE status = 'active'`).catch(() => ({ rows: [{ c: 0 }] })),
      pool.query(`SELECT COUNT(*)::int AS c FROM users WHERE created_at > NOW() - INTERVAL '7 days'`).catch(() => ({ rows: [{ c: 0 }] })),
    ]);
    const data = {
      residents: residents.rows[0].c,
      listings: listings.rows[0].c,
      newUsersThisWeek: newUsers.rows[0].c,
    };
    cache = { data, at: Date.now() };
    res.json(data);
  } catch (err) {
    console.error('[stats] error', err);
    res.json({ residents: 0, listings: 0, newUsersThisWeek: 0 });
  }
});

export default router;
```

### 3.3 `server/src/routes/listings.ts` (확인/추가)

기존 파일에 없다면 추가:

```typescript
// GET /api/listings/top?category=숙소&city=danang&limit=3
router.get('/top', async (req, res) => {
  const category = String(req.query.category || '숙소');
  const city = String(req.query.city || 'danang');
  const limit = Math.min(parseInt(String(req.query.limit || '3'), 10), 10);

  try {
    const result = await pool.query(
      `SELECT id, name, category, city, thumbnail_url, price_from, currency,
              rating, review_count, agoda_deeplink, category_data
       FROM listings
       WHERE category = $1 AND city = $2 AND status = 'active'
       ORDER BY rating DESC NULLS LAST, review_count DESC NULLS LAST
       LIMIT $3`,
      [category, city, limit]
    );
    res.json({ items: result.rows });
  } catch (err) {
    console.error('[listings/top] error', err);
    res.status(500).json({ items: [] });
  }
});
```

**listings 테이블에 `agoda_deeplink` 컬럼이 없다면** 03 스펙 작업 중 추가 필요. 임시로는 `category_data->>'agoda_url'`로 꺼내도 됨.

---

## 4. 프런트 구현 (핵심 컴포넌트)

### 4.1 `src/lib/routes.ts` (신규)

```typescript
export const ROUTES = {
  home: '/',
  compare: (params?: { q?: string; city?: string; budget?: number }) => {
    const sp = new URLSearchParams();
    if (params?.q) sp.set('q', params.q);
    if (params?.city) sp.set('city', params.city);
    if (params?.budget) sp.set('budget', String(params.budget));
    const qs = sp.toString();
    return qs ? `/compare?${qs}` : '/compare';
  },
  listing: (id: string | number) => `/listings/${id}`,
  directory: (category?: string) => category ? `/directory?category=${category}` : '/directory',
  cities: (slug: string) => `/cities/${slug}`,  // 08b에서 구현, 지금은 /compare로 리다이렉트
} as const;

export const CITY_SLUGS = ['hochiminh', 'hanoi', 'danang', 'nhatrang', 'phuquoc'] as const;
export type CitySlug = typeof CITY_SLUGS[number];

export const CITY_LABELS: Record<CitySlug, string> = {
  hochiminh: '호치민',
  hanoi: '하노이',
  danang: '다낭',
  nhatrang: '나트랑',
  phuquoc: '푸꾸옥',
};
```

### 4.2 `src/lib/agoda.ts` (신규)

```typescript
// Agoda 어필리에이트 deeplink 빌더
// 02 스펙에서 어필리에이트 ID 이미 획득됨
const AGODA_SITE_ID = import.meta.env.VITE_AGODA_SITE_ID || '';
const AGODA_BASE = 'https://www.agoda.com/partners/partnersearch.aspx';

export function buildAgodaLink(params: {
  cityId?: number;        // Agoda city id (다낭=17196 등)
  hotelId?: number;       // 특정 호텔
  checkIn?: string;       // YYYY-MM-DD
  checkOut?: string;
  rooms?: number;
  adults?: number;
}): string {
  const sp = new URLSearchParams();
  if (AGODA_SITE_ID) sp.set('cid', AGODA_SITE_ID);
  if (params.cityId) sp.set('city', String(params.cityId));
  if (params.hotelId) sp.set('hid', String(params.hotelId));
  if (params.checkIn) sp.set('checkIn', params.checkIn);
  if (params.checkOut) sp.set('checkOut', params.checkOut);
  sp.set('rooms', String(params.rooms || 1));
  sp.set('adults', String(params.adults || 2));
  return `${AGODA_BASE}?${sp.toString()}`;
}

// listings 테이블에 저장된 deeplink가 있으면 그걸, 없으면 빌더 사용
export function resolveHotelLink(listing: {
  agoda_deeplink?: string | null;
  category_data?: any;
}): string {
  return listing.agoda_deeplink
      || listing.category_data?.agoda_url
      || buildAgodaLink({ cityId: 17196 }); // 다낭 fallback
}
```

### 4.3 `src/components/home/HeroSearch.tsx` (수정)

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/lib/routes';

export function HeroSearch() {
  const [q, setQ] = useState('');
  const nav = useNavigate();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) {
      nav(ROUTES.compare());
      return;
    }
    nav(ROUTES.compare({ q: trimmed }));
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex gap-2 rounded-full bg-white p-2 shadow-lg">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(e as any); }}
          placeholder="도시 또는 키워드 — 예: 다낭 월세, 나트랑 생활비"
          className="flex-1 px-4 py-2 outline-none"
          aria-label="도시 검색"
        />
        <button
          type="button"
          onClick={onSubmit as any}
          className="rounded-full bg-blue-600 px-6 py-2 font-semibold text-white hover:bg-blue-700"
        >
          검색
        </button>
      </div>
      <p className="mt-3 text-center text-sm text-white/80">
        다낭 현지 운영 · 검증 업체 등록 중
      </p>
    </div>
  );
}
```

### 4.4 `src/components/home/CityTabs.tsx` (수정)

```tsx
import { useNavigate } from 'react-router-dom';
import { CITY_SLUGS, CITY_LABELS, ROUTES, type CitySlug } from '@/lib/routes';

export function CityTabs({ active }: { active?: CitySlug | 'all' }) {
  const nav = useNavigate();
  const tabs: Array<{ key: CitySlug | 'all'; label: string }> = [
    { key: 'all', label: '전체' },
    ...CITY_SLUGS.map((s) => ({ key: s, label: CITY_LABELS[s] })),
  ];

  return (
    <div className="flex flex-wrap justify-center gap-2">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => nav(t.key === 'all' ? ROUTES.compare() : ROUTES.compare({ city: t.key }))}
          className={`rounded-full px-5 py-2 text-sm font-medium transition ${
            active === t.key
              ? 'bg-white text-blue-700'
              : 'bg-white/20 text-white hover:bg-white/30'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
```

### 4.5 `src/components/home/CityCostCards.tsx` (수정 — 클릭 가능)

```tsx
import { useNavigate } from 'react-router-dom';
import { CITY_SLUGS, CITY_LABELS, ROUTES } from '@/lib/routes';

// 하드코딩 데이터는 일단 유지, 나중에 API로 교체
const COST_DATA = {
  hochiminh: { monthly: 192, rent: 77, usd: 1370, usdRent: 550, pop: '약 1000만', climate: '열대 고온' },
  hanoi:     { monthly: 168, rent: 70, usd: 1200, usdRent: 500, pop: '약 900만',  climate: '4계절' },
  danang:    { monthly: 130, rent: 49, usd: 930,  usdRent: 350, pop: '약 120만',  climate: '온난 해변', highlight: true },
  nhatrang:  { monthly: 112, rent: 42, usd: 800,  usdRent: 300, pop: '약 50만',   climate: '온난 해변' },
  phuquoc:   { monthly: 133, rent: 56, usd: 950,  usdRent: 400, pop: '약 15만',   climate: '열대 섬' },
} as const;

export function CityCostCards() {
  const nav = useNavigate();

  return (
    <section className="py-12">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">도시별 생활비</h2>
          <button
            onClick={() => nav(ROUTES.compare())}
            className="text-sm text-blue-600 hover:underline"
          >
            전체 비교 →
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {CITY_SLUGS.map((slug) => {
            const d = COST_DATA[slug];
            return (
              <button
                key={slug}
                onClick={() => nav(ROUTES.compare({ city: slug }))}
                className="group relative rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                {d.highlight && (
                  <span className="absolute right-3 top-3 rounded-full bg-blue-600 px-2 py-0.5 text-xs text-white">
                    현지 운영
                  </span>
                )}
                <div className="mb-3 text-lg font-bold">{CITY_LABELS[slug]}</div>
                <div className="mb-1 text-xs text-gray-500">월 생활비</div>
                <div className="text-2xl font-bold text-blue-700">{d.monthly}만원</div>
                <div className="mb-3 text-xs text-gray-400">${d.usd}</div>
                <div className="text-xs text-gray-500">원룸 월세</div>
                <div className="text-lg font-semibold">{d.rent}만원</div>
                <div className="text-xs text-gray-400">${d.usdRent}</div>
                <div className="mt-3 border-t pt-2 text-xs text-gray-500">
                  {d.pop} · {d.climate}
                </div>
                <div className="mt-3 text-xs font-semibold text-blue-600 opacity-0 transition group-hover:opacity-100">
                  숙소 보기 →
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
```

### 4.6 `src/components/home/TopHotels.tsx` (신규 — **수익 핵심**)

```tsx
import { useEffect, useState } from 'react';
import { resolveHotelLink } from '@/lib/agoda';

type Hotel = {
  id: number;
  name: string;
  thumbnail_url: string;
  price_from: number;
  currency: string;
  rating: number;
  review_count: number;
  agoda_deeplink?: string;
  category_data?: any;
};

export function TopHotels() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/listings/top?category=숙소&city=danang&limit=3')
      .then((r) => r.json())
      .then((d) => setHotels(d.items || []))
      .catch(() => setHotels([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (hotels.length === 0) return null; // 데이터 없으면 섹션 자체 숨김

  return (
    <section className="bg-gradient-to-b from-blue-50 to-white py-12">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">다낭 인기 숙소 TOP 3</h2>
            <p className="mt-1 text-sm text-gray-500">럭키다낭 + Agoda 연동 · 실시간 가격</p>
          </div>
          <a href="/compare?city=danang" className="text-sm text-blue-600 hover:underline">
            전체 숙소 보기 →
          </a>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {hotels.map((h) => (
            <div key={h.id} className="overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-lg">
              <img
                src={h.thumbnail_url}
                alt={h.name}
                className="h-48 w-full object-cover"
                loading="lazy"
              />
              <div className="p-4">
                <h3 className="mb-1 line-clamp-1 font-bold">{h.name}</h3>
                <div className="mb-3 flex items-center gap-2 text-sm text-gray-500">
                  <span>⭐ {h.rating?.toFixed(1) || '-'}</span>
                  <span>·</span>
                  <span>리뷰 {h.review_count || 0}</span>
                </div>
                <div className="mb-4">
                  <span className="text-xs text-gray-500">1박 기준 </span>
                  <span className="text-xl font-bold text-blue-700">
                    {h.currency === 'KRW' ? '₩' : '$'}
                    {h.price_from?.toLocaleString()}
                  </span>
                </div>
                <a
                  href={resolveHotelLink(h)}
                  target="_blank"
                  rel="noopener sponsored"
                  className="block w-full rounded-lg bg-blue-600 py-2 text-center font-semibold text-white hover:bg-blue-700"
                  onClick={() => {
                    // 전환 측정
                    (window as any).gtag?.('event', 'agoda_outbound', {
                      listing_id: h.id,
                      source: 'home_top_hotels',
                    });
                  }}
                >
                  예약하기 →
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

### 4.7 `src/components/home/CostCalculator.tsx` (CTA 추가 diff)

기존 결과 박스 하단에 **정확히 이 블록만 추가**:

```diff
         <div className="text-right">
           <div className="text-sm text-gray-500">합계</div>
           <div className="text-lg font-bold">{total}만원</div>
         </div>
       </div>
       <p className="mt-4 text-xs text-gray-500">
         * 1인 기준, Numbeo + 현지 확인
       </p>
+      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
+        <button
+          onClick={() => nav(ROUTES.compare({ city, budget: total }))}
+          className="flex-1 rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700"
+        >
+          이 예산으로 가능한 숙소 보기 →
+        </button>
+        <button
+          onClick={() => nav('/planner')}
+          className="flex-1 rounded-lg border border-blue-600 px-4 py-3 font-semibold text-blue-600 hover:bg-blue-50"
+        >
+          한달살기 플래너 시작 →
+        </button>
+      </div>
-      <button className="mt-4 text-sm text-blue-600">다른 도시와 비교하기 →</button>
+      <button
+        onClick={() => nav(ROUTES.compare())}
+        className="mt-3 text-sm text-blue-600 hover:underline"
+      >
+        다른 도시와 비교하기 →
+      </button>
     </div>
```

상단에 `import { useNavigate } from 'react-router-dom'; import { ROUTES } from '@/lib/routes';` 추가, 컴포넌트 안에 `const nav = useNavigate();` 추가.

### 4.8 `src/components/home/NewsletterForm.tsx` (신규)

```tsx
import { useState } from 'react';

export function NewsletterForm({ source = 'main' }: { source?: string }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
  const [msg, setMsg] = useState('');

  const submit = async () => {
    if (status === 'loading') return;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus('err');
      setMsg('올바른 이메일을 입력해주세요');
      return;
    }
    setStatus('loading');
    try {
      const r = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source }),
      });
      const d = await r.json();
      if (d.ok) {
        setStatus('ok');
        setMsg('구독 완료! 이번 주 요약 메일을 보내드릴게요');
        setEmail('');
      } else if (d.error === 'RATE_LIMIT') {
        setStatus('err');
        setMsg('잠시 후 다시 시도해주세요');
      } else {
        setStatus('err');
        setMsg('구독에 실패했습니다');
      }
    } catch {
      setStatus('err');
      setMsg('네트워크 오류');
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder="이메일 주소"
          className="flex-1 rounded-lg border border-white/30 bg-white/10 px-4 py-3 text-white placeholder:text-white/60 focus:border-white focus:outline-none"
          disabled={status === 'loading'}
        />
        <button
          onClick={submit}
          disabled={status === 'loading'}
          className="rounded-lg bg-white px-6 py-3 font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
        >
          {status === 'loading' ? '...' : '무료 구독'}
        </button>
      </div>
      {msg && (
        <p className={`mt-2 text-sm ${status === 'ok' ? 'text-green-200' : 'text-red-200'}`}>
          {msg}
        </p>
      )}
    </div>
  );
}
```

### 4.9 `src/components/home/TrustIndicators.tsx` (신규 — 조건부 노출)

```tsx
import { useEffect, useState } from 'react';

export function TrustIndicators() {
  const [stats, setStats] = useState<{ residents: number; listings: number; newUsersThisWeek: number } | null>(null);

  useEffect(() => {
    fetch('/api/stats/summary').then((r) => r.json()).then(setStats).catch(() => {});
  }, []);

  if (!stats) return null;
  // 모두 0이면 숨김 (빈 숫자는 신뢰도 역효과)
  if (stats.residents === 0 && stats.listings === 0 && stats.newUsersThisWeek === 0) return null;

  return (
    <div className="flex flex-wrap justify-center gap-6 text-white/90">
      {stats.residents > 0 && (
        <div><span className="text-2xl font-bold">{stats.residents}</span><span className="ml-1 text-sm">명 다낭 체류자 등록</span></div>
      )}
      {stats.listings > 0 && (
        <div><span className="text-2xl font-bold">{stats.listings}</span><span className="ml-1 text-sm">개 검증 업체</span></div>
      )}
      {stats.newUsersThisWeek > 0 && (
        <div><span className="text-2xl font-bold">+{stats.newUsersThisWeek}</span><span className="ml-1 text-sm">명 이번 주 가입</span></div>
      )}
    </div>
  );
}
```

### 4.10 `src/data/weekly-news.json` (신규)

```json
[
  {
    "id": "2026-04-07-evisa",
    "date": "2026.04.07",
    "tag": "비자",
    "title": "베트남 e-visa 90일 체류 유지 중",
    "summary": "2023년 8월 시행. 한달살기 시 비자런 불필요. 단, 입국 목적에 따라 별도 비자가 필요할 수 있음.",
    "source": "베트남 법무이민국",
    "confirmedAt": "2026.04"
  },
  {
    "id": "2026-04-04-rent",
    "date": "2026.04.04",
    "tag": "생활",
    "title": "다낭 미케비치 인근 원룸 월세 49만~63만원 구간",
    "summary": "성수기(7~8월) 진입으로 비수기 대비 7만~14만원 상승. 장기 1개월 이상 계약 시 협상 가능.",
    "source": "현지 부동산 에이전시 3곳 확인 2026.04"
  },
  {
    "id": "2026-04-01-phuquoc",
    "date": "2026.04.01",
    "tag": "부동산",
    "title": "푸꾸옥 콘도텔 외국인 매입 규제 완화 검토 중",
    "summary": "관광청 주 지역 내 외국인 소유 허용 범위 확대 논의. 확정 아님, 검토 단계.",
    "source": "VnExpress 2026.04.09"
  }
]
```

### 4.11 `src/components/home/WeeklyNews.tsx` (수정)

```tsx
import news from '@/data/weekly-news.json';

export function WeeklyNews() {
  return (
    <section className="py-12">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">이번 주 변경사항</h2>
          <span className="text-sm text-gray-400">수동 업데이트 · 주 1회</span>
        </div>
        <div className="space-y-3">
          {news.map((n) => (
            <div key={n.id} className="rounded-xl border bg-white p-4">
              <div className="mb-2 flex items-center gap-2 text-xs">
                <span className="text-gray-500">{n.date}</span>
                <span className="rounded bg-red-50 px-2 py-0.5 text-red-600">{n.tag}</span>
              </div>
              <h3 className="mb-1 font-bold">{n.title}</h3>
              <p className="text-sm text-gray-600">{n.summary}</p>
              <p className="mt-2 text-xs text-gray-400">출처: {n.source}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

### 4.12 `src/pages/Home.tsx` (수정 — 섹션 조립 순서)

```tsx
import { HeroSearch } from '@/components/home/HeroSearch';
import { CityTabs } from '@/components/home/CityTabs';
import { TrustIndicators } from '@/components/home/TrustIndicators';
import { TopHotels } from '@/components/home/TopHotels';
import { CityCostCards } from '@/components/home/CityCostCards';
import { CostCalculator } from '@/components/home/CostCalculator';
import { LocalServices } from '@/components/home/LocalServices';
import { WeeklyNews } from '@/components/home/WeeklyNews';
import { NewsletterForm } from '@/components/home/NewsletterForm';

export default function Home() {
  return (
    <main>
      {/* 히어로 */}
      <section className="bg-gradient-to-b from-blue-700 to-blue-900 pb-16 pt-20 text-white">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <h1 className="mb-4 text-3xl font-bold md:text-5xl">
            다낭 한달살기 비용·월세·비자,<br />5개 도시와 비교하세요.
          </h1>
          <p className="mb-2 text-white/80">
            1인 월 생활비 기준 — 다낭 130만원 · 나트랑 112만원 · 푸꾸옥 133만원
          </p>
          {/* 환율 하드코딩 제거됨 */}
          <div className="mt-8"><CityTabs /></div>
          <div className="mt-6"><HeroSearch /></div>
          <div className="mt-8"><TrustIndicators /></div>
        </div>
      </section>

      {/* 수익 핵심: 다낭 인기 숙소 */}
      <TopHotels />

      {/* 도시 카드 */}
      <CityCostCards />

      {/* 계산기 */}
      <CostCalculator />

      {/* 현지 서비스 */}
      <LocalServices />

      {/* 뉴스 */}
      <WeeklyNews />

      {/* 뉴스레터 */}
      <section className="bg-blue-700 py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <div className="mb-4 text-4xl">✉</div>
          <h2 className="mb-2 text-2xl font-bold">이번 주 다낭, 뭐가 바뀌었나</h2>
          <p className="mb-6 text-white/80">비자·월세·생활비 변경사항만 추려서 매주 월요일 보내드립니다</p>
          <NewsletterForm source="main" />
        </div>
      </section>
    </main>
  );
}
```

### 4.13 `src/components/layout/Navbar.tsx` (수정 — 비스펙 메뉴 숨김)

```diff
-  const menus = [
-    { label: '한달살기', href: '/living' },
-    { label: '은퇴·장기체류', href: '/retire' },
-    { label: '도시비교', href: '/compare' },
-    { label: '업체찾기', href: '/directory' },
-    { label: '뉴스', href: '/news' },
-    { label: '커뮤니티', href: '/community' },
-  ];
+  const menus = [
+    { label: '도시비교', href: '/compare' },
+    { label: '업체찾기', href: '/directory' },
+    { label: '커뮤니티', href: '/community' },
+  ];
```

> 스펙에 있는 커뮤니티는 06에서 구현 예정이지만 메뉴는 남겨두고, 클릭 시 `/coming-soon` 정적 페이지로 라우팅해도 OK.

---

## 5. 환경변수

`server/.env`에 추가:
```bash
HASH_SALT=<랜덤 32자 이상>
```

`.env.local` (프런트):
```bash
VITE_AGODA_SITE_ID=<Agoda 파트너 ID>
```

---

## 6. 검증 체크리스트 (Codex 작업 후 Jeff가 확인)

### 기능
- [ ] 히어로 검색창에 "다낭 월세" 입력 → `/compare?q=...` 이동
- [ ] 빈 검색 → `/compare` 이동
- [ ] 도시 탭 "다낭" 클릭 → `/compare?city=danang`
- [ ] 도시 카드 5개 모두 클릭 시 해당 city 파라미터로 이동
- [ ] 생활비 계산기에서 "숙소 보기" 클릭 → budget 파라미터 포함 이동
- [ ] 현지 서비스 3개 클릭 → 해당 listing 또는 directory 이동
- [ ] 뉴스레터 이메일 입력 → "구독 완료" 메시지
- [ ] 같은 이메일 재입력 → 성공 응답 (중복 조용히 무시)
- [ ] 잘못된 이메일 → "올바른 이메일" 에러
- [ ] 60초 내 재요청 → "잠시 후 다시" 에러

### 수익
- [ ] `/api/listings/top?category=숙소&city=danang` 호출 시 3건 반환 (데이터 있으면)
- [ ] 데이터 0건이면 TopHotels 섹션 자체가 DOM에 없음
- [ ] "예약하기" 클릭 시 Agoda 링크로 새 탭 열림, cid 파라미터 포함
- [ ] rel="sponsored" 속성 확인 (SEO)

### DB
- [ ] `SELECT COUNT(*) FROM newsletter_subscribers;` 증가 확인
- [ ] `SELECT source FROM newsletter_subscribers ORDER BY id DESC LIMIT 5;` → 'main' 확인

### 환각 제거
- [ ] 히어로에서 "₩1 = ₫18.4" 하드코딩 사라짐
- [ ] Navbar에서 "한달살기/은퇴장기체류/뉴스" 메뉴 사라짐

### 성능
- [ ] 첫 화면 로딩 시 `/api/listings/top`, `/api/stats/summary` 각 1회씩만 호출
- [ ] 이미지 `loading="lazy"` 적용

---

## 7. 배포 순서

```bash
# 1. 마이그레이션
ssh vps
cd /var/www/work-luckydanang/server
psql -U dreamspace -d dreamspace -f src/db/migrations/008_newsletter.sql

# 2. 서버 코드 배포
git pull origin main
npm install
npm run build
pm2 restart dreamspace-api

# 3. 프런트 빌드 + 정적 배포
cd ..
npm install
npm run build
# Nginx가 dist/ 서빙 중이면 자동 반영

# 4. 로그 확인
pm2 logs dreamspace-api --lines 50
tail -f /var/log/nginx/luckydanang.access.log
```

---

## 8. 리스크 & 대응

| 리스크 | 확률 | 대응 |
|---|---|---|
| listings 테이블에 숙소 0건 | 높음 (03 작업 중) | TopHotels가 자동 숨김 처리되어 깨지지 않음. 미카 수집 후 자동 노출 |
| Agoda deeplink 필드 없음 | 중 | `resolveHotelLink`에서 다낭 city fallback 적용 |
| Compare 페이지가 q/budget 파라미터 미지원 | 중 | 08a 작업 시 Compare.tsx도 한 번 훑기. 미지원이면 일단 무시하게만 처리 |
| 뉴스레터 스팸 봇 | 낮음 | 60초 rate limit + hCaptcha는 Phase 2 |
| Agoda 전환 측정 불가 | 중 | GA4 설치 별건 작업 필요. 일단 `gtag` 호출만 심어두고 이후 연결 |

---

## 9. 다음 스펙으로 이어지는 지점

- **08b (도시 랜딩)**: CityCostCards 카드가 `/cities/:slug`로 가도록 바꾸면 됨. 1줄 수정
- **07 (DashboardBar)**: 히어로에서 환율 이미 제거했으므로 충돌 없음
- **06 (커뮤니티)**: Navbar "커뮤니티" 메뉴가 살아있으므로 06 완료 시 바로 연결
- **GA4 설치**: `agoda_outbound`, `newsletter_signup`, `search_submit`, `city_card_click` 이벤트만 찍으면 전환 퍼널 완성

---

## 10. 작업 우선순위 (Codex에게)

1. **Day 1 오전**: `src/lib/routes.ts`, `src/lib/agoda.ts` 생성 → HeroSearch, CityTabs, CityCostCards 수정 (죽은 링크 살리기)
2. **Day 1 오후**: Navbar 정리, CostCalculator CTA 추가, LocalServices 링크 연결
3. **Day 2 오전**: 008_newsletter.sql 실행, `routes/newsletter.ts` + `routes/stats.ts` 구현 + 등록
4. **Day 2 오후**: `NewsletterForm.tsx`, `TrustIndicators.tsx` 구현 + Home.tsx 조립
5. **Day 3 오전**: `routes/listings.ts`의 `/top` 엔드포인트 확인/추가, `TopHotels.tsx` 구현
6. **Day 3 오후**: `WeeklyNews.tsx` + `weekly-news.json`, 히어로 환율 하드코딩 제거
7. **Day 4**: 검증 체크리스트 전부 돌리고, 배포, 로그 확인

---

## 11. 참고: 각 스펙과의 관계

- **02 (accommodation-compare)**: Compare 페이지가 q/city/budget 쿼리파라미터를 처리하는지 반드시 확인. 미지원이면 08a 범위 내에 추가
- **03 (business-directory)**: listings 테이블 스키마 확정되어야 `/api/listings/top` 안정. `agoda_deeplink` 컬럼 추가 검토
- **04 (oauth-auth)**: TrustIndicators의 `users` 테이블 집계는 04 완료 후 의미있음. 미완료면 0 반환 → 자동 숨김
- **07 (dashboard-bar)**: 히어로 환율을 미리 제거했으므로 07 붙일 때 충돌 없음
