# feat: OAuth + business directory system

## 상태
- 구현/배포: 대부분 완료
- 미완료: 실제 OAuth provider 키 입력 후 실로그인 검증, admin 계정 연결 검증, 등록→승인→노출 1사이클 실데이터 검증

## 04 OAuth DoD 체크리스트
- [x] OAuth 관련 마이그레이션 추가 (`server/migrations/003_oauth.sql`)
- [x] auth 라우트/세션 구조 추가
- [x] `/api/auth/me` 동작 (`{"user":null}` 확인)
- [x] 프론트 `Login`/`RequireAuth`/`useAuth` 추가
- [ ] 카카오 로그인 성공 (키 미입력)
- [ ] 구글 로그인 성공 (키 미입력)
- [ ] 네이버 로그인 성공 (키 미입력)

## 03 디렉토리 DoD 체크리스트
- [x] listings 마이그레이션 추가 (`server/migrations/004_listings.sql`)
- [x] listings API 추가
- [x] admin listings API 추가
- [x] import script 추가 (`server/scripts/import-listings.mjs`)
- [x] accommodations 호환 API 유지
- [x] 시드 데이터 반영 (15건 확인)

## 03b 프론트엔드 DoD 체크리스트
- [x] `BusinessRegister.tsx`
- [x] `BusinessDashboard.tsx`
- [x] `AdminListings.tsx`
- [x] `Login.tsx`
- [x] 관련 hook/component 추가
- [ ] 기존 페이지 최소 변경 원칙 최종 재점검 필요

## 검증 결과
1. `curl https://work.luckydanang.com/api/health`
   - 결과: `{"status":"ok", ...}`
2. `curl https://work.luckydanang.com/api/auth/me`
   - 결과: `{"user":null}`
3. OAuth login 시작
   - kakao/google/naver: 현재 `503` (provider 키 없음)
4. `curl "https://work.luckydanang.com/api/listings?category=accommodation&limit=5"`
   - 결과: 정상 JSON 응답
5. `curl "https://work.luckydanang.com/api/accommodations?price_max=100"`
   - 결과: 정상 JSON 응답, listings 기반 호환 유지
6. DB 확인
   - listings/accommodations: 15
   - checklist_items: 7
7. PM2
   - `dreamspace-api` online

## 마이그레이션/호환성
- `003_oauth.sql`, `004_listings.sql` 추가
- 기존 accommodations API는 뷰/호환 계층으로 유지되도록 구현됨
- 실제 데이터 손실 여부는 추가 SQL 검증 필요

## 변경 파일 개요
- `server/` 신설 및 다수 추가
- `src/hooks/use-auth.tsx`
- `src/components/RequireAuth.tsx`
- `src/pages/Login.tsx`
- `src/pages/BusinessRegister.tsx`
- `src/pages/BusinessDashboard.tsx`
- `src/pages/AdminListings.tsx`
- `vite.config.ts`
- 기타 listings/checklist 관련 hook/lib 파일

## 막힌 부분 / 임의 결정
- OAuth provider 실제 키 없음 → login redirect 최종 검증 불가
- `AGODA_AFFILIATE_ID` 빈값 유지
- 일부 기존 페이지(`Planner.tsx`, `Compare.tsx`)가 수정된 흔적 있어 제약 재검토 필요

## PM2 status
- process: `dreamspace-api`
- status: online
