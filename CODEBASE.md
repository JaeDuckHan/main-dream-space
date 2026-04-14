# main-dream-space 코드베이스 참조 문서

> 한국 장기체류/은퇴 플래닝 웹 서비스. 숙소 검색, 비즈니스 디렉토리, 커뮤니티 포럼, 이주 플래너 기능 제공.

---

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| Frontend Framework | React 18.3.1 + TypeScript 5.8.3 |
| Routing | React Router v6 |
| Build Tool | Vite 5.4.19 |
| UI Framework | shadcn/ui + Tailwind CSS 3.4.17 |
| Form/Validation | react-hook-form + Zod |
| Server State | TanStack React Query 5.83.0 |
| 3D Graphics | Three.js + React Three Fiber |
| Maps | Leaflet + React Leaflet |
| Charts | Recharts |
| Backend | Express.js 4.21.2 + Node.js |
| Database | PostgreSQL |
| Auth | OAuth 2.0 (Kakao, Google, Naver) + 세션 |
| File Upload | Multer + Sharp |
| Testing | Vitest (unit) + Playwright (e2e) |

---

## 프로젝트 구조

```
main-dream-space/
├── src/                    # 프론트엔드
│   ├── components/         # React 컴포넌트
│   ├── pages/              # 라우트 페이지 (20개)
│   ├── hooks/              # 커스텀 훅 (6개)
│   ├── lib/                # 유틸리티 & 헬퍼
│   ├── data/               # 정적 데이터 (JSON)
│   └── test/               # 테스트 파일
├── server/                 # 백엔드
│   ├── src/
│   │   ├── routes/         # API 엔드포인트 (13개)
│   │   ├── lib/            # 백엔드 유틸리티
│   │   ├── services/       # 캐시 서비스
│   │   ├── middleware/     # Express 미들웨어
│   │   ├── cron/           # 크론 작업
│   │   └── utils/          # 공통 유틸
│   ├── migrations/         # DB 스키마 SQL (7개)
│   └── seeds/              # DB 시드 데이터
├── docs/
│   ├── specs/              # 기능별 스펙 문서 (13개)
│   └── pr/                 # PR 설명 문서
├── public/                 # 정적 에셋
├── vite.config.ts
├── tailwind.config.ts
├── playwright.config.ts
└── components.json         # shadcn/ui 설정
```

---

## 페이지 & 라우팅

| 경로 | 컴포넌트 | 설명 |
|------|----------|------|
| `/` | `Index.tsx` | 홈 페이지 |
| `/living` | `Living.tsx` | 생활 가이드 |
| `/retire` | `Retire.tsx` | 은퇴 가이드 |
| `/community` | `Community.tsx` | 커뮤니티 피드 |
| `/community/write` | `CommunityWrite.tsx` | 글 작성 |
| `/community/:id` | `CommunityPostDetail.tsx` | 게시글 상세 |
| `/community/:id/edit` | `CommunityEdit.tsx` | 게시글 수정 |
| `/coffee-chats` | `CoffeeChats.tsx` | 커피챗 모임 |
| `/residents` | `Residents.tsx` | 거주자 디렉토리 |
| `/residents/me` | `ResidentMe.tsx` | 내 거주자 프로필 |
| `/planner` | `Planner.tsx` | 이주 체크리스트 |
| `/compare` | `Compare.tsx` | 숙소 비교 |
| `/directory` | `Directory.tsx` | 비즈니스 디렉토리 + 지도 |
| `/insight` | `Insight.tsx` | 분석/인사이트 대시보드 |
| `/login` | `Login.tsx` | OAuth 로그인 |
| `/business/register` | `BusinessRegister.tsx` | 비즈니스 등록 (3단계) |
| `/business/dashboard` | `BusinessDashboard.tsx` | 비즈니스 관리 |
| `/admin/listings` | `AdminListings.tsx` | 어드민 리스팅 관리 |
| `/checklist` | `ChecklistStatus.tsx` | 체크리스트 현황 |
| `*` | `NotFound.tsx` | 404 |

**App Shell 레이아웃:**
```
<PlannerBar />      ← 체크리스트 진행 바
<Navbar />          ← 전역 네비게이션
<DashboardBar />    ← 대시보드 메트릭 바
<Outlet />          ← 라우트 컨텐츠
```

---

## 컴포넌트 구조

### Feature 컴포넌트
```
src/components/
├── business/
│   ├── StepBasic.tsx       # 비즈니스 등록 1단계
│   ├── StepDetails.tsx     # 비즈니스 등록 2단계
│   └── StepReview.tsx      # 비즈니스 등록 3단계
├── community/
│   ├── CommunityEditorForm.tsx   # 마크다운 에디터
│   └── ResidentDetailModal.tsx   # 거주자 프로필 모달
├── home/
│   ├── CityCostCards.tsx   # 도시별 비용 카드
│   ├── CityTabs.tsx        # 도시 선택 탭
│   ├── HeroSearch.tsx      # 검색 박스
│   ├── NewsletterForm.tsx  # 뉴스레터 구독
│   ├── TopHotels.tsx       # 추천 숙소
│   ├── TrustIndicators.tsx # 신뢰 지표
│   └── WeeklyNews.tsx      # 주간 뉴스 캐러셀
├── ui/                     # shadcn/ui 컴포넌트 (45+개)
├── DashboardBar.tsx        # 대시보드 메트릭
├── DirectoryMap.tsx        # Leaflet 지도
├── Footer.tsx
├── HeroScene.tsx           # Three.js 3D 씬
├── HeroSection.tsx
├── Navbar.tsx
├── PlannerBar.tsx          # 체크리스트 진행 바
└── RequireAuth.tsx         # 인증 게이트
```

---

## 커스텀 훅

| 훅 | 파일 | 반환값 |
|----|------|--------|
| `useAuth()` | `use-auth.tsx` | `{ user, loading, refetch, logout }` |
| `useAccommodations(params)` | `use-accommodations.ts` | `{ data, total, loading, error }` |
| `useListings(params)` | `use-listings.ts` | 비즈니스 리스팅 데이터 |
| `usePlannerChecklist()` | `use-planner-checklist.ts` | 체크리스트 상태 |
| `useMobile()` | `use-mobile.tsx` | `boolean` |
| `useToast()` | `use-toast.ts` | toast 함수 |

**Auth 사용법:**
```typescript
const { user, loading, logout } = useAuth()
// user가 null이면 비로그인
```

---

## 상태 관리

1. **전역 인증 상태** → `AuthContext` (use-auth.tsx)
2. **서버 데이터 캐싱** → TanStack React Query
3. **폼 상태** → react-hook-form + Zod
4. **로컬 UI 상태** → useState

---

## API 엔드포인트 (백엔드)

| 경로 | 파일 | 기능 |
|------|------|------|
| `/api/auth`, `/api/oauth` | auth.ts | OAuth 로그인/로그아웃/세션 |
| `/api/accommodations` | accommodations.ts | 숙소 검색/필터 |
| `/api/listings` | listings.ts | 비즈니스 리스팅 CRUD |
| `/api/admin/listings` | admin-listings.ts | 어드민 리스팅 관리 |
| `/api/admin/community` | admin-community.ts | 어드민 커뮤니티 관리 |
| `/api/affiliate` | affiliate.ts | 어필리에이트 링크 |
| `/api/community` | community.ts | 게시글/댓글/좋아요 CRUD |
| `/api/coffee-chats` | coffee-chats.ts | 커피챗 CRUD |
| `/api/residents` | residents.ts | 거주자 프로필 CRUD |
| `/api/newsletter` | newsletter.ts | 뉴스레터 구독 |
| `/api/planner` | planner.ts | 체크리스트 관리 |
| `/api/stats` | stats.ts | 통계/분석 |
| `/api/*` | dashboard.ts | 캐시된 대시보드 데이터 |

**Dev 환경 프록시** (vite.config.ts):
- 프론트 포트: `8080`
- 백엔드 포트: `3001`
- `/api/*`, `/uploads/*` → `localhost:3001`

---

## 데이터베이스 스키마

**주요 테이블:**

| 테이블 | 설명 |
|--------|------|
| `users` | 유저 계정 (role: user/admin) |
| `user_sessions` | 세션 관리 |
| `accommodations` | 숙소 (호텔/빌라/아파트) + 가격 |
| `listings` | 비즈니스 디렉토리 (restaurant/massage/real_estate/tour) |
| `community_posts` | 커뮤니티 게시글 (마크다운) |
| `community_comments` | 중첩 댓글 |
| `residents` | 커뮤니티 거주자 프로필 |
| `coffee_chats` | 모임 이벤트 |
| `checklist_templates` | 체크리스트 템플릿 |
| `checklist_items` | 체크리스트 항목 |

**마이그레이션 파일 (server/migrations/):**
```
001_init.sql              ← 핵심 테이블
003_oauth.sql             ← OAuth 연동
004_listings.sql          ← 비즈니스 리스팅
004b_migrate_accommodations.sql
005_community.sql         ← 커뮤니티
006_residents_patch.sql   ← 거주자 프로필 확장
008_newsletter.sql        ← 뉴스레터
```

---

## 백엔드 유틸리티

### 인증 미들웨어 (server/src/lib/auth.ts)
```typescript
authSessionMiddleware  // 세션 쿠키 검증, req.authUser 주입
requireAuth            // 로그인 필수 미들웨어
requireAdmin           // 어드민 필수 미들웨어
destroySession()       // 세션 삭제
createOpaqueToken()    // 보안 토큰 생성
```

### 캐시 서비스 (server/src/services/)
- `exchange-service.ts` - 환율 데이터 (TTL 캐시)
- `weather-service.ts` - 날씨 데이터 (TTL 캐시)
- `residents-count-service.ts` - 거주자 수 (TTL 캐시)

---

## 개발 환경 실행

```bash
# 프론트엔드 (포트 8080)
npm run dev

# 백엔드 (포트 3001)
cd server && npm run dev

# 테스트
npm run test           # Vitest 유닛 테스트
npx playwright test    # Playwright e2e 테스트

# DB 마이그레이션
cd server && npm run migrate

# DB 시드
cd server && npm run seed
```

---

## 환경 변수

백엔드 `.env` 필요:
- `DATABASE_URL` - PostgreSQL 연결 문자열
- OAuth 관련 키 (Kakao, Google, Naver)

---

## 스펙 문서 (docs/specs/)

| 파일 | 내용 |
|------|------|
| 00-infrastructure.md | 인프라 설정 |
| 01-planner-checklist-actionable.md | 플래너/체크리스트 |
| 02-accommodation-compare.md | 숙소 비교 |
| 03-business-directory.md | 비즈니스 디렉토리 |
| 03b-frontend-pages.md | 프론트엔드 페이지 |
| 04-oauth-auth.md | OAuth 인증 |
| 05-data-collection-mika.md | 데이터 수집 |
| 06-community.md | 커뮤니티 |
| 06b-residents-enhancement.md | 거주자 기능 확장 |
| 07-dashboard-bar.md | 대시보드 바 |
| 08a-main-page-rescue.md | 메인 페이지 |
| 08d-persona-landing.md | 페르소나 랜딩 |
