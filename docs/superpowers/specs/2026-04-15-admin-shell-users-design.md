# 관리자 대시보드 — 서브시스템 1: 쉘 + 회원 관리

**날짜:** 2026-04-15  
**프로젝트:** 럭키다낭  
**범위:** AdminLayout 컴포넌트, 대시보드 홈, 회원 관리 페이지  

---

## 전체 서브시스템 로드맵

이 스펙은 4개 서브시스템 중 첫 번째입니다.

| # | 서브시스템 | 범위 |
|---|-----------|------|
| **1** | **관리자 쉘 + 회원 관리** | ← 이 스펙 |
| 2 | 기획상품 + 픽업 서비스 | 상품 등록, 사용자 상품 목록 |
| 3 | 주문/결제 (무통장 입금) | 주문 생성, 입금 확인 흐름 |
| 4 | 알림 | 이메일 + 카카오 알림톡 |

---

## 아키텍처

### 레이아웃 분리

기존 `AppShell` (Navbar, PlannerBar, DashboardBar, KakaoChannelButton 포함)과 완전히 분리된 `AdminLayout`을 신규 생성한다. `/admin/*` 경로는 `AdminLayout`으로 감싸고, 일반 사용자용 UI 요소가 관리자 화면에 노출되지 않도록 한다.

`App.tsx`에서 `/admin/*` 라우트들을 `AppShell` 바깥으로 분리하여 `AdminLayout`을 적용한다.

### 파일 구조

```
src/components/admin/
  AdminLayout.tsx       ← NEW: 사이드바 포함 레이아웃 래퍼

src/pages/admin/
  AdminHome.tsx         ← NEW: /admin (대시보드 홈)
  AdminUsers.tsx        ← NEW: /admin/users (회원 관리)
  AdminListings.tsx     ← 기존 src/pages/AdminListings.tsx 이동

src/App.tsx             ← /admin/* 라우트 AdminLayout으로 교체
```

---

## 컴포넌트 설계

### AdminLayout

- 왼쪽 고정 사이드바 (너비: 160px, 배경: `#0f172a`)
- 오른쪽 콘텐츠 영역 (`<Outlet />`)
- `RequireAuth requireAdmin`으로 감싸 비관리자 접근 차단
- 사이드바 항목:
  - 📊 대시보드 (`/admin`)
  - 👥 회원 관리 (`/admin/users`)
  - 🏢 업체 검수 (`/admin/listings`) — 대기 건수 뱃지 표시
  - 🎁 기획상품 (`/admin/products`) — 비활성 (서브시스템 2)
  - 🚗 픽업 서비스 (`/admin/pickup`) — 비활성 (서브시스템 2)
  - 📦 주문 관리 (`/admin/orders`) — 비활성 (서브시스템 3)
  - ← 사이트로 돌아가기 (`/`)
- 현재 로그인한 관리자 이메일 사이드바 상단 표시

### AdminHome (`/admin`)

대시보드 홈. 현황 수치 카드 4개 표시:
- 전체 회원 수
- 업체 검수 대기 수 (강조: 주황)
- 이번달 주문 수
- 입금 대기 수 (강조: 빨강)

데이터 출처: `GET /api/admin/stats`

### AdminUsers (`/admin/users`)

**목록 테이블**

| 컬럼 | 내용 |
|------|------|
| 회원 | 이름 + 이메일 |
| 가입일 | `created_at` |
| 소셜 | 카카오/구글/네이버 뱃지 |
| 역할 | `user` / `admin` 색상 뱃지 |
| 상태 | 활성 / 비활성 |
| 주문 | 주문 건수 |

- 검색 입력: 이름·이메일 (debounce 300ms)
- 역할 필터: 전체 / user / admin
- 상태 필터: 전체 / 활성 / 비활성
- 페이지네이션: 20건씩

**사이드 패널 (클릭 시)**

Sheet 컴포넌트(`src/components/ui/sheet.tsx`)를 활용한 오른쪽 슬라이드 패널.

- 회원 기본 정보 (이름, 이메일, 소셜, 가입일)
- 역할 변경 버튼: `user ↔ admin` (확인 다이얼로그 포함)
- 계정 비활성화/활성화 버튼 (확인 다이얼로그 포함)
- 탭 3개:
  - **주문** — 주문명, 금액, 상태 (서브시스템 3 연동 후 채워짐)
  - **작성글** — 커뮤니티 글 제목, 날짜
  - **업체** — 등록한 리스팅 이름, 상태

---

## 백엔드 API

모든 엔드포인트는 `role === "admin"` 세션 검증 필요.

```
GET  /api/admin/stats
  → { pending_listings, total_users, monthly_orders, pending_payments }

GET  /api/admin/users
  → query: search?, role?, status?, page?, limit?
  → { total, items: User[] }

GET  /api/admin/users/:id
  → User + { posts[], listings[], orders[] }

PATCH /api/admin/users/:id/role
  → body: { role: "user" | "admin" }

PATCH /api/admin/users/:id/status
  → body: { active: boolean }
```

---

## DB 변경 사항

기존 `users` 테이블에 컬럼 추가:

```sql
ALTER TABLE users ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE;
```

---

## 라우팅 변경 (App.tsx)

```tsx
// 기존: AppShell 하위에 있던 /admin/listings 제거
// 추가:
<Route element={<AdminLayout />}>
  <Route path="/admin" element={<AdminHome />} />
  <Route path="/admin/users" element={<AdminUsers />} />
  <Route path="/admin/listings" element={<AdminListings />} />
</Route>
```

---

## 범위 외 (이 스펙에서 제외)

- 기획상품, 픽업 서비스 관리 → 서브시스템 2
- 주문 생성/결제, 무통장 입금 → 서브시스템 3
- 이메일/카카오 알림톡 → 서브시스템 4
- 커뮤니티 글 관리 페이지 (관리자 삭제 등) → 별도 논의
