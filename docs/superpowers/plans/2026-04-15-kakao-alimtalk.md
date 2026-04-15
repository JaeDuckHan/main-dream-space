# SS4 카카오 알림톡 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** iwinv REST API를 사용해 주문 상태 4개 트리거(pending_payment / payment_checking / confirmed / cancelled)에 카카오 알림톡을 병행 발송한다.

**Architecture:** `email.ts` 미러 패턴으로 `server/src/lib/alimtalk.ts`를 신규 생성. `orders.ts`(주문 생성)와 `admin-orders.ts`(상태 변경) 두 파일에서 이메일과 나란히 fire-and-forget 호출. API 키/템플릿 코드 없으면 silent return.

**Tech Stack:** Node.js fetch API (global, Node 18+), iwinv biz.service.iwinv.kr REST API, TypeScript, 기존 `query()` DB 헬퍼

---

## 파일 구조

| 파일 | 작업 | 역할 |
|------|------|------|
| `server/src/lib/alimtalk.ts` | CREATE | iwinv API 호출 유틸 (4개 공개 함수) |
| `server/src/routes/orders.ts` | MODIFY | 주문 생성 후 pending_payment 알림톡 추가 |
| `server/src/routes/admin-orders.ts` | MODIFY | orderer_phone RETURNING 추가 + 3개 알림톡 트리거 |
| `server/.env.example` | MODIFY | iwinv 환경변수 6개 추가 |

---

### Task 1: alimtalk.ts 유틸 생성

**Files:**
- Create: `server/src/lib/alimtalk.ts`

#### 컨텍스트

이 파일은 `server/src/lib/email.ts`와 동일한 구조를 따른다.
- API 키/템플릿 코드 없으면 즉시 return (개발 환경 안전)
- 내부 헬퍼 3개: `normalizePhone`, `formatPrice`, `buildMessage`
- 공개 함수 4개: `sendPendingPaymentAlimtalk`, `sendPaymentCheckingAlimtalk`, `sendOrderConfirmedAlimtalk`, `sendOrderCancelledAlimtalk`

iwinv API 규격:
```
POST https://biz.service.iwinv.kr/api/send/
Headers:
  Content-Type: application/json;charset=UTF-8
  AUTH: Buffer.from(IWINV_API_KEY).toString("base64")
Body:
{
  sender_key: string,
  template_code: string,
  phone_number: string,  // 하이픈 없이 "01012341234"
  message: string,       // #{변수} 치환이 완료된 최종 메시지
  fall_back_yn: false
}
```

- [ ] **Step 1: 파일 생성**

`server/src/lib/alimtalk.ts` 전체 내용:

```typescript
const API_URL = "https://biz.service.iwinv.kr/api/send/";
const SENDER_KEY = process.env.IWINV_SENDER_KEY ?? "";

export interface OrderAlimtalkData {
  id: number;
  orderer_name: string;
  orderer_phone: string;
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

function normalizePhone(phone: string): string {
  return phone.replace(/-/g, "");
}

function formatPrice(n: number): string {
  return n.toLocaleString("ko-KR");
}

function buildMessage(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (msg, [key, val]) => msg.replaceAll(`#{${key}}`, val),
    template,
  );
}

async function sendAlimtalk(
  templateCode: string,
  phone: string,
  message: string,
): Promise<void> {
  if (!process.env.IWINV_API_KEY) return;
  const auth = Buffer.from(process.env.IWINV_API_KEY).toString("base64");
  await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      AUTH: auth,
    },
    body: JSON.stringify({
      sender_key: SENDER_KEY,
      template_code: templateCode,
      phone_number: normalizePhone(phone),
      message,
      fall_back_yn: false,
    }),
  });
}

// 템플릿 문구 (iwinv에 등록된 내용과 완전히 일치해야 함)
const TEMPLATES = {
  pending: [
    "[럭키다낭] 주문이 접수되었습니다",
    "",
    "안녕하세요, #{이름}님.",
    "주문이 정상적으로 접수되었습니다.",
    "",
    "■ 상품명: #{상품명}",
    "■ 주문번호: #{주문번호}",
    "■ 결제금액: #{주문금액}원",
    "",
    "━━ 무통장 입금 안내 ━━",
    "은행명: #{은행명}",
    "계좌번호: #{계좌번호}",
    "예금주: #{예금주}",
    "",
    "#{안내문구}",
    "",
    "입금 확인 후 카카오톡으로 안내드립니다.",
    "문의: #{이메일}",
  ].join("\n"),

  checking: [
    "[럭키다낭] 입금 확인 중입니다",
    "",
    "안녕하세요, #{이름}님.",
    "담당자가 입금 내역을 확인하고 있습니다.",
    "",
    "■ 상품명: #{상품명}",
    "■ 주문번호: #{주문번호}",
    "■ 결제금액: #{주문금액}원",
    "",
    "확인이 완료되면 카카오톡으로 안내드립니다.",
    "문의: #{이메일}",
  ].join("\n"),

  confirmed: [
    "[럭키다낭] 주문이 확정되었습니다",
    "",
    "안녕하세요, #{이름}님.",
    "주문이 최종 확정되었습니다.",
    "",
    "■ 상품명: #{상품명}",
    "■ 주문번호: #{주문번호}",
    "■ 결제금액: #{주문금액}원",
    "",
    "즐거운 다낭 여행 되세요!",
    "문의: #{이메일}",
  ].join("\n"),

  cancelled: [
    "[럭키다낭] 주문이 취소되었습니다",
    "",
    "안녕하세요, #{이름}님.",
    "아래 주문이 취소 처리되었습니다.",
    "",
    "■ 상품명: #{상품명}",
    "■ 주문번호: #{주문번호}",
    "■ 결제금액: #{주문금액}원",
    "",
    "환불 관련 문의는 아래 이메일로 연락해주세요.",
    "문의: #{이메일}",
  ].join("\n"),
};

export async function sendPendingPaymentAlimtalk(
  order: OrderAlimtalkData,
  settings: BankSettings,
): Promise<void> {
  const templateCode = process.env.IWINV_TEMPLATE_PENDING ?? "";
  if (!templateCode) return;
  const message = buildMessage(TEMPLATES.pending, {
    이름: order.orderer_name,
    상품명: order.product_title,
    주문번호: String(order.id),
    주문금액: formatPrice(order.total_price),
    은행명: settings.bank_name,
    계좌번호: settings.bank_account,
    예금주: settings.bank_holder,
    안내문구: settings.bank_notice,
    이메일: settings.company_email,
  });
  await sendAlimtalk(templateCode, order.orderer_phone, message);
}

export async function sendPaymentCheckingAlimtalk(
  order: OrderAlimtalkData,
  companyEmail: string,
): Promise<void> {
  const templateCode = process.env.IWINV_TEMPLATE_CHECKING ?? "";
  if (!templateCode) return;
  const message = buildMessage(TEMPLATES.checking, {
    이름: order.orderer_name,
    상품명: order.product_title,
    주문번호: String(order.id),
    주문금액: formatPrice(order.total_price),
    이메일: companyEmail,
  });
  await sendAlimtalk(templateCode, order.orderer_phone, message);
}

export async function sendOrderConfirmedAlimtalk(
  order: OrderAlimtalkData,
  companyEmail: string,
): Promise<void> {
  const templateCode = process.env.IWINV_TEMPLATE_CONFIRMED ?? "";
  if (!templateCode) return;
  const message = buildMessage(TEMPLATES.confirmed, {
    이름: order.orderer_name,
    상품명: order.product_title,
    주문번호: String(order.id),
    주문금액: formatPrice(order.total_price),
    이메일: companyEmail,
  });
  await sendAlimtalk(templateCode, order.orderer_phone, message);
}

export async function sendOrderCancelledAlimtalk(
  order: OrderAlimtalkData,
  companyEmail: string,
): Promise<void> {
  const templateCode = process.env.IWINV_TEMPLATE_CANCELLED ?? "";
  if (!templateCode) return;
  const message = buildMessage(TEMPLATES.cancelled, {
    이름: order.orderer_name,
    상품명: order.product_title,
    주문번호: String(order.id),
    주문금액: formatPrice(order.total_price),
    이메일: companyEmail,
  });
  await sendAlimtalk(templateCode, order.orderer_phone, message);
}
```

- [ ] **Step 2: TypeScript 컴파일 확인**

```bash
cd server && npx tsc --noEmit 2>&1 | grep -v "community\|residents"
```

Expected: 빈 출력 (no errors in alimtalk.ts)

- [ ] **Step 3: 커밋**

```bash
git add server/src/lib/alimtalk.ts
git commit -m "feat: iwinv 알림톡 유틸 (alimtalk.ts)"
```

---

### Task 2: orders.ts — pending_payment 알림톡 추가

**Files:**
- Modify: `server/src/routes/orders.ts`

#### 컨텍스트

`orders.ts`는 `server/src/routes/orders.ts`에 있다. POST `/` 핸들러에서 주문을 생성한다.
현재 흐름:
1. Zod validate
2. product 조회 (`products[0].title` 이용 가능)
3. 옵션 조회 + 총액 계산
4. INSERT orders → `orderId`
5. INSERT order_options (루프)
6. `res.status(201).json({ id: orderId, status: "pending_payment", total_price })`

알림톡은 step 5 루프 직후, `res.status(201)` 직전에 추가한다.
`data.orderer_name`, `data.orderer_phone`, `product.title`, `total_price`는 이미 스코프에 있다.
settings(계좌 정보)는 여기서 별도 조회 필요.

- [ ] **Step 1: import 추가**

`server/src/routes/orders.ts` 상단 import 블록에 추가:

```typescript
import { sendPendingPaymentAlimtalk } from "../lib/alimtalk.js";
```

기존 import들 사이에 삽입 (예: `import { requireAuth } from "../lib/auth.js";` 아래):

```typescript
import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth } from "../lib/auth.js";
import { sendPendingPaymentAlimtalk } from "../lib/alimtalk.js";
```

- [ ] **Step 2: 알림톡 호출 추가**

`orders.ts`의 POST `/` 핸들러, 옵션 스냅샷 루프(`for (const opt of optionRows)`) 직후,
`res.status(201).json(...)` 직전에 다음 코드 삽입:

```typescript
    // 알림톡: pending_payment (은행 정보 포함, 비동기 fire-and-forget)
    const settingsRows = await query<{ key: string; value: string }>(
      "SELECT key, value FROM site_settings WHERE key = ANY($1)",
      [["bank_name", "bank_account", "bank_holder", "bank_notice", "company_email"]],
    );
    const s = Object.fromEntries(settingsRows.map((r) => [r.key, r.value]));
    sendPendingPaymentAlimtalk(
      {
        id: orderId,
        orderer_name: data.orderer_name,
        orderer_phone: data.orderer_phone,
        product_title: product.title,
        total_price,
      },
      {
        bank_name: s.bank_name ?? "",
        bank_account: s.bank_account ?? "",
        bank_holder: s.bank_holder ?? "",
        bank_notice: s.bank_notice ?? "",
        company_email: s.company_email ?? "",
      },
    ).catch(console.error);

    res.status(201).json({ id: orderId, status: "pending_payment", total_price });
```

주의: 기존 `res.status(201).json(...)` 라인을 교체(위 코드 블록에 이미 포함됨).

- [ ] **Step 3: TypeScript 컴파일 확인**

```bash
cd server && npx tsc --noEmit 2>&1 | grep -v "community\|residents"
```

Expected: 빈 출력

- [ ] **Step 4: 커밋**

```bash
git add server/src/routes/orders.ts
git commit -m "feat: 주문 생성 시 pending_payment 알림톡 발송"
```

---

### Task 3: admin-orders.ts — 상태 변경 알림톡 3개 추가

**Files:**
- Modify: `server/src/routes/admin-orders.ts`

#### 컨텍스트

`admin-orders.ts`의 PATCH `/:id/status` 핸들러를 수정한다.

현재 상태:
- RETURNING 절에 `o.orderer_phone`이 빠져 있음 → 추가 필요
- 이메일 발송 후 알림톡 발송 추가

현재 RETURNING 절 (line 114-115):
```sql
RETURNING o.id, o.status, o.orderer_email, o.orderer_name, o.total_price,
          p.title AS product_title
```

현재 TypeScript 타입 (line 106-109):
```typescript
const rows = await query<{
  id: number; status: string; orderer_email: string;
  orderer_name: string; product_title: string; total_price: number;
}>(
```

- [ ] **Step 1: import 추가**

`admin-orders.ts` 상단 import 블록 (`../lib/email.js` import 바로 아래)에 추가:

```typescript
import {
  sendPaymentCheckingEmail,
  sendOrderConfirmedEmail,
  sendOrderCancelledEmail,
} from "../lib/email.js";
import {
  sendPaymentCheckingAlimtalk,
  sendOrderConfirmedAlimtalk,
  sendOrderCancelledAlimtalk,
} from "../lib/alimtalk.js";
```

- [ ] **Step 2: RETURNING 절 + 타입에 orderer_phone 추가**

기존 코드 (`admin-orders.ts` line 106-115):
```typescript
    const rows = await query<{
      id: number; status: string; orderer_email: string;
      orderer_name: string; product_title: string; total_price: number;
    }>(
      `UPDATE orders o
       SET status = $1
       FROM products p
       WHERE o.id = $2 AND p.id = o.product_id
       RETURNING o.id, o.status, o.orderer_email, o.orderer_name, o.total_price,
                 p.title AS product_title`,
      [status, id],
    );
```

교체:
```typescript
    const rows = await query<{
      id: number; status: string; orderer_email: string;
      orderer_name: string; orderer_phone: string; product_title: string; total_price: number;
    }>(
      `UPDATE orders o
       SET status = $1
       FROM products p
       WHERE o.id = $2 AND p.id = o.product_id
       RETURNING o.id, o.status, o.orderer_email, o.orderer_name, o.orderer_phone,
                 o.total_price, p.title AS product_title`,
      [status, id],
    );
```

- [ ] **Step 3: 알림톡 호출 추가**

기존 이메일 발송 블록 (line 130-137):
```typescript
    // 이메일 발송 (비동기, 실패해도 응답에 영향 없음)
    if (status === "payment_checking") {
      sendPaymentCheckingEmail(emailData).catch(console.error);
    } else if (status === "confirmed") {
      sendOrderConfirmedEmail(emailData).catch(console.error);
    } else if (status === "cancelled") {
      sendOrderCancelledEmail(emailData).catch(console.error);
    }

    res.json({ ok: true, status });
```

교체:
```typescript
    // 이메일 발송 (비동기, 실패해도 응답에 영향 없음)
    if (status === "payment_checking") {
      sendPaymentCheckingEmail(emailData).catch(console.error);
    } else if (status === "confirmed") {
      sendOrderConfirmedEmail(emailData).catch(console.error);
    } else if (status === "cancelled") {
      sendOrderCancelledEmail(emailData).catch(console.error);
    }

    // 알림톡 발송 (비동기, 실패해도 응답에 영향 없음)
    const settingsRows = await query<{ key: string; value: string }>(
      "SELECT key, value FROM site_settings WHERE key = 'company_email'",
      [],
    );
    const companyEmail = settingsRows[0]?.value ?? "";
    const alimtalkData = {
      id: order.id,
      orderer_name: order.orderer_name,
      orderer_phone: order.orderer_phone,
      product_title: order.product_title,
      total_price: order.total_price,
    };
    if (status === "payment_checking") {
      sendPaymentCheckingAlimtalk(alimtalkData, companyEmail).catch(console.error);
    } else if (status === "confirmed") {
      sendOrderConfirmedAlimtalk(alimtalkData, companyEmail).catch(console.error);
    } else if (status === "cancelled") {
      sendOrderCancelledAlimtalk(alimtalkData, companyEmail).catch(console.error);
    }

    res.json({ ok: true, status });
```

- [ ] **Step 4: TypeScript 컴파일 확인**

```bash
cd server && npx tsc --noEmit 2>&1 | grep -v "community\|residents"
```

Expected: 빈 출력

- [ ] **Step 5: 커밋**

```bash
git add server/src/routes/admin-orders.ts
git commit -m "feat: 주문 상태 변경 시 알림톡 발송 (payment_checking/confirmed/cancelled)"
```

---

### Task 4: .env.example 업데이트 + 최종 빌드 검증

**Files:**
- Modify: `server/.env.example`

#### 컨텍스트

`server/.env.example`의 `# Email (Resend)` 섹션 바로 아래에 iwinv 섹션 추가.

현재 마지막 줄들 (line 22-24):
```env
# Email (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=noreply@luckydanang.com
```

- [ ] **Step 1: .env.example에 iwinv 환경변수 추가**

`# Email (Resend)` 블록 바로 아래에 추가:

```env
# Email (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=noreply@luckydanang.com

# Kakao Alimtalk (iwinv)
IWINV_API_KEY=                     # iwinv 관리콘솔 > 계정 > API 키
IWINV_SENDER_KEY=                  # 알림톡 채널 > 발신 프로필 키
IWINV_TEMPLATE_PENDING=            # lucky_pending 템플릿 코드
IWINV_TEMPLATE_CHECKING=           # lucky_checking 템플릿 코드
IWINV_TEMPLATE_CONFIRMED=          # lucky_confirmed 템플릿 코드
IWINV_TEMPLATE_CANCELLED=          # lucky_cancelled 템플릿 코드
```

- [ ] **Step 2: 백엔드 최종 빌드 확인**

```bash
cd server && npx tsc --noEmit 2>&1 | grep -v "community\|residents"
```

Expected: 빈 출력

- [ ] **Step 3: 프론트엔드 빌드 확인**

```bash
cd /d/claude/main-dream-space && npx tsc --noEmit 2>&1
```

Expected: 빈 출력

- [ ] **Step 4: 커밋**

```bash
git add server/.env.example
git commit -m "chore: iwinv 알림톡 환경변수 추가 (.env.example)"
```

---

## 완료 후 확인 사항

1. iwinv 관리콘솔에서 API 키 + 발신 프로필 키 발급 후 서버 `.env`에 설정
2. 4개 템플릿 등록 및 검수 완료 (2~3 영업일) 후 코드 서버 `.env`에 설정
3. 실제 주문 생성/상태 변경으로 알림톡 수신 테스트

> ⚠️ iwinv API body 파라미터명이 실제와 다를 경우 `alimtalk.ts`의 `sendAlimtalk` 함수 내 JSON body만 수정하면 됨.
