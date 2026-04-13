# 02. 숙소 비교 (Compare 페이지 확장)

## Context
- 기존 `src/pages/Compare.tsx` 존재, 이번 스펙으로 표준화
- 부동산 가격대 기반 더미 숙소 15건 시드
- Q6 답변: 입력 백오피스는 다음 스프린트
- DB: **PostgreSQL 14+** (JSONB + GIN 인덱스)

## API 엔드포인트

### 1. 목록 (필터 + 정렬)
```
GET /api/accommodations?district=my-khe&price_min=20&price_max=100&type=hotel&sort=price_asc&limit=20
```
Response:
```typescript
{
  total: number;
  items: Array<{
    id: number;
    slug: string;
    name: string;
    name_ko: string | null;
    type: string;
    district: string;
    price_min_usd: number;
    price_max_usd: number;
    price_monthly_usd: number | null;
    rating: number;
    review_count: number;
    amenities: string[];
    thumbnail_url: string;
    agoda_url: string;  // AGODA_AFFILIATE_ID 주입 후 반환
  }>
}
```

### 2. 상세
```
GET /api/accommodations/:slug
```

### 3. 비교
```
GET /api/accommodations/compare?ids=1,3,7
```
최대 4개, amenities diff 포함.

### PG 특화 쿼리 팁 (서버 구현 시)
- amenities 필터: `WHERE amenities @> '["pool"]'::jsonb` (GIN 인덱스 활용)
- 가격 범위: `WHERE price_min_usd BETWEEN $1 AND $2`
- IN 절: `WHERE id = ANY($1::int[])` ← `pg` 드라이버는 배열을 그대로 받음

## 시드 데이터 (seeds/accommodations.seed.sql)

15개 더미 (My Khe 5, An Thuong 4, Son Tra 3, City Center 3):

```sql
-- PostgreSQL: JSONB 캐스팅 + ENUM 캐스팅 필수
INSERT INTO accommodations 
  (slug, name, name_ko, type, district, price_min_usd, price_max_usd, price_monthly_usd,
   rating, review_count, bedrooms, max_guests, amenities, thumbnail_url,
   agoda_url, agoda_hotel_id, source)
VALUES
('danang-beach-hotel', 'Danang Beach Hotel', '다낭비치호텔', 'hotel', 'My Khe',
 45, 85, 950, 4.2, 1203, 1, 2,
 '["wifi","pool","breakfast","ac"]'::jsonb,
 'https://img.kowinsblue.com/acc/danang-beach.jpg',
 'https://www.agoda.com/danang-beach-hotel/hotel/da-nang-vn.html?cid={AFFILIATE_ID}',
 '12345', 'manual')
-- ... 14개 추가
;
```

⚠️ Codex가 나머지 14개는 사실적인 다낭 지명/가격대로 생성. Jeff가 실제 숙소 이름 알려주면 교체.

## 서버 URL 주입
```typescript
// server/src/routes/accommodations.ts
function injectAffiliate(url: string | null): string | null {
  if (!url) return null;
  return url.replace('{AFFILIATE_ID}', process.env.AGODA_AFFILIATE_ID || '');
}
```

## 프론트엔드 (src/pages/Compare.tsx)

### 기능
1. **필터 사이드바**: 지역, 가격 슬라이더, 타입, 정렬
2. **카드 그리드**: 썸네일, 이름, 가격, 평점, 편의시설 아이콘, "Agoda에서 보기" CTA
3. **비교 모드**: 카드 체크박스 → 최대 4개 → 상단 "비교하기" → 모달
4. **URL 동기화**: `?district=my-khe&price_max=100` (Planner의 internal 액션 연동)

### 신규 훅 (src/hooks/use-accommodations.ts)
```typescript
export function useAccommodations(filters: Filters) {
  const [data, setData] = useState<Accommodation[]>([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    const params = new URLSearchParams(filters as any);
    setLoading(true);
    fetch(`/api/accommodations?${params}`)
      .then(r => r.json())
      .then(d => setData(d.items))
      .finally(() => setLoading(false));
  }, [JSON.stringify(filters)]);
  
  return { data, loading };
}
```

### Agoda 클릭 핸들러
```typescript
const handleAgodaClick = (acc: Accommodation) => {
  fetch('/api/affiliate/click', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: getSessionId(),
      partner: 'agoda',
      target_type: 'accommodation',
      target_id: acc.id,
    }),
  });
  window.open(acc.agoda_url, '_blank', 'noopener');
};
```

## 수익화 💰
1. Agoda 전환 (쿠키 30일)
2. 비교 테이블 → 결정 단계 CTA 강화 → 전환율↑
3. `affiliate_clicks.target_id` 집계 → 인기 숙소 상단 노출 자동화

## 로드맵
| 단계 | 기간 | 내용 |
|---|---|---|
| 단기 | 1주 | 더미 15 + API + Compare + Agoda |
| 중기 1 | 2-4주 | 부동산 입력 백오피스 |
| 중기 2 | 1-2달 | Booking/Trip.com 파트너십 |
| 장기 | 3달+ | 크롤링 or 부동산 직접 제휴 |

## 법적 고지 ⚠️
한국 공정위 "경제적 이해관계 표시" 의무. Compare 페이지 하단 또는 카드 근처 "제휴 링크 포함" 고지 필수.

## DoD
- [ ] `/api/accommodations?price_max=100` 필터링 정상
- [ ] agoda_url에 실제 AFFILIATE_ID 주입
- [ ] 필터 조작 시 URL 동기화
- [ ] 카드 클릭 시 Agoda 새탭 + affiliate_clicks 로깅
- [ ] 2-4개 선택 후 비교 모달 렌더링
- [ ] Planner "숙소 정하기" → `/compare?district=my-khe` 진입 + 필터 적용
- [ ] 시드 15건 로드 확인
