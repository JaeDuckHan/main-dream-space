# 스펙 08d: 한달살기 / 은퇴·장기체류 전용 랜딩 페이지

**파일 경로**: `docs/specs/08d-persona-landing.md`
**작업자**: Codex
**예상 소요**: 1주
**선행 조건**: 08a 완료 (Navbar B안 연결, INTENT_CONFIG 존재), 03(business-directory) 최소 데이터 50건 이상
**작성일**: 2026-04-13

---

## 0. 목표

08a에서 임시로 `/compare?intent=monthly`, `/compare?intent=retire`로 연결한 두 메뉴를 **독립된 페르소나 랜딩 페이지**로 교체한다.

| 항목 | 08a (임시) | 08d (본격) |
|---|---|---|
| URL | `/compare?intent=monthly` | `/monthly-stay` |
| URL | `/compare?intent=retire` | `/retire` |
| 히어로 | Compare 위에 얹힌 배너 | 페르소나 전용 히어로 |
| 콘텐츠 | Compare 테이블만 | 페르소나 맞춤 섹션 5~7개 |
| CTA | 일반 숙소 링크 | 1개월+ Agoda 링크, 업체 문의 폼 |
| SEO | Compare와 중복 | 각 페이지 독립 meta + 구조화 데이터 |
| 수익 | 일반 Agoda 수수료 | 장기예약 수수료 + 업체 리드 판매 |

---

## 1. 왜 전용 페이지가 필요한가

**수익 관점**:
- "한달살기" 검색자 → 30박+ 예약 → Agoda 수수료 단가 **3~5배**
- "은퇴·장기체류" 검색자 → 부동산/비자/의료 업체 문의 → **건당 5만~20만원 리드 수익**
- Compare 페이지는 범용 비교용 — 전환 포인트가 흐림

**SEO 관점**:
- "다낭 한달살기" 월 검색량 높음, 경쟁도 중간
- "다낭 은퇴", "다낭 장기체류" 경쟁도 낮음 → 빠른 상위 노출 가능
- Compare 페이지는 `?intent=` 파라미터로 중복 콘텐츠 페널티 위험

**페르소나 관점**:
- 한달살기 (20~40대 디지털노마드) vs 은퇴 (50대+ 안정 추구) — 니즈 완전히 다름
- 같은 숙소라도 소구 포인트 다름 (WiFi 속도 vs 엘리베이터/병원 거리)

---

## 2. 파일 구조

```
src/
├── pages/
│   ├── MonthlyStay.tsx             [신규] /monthly-stay
│   └── Retire.tsx                  [신규] /retire
├── components/
│   ├── persona/
│   │   ├── PersonaHero.tsx         [신규] 재사용 히어로
│   │   ├── PersonaCostBreakdown.tsx [신규] 페르소나별 예산 시뮬레이션
│   │   ├── PersonaHotelList.tsx    [신규] intent 필터 적용된 숙소 리스트
│   │   ├── PersonaServiceList.tsx  [신규] 업체 디렉토리 필터 뷰
│   │   ├── PersonaResidentVoice.tsx [신규] 체류자 후기 (06b 완료 후)
│   │   ├── PersonaFaq.tsx          [신규] FAQ 아코디언
│   │   └── PersonaLeadForm.tsx     [신규] 상담 문의 폼 (리드 수집)
│   └── layout/
│       └── Navbar.tsx              [수정] href 교체
├── data/
│   ├── monthly-stay-faq.json       [신규]
│   └── retire-faq.json             [신규]
└── lib/
    └── seo.ts                      [신규 또는 수정] meta 태그 헬퍼

server/
├── src/
│   ├── routes/
│   │   ├── leads.ts                [신규] POST /api/leads
│   │   └── listings.ts             [수정] intent 필터 본격 적용
│   └── db/
│       └── migrations/
│           ├── 009_leads.sql       [신규]
│           └── 010_listings_persona_fields.sql [신규]
```

---

## 3. DB 마이그레이션

### 3.1 `009_leads.sql` — 리드 수집 테이블

```sql
-- 상담 문의 리드 (한달살기/은퇴 페이지에서 수집)
CREATE TABLE IF NOT EXISTS leads (
  id              BIGSERIAL PRIMARY KEY,
  intent          VARCHAR(20) NOT NULL,  -- monthly, retire, business_inquiry
  name            VARCHAR(100) NOT NULL,
  email           VARCHAR(255) NOT NULL,
  phone           VARCHAR(30),
  kakao_id        VARCHAR(50),
  message         TEXT,
  -- 페르소나별 추가 필드 (JSONB로 유연하게)
  extra           JSONB DEFAULT '{}',  -- { "budget": 150, "stayMonths": 3, "age": 55, ... }
  -- 분배 관련
  assigned_to     VARCHAR(100),  -- 어느 업체에 판매했는지 (후속)
  status          VARCHAR(20) NOT NULL DEFAULT 'new',  -- new, contacted, sold, closed
  source          VARCHAR(50) NOT NULL,  -- monthly_hero, retire_hero, monthly_faq, ...
  ip_hash         VARCHAR(64),
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  contacted_at    TIMESTAMPTZ,
  sold_at         TIMESTAMPTZ,
  sold_price      INTEGER  -- 리드 판매가 (원)
);

CREATE INDEX IF NOT EXISTS idx_leads_intent ON leads(intent);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);
```

### 3.2 `010_listings_persona_fields.sql` — listings 테이블 페르소나 필드

```sql
-- 기존 listings.category_data (JSONB)에 다음 키를 추가할 것:
-- monthly_available (boolean)       : 1개월+ 예약 가능
-- monthly_min_nights (integer)      : 최소 박수 (기본 30)
-- monthly_discount_percent (integer): 장기 할인율
-- long_stay_friendly (boolean)      : 엘리베이터/병원 근접/한인타운 등
-- has_elevator (boolean)
-- nearest_hospital_km (numeric)
-- english_speaking_staff (boolean)
-- kitchen (boolean)                 : 취사 가능
-- laundry (boolean)
-- internet_mbps (integer)           : WiFi 실측 속도

-- JSONB는 스키마 변경 없이 INSERT/UPDATE로 반영
-- 다만 인덱스 추가로 필터 성능 확보:
CREATE INDEX IF NOT EXISTS idx_listings_monthly_available 
  ON listings ((category_data->>'monthly_available'))
  WHERE status = 'active' AND category = '숙소';

CREATE INDEX IF NOT EXISTS idx_listings_long_stay_friendly 
  ON listings ((category_data->>'long_stay_friendly'))
  WHERE status = 'active' AND category = '숙소';
```

> ⚠️ **미카 수집 가이드 업데이트 필요**: 05 스펙(data-collection-mika.md)에 위 필드 수집 항목 추가해야 함. Jeff가 미카에게 지시하거나, 05 스펙 개정으로 자동화.

---

## 4. 백엔드 구현

### 4.1 `server/src/routes/leads.ts` (신규)

```typescript
import { Router } from 'express';
import { pool } from '../db/pool';
import crypto from 'crypto';

const router = Router();
const SALT = process.env.HASH_SALT || 'luckydanang-dev-salt';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9\-+\s()]{7,20}$/;

function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip + SALT).digest('hex');
}

router.post('/', async (req, res) => {
  const { intent, name, email, phone, kakaoId, message, extra, source } = req.body || {};

  // 검증
  if (!['monthly', 'retire', 'business_inquiry'].includes(intent)) {
    return res.status(400).json({ ok: false, error: 'INVALID_INTENT' });
  }
  if (!name || typeof name !== 'string' || name.length < 2 || name.length > 100) {
    return res.status(400).json({ ok: false, error: 'INVALID_NAME' });
  }
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ ok: false, error: 'INVALID_EMAIL' });
  }
  if (phone && !PHONE_RE.test(phone)) {
    return res.status(400).json({ ok: false, error: 'INVALID_PHONE' });
  }
  if (message && message.length > 2000) {
    return res.status(400).json({ ok: false, error: 'MESSAGE_TOO_LONG' });
  }

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim()
          || req.socket.remoteAddress || 'unknown';
  const ipHash = hashIp(ip);
  const ua = req.headers['user-agent']?.slice(0, 500) || '';

  try {
    // 간단한 중복 방지: 같은 이메일 + 같은 intent 24시간 내 중복 차단
    const dup = await pool.query(
      `SELECT id FROM leads 
       WHERE email = $1 AND intent = $2 AND created_at > NOW() - INTERVAL '24 hours'
       LIMIT 1`,
      [email.toLowerCase().trim(), intent]
    );
    if (dup.rows.length > 0) {
      return res.json({ ok: true, duplicated: true });
    }

    await pool.query(
      `INSERT INTO leads(intent, name, email, phone, kakao_id, message, extra, source, ip_hash, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        intent,
        name.trim(),
        email.toLowerCase().trim(),
        phone || null,
        kakaoId || null,
        message || null,
        JSON.stringify(extra || {}),
        source || 'unknown',
        ipHash,
        ua,
      ]
    );

    // TODO: Slack 알림 (Jeff에게 새 리드 도착 알림)
    // TODO: 자동 응답 이메일 (Phase 2)

    res.json({ ok: true });
  } catch (err: any) {
    console.error('[leads] create error', err);
    res.status(500).json({ ok: false, error: 'SERVER_ERROR' });
  }
});

export default router;
```

등록:
```typescript
import leadsRouter from './routes/leads';
app.use('/api/leads', leadsRouter);
```

### 4.2 `server/src/routes/listings.ts` — intent 필터 본격 적용

08a에서 작성한 `/top` 엔드포인트를 업그레이드:

```typescript
// GET /api/listings/top?category=숙소&city=danang&limit=6&intent=monthly
router.get('/top', async (req, res) => {
  const category = String(req.query.category || '숙소');
  const city = String(req.query.city || 'danang');
  const limit = Math.min(parseInt(String(req.query.limit || '6'), 10), 20);
  const intent = String(req.query.intent || '');
  const minBudget = req.query.minBudget ? Number(req.query.minBudget) : null;
  const maxBudget = req.query.maxBudget ? Number(req.query.maxBudget) : null;

  const wheres: string[] = [`category = $1`, `city = $2`, `status = 'active'`];
  const params: any[] = [category, city];
  let paramIdx = 3;

  if (intent === 'monthly') {
    wheres.push(`COALESCE((category_data->>'monthly_available')::boolean, false) = true`);
  } else if (intent === 'retire') {
    wheres.push(`COALESCE((category_data->>'long_stay_friendly')::boolean, false) = true`);
  }

  if (minBudget !== null) {
    wheres.push(`price_from >= $${paramIdx++}`);
    params.push(minBudget);
  }
  if (maxBudget !== null) {
    wheres.push(`price_from <= $${paramIdx++}`);
    params.push(maxBudget);
  }

  params.push(limit);

  try {
    const result = await pool.query(
      `SELECT id, name, category, city, thumbnail_url, price_from, currency,
              rating, review_count, agoda_deeplink, category_data
       FROM listings
       WHERE ${wheres.join(' AND ')}
       ORDER BY rating DESC NULLS LAST, review_count DESC NULLS LAST
       LIMIT $${paramIdx}`,
      params
    );
    res.json({ items: result.rows, count: result.rows.length });
  } catch (err) {
    console.error('[listings/top] error', err);
    res.status(500).json({ items: [], count: 0 });
  }
});
```

---

## 5. 프런트 구현

### 5.1 `src/pages/MonthlyStay.tsx` (신규)

```tsx
import { PersonaHero } from '@/components/persona/PersonaHero';
import { PersonaCostBreakdown } from '@/components/persona/PersonaCostBreakdown';
import { PersonaHotelList } from '@/components/persona/PersonaHotelList';
import { PersonaServiceList } from '@/components/persona/PersonaServiceList';
import { PersonaFaq } from '@/components/persona/PersonaFaq';
import { PersonaLeadForm } from '@/components/persona/PersonaLeadForm';
import { NewsletterForm } from '@/components/home/NewsletterForm';
import faq from '@/data/monthly-stay-faq.json';
import { useEffect } from 'react';

export default function MonthlyStay() {
  useEffect(() => {
    document.title = '다낭 한달살기 완벽 가이드 — 월세·생활비·비자 | 럭키다낭';
    // meta description
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute('content', '다낭 한달살기 월세 49만원부터, 월 생활비 130만원. 1개월+ 숙소 Agoda 연동, 현지 검증 업체 소개, 체류자 후기 기반 가이드.');
    }
  }, []);

  return (
    <main>
      <PersonaHero
        label="한달살기"
        title="다낭 한달살기,"
        titleEm="월세·생활비·비자 한 번에"
        subtitle="1개월 이상 장기 숙소 · 월 130만원 생활비 · 검증 업체 소개"
        backgroundClass="bg-gradient-to-br from-sky-500 to-blue-800"
        keyStats={[
          { label: '월 생활비', value: '130만원', sub: '1인 기준' },
          { label: '원룸 월세', value: '49만원~', sub: '미케비치 인근' },
          { label: '비자', value: 'e-visa 90일', sub: '비자런 불필요' },
        ]}
        ctaText="1개월 숙소 보기"
        ctaHref="#hotels"
        secondaryCtaText="상담 문의"
        secondaryCtaHref="#lead-form"
      />

      <PersonaCostBreakdown
        intent="monthly"
        defaultBudget={150}
        sections={[
          { label: '숙소 (원룸~1베드)', min: 49, max: 90 },
          { label: '식비', min: 25, max: 40 },
          { label: '교통 (그랩)', min: 8, max: 15 },
          { label: '통신·WiFi', min: 3, max: 5 },
          { label: '여가·카페', min: 15, max: 30 },
          { label: '보험·비상금', min: 10, max: 20 },
        ]}
      />

      <PersonaHotelList
        id="hotels"
        intent="monthly"
        title="1개월+ 예약 가능 숙소"
        subtitle="장기 할인 적용 · 취사·세탁 가능 · WiFi 검증"
        limit={6}
      />

      <PersonaServiceList
        intent="monthly"
        title="한달살기 필수 서비스"
        categories={['부동산', '투어']}
        subcategoryFilter={['장기임대', '공항픽업', '시내투어']}
      />

      <PersonaFaq items={faq} />

      <PersonaLeadForm
        intent="monthly"
        title="한달살기 상담 신청"
        subtitle="예산·기간·원하는 지역만 알려주시면 현지 운영진이 직접 답변드립니다"
        source="monthly_lead_form"
        extraFields={[
          { key: 'budget', label: '월 예산 (만원)', type: 'number', placeholder: '150' },
          { key: 'stayMonths', label: '체류 기간 (개월)', type: 'number', placeholder: '1' },
          { key: 'preferredArea', label: '선호 지역', type: 'text', placeholder: '미케비치, 한시장 등' },
        ]}
      />

      <section className="bg-blue-700 py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <h2 className="mb-2 text-2xl font-bold">주간 다낭 업데이트 받기</h2>
          <p className="mb-6 text-white/80">한달살기 숙소 시세·비자 변경·생활비 추이 매주 월요일</p>
          <NewsletterForm source="monthly" />
        </div>
      </section>
    </main>
  );
}
```

### 5.2 `src/pages/Retire.tsx` (신규)

```tsx
import { PersonaHero } from '@/components/persona/PersonaHero';
import { PersonaCostBreakdown } from '@/components/persona/PersonaCostBreakdown';
import { PersonaHotelList } from '@/components/persona/PersonaHotelList';
import { PersonaServiceList } from '@/components/persona/PersonaServiceList';
import { PersonaFaq } from '@/components/persona/PersonaFaq';
import { PersonaLeadForm } from '@/components/persona/PersonaLeadForm';
import { NewsletterForm } from '@/components/home/NewsletterForm';
import faq from '@/data/retire-faq.json';
import { useEffect } from 'react';

export default function Retire() {
  useEffect(() => {
    document.title = '다낭 은퇴·장기체류 가이드 — 비자·의료·주거 | 럭키다낭';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute('content', '다낭 은퇴 생활 월 150~200만원. 장기체류 비자, 한국어 의료, 안전한 주거, 50대+ 체류자 후기 기반 실제 가이드.');
    }
  }, []);

  return (
    <main>
      <PersonaHero
        label="은퇴·장기체류"
        title="다낭 은퇴·장기체류,"
        titleEm="안정적인 시작"
        subtitle="비자·의료·주거·커뮤니티 — 50대 이상 체류자 후기 기반"
        backgroundClass="bg-gradient-to-br from-emerald-600 to-teal-900"
        keyStats={[
          { label: '월 생활비', value: '150~200만원', sub: '부부 기준' },
          { label: '의료비', value: '국내의 1/3', sub: '빈민 VIP 병원' },
          { label: '한인회', value: '약 5000명', sub: '다낭 한인 커뮤니티' },
        ]}
        ctaText="장기 주거 보기"
        ctaHref="#hotels"
        secondaryCtaText="1:1 상담"
        secondaryCtaHref="#lead-form"
      />

      <PersonaCostBreakdown
        intent="retire"
        defaultBudget={200}
        sections={[
          { label: '주거 (1~2베드)', min: 60, max: 120 },
          { label: '식비 (한식 포함)', min: 40, max: 70 },
          { label: '교통', min: 10, max: 20 },
          { label: '의료·보험', min: 20, max: 40 },
          { label: '여가·모임', min: 15, max: 30 },
          { label: '여행·비상금', min: 15, max: 30 },
        ]}
      />

      <PersonaHotelList
        id="hotels"
        intent="retire"
        title="장기 체류 주거"
        subtitle="엘리베이터 · 병원 근접 · 한국어 응대 가능"
        limit={6}
      />

      <PersonaServiceList
        intent="retire"
        title="은퇴·장기체류 필수 서비스"
        categories={['부동산', '식당', '마사지']}
        subcategoryFilter={['장기임대', '한식', '건강관리']}
      />

      <PersonaFaq items={faq} />

      <PersonaLeadForm
        intent="retire"
        title="은퇴·장기체류 상담 신청"
        subtitle="비자·주거·의료 등 궁금한 점을 편하게 남겨주세요"
        source="retire_lead_form"
        extraFields={[
          { key: 'age', label: '연령대', type: 'select', options: ['50대', '60대', '70대 이상'] },
          { key: 'partners', label: '동반 인원', type: 'select', options: ['혼자', '부부', '가족'] },
          { key: 'budget', label: '월 예산 (만원)', type: 'number', placeholder: '200' },
          { key: 'stayPlan', label: '체류 계획', type: 'select', options: ['3개월', '6개월', '1년 이상', '영구 이주'] },
        ]}
      />

      <section className="bg-emerald-700 py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <h2 className="mb-2 text-2xl font-bold">다낭 은퇴 소식 주간 뉴스레터</h2>
          <p className="mb-6 text-white/80">비자 변경·의료비·한인회 소식 매주 월요일</p>
          <NewsletterForm source="retire" />
        </div>
      </section>
    </main>
  );
}
```

### 5.3 `src/components/persona/PersonaHero.tsx` (신규)

```tsx
type KeyStat = { label: string; value: string; sub?: string };

type Props = {
  label: string;
  title: string;
  titleEm: string;
  subtitle: string;
  backgroundClass: string;
  keyStats: KeyStat[];
  ctaText: string;
  ctaHref: string;
  secondaryCtaText?: string;
  secondaryCtaHref?: string;
};

export function PersonaHero({
  label, title, titleEm, subtitle, backgroundClass, keyStats,
  ctaText, ctaHref, secondaryCtaText, secondaryCtaHref,
}: Props) {
  return (
    <section className={`${backgroundClass} pb-20 pt-24 text-white`}>
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-4 inline-block rounded-full bg-white/20 px-4 py-1 text-xs font-medium backdrop-blur">
          {label}
        </div>
        <h1 className="mb-4 text-4xl font-bold md:text-5xl lg:text-6xl">
          {title}<br />
          <span className="text-yellow-300">{titleEm}</span>
        </h1>
        <p className="mb-8 text-lg text-white/80 md:text-xl">{subtitle}</p>

        <div className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {keyStats.map((s) => (
            <div key={s.label} className="rounded-2xl bg-white/10 p-5 backdrop-blur">
              <div className="mb-1 text-sm text-white/70">{s.label}</div>
              <div className="text-3xl font-bold">{s.value}</div>
              {s.sub && <div className="mt-1 text-xs text-white/60">{s.sub}</div>}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            href={ctaHref}
            className="rounded-full bg-white px-8 py-4 text-center text-base font-bold text-blue-800 shadow-lg transition hover:scale-105"
          >
            {ctaText} →
          </a>
          {secondaryCtaText && secondaryCtaHref && (
            <a
              href={secondaryCtaHref}
              className="rounded-full border-2 border-white/60 px-8 py-4 text-center text-base font-bold text-white transition hover:bg-white/10"
            >
              {secondaryCtaText}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
```

### 5.4 `src/components/persona/PersonaHotelList.tsx` (신규)

```tsx
import { useEffect, useState } from 'react';
import { resolveHotelLink } from '@/lib/agoda';
import type { Intent } from '@/lib/routes';

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

type Props = {
  id?: string;
  intent: Intent;
  title: string;
  subtitle: string;
  limit?: number;
};

export function PersonaHotelList({ id, intent, title, subtitle, limit = 6 }: Props) {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/listings/top?category=숙소&city=danang&intent=${intent}&limit=${limit}`)
      .then((r) => r.json())
      .then((d) => setHotels(d.items || []))
      .catch(() => setHotels([]))
      .finally(() => setLoading(false));
  }, [intent, limit]);

  if (loading) {
    return (
      <section id={id} className="py-16">
        <div className="mx-auto max-w-7xl px-4 text-center text-gray-400">불러오는 중...</div>
      </section>
    );
  }

  if (hotels.length === 0) {
    return (
      <section id={id} className="py-16">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <h2 className="mb-2 text-2xl font-bold">{title}</h2>
          <p className="text-gray-500">현재 등록된 숙소를 준비 중입니다. 상담을 통해 맞춤 추천을 받아보세요.</p>
          <a href="#lead-form" className="mt-4 inline-block rounded-full bg-blue-600 px-6 py-3 font-semibold text-white">
            상담 문의하기
          </a>
        </div>
      </section>
    );
  }

  return (
    <section id={id} className="py-16">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-8">
          <h2 className="text-3xl font-bold">{title}</h2>
          <p className="mt-2 text-gray-600">{subtitle}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {hotels.map((h) => (
            <article key={h.id} className="overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-xl">
              <img src={h.thumbnail_url} alt={h.name} className="h-56 w-full object-cover" loading="lazy" />
              <div className="p-5">
                <h3 className="mb-2 line-clamp-1 text-lg font-bold">{h.name}</h3>
                <div className="mb-3 flex items-center gap-2 text-sm text-gray-500">
                  <span>⭐ {h.rating?.toFixed(1) || '-'}</span>
                  <span>·</span>
                  <span>리뷰 {h.review_count || 0}</span>
                </div>

                {/* 페르소나별 배지 */}
                <div className="mb-4 flex flex-wrap gap-1">
                  {h.category_data?.monthly_available && (
                    <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">월 단위 OK</span>
                  )}
                  {h.category_data?.kitchen && (
                    <span className="rounded bg-green-50 px-2 py-0.5 text-xs text-green-700">취사 가능</span>
                  )}
                  {h.category_data?.has_elevator && (
                    <span className="rounded bg-purple-50 px-2 py-0.5 text-xs text-purple-700">엘리베이터</span>
                  )}
                  {h.category_data?.nearest_hospital_km !== undefined && (
                    <span className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-700">
                      병원 {h.category_data.nearest_hospital_km}km
                    </span>
                  )}
                </div>

                <div className="mb-4">
                  <span className="text-xs text-gray-500">
                    {intent === 'monthly' ? '1개월 기준' : '월 기준'}{' '}
                  </span>
                  <span className="text-2xl font-bold text-blue-700">
                    {h.currency === 'KRW' ? '₩' : '$'}{h.price_from?.toLocaleString()}
                  </span>
                </div>

                <a
                  href={resolveHotelLink(h)}
                  target="_blank"
                  rel="noopener sponsored"
                  onClick={() => {
                    (window as any).gtag?.('event', 'agoda_outbound', {
                      listing_id: h.id,
                      source: `persona_${intent}`,
                    });
                  }}
                  className="block w-full rounded-lg bg-blue-600 py-3 text-center font-semibold text-white hover:bg-blue-700"
                >
                  Agoda에서 예약 →
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
```

### 5.5 `src/components/persona/PersonaCostBreakdown.tsx` (신규)

```tsx
import { useState, useMemo } from 'react';
import type { Intent } from '@/lib/routes';

type Section = { label: string; min: number; max: number };
type Props = {
  intent: Intent;
  defaultBudget: number;
  sections: Section[];
};

export function PersonaCostBreakdown({ intent, defaultBudget, sections }: Props) {
  const [level, setLevel] = useState<'min' | 'mid' | 'max'>('mid');

  const totals = useMemo(() => {
    const getAmount = (s: Section) => {
      if (level === 'min') return s.min;
      if (level === 'max') return s.max;
      return Math.round((s.min + s.max) / 2);
    };
    const rows = sections.map((s) => ({ ...s, amount: getAmount(s) }));
    const sum = rows.reduce((a, b) => a + b.amount, 0);
    return { rows, sum };
  }, [sections, level]);

  return (
    <section className="bg-gray-50 py-16">
      <div className="mx-auto max-w-4xl px-4">
        <h2 className="mb-2 text-center text-3xl font-bold">
          {intent === 'monthly' ? '한달살기' : '은퇴·장기체류'} 예산 시뮬레이션
        </h2>
        <p className="mb-8 text-center text-gray-600">생활 수준별 월 예산을 확인하세요</p>

        <div className="mb-6 flex justify-center gap-2">
          {[
            { key: 'min', label: '절약형' },
            { key: 'mid', label: '표준형' },
            { key: 'max', label: '여유형' },
          ].map((o) => (
            <button
              key={o.key}
              onClick={() => setLevel(o.key as any)}
              className={`rounded-full px-5 py-2 text-sm font-medium transition ${
                level === o.key ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-lg">
          <div className="space-y-3">
            {totals.rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between border-b py-2 last:border-0">
                <span className="text-gray-700">{r.label}</span>
                <span className="font-semibold">{r.amount}만원</span>
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-center justify-between border-t-2 border-blue-600 pt-4">
            <span className="text-lg font-bold">월 합계</span>
            <span className="text-3xl font-bold text-blue-700">{totals.sum}만원</span>
          </div>
          <p className="mt-4 text-xs text-gray-500">
            * 1인 기준, Numbeo + 현지 체류자 후기 취합 (2026.04)
          </p>
        </div>
      </div>
    </section>
  );
}
```

### 5.6 `src/components/persona/PersonaLeadForm.tsx` (신규)

```tsx
import { useState } from 'react';
import type { Intent } from '@/lib/routes';

type ExtraField = {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  placeholder?: string;
  options?: string[];
};

type Props = {
  intent: Intent;
  title: string;
  subtitle: string;
  source: string;
  extraFields?: ExtraField[];
};

export function PersonaLeadForm({ intent, title, subtitle, source, extraFields = [] }: Props) {
  const [form, setForm] = useState<Record<string, any>>({});
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
  const [msg, setMsg] = useState('');
  const [agree, setAgree] = useState(false);

  const update = (key: string, value: any) => setForm((p) => ({ ...p, [key]: value }));

  const submit = async () => {
    if (!agree) {
      setStatus('err');
      setMsg('개인정보 수집·이용에 동의해주세요');
      return;
    }
    if (!form.name || form.name.length < 2) {
      setStatus('err');
      setMsg('이름을 입력해주세요');
      return;
    }
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setStatus('err');
      setMsg('올바른 이메일을 입력해주세요');
      return;
    }

    const extra: Record<string, any> = {};
    extraFields.forEach((f) => {
      if (form[f.key] !== undefined && form[f.key] !== '') extra[f.key] = form[f.key];
    });

    setStatus('loading');
    try {
      const r = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent,
          name: form.name,
          email: form.email,
          phone: form.phone || '',
          kakaoId: form.kakaoId || '',
          message: form.message || '',
          extra,
          source,
        }),
      });
      const d = await r.json();
      if (d.ok) {
        setStatus('ok');
        setMsg('상담 신청이 접수되었습니다. 영업일 기준 1~2일 내 답변드립니다.');
        setForm({});
        (window as any).gtag?.('event', 'lead_submit', { intent, source });
      } else {
        setStatus('err');
        setMsg('제출 실패. 잠시 후 다시 시도해주세요.');
      }
    } catch {
      setStatus('err');
      setMsg('네트워크 오류');
    }
  };

  return (
    <section id="lead-form" className="bg-blue-50 py-16">
      <div className="mx-auto max-w-2xl px-4">
        <div className="mb-8 text-center">
          <h2 className="mb-2 text-3xl font-bold">{title}</h2>
          <p className="text-gray-600">{subtitle}</p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-xl">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">이름 *</label>
              <input
                type="text"
                value={form.name || ''}
                onChange={(e) => update('name', e.target.value)}
                className="w-full rounded-lg border px-4 py-2 focus:border-blue-500 focus:outline-none"
                placeholder="홍길동"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">이메일 *</label>
              <input
                type="email"
                value={form.email || ''}
                onChange={(e) => update('email', e.target.value)}
                className="w-full rounded-lg border px-4 py-2 focus:border-blue-500 focus:outline-none"
                placeholder="you@example.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">연락처</label>
                <input
                  type="tel"
                  value={form.phone || ''}
                  onChange={(e) => update('phone', e.target.value)}
                  className="w-full rounded-lg border px-4 py-2 focus:border-blue-500 focus:outline-none"
                  placeholder="010-0000-0000"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">카카오 ID</label>
                <input
                  type="text"
                  value={form.kakaoId || ''}
                  onChange={(e) => update('kakaoId', e.target.value)}
                  className="w-full rounded-lg border px-4 py-2 focus:border-blue-500 focus:outline-none"
                  placeholder="선택"
                />
              </div>
            </div>

            {extraFields.map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-sm font-medium">{f.label}</label>
                {f.type === 'select' ? (
                  <select
                    value={form[f.key] || ''}
                    onChange={(e) => update(f.key, e.target.value)}
                    className="w-full rounded-lg border px-4 py-2 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">선택</option>
                    {f.options?.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={f.type}
                    value={form[f.key] || ''}
                    onChange={(e) => update(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full rounded-lg border px-4 py-2 focus:border-blue-500 focus:outline-none"
                  />
                )}
              </div>
            ))}

            <div>
              <label className="mb-1 block text-sm font-medium">문의 내용</label>
              <textarea
                rows={4}
                value={form.message || ''}
                onChange={(e) => update('message', e.target.value)}
                className="w-full rounded-lg border px-4 py-2 focus:border-blue-500 focus:outline-none"
                placeholder="궁금한 점을 자유롭게 적어주세요"
              />
            </div>

            <label className="flex items-start gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                className="mt-1"
              />
              <span>
                개인정보 수집·이용에 동의합니다. 수집 항목: 이름, 이메일, 연락처. 보관 기간: 상담 완료 후 6개월.
              </span>
            </label>

            <button
              onClick={submit}
              disabled={status === 'loading'}
              className="w-full rounded-lg bg-blue-600 py-4 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {status === 'loading' ? '제출 중...' : '상담 신청하기'}
            </button>

            {msg && (
              <p className={`text-center text-sm ${status === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
                {msg}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
```

### 5.7 `src/components/persona/PersonaFaq.tsx` (신규)

```tsx
import { useState } from 'react';

type FaqItem = { q: string; a: string };

export function PersonaFaq({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="py-16">
      <div className="mx-auto max-w-3xl px-4">
        <h2 className="mb-8 text-center text-3xl font-bold">자주 묻는 질문</h2>
        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={i} className="overflow-hidden rounded-xl border bg-white">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-center justify-between px-5 py-4 text-left font-medium hover:bg-gray-50"
              >
                <span>{item.q}</span>
                <span className="text-xl text-gray-400">{open === i ? '−' : '+'}</span>
              </button>
              {open === i && (
                <div className="border-t bg-gray-50 px-5 py-4 text-sm text-gray-700 whitespace-pre-line">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

### 5.8 `src/components/persona/PersonaServiceList.tsx` (신규)

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Intent } from '@/lib/routes';

type Service = {
  id: number;
  name: string;
  category: string;
  thumbnail_url: string;
  rating: number;
  description?: string;
};

type Props = {
  intent: Intent;
  title: string;
  categories: string[];
  subcategoryFilter?: string[];
};

export function PersonaServiceList({ intent, title, categories, subcategoryFilter }: Props) {
  const [services, setServices] = useState<Service[]>([]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('city', 'danang');
    params.set('intent', intent);
    categories.forEach((c) => params.append('category', c));
    if (subcategoryFilter) subcategoryFilter.forEach((s) => params.append('sub', s));

    fetch(`/api/listings/top?${params.toString()}&limit=6`)
      .then((r) => r.json())
      .then((d) => setServices(d.items || []))
      .catch(() => setServices([]));
  }, [intent, categories.join(','), subcategoryFilter?.join(',')]);

  if (services.length === 0) return null;

  return (
    <section className="bg-gray-50 py-16">
      <div className="mx-auto max-w-7xl px-4">
        <h2 className="mb-8 text-3xl font-bold">{title}</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <Link
              key={s.id}
              to={`/listings/${s.id}`}
              className="flex gap-4 rounded-xl border bg-white p-4 transition hover:shadow-md"
            >
              <img src={s.thumbnail_url} alt={s.name} className="h-20 w-20 rounded object-cover" loading="lazy" />
              <div className="flex-1">
                <div className="mb-1 text-xs text-gray-500">{s.category}</div>
                <h3 className="mb-1 line-clamp-1 font-bold">{s.name}</h3>
                <div className="text-sm text-gray-500">⭐ {s.rating?.toFixed(1) || '-'}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
```

### 5.9 `src/data/monthly-stay-faq.json`

```json
[
  {
    "q": "다낭 한달살기 최소 예산이 얼마인가요?",
    "a": "1인 기준 월 130만원이 표준입니다. 절약형은 100만원부터 가능하지만 식비·여가 제약이 큽니다. 여유롭게 지내려면 150~200만원을 권장합니다. 숙소 49만원 + 식비 30만원 + 교통·통신 15만원 + 여가 20만원 + 여유자금 16만원 기준입니다."
  },
  {
    "q": "비자 없이 한 달 체류 가능한가요?",
    "a": "한국 여권 보유자는 베트남 e-visa로 90일 단수 체류가 가능합니다. 2023년 8월부터 시행되어 한달살기에는 충분합니다. 단, 목적에 따라 별도 비자가 필요할 수 있으니 출국 전 확인하세요."
  },
  {
    "q": "숙소는 어떻게 구하나요?",
    "a": "두 가지 방법이 있습니다. (1) Agoda/Booking에서 월 단위 예약: 바로 확정되지만 가격이 10~20% 높습니다. (2) 현지 에이전시 직계약: 가격은 저렴하지만 계약서·디포짓 체크가 필요합니다. 럭키다낭에서는 양쪽 모두 검증된 옵션을 제공합니다."
  },
  {
    "q": "WiFi 속도는 어느 정도인가요?",
    "a": "다낭 시내 대부분의 아파트·호텔은 50~100Mbps가 표준입니다. 디지털노마드용으로는 충분하지만, 영상 업로드가 잦다면 계약 전 실측 확인을 권장합니다. 럭키다낭 등록 숙소는 실측 WiFi 속도를 표시합니다."
  },
  {
    "q": "한국 음식은 구할 수 있나요?",
    "a": "한시장·미케비치 인근에 한식당 20곳 이상 있고, 한국 식재료도 롯데마트·Kmart에서 구매 가능합니다. 월 식비 25~40만원이면 한식·현지식 섞어서 충분히 해결됩니다."
  }
]
```

### 5.10 `src/data/retire-faq.json`

```json
[
  {
    "q": "은퇴 후 다낭 장기체류, 비자는 어떻게 하나요?",
    "a": "현재 한국인은 e-visa 90일 단수 비자가 기본입니다. 3개월마다 비자런(재입국)이 필요합니다. 1년 이상 체류를 원한다면 투자비자(DT), 결혼비자, 또는 베트남 법인 설립을 통한 비자가 있습니다. 각 비자의 조건과 비용은 상담 신청 시 상세히 안내드립니다."
  },
  {
    "q": "의료 수준은 어떤가요? 한국어 진료 가능한가요?",
    "a": "다낭에는 VINMEC, FAMILY HOSPITAL 등 외국인 대상 병원이 있고, 기본 진료·검진 수준은 한국의 1/3 가격입니다. 한국어 통역 서비스를 운영하는 병원도 있으며, 응급 상황 시 호치민·방콕 이송도 가능합니다. 중증 질환은 한국 후송을 권장합니다."
  },
  {
    "q": "다낭 한인회나 커뮤니티는 활성화되어 있나요?",
    "a": "다낭 한인회 약 5천명 규모로 베트남 3대 한인사회입니다. 골프 모임, 등산 모임, 종교 모임 등 다양한 커뮤니티가 있고, 대부분 50대 이상 회원이 주축입니다. 럭키다낭에서 커뮤니티 연결을 도와드릴 수 있습니다."
  },
  {
    "q": "부부 월 생활비는 얼마 정도 필요한가요?",
    "a": "부부 기준 월 200~250만원이 표준입니다. 2베드 아파트 80~120만원, 식비 70만원, 의료·보험 30만원, 여가·교통 50만원, 여행·비상금 20만원 기준입니다. 골프·여행 빈도에 따라 최대 300만원까지 올라갈 수 있습니다."
  },
  {
    "q": "한국에서 연금 수령이나 금융 이용에 문제 없나요?",
    "a": "국민연금은 해외 거주자도 수령 가능하며, 한국 은행 계좌 유지도 가능합니다. 단, 주소지 이전 신고 여부에 따라 건강보험·세금이 달라지므로 출국 전 국민연금공단·세무서에 확인하세요. 럭키다낭 상담 시 체크리스트를 제공합니다."
  },
  {
    "q": "여름이 너무 덥지 않나요? 건강에 무리는 없나요?",
    "a": "다낭은 연중 22~32도로 비교적 온화한 편입니다. 6~8월이 가장 덥지만(35도 내외), 해안 도시라 서울·부산 한여름보다 체감상 쾌적합니다. 50대 이상 건강한 분들은 대부분 잘 적응합니다. 다만 고혈압·심장질환자는 사전 주치의 상담 권장합니다."
  }
]
```

### 5.11 `src/components/layout/Navbar.tsx` (08d 완료 후 diff)

```diff
   const menus = [
-    { label: '한달살기', href: '/compare?intent=monthly' },
-    { label: '은퇴·장기체류', href: '/compare?intent=retire' },
+    { label: '한달살기', href: '/monthly-stay' },
+    { label: '은퇴·장기체류', href: '/retire' },
     { label: '도시비교', href: '/compare' },
     { label: '업체찾기', href: '/directory' },
     { label: '커뮤니티', href: '/community' },
   ];
```

### 5.12 라우터 등록

`src/App.tsx` 또는 라우팅 파일에:

```tsx
import MonthlyStay from '@/pages/MonthlyStay';
import Retire from '@/pages/Retire';

// ...
<Route path="/monthly-stay" element={<MonthlyStay />} />
<Route path="/retire" element={<Retire />} />
```

---

## 6. 검증 체크리스트

### 기능
- [ ] `/monthly-stay` 접속 시 페르소나 히어로 + 6개 섹션 노출
- [ ] `/retire` 접속 시 페르소나 히어로 + 6개 섹션 노출
- [ ] 각 페이지 Hero의 CTA 2개 클릭 시 해당 섹션으로 스크롤
- [ ] PersonaCostBreakdown의 절약/표준/여유 탭 전환 시 금액 계산 변경
- [ ] PersonaHotelList가 intent 필터 적용된 숙소만 노출 (데이터 있을 때)
- [ ] PersonaHotelList가 0건이면 "상담 문의" CTA 대체 노출
- [ ] PersonaLeadForm 제출 시 leads 테이블에 저장
- [ ] 같은 이메일 + intent 24시간 내 재제출 시 `duplicated: true` 응답
- [ ] PersonaFaq 아코디언 정상 동작
- [ ] NewsletterForm의 source가 각각 'monthly', 'retire'로 기록

### 수익
- [ ] 각 페이지 Agoda 예약 버튼 클릭 시 gtag 이벤트 `source: persona_monthly` / `persona_retire` 발화
- [ ] 리드 제출 시 gtag 이벤트 `lead_submit` 발화
- [ ] listings 테이블에 `monthly_available=true` 데이터가 최소 10건 이상
- [ ] listings 테이블에 `long_stay_friendly=true` 데이터가 최소 10건 이상

### SEO
- [ ] `/monthly-stay` 의 `<title>`, `meta description` 고유 값
- [ ] `/retire` 의 `<title>`, `meta description` 고유 값
- [ ] 구글 서치콘솔에 두 URL 색인 요청
- [ ] 구조화 데이터 FAQPage JSON-LD 적용 (선택)

### DB
- [ ] `SELECT intent, COUNT(*) FROM leads GROUP BY intent;` — 각 intent별 리드 집계
- [ ] `SELECT status, COUNT(*) FROM leads GROUP BY status;` — 리드 상태 관리 가능 확인

### 리드 운영
- [ ] Jeff에게 신규 리드 Slack 알림 (선택, Phase 2)
- [ ] 리드 수집 후 업체로 전달하는 수동 프로세스 정의 (Jeff 결정)

---

## 7. 배포 순서

```bash
# 1. 마이그레이션
ssh vps
cd /var/www/work-luckydanang/server
psql -U dreamspace -d dreamspace -f src/db/migrations/009_leads.sql
psql -U dreamspace -d dreamspace -f src/db/migrations/010_listings_persona_fields.sql

# 2. 미카에게 persona 필드 수집 지시 (category_data 업데이트)
# - monthly_available, long_stay_friendly, has_elevator, nearest_hospital_km 등
# - 최소 숙소 20건 이상 업데이트

# 3. 서버 배포
git pull origin main
npm install
npm run build
pm2 restart dreamspace-api

# 4. 프런트 배포
cd ..
npm install
npm run build

# 5. Navbar href 업데이트 확인
# 6. 구글 서치콘솔 색인 요청
```

---

## 8. 리스크 & 대응

| 리스크 | 확률 | 대응 |
|---|---|---|
| listings에 persona 필드 데이터 부족 | 높음 | PersonaHotelList가 "상담 문의" CTA로 fallback. 미카 수집 지시 병행 |
| 리드 제출 후 후속 운영 프로세스 없음 | 높음 | **Jeff가 결정해야 함**: 본인이 직접 응대할지, 특정 업체와 수익 분배할지 |
| 리드가 스팸으로 가득 참 | 중 | 24시간 이메일+intent 중복 차단. reCAPTCHA는 Phase 2 |
| SEO 중복 콘텐츠 경고 | 낮음 | Compare와 명확히 다른 콘텐츠 + canonical 태그 |
| intent 필터로 0건 → UX 저하 | 중 | 0건일 때 상담 CTA로 자연스럽게 전환 |
| 개인정보 수집 동의 미흡 | 중 | 폼에 체크박스 + 개인정보처리방침 페이지 별도 준비 필요 |

---

## 9. 수익 모델 요약

### 단기 (스펙 완료 직후 ~ 1개월)
1. **Agoda 어필리에이트 (월 단위 예약)**
   - 평균 1박 6만원 × 30박 = 180만원 결제 × 4% 수수료 = **건당 7만원**
   - 월 5건 성사 가정 → 월 35만원

2. **리드 수집 (무료 수집 → 수동 매칭)**
   - 월 20건 수집 가정
   - Jeff가 본인 네트워크(다낭 에이전시, 부동산)로 매칭
   - 건당 수수료 없이 관계 구축부터

### 중기 (2~6개월)
1. **리드 판매 자동화**
   - 은퇴·장기체류 리드 → 부동산 에이전시 건당 10~30만원
   - 월 10건 × 20만원 = **월 200만원**

2. **업체 등록 유료화**
   - 무료: 기본 정보 노출
   - Pro (월 10만원): 상단 노출, 사진 10장+, 블로그 포스트 링크
   - 20개 업체 × 10만원 = **월 200만원 MRR**

### 장기 (6개월~)
- 전용 브랜드 커뮤니티화 → 광고 수익 + 독점 파트너십
- 한국 TV/유튜브 출연 → 트래픽 폭증 구간 준비

---

## 10. 작업 우선순위 (Codex에게)

1. **Day 1**: DB 마이그레이션 2개 실행 + `routes/leads.ts` + `routes/listings.ts` 업데이트
2. **Day 2**: `PersonaHero`, `PersonaCostBreakdown`, `PersonaHotelList` 컴포넌트
3. **Day 3**: `PersonaLeadForm`, `PersonaFaq`, `PersonaServiceList` 컴포넌트
4. **Day 4**: `MonthlyStay.tsx`, `Retire.tsx` 페이지 조립 + 라우터 등록
5. **Day 5**: FAQ JSON 작성, SEO meta, Navbar href 교체
6. **Day 6**: 검증 체크리스트 전부 돌리고 배포
7. **Day 7**: 구글 서치콘솔 색인 요청, 미카에게 persona 필드 수집 지시

---

## 11. 참고: 각 스펙과의 관계

- **08a (메인 긴급수리)**: `INTENT_CONFIG`, `ROUTES.monthlyStay/retire` 활용. 08a 완료 필수
- **03 (business-directory)**: listings 테이블의 `category_data` JSONB 구조 사용. persona 필드 수집 필요
- **05 (미카 데이터 수집)**: persona 필드 수집 지시 추가 필요
- **06b (체류자 보강)**: 완료 시 각 페르소나 페이지에 `PersonaResidentVoice` 섹션 추가
- **07 (dashboard-bar)**: 페르소나 페이지에도 글로벌 대시보드 바 자동 적용됨
- **08c (뉴스레터 자동화)**: 완료 시 source별 세그먼트 발송 가능 (monthly/retire 구독자에게 다른 콘텐츠)

---

## 12. Jeff 결정 필요 사항

스펙 작업 착수 전에 Jeff가 결정해야 하는 것들:

| 항목 | 옵션 | 비고 |
|---|---|---|
| **리드 후속 프로세스** | A) Jeff 직접 응대 / B) 파트너 업체 분배 / C) 수동 매칭 후 자동화 | Phase 1은 A 추천 |
| **개인정보처리방침** | A) 기본 템플릿 사용 / B) 변호사 검토 | 법적 리스크 vs 비용 |
| **리드 판매 단가** | 은퇴 리드 얼마에 팔 것인지 | 업계 표준 10~30만원 |
| **한달살기 Pro 업체** | 어느 업체에 우선권 줄지 | 다낭 에이전시 2~3곳 선정 필요 |
| **Agoda 외 OTA** | Booking.com, Hotels.com 추가 어필리에이트 | 수익 2배 가능, 작업 1일 추가 |
| **FAQ 검수** | 본인 체류 경험 기반 재작성 필요 여부 | 현재는 일반론, Jeff 경험 추가 시 신뢰도 ↑ |
