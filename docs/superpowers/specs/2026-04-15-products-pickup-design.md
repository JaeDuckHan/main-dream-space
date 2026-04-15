# 관리자 대시보드 — 서브시스템 2: 기획상품 + 픽업 서비스

**날짜:** 2026-04-15  
**프로젝트:** 럭키다낭  
**범위:** 상품 DB 모델, 관리자 상품 CRUD, 사용자 상품 목록/상세 페이지, 홈 섹션

---

## 전체 서브시스템 로드맵

| # | 서브시스템 | 상태 |
|---|-----------|------|
| 1 | 관리자 쉘 + 회원 관리 | ✅ 완료 |
| **2** | **기획상품 + 픽업 서비스** | ← 이 스펙 |
| 3 | 주문/결제 (무통장 입금) | 대기 |
| 4 | 알림 (이메일 + 카카오톡) | 대기 |

---

## 아키텍처

### 데이터 모델 결정

모든 상품(패키지, 픽업)을 `products` 테이블 하나로 통합 관리. `category` 컬럼으로 구분. 옵션(추가 금액)은 `product_options` 테이블로 분리. 픽업 예약에 필요한 추가 입력 필드(항공편 번호, 도착 시간 등)는 주문 생성 시 수집하며 서브시스템 3에서 처리.

### 가격 구조

- `base_price`: 기본 금액 (원 단위, 정수)
- `product_options.price_delta`: 옵션 선택 시 추가되는 금액
- 사용자에게는 "350,000원~" 형태로 최저가 노출
- 상세 페이지에서 옵션 선택 시 총 금액 실시간 계산

---

## 파일 구조

| 파일 | 작업 | 설명 |
|------|------|------|
| `server/migrations/009_products.sql` | CREATE | products, product_options 테이블 |
| `server/src/routes/products.ts` | CREATE | 공개 API (목록, 상세) |
| `server/src/routes/admin-products.ts` | CREATE | 관리자 CRUD API |
| `server/src/index.ts` | MODIFY | 새 라우트 등록 |
| `src/pages/Products.tsx` | CREATE | `/products` 목록 페이지 |
| `src/pages/ProductDetail.tsx` | CREATE | `/products/:slug` 상세 페이지 |
| `src/pages/admin/AdminProducts.tsx` | CREATE | `/admin/products` 관리 페이지 |
| `src/components/home/FeaturedProducts.tsx` | CREATE | 홈 페이지 상품 섹션 |
| `src/pages/Index.tsx` | MODIFY | FeaturedProducts 컴포넌트 추가 |
| `src/App.tsx` | MODIFY | 새 라우트 추가 |

---

## DB 스키마

### `server/migrations/009_products.sql`

```sql
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

CREATE TABLE IF NOT EXISTS product_options (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label VARCHAR(100) NOT NULL,
  price_delta INT NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_product_options_product ON product_options(product_id, sort_order);
```

---

## 백엔드 API

### 공개 API (`server/src/routes/products.ts`)

```
GET /api/products
  query: category? ('package'|'pickup'), limit?
  → { items: Product[] }  (is_active=TRUE만, sort_order ASC)
  각 item에 options[] 포함

GET /api/products/:slug
  → Product + options[]
  (is_active=FALSE면 404)
```

### 관리자 API (`server/src/routes/admin-products.ts`)

모든 엔드포인트 `requireAdmin` 필요.

```
GET  /api/admin/products
  → { items: Product[] }  (전체, is_active 무관)

POST /api/admin/products
  body: { slug, category, title, description?, thumbnail_url?, base_price, sort_order? }
  → { id, slug, ... }

PUT  /api/admin/products/:id
  body: 위와 동일 (부분 업데이트)
  → { ok: true }

PATCH /api/admin/products/:id/toggle
  → is_active 토글
  → { ok: true, is_active: boolean }

DELETE /api/admin/products/:id
  → 영구 삭제 (주문이 없는 상품만)
  → { ok: true }

POST /api/admin/products/:id/options
  body: { label, price_delta, sort_order? }
  → { id, label, price_delta, sort_order }

DELETE /api/admin/product-options/:optionId
  → { ok: true }
```

---

## 컴포넌트 설계

### AdminProducts (`/admin/products`)

- 상품 목록 테이블: 썸네일, 상품명, 카테고리 뱃지, 기본가, 공개 상태, 수정/숨김 버튼
- **등록/수정 Sheet** (오른쪽 슬라이드):
  - 기본 정보: 상품명, slug(자동생성), 카테고리, 설명, 기본가, 정렬순서, 공개여부
  - 썸네일: 이미지 URL 입력 (업로드는 기존 `/api/upload` 활용)
  - 옵션 관리: 옵션명 + 추가금액 입력 → 추가 버튼 / 기존 옵션 × 삭제
- AdminLayout 사이드바의 "기획상품" 항목 활성화 (기존 disabled 제거)

### Products (`/products`)

- 상단 카테고리 필터: 전체 / 패키지 / 픽업
- 카드 그리드: 썸네일, 상품명, 기본가("350,000원~"), "자세히 보기" 버튼
- 빈 상태: "준비 중인 상품입니다" 메시지

### ProductDetail (`/products/:slug`)

- 상단: 썸네일, 상품명, 설명
- **옵션 선택 영역**: 체크박스 목록, 선택 시 총 금액 실시간 업데이트
- **픽업 상품(`category === 'pickup'`)일 때 추가 입력 폼**:
  - 날짜 (date picker)
  - 인원 수 (숫자 입력)
  - 픽업 타입: 공항→호텔 / 호텔→공항 (radio)
  - 항공편 번호 (text)
  - 도착/출발 시간 (time input)
  - 호텔명 (text)
  - 요청사항 (textarea)
- **총 금액 표시**: 기본가 + 선택 옵션 합계
- **"주문하기" 버튼**: 서브시스템 3 연결 전까지 `alert("준비 중입니다.")` 처리
- 로그인 안 된 경우: 로그인 유도 모달

### FeaturedProducts (홈 섹션)

- `src/components/home/FeaturedProducts.tsx`
- `/api/products?limit=4` 호출, is_active인 상품 최대 4개 노출
- 카드 형태 (썸네일, 이름, 가격, 바로가기)
- `src/pages/Index.tsx`에 기존 섹션들 사이에 추가

---

## 사이드바 활성화

`src/components/admin/AdminLayout.tsx`에서 기획상품/픽업 항목의 `disabled: true` 제거:

```tsx
// 변경 전
{ href: "/admin/products", label: "기획상품", icon: "🎁", disabled: true },
{ href: "/admin/pickup", label: "픽업 서비스", icon: "🚗", disabled: true },

// 변경 후 — 픽업도 /admin/products로 통합 (category 필터로 구분)
{ href: "/admin/products", label: "기획/픽업 상품", icon: "🎁" },
```

픽업 서비스가 products로 통합되므로 별도 `/admin/pickup` 라우트 불필요.

---

## 범위 외

- 주문 생성 및 무통장 입금 처리 → 서브시스템 3
- 픽업 예약 상세 정보 (항공편 번호 등) 저장 → 서브시스템 3 orders 테이블
- 이미지 직접 업로드 UI → 기존 업로드 인프라 있으나 이 스펙에서 제외 (URL 입력으로 대체)
- 상품 상세 리뷰/후기 → 별도 논의
