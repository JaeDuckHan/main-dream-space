# 03. 업체 등록 디렉토리 (코어)

## Context
- 목표: 5개 카테고리 종합 디렉토리 + 사용자 셀프 등록 + 관리자 검수
- 모델: B (셀프 등록 + Jeff 승인 + 무료)
- 카테고리: 숙소 / 식당 / 마사지 / 부동산 / 투어
- 데이터 입력: 미카(AI) 수집 → 구글시트 → CSV → import 스크립트 (별도 문서 05)
- 선행: 00 (인프라), 04 (OAuth) 완료 필수

## 핵심 설계 결정
- **단일 listings 테이블 + category_data JSONB** (옵션 A)
- 기존 `accommodations` 테이블 → `listings`로 마이그레이션 (뷰로 하위호환 유지)
- 환각 방지: google_maps_place_id 필수 + URL HEAD 검증 + Place API 검증

## DB 스키마 (migrations/004_listings.sql)

```sql
-- 0. ENUM 정의
CREATE TYPE listing_category_enum AS ENUM (
  'accommodation', 'restaurant', 'massage', 'real_estate', 'tour'
);
CREATE TYPE listing_status_enum AS ENUM (
  'draft', 'pending', 'approved', 'rejected', 'archived'
);
CREATE TYPE photo_source_enum AS ENUM (
  'official', 'google_maps', 'agoda', 'owner_provided', 'self_taken'
);

-- 1. 통합 listings 테이블
CREATE TABLE listings (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(160) NOT NULL UNIQUE,
  category listing_category_enum NOT NULL,
  
  -- 공통: 식별
  name VARCHAR(200) NOT NULL,                    -- 베트남어 또는 영문 원어
  name_ko VARCHAR(200),                          -- 한국어 표기
  name_en VARCHAR(200),                          -- 영문 표기
  
  -- 공통: 위치 (환각 방지 핵심)
  district VARCHAR(100) NOT NULL,
  address TEXT NOT NULL,
  lat NUMERIC(10,7),
  lng NUMERIC(10,7),
  google_maps_url VARCHAR(1000) NOT NULL,        -- 필수
  google_maps_place_id VARCHAR(255) NOT NULL,    -- 필수, 환각 차단
  
  -- 공통: 연락
  phone VARCHAR(50),
  contact_email VARCHAR(255),
  website VARCHAR(500),
  kakao_channel VARCHAR(255),
  
  -- 공통: 미디어
  thumbnail_url VARCHAR(1000),
  image_urls JSONB,                              -- [{"url":"...","source":"official"}, ...]
  
  -- 공통: 평가
  rating NUMERIC(2,1),
  review_count INT DEFAULT 0,
  
  -- 공통: 설명
  description TEXT,
  description_ko TEXT,
  
  -- 공통: 한국인 친화도
  korean_friendly BOOLEAN DEFAULT FALSE,
  korean_speaking_staff BOOLEAN DEFAULT FALSE,
  korean_menu_signage BOOLEAN DEFAULT FALSE,
  
  -- 카테고리별 특수 필드
  category_data JSONB NOT NULL DEFAULT '{}',
  
  -- 어필리에이트
  agoda_url VARCHAR(1000),
  agoda_hotel_id VARCHAR(50),
  booking_url VARCHAR(1000),
  tripcom_url VARCHAR(1000),
  
  -- 등록자 (04 OAuth 연동, 미카 수집은 NULL 허용)
  owner_id INT REFERENCES users(id) ON DELETE SET NULL,
  
  -- 검수
  status listing_status_enum NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  reviewed_by INT REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  
  -- 데이터 출처 추적
  source VARCHAR(50) NOT NULL DEFAULT 'manual',  
    -- 'manual', 'mika_collected', 'real_estate_partner', 'self_registered'
  source_url VARCHAR(1000),                      -- 수집 출처 (구글맵/Agoda 등)
  collected_by VARCHAR(50),                      -- 'mika', 'jeff', 'user_xxx'
  collected_at TIMESTAMPTZ,
  
  -- 검증 (환각 방지)
  place_id_verified BOOLEAN DEFAULT FALSE,       -- Google Places API로 검증됨
  url_verified BOOLEAN DEFAULT FALSE,            -- google_maps_url HEAD 200
  last_verified_at TIMESTAMPTZ,
  
  -- 메타
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  view_count INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_listings_category ON listings(category);
CREATE INDEX idx_listings_district ON listings(district);
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_listings_active ON listings(is_active, status);
CREATE INDEX idx_listings_owner ON listings(owner_id);
CREATE INDEX idx_listings_place_id ON listings(google_maps_place_id);
CREATE INDEX idx_listings_data_gin ON listings USING GIN (category_data);
CREATE INDEX idx_listings_images_gin ON listings USING GIN (image_urls);

CREATE TRIGGER trg_listings_updated
  BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2. 검수 로그 (이력 추적)
CREATE TABLE listing_reviews (
  id SERIAL PRIMARY KEY,
  listing_id INT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  reviewer_id INT NOT NULL REFERENCES users(id),
  action VARCHAR(20) NOT NULL,                   -- 'approve' | 'reject' | 'request_changes'
  reason TEXT,
  changes_requested JSONB,                       -- 어떤 필드 수정 요청
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_reviews_listing ON listing_reviews(listing_id);

-- 3. 기존 accommodations 호환 뷰 (02 스펙 코드가 그대로 동작)
CREATE OR REPLACE VIEW accommodations AS
SELECT 
  id,
  slug,
  name,
  name_ko,
  (category_data->>'subtype')::text AS type,
  district,
  address,
  lat,
  lng,
  (category_data->>'price_min_usd')::int AS price_min_usd,
  (category_data->>'price_max_usd')::int AS price_max_usd,
  (category_data->>'price_monthly_usd')::int AS price_monthly_usd,
  rating,
  review_count,
  (category_data->>'bedrooms')::smallint AS bedrooms,
  (category_data->>'max_guests')::smallint AS max_guests,
  (category_data->'amenities') AS amenities,
  thumbnail_url,
  image_urls,
  agoda_url,
  agoda_hotel_id,
  booking_url,
  tripcom_url,
  source,
  is_active,
  created_at,
  updated_at
FROM listings
WHERE category = 'accommodation' AND status = 'approved' AND is_active = TRUE;
```

⚠️ 02 스펙의 기존 `accommodations` 테이블은 **DROP 후 listings로 데이터 마이그레이션** 필요. 마이그레이션 스크립트 별도 작성:

```sql
-- migrations/004b_migrate_accommodations.sql
INSERT INTO listings (
  slug, category, name, name_ko, district, address, lat, lng,
  google_maps_url, google_maps_place_id,
  thumbnail_url, image_urls, rating, review_count,
  category_data, agoda_url, agoda_hotel_id,
  status, source, is_active, created_at, updated_at
)
SELECT 
  slug, 'accommodation'::listing_category_enum, name, name_ko, district, address, lat, lng,
  COALESCE(NULL, ''),  -- 기존 데이터에 google_maps_url 없음 → 빈값 (수동 보완 필요)
  COALESCE(NULL, ''),  -- google_maps_place_id 동일
  thumbnail_url, image_urls, rating, review_count,
  jsonb_build_object(
    'subtype', type::text,
    'price_min_usd', price_min_usd,
    'price_max_usd', price_max_usd,
    'price_monthly_usd', price_monthly_usd,
    'bedrooms', bedrooms,
    'max_guests', max_guests,
    'amenities', amenities
  ),
  agoda_url, agoda_hotel_id,
  'approved'::listing_status_enum, 'manual', is_active, created_at, updated_at
FROM accommodations_old;  -- DROP 전에 RENAME

-- 마이그레이션 후 google_maps_url/place_id가 빈 값인 row는 수동 보완 또는 비공개 처리
UPDATE listings SET status = 'draft' 
WHERE google_maps_place_id = '' OR google_maps_place_id IS NULL;
```

⚠️ **운영 순서**:
1. 기존 `accommodations` → `accommodations_old` 로 RENAME
2. 새 `listings` 테이블 생성 (003_oauth.sql 이후)
3. 마이그레이션 INSERT
4. 뷰 `accommodations` 생성 (이름 충돌 없음, accommodations_old는 별도)
5. 검증 후 `DROP TABLE accommodations_old`

## 카테고리별 category_data 스키마

### 숙소 (accommodation)
```typescript
{
  subtype: 'hotel' | 'resort' | 'apartment' | 'villa' | 'guesthouse',
  price_min_usd: number,           // 1박 최소
  price_max_usd: number,
  price_monthly_usd?: number,
  bedrooms?: number,
  max_guests?: number,
  amenities: string[],             // ['wifi','pool','breakfast','ac','kitchen','gym']
  check_in_time?: string,
  check_out_time?: string,
  cancellation_policy?: string,
}
```

### 식당 (restaurant)
```typescript
{
  cuisine_type: 'korean' | 'vietnamese' | 'japanese' | 'chinese' 
              | 'western' | 'cafe' | 'fusion' | 'seafood' | 'bbq',
  price_per_person_usd: number,
  opening_hours: {
    mon: string; tue: string; wed: string; thu: string;
    fri: string; sat: string; sun: string;
    // 형식: "10:00-22:00" 또는 "closed"
  },
  menu_highlights: string[],
  has_korean_menu: boolean,
  has_korean_staff: boolean,
  delivery_available: boolean,
  delivery_apps?: string[],        // ['grab','shopeefood','befood']
  reservation_recommended: boolean,
  alcohol_served: boolean,
  kid_friendly: boolean,
  vegetarian_options: boolean,
}
```

### 마사지 (massage)
```typescript
{
  massage_types: string[],         // ['thai','vietnamese','oil','foot','stone','aroma']
  price_60min_usd: number,
  price_90min_usd?: number,
  price_120min_usd?: number,
  korean_speaking: boolean,
  korean_menu: boolean,
  reservation_required: boolean,
  private_room: boolean,
  shower_available: boolean,
  tip_expected: boolean,
  recommended_tip_usd?: string,    // "2-3"
  pickup_service?: boolean,
}
```

### 부동산 (real_estate)
```typescript
{
  real_estate_type: 'monthly_rental' | 'long_term_rental' | 'sale' | 'shortterm_apartment',
  deposit_usd?: number,
  monthly_rent_usd: number,
  min_lease_months: number,
  max_lease_months?: number,
  furnished: boolean,
  utilities_included: string[],    // ['wifi','water','electricity','cleaning']
  utilities_excluded: string[],
  pets_allowed: boolean,
  korean_landlord: boolean,
  korean_agent: boolean,
  agent_commission_pct?: number,
  viewing_required: boolean,
  available_from?: string,         // ISO date
}
```

### 투어 (tour)
```typescript
{
  tour_subtype: 'airport_pickup' | 'city_tour' | 'hoian_tour' | 'banahills'
              | 'myson' | 'hue_tour' | 'golf' | 'activity' | 'car_rental' | 'other',
  duration_hours: number,
  duration_label: '반나절' | '종일' | '1박2일' | '시간단위',
  price_per_person_usd: number,
  price_private_usd?: number,
  min_people: number,
  max_people: number,
  pickup_included: boolean,
  lunch_included: boolean,
  ticket_included: boolean,
  korean_guide: boolean,
  vehicle_type?: 'sedan' | 'suv' | 'van' | 'minibus' | 'bus',
  route_summary?: string,
  languages: string[],             // ['ko','en','vi']
  booking_lead_time_hours: number,
  cancellation_policy?: string,
  meeting_point?: string,
  
  // 공항픽업 특화 (subtype === 'airport_pickup'일 때만)
  pickup_routes?: Array<{
    from: string;                  // "DAD"
    to: string;                    // "다낭 시내"
    price_usd: number;
    duration_min: number;
  }>,
  vehicle_options?: string[],      // ['sedan_4seat','suv_7seat','van_16seat']
  available_24h?: boolean,
  meet_and_greet?: boolean,
  child_seat_available?: boolean,
  luggage_capacity?: string,
}
```

## API 엔드포인트

### 공개 (인증 불필요)

```
GET /api/listings
  ?category=accommodation
  &district=my-khe
  &price_min=20&price_max=100
  &sort=rating_desc
  &limit=20&offset=0

GET /api/listings/:slug
GET /api/listings/compare?ids=1,3,7

# 02 스펙 호환 (뷰 사용)
GET /api/accommodations?...     # 내부적으로 listings WHERE category='accommodation'
```

**Response (목록)**:
```typescript
{
  total: number;
  items: Array<{
    id: number;
    slug: string;
    category: string;
    name: string;
    name_ko: string | null;
    district: string;
    rating: number;
    review_count: number;
    thumbnail_url: string;
    google_maps_url: string;
    category_data: object;          // 카테고리별 다름
    agoda_url?: string;             // 어필리에이트 주입됨
  }>
}
```

### 사용자 인증 필요 (requireAuth)

```
POST   /api/listings                    # 신규 등록 (status='pending')
GET    /api/listings/me                 # 내가 등록한 목록
PATCH  /api/listings/:id                # 본인 매물만 수정 (재검수 트리거: status='pending')
DELETE /api/listings/:id                # 본인 매물 archived 처리
```

**POST /api/listings 요청 body**:
```typescript
{
  category: 'accommodation' | 'restaurant' | ... ;
  name: string;
  name_ko?: string;
  district: string;
  address: string;
  google_maps_url: string;        // 필수
  // lat/lng/place_id는 서버에서 Google Places API로 자동 추출
  phone?: string;
  description?: string;
  category_data: object;          // 카테고리 스키마에 맞게
  image_urls?: Array<{url: string, source: string}>;
}
```

**서버 처리**:
1. zod로 카테고리별 스키마 검증
2. `google_maps_url`에서 place_id 추출 (정규식 또는 Place API)
3. Google Places API Lookup으로 place_id 검증 → lat/lng/주소 자동 채움
4. slug 자동 생성 (`name`-`district`-`random4`)
5. `owner_id = req.user.id`, `source = 'self_registered'`, `status = 'pending'`
6. INSERT
7. (선택) Jeff에게 알림 (이메일 또는 텔레그램)

### 관리자 인증 필요 (requireAdmin)

```
GET    /api/admin/listings/pending             # 검수 대기 목록
PATCH  /api/admin/listings/:id/approve         # 승인
PATCH  /api/admin/listings/:id/reject          # 반려 + reason
POST   /api/admin/listings/:id/request-changes # 수정 요청
GET    /api/admin/listings/all?status=...      # 전체 관리
```

**승인 처리**:
```typescript
// status='pending' → 'approved'
// reviewed_by, reviewed_at 기록
// listing_reviews INSERT (action='approve')
// 등록자에게 이메일 알림 (선택)
```

## import 스크립트 명세 (server/scripts/import_listings.ts)

미카 수집 → 구글시트 → CSV → import. **상세 운영은 05번 문서**에서 다루지만, 스크립트 명세는 여기에:

### 사용법
```bash
# Dry-run (검증만, DB 변경 없음)
npm run import:listings -- --file ~/imports/2026_04_13.csv --dry-run

# 실제 import
npm run import:listings -- --file ~/imports/2026_04_13.csv

# 기존 slug 업데이트 허용 (기본은 skip)
npm run import:listings -- --file ~/imports/2026_04_13.csv --update

# 특정 카테고리만
npm run import:listings -- --file ~/imports/2026_04_13.csv --category restaurant
```

### 처리 단계
1. **CSV 파싱** (papaparse)
2. **공통 필드 검증** (zod)
   - 필수: category, name, district, address, google_maps_url, google_maps_place_id
   - district 화이트리스트: ['my-khe', 'an-thuong', 'son-tra', 'city-center', 'hai-chau', 'hoian']
3. **카테고리별 category_data 검증**
   - 각 카테고리 zod 스키마 적용
4. **환각 방지 검증** (5종):
   - (a) `google_maps_place_id` 형식 (`ChIJ` 시작)
   - (b) Google Places API Lookup → 200 응답 확인
   - (c) `google_maps_url` HEAD 요청 → 200/3xx
   - (d) 사진 URL 형식 (https + .jpg/.png/.webp)
   - (e) `photo_source` 명시 ('official' / 'google_maps' / 'agoda' / 'owner_provided')
5. **slug 생성** (name-district-random4)
6. **중복 체크**:
   - 같은 `google_maps_place_id` 존재? → `--update` 플래그 있으면 UPDATE, 없으면 SKIP
   - 같은 slug 존재? → 자동 random4 재생성
7. **트랜잭션 INSERT** (전체 성공 또는 전체 롤백)
8. **결과 리포트** JSON:
```json
{
  "imported_at": "2026-04-13T10:30:00Z",
  "file": "2026_04_13.csv",
  "total_rows": 50,
  "inserted": 42,
  "updated": 3,
  "skipped": 5,
  "errors": [
    {
      "row": 15,
      "name": "Some Restaurant",
      "errors": ["missing google_maps_place_id", "invalid district 'unknown'"]
    }
  ]
}
```
9. 리포트는 `~/imports/import_2026_04_13.log.json`에 저장

### 환경변수 추가
```bash
GOOGLE_PLACES_API_KEY=AIzaSy...
IMPORT_REPORT_DIR=/home/user/imports
```

## 프론트엔드 페이지 (Codex가 사이트 톤에 맞춰 자체 제작)

⚠️ Lovable 통보 불필요. Codex가 기존 src/components/ 패턴 참조해서 일관된 톤으로 제작.

### 1. `/login` (Login.tsx)
- 04 스펙 참고 (3개 OAuth 버튼)

### 2. `/business/register` (BusinessRegister.tsx)
- 인증 필요 (`useAuth`로 user null이면 `/login?redirect=/business/register`로 리다이렉트)
- 3-step wizard:
  - **Step 1**: 카테고리 선택 + 기본정보 (이름/지역/주소/구글맵URL)
  - **Step 2**: 카테고리별 상세 (category_data)
  - **Step 3**: 사진 + 설명 + 제출
- 제출 시 POST `/api/listings`
- 성공 시 "검수 대기 중" 페이지로 이동

### 3. `/business/dashboard` (BusinessDashboard.tsx)
- 본인이 등록한 매물 목록
- 각 항목 status 표시: pending(노랑) / approved(초록) / rejected(빨강)
- 수정/삭제 버튼

### 4. `/admin/listings` (AdminListings.tsx)
- requireAdmin (user.role !== 'admin'이면 403 또는 / 리다이렉트)
- pending 목록 + 카테고리 필터
- 각 항목 클릭 시 상세 + [승인] [반려] [수정요청] 버튼
- 반려 시 reason 입력 모달

## 수익화 포인트 💰

| 카테고리 | 수익 모델 |
|---|---|
| 숙소 | Agoda 어필리에이트 (기존 02) |
| 식당 | 트래픽 → 광고 슬롯 (Phase 2) |
| 마사지 | 예약 수수료 (직접 제휴, Phase 2) |
| 부동산 | 리드 과금 (DM/문의 발생 시, Phase 2) |
| 투어 | 직접 예약 수수료 (Phase 2) |

**단기 수익은 숙소(Agoda)가 거의 전부**. 나머지 4개 카테고리는 트래픽/SEO/사용자 lock-in 목적. 6개월 후 데이터 보고 수익화 모델 추가.

## 단기 / 중기 로드맵

| 단계 | 기간 | 내용 |
|---|---|---|
| 단기 (이번 스프린트) | 2주 | listings DB + API + 등록/검수 페이지 + import 스크립트 |
| 중기 1 | +2주 | 미카 수집 50건 + Jeff 검수 + 첫 공개 |
| 중기 2 | +1달 | SEO 최적화, 어필리에이트 확장 (식당/투어 개별 제휴) |
| 장기 | 3달+ | 부동산 리드 과금, 구독 모델 |

## DoD
- [ ] migrations/004_listings.sql 무에러 실행
- [ ] 기존 accommodations 데이터 마이그레이션 검증 (count 일치)
- [ ] accommodations 뷰 동작 (02 스펙 API 변경 없이 동작)
- [ ] POST /api/listings 인증 + 검증 + INSERT 동작
- [ ] 카테고리 5개 모두 category_data 검증 통과
- [ ] GET /api/listings 필터링 (category, district, price)
- [ ] 어드민 검수 워크플로우 (pending → approved/rejected)
- [ ] import 스크립트: 환각방지 5종 검증 통과
- [ ] import 스크립트: dry-run 모드 동작
- [ ] 4개 페이지(/login, /business/register, /business/dashboard, /admin/listings) 동작
- [ ] Jeff 본인 계정을 admin으로 승격 후 검수 페이지 접근 확인

## 다음 문서 (Phase 2)
- `05-data-collection-mika.md` — 미카 수집 워크플로우 운영 가이드
- `templates/google_sheet_template.md` — 구글시트 컬럼 정의표
- `prompts/mika_collection_prompt.md` — 미카에게 줄 임무 프롬프트
- 03번 프론트엔드 상세 (Wizard UI 코드)
