# 관리자 대시보드 — 서브시스템 3: 주문/결제 (무통장 입금)

**날짜:** 2026-04-15  
**프로젝트:** 럭키다낭  
**범위:** 주문 생성, 무통장 입금 안내, 상태 관리, 이메일 알림, 관리자 설정

---

## 전체 서브시스템 로드맵

| # | 서브시스템 | 상태 |
|---|-----------|------|
| 1 | 관리자 쉘 + 회원 관리 | ✅ 완료 |
| 2 | 기획상품 + 픽업 서비스 | ✅ 완료 |
| **3** | **주문/결제 (무통장 입금)** | ← 이 스펙 |
| 4 | 알림 (카카오 알림톡) | 대기 |

---

## 아키텍처

- `orders` + `order_options` 테이블로 주문 관리. 패키지/픽업 전용 예약 데이터는 `booking_data JSONB`에 저장.
- `site_settings` 테이블(key-value)로 계좌 정보 + 회사 정보 관리. 관리자 페이지에서 수정.
- 이메일 발송: Resend API (`resend` npm 패키지). 상태 변경 3개 트리거(입금확인중/확정/취소).
- 주문서 폼: 별도 페이지 `/orders/new?product=:slug`. 상단에 상품 요약, 패키지/픽업별 폼 분기.

---

## 주문 상태 흐름

```
pending_payment → payment_checking → confirmed
                                   ↘ cancelled
```

| 상태 | 설명 | 이메일 트리거 |
|------|------|-------------|
| `pending_payment` | 주문 생성 직후, 입금 대기 | 없음 (주문서 화면에서 계좌 안내) |
| `payment_checking` | 관리자가 입금 확인 시작 | ✅ 발송 |
| `confirmed` | 관리자 확정 | ✅ 발송 |
| `cancelled` | 관리자 또는 추후 자동 취소 | ✅ 발송 |

---

## DB 스키마

### `server/migrations/010_orders.sql`

```sql
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

-- 계좌 정보 기본값
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

### booking_data 구조

**패키지:**
```json
{
  "travel_start": "2026-05-01",
  "travel_end": "2026-05-04",
  "num_people": 2
}
```

**픽업:**
```json
{
  "date": "2026-05-01",
  "num_people": 2,
  "pickup_type": "airport_to_hotel",
  "flight_no": "VJ123",
  "flight_time": "14:30",
  "hotel_name": "Hyatt Regency Da Nang",
  "memo": "유아 좌석 필요"
}
```

---

## 백엔드 API

### `server/src/routes/orders.ts` (사용자)

```
POST /api/orders
  requireAuth
  body: {
    product_id, selected_option_ids[],
    orderer_name, orderer_phone, orderer_email,
    booking_data,   // 패키지 또는 픽업 데이터
    memo?
  }
  → { id, status: 'pending_payment', total_price }

GET /api/orders/my
  requireAuth
  → { items: Order[] }  (본인 주문만, created_at DESC)
  각 item에 options[], product 정보(title, category, slug) 포함
```

### `server/src/routes/admin-orders.ts` (관리자)

```
GET  /api/admin/orders
  requireAdmin
  query: status?, page?, limit?
  → { items: Order[], total }

GET  /api/admin/orders/:id
  requireAdmin
  → Order + options[] + product 정보

PATCH /api/admin/orders/:id/status
  requireAdmin
  body: { status: 'payment_checking' | 'confirmed' | 'cancelled' }
  → { ok: true }
  → 이메일 트리거

PATCH /api/admin/orders/:id/memo
  requireAdmin
  body: { admin_memo: string }
  → { ok: true }
```

### `server/src/routes/settings.ts`

```
GET /api/settings
  공개 — bank_name, bank_account, bank_holder, bank_notice,
          company_name, company_ceo, company_biz_no, company_email, company_address
  → { [key]: value }

PUT /api/admin/settings
  requireAdmin
  body: { [key]: value }  (부분 업데이트)
  → { ok: true }
```

### `server/src/lib/email.ts` (내부 유틸)

Resend를 사용한 이메일 발송 유틸. 3개 템플릿:

1. **`sendPaymentCheckingEmail(order)`** — "입금 확인 중입니다"
2. **`sendOrderConfirmedEmail(order)`** — "주문이 확정되었습니다"
3. **`sendOrderCancelledEmail(order)`** — "주문이 취소되었습니다"

환경변수: `RESEND_API_KEY`, `EMAIL_FROM`

---

## 프론트엔드 컴포넌트

### `src/pages/OrderNew.tsx` (`/orders/new?product=:slug`)

1. product slug로 상품 정보 fetch
2. 상단: 상품 요약 카드 (썸네일, 이름, 선택 옵션, 총 금액)
3. 주문자 정보: 이름(자동), 연락처, 이메일(자동)
4. **패키지일 때:** 여행 시작일/종료일, 인원 수, 요청사항
5. **픽업일 때:** date, num_people, pickup_type(radio), flight_no, flight_time, hotel_name, 요청사항
6. 무통장 입금 안내 박스: 계좌 정보 + **복사 버튼 (계좌번호만)**
7. "주문 완료" 버튼 → POST /api/orders → 성공 시 `/my/orders`로 이동

ProductDetail에서 선택한 옵션 ID만 URL query params로 전달:
`/orders/new?product=slug&options=1,2`
예약 폼(패키지 일정, 픽업 정보)은 OrderNew 페이지에서 다시 입력.

### `src/pages/MyOrders.tsx` (`/my/orders`)

- requireAuth
- GET /api/orders/my 호출
- 주문 카드 목록: 상품명, 주문번호, 날짜, 금액, 상태 badge
- `pending_payment` 상태일 때: 무통장 입금 안내 + 계좌 복사 버튼 표시
- 사용자 메모(memo) 표시
- 관리자 메모(admin_memo) 있으면 표시
- 빈 상태: "주문 내역이 없습니다."

### `src/pages/admin/AdminOrders.tsx` (`/admin/orders`)

- 상태 필터 탭: 전체 / 결제대기 / 확인중 / 확정 / 취소
- 주문 목록 테이블: 주문번호, 상품명, 주문자, 금액, 상태, 주문일, 액션 버튼
- 클릭 시 Sheet(오른쪽 슬라이드)로 상세:
  - 주문자 정보, 예약 데이터(booking_data), 선택 옵션
  - 사용자 메모(읽기 전용)
  - 관리자 메모 Textarea + 저장 버튼
  - 상태 변경 버튼 (현재 상태에 따라 표시)

### `src/pages/admin/AdminSettings.tsx` (`/admin/settings`)

두 섹션:

**무통장 입금 계좌:**
- 은행명, 계좌번호, 예금주, 입금 안내 문구 (각각 Input)

**회사 정보 (푸터 표시용):**
- 회사명, 대표자, 통신판매업신고번호, 이메일, 주소

- GET /api/admin/settings로 현재 값 로드
- 저장 버튼 → PUT /api/admin/settings
- 미입력(빈 문자열) 저장 가능 → 해당 항목 공개 시 표시 안 함

### 수정 파일

- `src/pages/ProductDetail.tsx` — "주문하기" 클릭 시 `/orders/new?product=:slug&options=...` 로 navigate
- `src/components/admin/AdminLayout.tsx` — 사이드바 "주문 관리"(disabled 제거), "설정" 추가
- `src/App.tsx` — 새 라우트 4개 추가
- `server/src/index.ts` — 새 라우트 등록

---

## 파일 구조

| 파일 | 작업 |
|------|------|
| `server/migrations/010_orders.sql` | CREATE |
| `server/src/lib/email.ts` | CREATE |
| `server/src/routes/orders.ts` | CREATE |
| `server/src/routes/admin-orders.ts` | CREATE |
| `server/src/routes/settings.ts` | CREATE |
| `server/src/index.ts` | MODIFY |
| `src/pages/OrderNew.tsx` | CREATE |
| `src/pages/MyOrders.tsx` | CREATE |
| `src/pages/admin/AdminOrders.tsx` | CREATE |
| `src/pages/admin/AdminSettings.tsx` | CREATE |
| `src/pages/ProductDetail.tsx` | MODIFY |
| `src/components/admin/AdminLayout.tsx` | MODIFY |
| `src/App.tsx` | MODIFY |

---

## 이메일 템플릿 내용

### 공통
- 발신: `EMAIL_FROM` 환경변수
- 수신: `orderer_email`
- 제목/본문: 한국어

### 1. 입금 확인 중 (`payment_checking`)
> 제목: [럭키다낭] 입금 확인 중입니다 (#주문번호)  
> 내용: 주문하신 상품명, 결제 금액, 담당자가 입금 내역을 확인 중이라는 안내

### 2. 주문 확정 (`confirmed`)
> 제목: [럭키다낭] 주문이 확정되었습니다 (#주문번호)  
> 내용: 주문 확정 안내, 상품명, 금액, 문의 이메일

### 3. 주문 취소 (`cancelled`)
> 제목: [럭키다낭] 주문이 취소되었습니다 (#주문번호)  
> 내용: 취소 안내, 환불 관련 문의 이메일

---

## 범위 외

- 카카오 알림톡 → 서브시스템 4
- 주문 취소 요청(사용자 직접) → 별도 논의
- 환불 처리 → 수동 (이 스펙에서 제외)
- 결제 게이트웨이 연동(PG사) → 해당 없음 (무통장 입금만)
