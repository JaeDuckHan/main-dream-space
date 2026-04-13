# 05. 미카 데이터 수집 운영 가이드

## Context
- 수집 에이전트: 미카 (OpenClaw 플래너/크리에이터)
- 수집 도구: 구글시트 (LuckyDanang_Directory_Collection)
- DB 입력 도구: Codex import 스크립트 (server/scripts/import_listings.ts)
- 검수자: Jeff
- 선행: 03 (listings DB), 04 (OAuth, admin 계정)

## 전체 워크플로우

```
[Step 1] 미카가 구글시트에 데이터 입력 (카테고리별 시트)
              ↓
[Step 2] Jeff가 구글시트에서 검수 (status 컬럼 업데이트)
              ↓
[Step 3] Jeff가 import_export 시트를 CSV로 export
              ↓
[Step 4] CSV를 VPS에 업로드 (scp)
              ↓
[Step 5] Codex import 스크립트 실행 (--dry-run 먼저)
              ↓
[Step 6] dry-run 결과 검토 → 실제 import
              ↓
[Step 7] DB 확인 + 사이트에서 노출 확인
              ↓
[Step 8] 환각/오류 발견 시 수정 → 재import (--update)
```

## Phase별 운영

### Phase 1: 초기 시드 (Week 1-2)
- 미카가 5개 카테고리 × 10건 = 50건 수집
- Jeff가 일주일에 걸쳐 검수
- 첫 import → 사이트 공개

### Phase 2: 정기 보강 (Week 3+)
- 미카가 주 1회 카테고리당 5건 추가 수집
- 매주 월요일 Jeff 검수 + import
- 자동화 가능: 미카 task를 cron으로 매주 일요일 실행

### Phase 3: 검증 사이클 (Month 2+)
- `last_verified_at`이 90일 지난 listing → 미카가 재검증
- 폐업/이전 발견 시 status='archived' 처리

## Step별 상세

### Step 1: 미카 수집 임무 부여

Jeff가 OpenClaw Slack에서 미카에게 임무 전달:
```
@mika 다낭 디렉토리 데이터 수집 임무 시작.
프롬프트 파일: docs/prompts/mika_collection_prompt.md
구글시트: [LuckyDanang_Directory_Collection 링크]
이번 임무: 숙소 카테고리 10건 (가격대 분포 준수)
```

미카는 프롬프트 파일을 읽고 가이드라인에 따라 수집 → 구글시트 시트2(숙소)에 입력.

### Step 2: Jeff 검수

구글시트의 시트2~6 각각에 들어가서:
1. 행마다 데이터 확인
2. 구글맵 URL 클릭 → 실재 확인 (환각 차단)
3. 사진 URL 미리보기 (=IMAGE 함수)
4. 가격/연락처 합리성 확인
5. **`status` 컬럼 업데이트**:
   - `승인` → 사이트 공개 OK
   - `반려` → 환각/오류 → 미카 재수집
   - `보류` → 추가 정보 필요
   - `검토중` → 작업 중
6. 수정사항은 `jeff_notes` 컬럼에 메모

`status='승인'` 행만 시트7(검수승인_뷰)에 자동 표시 (QUERY 함수).

### Step 3: CSV Export

시트8(import_export)는 시트7의 데이터를 listings DB 컬럼 형식으로 정제한 시트.
1. 시트8 선택
2. 파일 → 다운로드 → CSV (.csv)
3. 파일명: `danang_YYYY_MM_DD.csv`

### Step 4: VPS 업로드

```bash
# 로컬에서
scp ~/Downloads/danang_2026_04_13.csv vps:~/imports/

# VPS에서 확인
ssh vps "ls -la ~/imports/"
```

또는 Jeff가 직접 VPS에 SSH 접속해서 nano로 붙여넣기.

### Step 5: Dry-run

```bash
ssh vps
cd ~/main-dream-space/server
npm run import:listings -- --file ~/imports/danang_2026_04_13.csv --dry-run
```

출력 예시:
```
📂 Reading: ~/imports/danang_2026_04_13.csv
✅ Parsed 47 rows
🔍 Validating common fields...
🔍 Validating category_data per row...
🔍 Verifying google_maps_place_id with Places API...
🔍 Verifying google_maps_url HEAD requests...
🔍 Verifying photo URLs...

✅ 42 rows passed all validations
⚠️  3 rows would be UPDATED (existing google_maps_place_id):
    - "Banh Mi Phuong" (place_id: ChIJxxx...)
    - "Madame Lan" (place_id: ChIJyyy...)
    - "Pizza 4Ps" (place_id: ChIJzzz...)
❌ 5 rows have errors:
    Row 15: missing required field 'district'
    Row 22: place_id 'ChIJ_invalid' not found in Places API
    Row 31: photo_urls[2] returned 404
    Row 38: invalid category 'massagee' (typo? did you mean 'massage'?)
    Row 45: google_maps_url HEAD failed (timeout)

📊 DRY RUN - no DB changes made
📝 Report: ~/imports/import_2026_04_13_dryrun.log.json
```

### Step 6: 실제 Import

dry-run 결과 OK면 실행:
```bash
# 신규 + 기존 update 모두 허용
npm run import:listings -- --file ~/imports/danang_2026_04_13.csv --update

# 또는 신규만 (기존은 skip)
npm run import:listings -- --file ~/imports/danang_2026_04_13.csv
```

### Step 7: 검증

```bash
# DB에 들어갔는지 확인
psql $DATABASE_URL -c "
  SELECT category, COUNT(*), MAX(created_at) 
  FROM listings 
  WHERE source='mika_collected' 
  GROUP BY category;
"

# 사이트에서 확인
curl https://work.luckydanang.com/api/listings?category=restaurant&limit=5 | jq
```

브라우저에서 직접:
- `https://work.luckydanang.com/compare?category=restaurant`
- 각 카테고리별 노출 확인

### Step 8: 오류 수정 사이클

만약 잘못된 데이터 발견:
1. 구글시트에서 해당 row 수정 (status='수정필요'로 표시)
2. 시트8 재export → 새 CSV
3. `npm run import:listings -- --file new.csv --update`
4. `--update` 플래그로 google_maps_place_id 매칭되는 기존 row UPDATE

## 환각 대응 매뉴얼

미카가 수집 중 환각 발생 시 Jeff 검수에서 잡아내야 하는 패턴:

| 패턴 | 검출 방법 | 대응 |
|---|---|---|
| 존재하지 않는 업체 | 구글맵 URL 클릭 → 404 | 반려 |
| 잘못된 place_id | import 스크립트가 자동 검증 | 반려 |
| 추측한 가격 | 구글맵/Agoda 원본과 비교 | 반려 또는 수정 |
| 사진 URL 추측 | =IMAGE 함수로 미리보기 | 반려 |
| 다른 도시 (호치민/하노이) | district 필드 확인 | 반려 |
| 같은 업체 중복 | place_id 중복 → import 스크립트가 SKIP | 자동 처리 |

## 운영 체크리스트 (매주 월요일)

```
[ ] 미카에게 이번 주 수집 임무 부여
[ ] 미카 수집 결과 구글시트에서 확인
[ ] 50건 이하면 즉시 검수, 50건+면 카테고리별 분할 검수
[ ] 검수 완료 행 status='승인'
[ ] 시트8 → CSV export
[ ] VPS scp 업로드
[ ] dry-run 실행
[ ] 오류 0건 또는 합리적인 수준 확인
[ ] 실제 import
[ ] 사이트 노출 확인
[ ] 다음 주 임무 계획 (어떤 카테고리 보강 필요한지)
```

## 미카 작업 스케줄 자동화 (Phase 3, 선택)

OpenClaw cron 또는 Slack reminder로 매주 일요일 자동 트리거:
```
매주 일요일 18:00 KST
→ 미카에게 자동 메시지: "이번 주 수집 임무를 시작하세요. 구글시트: [링크]"
→ 미카가 자동으로 5건 수집
→ 월요일 아침 Jeff에게 알림: "검수 대기 5건"
```

이 부분은 OpenClaw 워크스페이스 설정이라 Codex 작업 범위 밖. Jeff가 직접 설정.

## 트러블슈팅

### Q. dry-run에서 Places API 403 에러
- `.env`의 `GOOGLE_PLACES_API_KEY` 확인
- Cloud Console에서 "Places API (New)" 활성화 여부 확인
- API 키에 도메인 제한이 걸려있다면 서버 IP 화이트리스트 추가

### Q. 같은 place_id가 이미 있는데 새 데이터로 덮어쓰고 싶음
- `--update` 플래그 사용
- 단, owner_id가 있는 (사용자 등록) row는 보호됨 → 수동 SQL 필요

### Q. 미카가 같은 업체를 두 번 수집함
- 자동 SKIP (place_id UNIQUE)
- 시트에서도 미리 정렬 → 중복 제거 후 export

### Q. 한 카테고리에만 import하고 싶음
- `--category restaurant` 플래그

### Q. 미카가 환각만 만들고 있음
- 프롬프트 파일 강화 (`prompts/mika_collection_prompt.md` 참조)
- 임무 분할: "각 행에 대해 google.com/maps에서 검색 후 입력" 명시
- 환각 발견 시 미카 워크스페이스 MEMORY.md에 "주의: 환각 빈발" 기록

## DoD
- [ ] 구글시트 템플릿 생성 + 미카에게 권한 부여
- [ ] 미카 수집 프롬프트 파일 OpenClaw에 등록
- [ ] import 스크립트 dry-run 첫 실행 성공
- [ ] 첫 50건 시드 데이터 import 완료
- [ ] 사이트에서 5개 카테고리 모두 노출 확인
- [ ] Jeff 검수 워크플로우 1사이클 완주 (수집→검수→import→공개)
