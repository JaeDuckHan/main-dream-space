# 관리자 대시보드 — 서브시스템 4: 카카오 알림톡

**날짜:** 2026-04-15  
**프로젝트:** 럭키다낭  
**범위:** 주문 상태 변경 시 카카오 알림톡 발송 (iwinv API)

---

## 전체 서브시스템 로드맵

| # | 서브시스템 | 상태 |
|---|-----------|------|
| 1 | 관리자 쉘 + 회원 관리 | ✅ 완료 |
| 2 | 기획상품 + 픽업 서비스 | ✅ 완료 |
| 3 | 주문/결제 (무통장 입금) | ✅ 완료 |
| **4** | **알림 (카카오 알림톡)** | ← 이 스펙 |

---

## 아키텍처

- iwinv 메시지 서비스 REST API(`https://biz.service.iwinv.kr/api/send/`)로 알림톡 발송.
- 기존 `email.ts` 미러 패턴: `alimtalk.ts`를 신규 생성하고, 각 트리거 위치에서 email과 나란히 호출.
- 이메일과 알림톡은 **병행 발송** — 한쪽 실패가 다른 쪽에 영향 없음(각자 `.catch(console.error)`).
- API 키 없으면 silent return — 개발 환경에서 오류 없이 동작.

> ⚠️ **iwinv API 규격 확인 필요:** 아래 요청 body 형식은 공개 문서 기반 추정값입니다.
> 실제 연동 전 iwinv 관리콘솔 > API 규격서에서 정확한 파라미터명을 확인하고 조정하세요.

---

## 발송 트리거

| 트리거 | 발송 시점 | 담당 파일 |
|--------|----------|----------|
| `pending_payment` | 주문 생성 직후 | `server/src/routes/orders.ts` |
| `payment_checking` | 관리자 상태 변경 | `server/src/routes/admin-orders.ts` |
| `confirmed` | 관리자 상태 변경 | `server/src/routes/admin-orders.ts` |
| `cancelled` | 관리자 상태 변경 | `server/src/routes/admin-orders.ts` |

---

## iwinv API 규격 (추정)

```
POST https://biz.service.iwinv.kr/api/send/

Headers:
  Content-Type: application/json;charset=UTF-8
  AUTH: <Base64(IWINV_API_KEY)>

Body:
{
  "sender_key":    string,   // 카카오 채널 발신 프로필 키
  "template_code": string,   // 검수 완료된 템플릿 코드
  "phone_number":  string,   // 수신자 번호 (하이픈 없이, 예: "01012341234")
  "message":       string,   // #{변수} 치환이 완료된 최종 메시지
  "fall_back_yn":  false     // SMS 대체 발송 비활성화
}

성공 응답: { "result_code": "0000", ... }
```

---

## 환경변수

`server/.env.example`에 추가:

```env
# Kakao Alimtalk (iwinv)
IWINV_API_KEY=                    # iwinv 계정 API 키 (Base64 인코딩 전 원문)
IWINV_SENDER_KEY=                 # 카카오 채널 발신 프로필 키
IWINV_TEMPLATE_PENDING=           # pending_payment 템플릿 코드
IWINV_TEMPLATE_CHECKING=          # payment_checking 템플릿 코드
IWINV_TEMPLATE_CONFIRMED=         # confirmed 템플릿 코드
IWINV_TEMPLATE_CANCELLED=         # cancelled 템플릿 코드
```

---

## 알림톡 템플릿 4개

### 1. `pending_payment` — 주문 완료 + 입금 안내

**템플릿 이름:** `lucky_pending` (15자 이내)

```
[럭키다낭] 주문이 접수되었습니다

안녕하세요, #{이름}님.
주문이 정상적으로 접수되었습니다.

■ 상품명: #{상품명}
■ 주문번호: #{주문번호}
■ 결제금액: #{주문금액}원

━━ 무통장 입금 안내 ━━
은행명: #{은행명}
계좌번호: #{계좌번호}
예금주: #{예금주}

#{안내문구}

입금 확인 후 카카오톡으로 안내드립니다.
문의: #{이메일}
```

**변수 9개:** `#{이름}` `#{상품명}` `#{주문번호}` `#{주문금액}` `#{은행명}` `#{계좌번호}` `#{예금주}` `#{안내문구}` `#{이메일}`

---

### 2. `payment_checking` — 입금 확인 중

**템플릿 이름:** `lucky_checking`

```
[럭키다낭] 입금 확인 중입니다

안녕하세요, #{이름}님.
담당자가 입금 내역을 확인하고 있습니다.

■ 상품명: #{상품명}
■ 주문번호: #{주문번호}
■ 결제금액: #{주문금액}원

확인이 완료되면 카카오톡으로 안내드립니다.
문의: #{이메일}
```

**변수 5개:** `#{이름}` `#{상품명}` `#{주문번호}` `#{주문금액}` `#{이메일}`

---

### 3. `confirmed` — 주문 확정

**템플릿 이름:** `lucky_confirmed`

```
[럭키다낭] 주문이 확정되었습니다

안녕하세요, #{이름}님.
주문이 최종 확정되었습니다.

■ 상품명: #{상품명}
■ 주문번호: #{주문번호}
■ 결제금액: #{주문금액}원

즐거운 다낭 여행 되세요!
문의: #{이메일}
```

**변수 5개:** `#{이름}` `#{상품명}` `#{주문번호}` `#{주문금액}` `#{이메일}`

---

### 4. `cancelled` — 주문 취소

**템플릿 이름:** `lucky_cancelled`

```
[럭키다낭] 주문이 취소되었습니다

안녕하세요, #{이름}님.
아래 주문이 취소 처리되었습니다.

■ 상품명: #{상품명}
■ 주문번호: #{주문번호}
■ 결제금액: #{주문금액}원

환불 관련 문의는 아래 이메일로 연락해주세요.
문의: #{이메일}
```

**변수 5개:** `#{이름}` `#{상품명}` `#{주문번호}` `#{주문금액}` `#{이메일}`

---

## 백엔드 코드 구조

### `server/src/lib/alimtalk.ts` (신규)

```typescript
const API_URL = "https://biz.service.iwinv.kr/api/send/";
const SENDER_KEY = process.env.IWINV_SENDER_KEY ?? "";

export interface OrderAlimtalkData {
  id: number;
  orderer_name: string;
  orderer_phone: string;   // 알림톡 수신 번호
  product_title: string;
  total_price: number;
}

export interface BankSettings {
  bank_name: string;
  bank_account: string;
  bank_holder: string;
  bank_notice: string;
  company_email: string;
}

// 내부: #{변수명} 치환
function buildMessage(template: string, vars: Record<string, string>): string

// 내부: iwinv API 호출 (API 키 없으면 silent return)
async function sendAlimtalk(
  templateCode: string,
  phone: string,
  message: string
): Promise<void>

// 공개 함수
export async function sendPendingPaymentAlimtalk(
  order: OrderAlimtalkData,
  settings: BankSettings
): Promise<void>

export async function sendPaymentCheckingAlimtalk(
  order: OrderAlimtalkData,
  companyEmail: string
): Promise<void>

export async function sendOrderConfirmedAlimtalk(
  order: OrderAlimtalkData,
  companyEmail: string
): Promise<void>

export async function sendOrderCancelledAlimtalk(
  order: OrderAlimtalkData,
  companyEmail: string
): Promise<void>
```

### `server/src/routes/orders.ts` 수정

POST `/` 핸들러 — INSERT 성공 후:
```typescript
// 알림톡: pending_payment (은행 정보 포함)
const settingsRows = await query<{ key: string; value: string }>(
  "SELECT key, value FROM site_settings WHERE key = ANY($1)",
  [["bank_name","bank_account","bank_holder","bank_notice","company_email"]]
);
const s = Object.fromEntries(settingsRows.map(r => [r.key, r.value]));
sendPendingPaymentAlimtalk(
  { id: order.id, orderer_name, orderer_phone, product_title, total_price },
  { bank_name: s.bank_name, bank_account: s.bank_account,
    bank_holder: s.bank_holder, bank_notice: s.bank_notice,
    company_email: s.company_email }
).catch(console.error);
```

### `server/src/routes/admin-orders.ts` 수정

PATCH `/:id/status` 핸들러 — 두 가지 수정:

**1) RETURNING 절에 `o.orderer_phone` 추가** (현재 누락):
```sql
RETURNING o.id, o.status, o.orderer_email, o.orderer_name,
          o.orderer_phone, o.total_price, p.title AS product_title
```

**2) 이메일 호출 바로 아래에 알림톡 추가:**
```typescript
// 기존 이메일
sendXxxEmail(emailData).catch(console.error);

// 알림톡 추가
const settingsRows = await query<{ key: string; value: string }>(
  "SELECT key, value FROM site_settings WHERE key = 'company_email'"
);
const companyEmail = settingsRows[0]?.value ?? "";
sendXxxAlimtalk(
  {
    id: order.id,
    orderer_name: order.orderer_name,
    orderer_phone: order.orderer_phone,
    product_title: order.product_title,
    total_price: order.total_price,
  },
  companyEmail
).catch(console.error);
```

---

## 파일 구조

| 파일 | 작업 |
|------|------|
| `server/src/lib/alimtalk.ts` | CREATE |
| `server/src/routes/orders.ts` | MODIFY |
| `server/src/routes/admin-orders.ts` | MODIFY |
| `server/.env.example` | MODIFY |

---

## iwinv 템플릿 등록 가이드

### 사전 준비

1. **카카오 채널 생성** — [카카오 비즈니스](https://business.kakao.com) > 카카오톡 채널 > 채널 개설
2. **비즈니스 채널 인증** — 사업자등록증 등 서류 제출 후 검수 (1~3 영업일)
3. **iwinv 메시지 서비스 신청** — iwinv 관리콘솔 > 메시지 서비스 > 신청
4. **알림톡 채널 추가** — iwinv 관리콘솔 > 알림톡 > 채널 추가 > 카카오 채널 연동
5. **발신번호 등록** — 사용할 전화번호 등록 및 인증

### 템플릿 등록 절차

iwinv 관리콘솔 > 알림톡 > 템플릿 관리 > 템플릿 추가

각 템플릿 등록 시 입력 항목:
- **템플릿 이름:** `lucky_pending` / `lucky_checking` / `lucky_confirmed` / `lucky_cancelled`
- **템플릿 내용:** 위 4개 문구 그대로 입력 (#{변수명} 포함)
- **카테고리:** 주문/예약확인
- 검수 제출 → 카카오 검수 완료 후 (2~3 영업일) 템플릿 코드 발급

### 환경변수 설정

템플릿 검수 완료 후 발급된 코드를 서버 `.env`에 입력:
```env
IWINV_API_KEY=<iwinv 관리콘솔 > 계정 > API 키>
IWINV_SENDER_KEY=<알림톡 채널 > 발신 프로필 키>
IWINV_TEMPLATE_PENDING=<lucky_pending 코드>
IWINV_TEMPLATE_CHECKING=<lucky_checking 코드>
IWINV_TEMPLATE_CONFIRMED=<lucky_confirmed 코드>
IWINV_TEMPLATE_CANCELLED=<lucky_cancelled 코드>
```

---

## 범위 외

- SMS 대체 발송(`fall_back_yn: true`) — 별도 논의
- 발송 이력 조회 UI — 별도 논의
- 광고성 메시지 — 카카오 정책상 알림톡 불가 (별도 채널 필요)
