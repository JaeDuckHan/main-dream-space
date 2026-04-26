# 생활뉴스 작업 현황 & 다음 할 일

> 마지막 업데이트: 2026-04-27

---

## ✅ 완료 (2026-04-27)

- `server/src/index.ts` `/api/insight` 라우트 등록
- `Insight.tsx` 관리자 "새 기사 작성" 버튼 추가
- `repub.js` — DB 삭제 + Notion APPROVED 리셋 스크립트
- `fix-content.js` — 본문 사진보기·예약하기·인라인이미지 일괄 제거
- `WRITING_GUIDE.md` — 이미지·링크 금지 규칙, 음식/맛집 템플릿 추가
- Notion 전체 기사 Image URL 고유 이미지로 설정 (13개, 중복 0)
- 맛집 가이드 본문 재작성 (리스트형, 주소+가격+영업시간)
- 카페 추천·환전ATM 본문 정리 (인라인이미지·사진보기 제거)
- 맛집가이드·환전ATM Notion Status → APPROVED 리셋

---

## 🔴 즉시 필요 — 서버에서 실행

```bash
cd /var/www/work-luckydanang

# 1. 새 스크립트 가져오기
git fetch origin
git show origin/main:news-bot/repub.js > news-bot/repub.js
git show origin/main:news-bot/fix-content.js > news-bot/fix-content.js

# 2. 어제 발행 2건 DB 삭제
node news-bot/repub.js              # slug 목록 확인
node news-bot/repub.js <slug1> <slug2>

# 3. Notion에서 맛집가이드 구글맵 place URL 7곳 직접 확인·교체 후
npm run publish:morning
```

---

## 🟡 다음 콘텐츠 작업

### 1. 맛집 가이드 구글맵 place URL 교체
현재 추정값 사용 중 → Notion에서 직접 구글맵 검색해서 place URL로 교체 필요.

대상 식당:
- 미꽝 1A (1 Hải Phòng, Thạch Thang)
- 반쎄오 바 드엉 (23 Hoàng Diệu)
- 분짜 꾸엔
- 베 니 2 (미케비치)
- 마담 란 (4 Bạch Đằng)
- Nén Danang (48A Bạch Đằng)
- 껌헨 (일대 노점)

### 2. 나머지 10개 기사 구글맵 search URL → place URL 교체
fix-content.js는 링크 제거만 함. URL 직접 교체는 별도 작업.

### 3. 카페 추천 Category 검토
현재 "기타" → "음식"으로 변경 여부 확인

---

## 🟢 선택 작업

- `collect.js` crontab 등록 (자동 수집, 매일 20:00 KST)
- 나머지 15개 기사 본문 보강 (VND+원화, 구글맵 place URL)

---

## 기사별 이미지 현황 (Notion Image URL, 중복 없음)

| 기사 | Pexels ID | 내용 |
|------|-----------|------|
| 다낭 맛집 가이드 | 6009475 | 베트남 음식 세트 |
| 베트남 환전 & ATM | 6132767 | ATM 현금 출금 |
| 한국인 무비자 45일 | 32060712 | 여권+서류 |
| 베트남 90일 이상 체류 | 27688355 | 아파트 클로즈업 |
| 다낭→호이안 당일치기 | 35427724 | 호이안 등불 야시장 |
| 다낭 이동 완벽 가이드 | 32303442 | 다낭 용다리 |
| 다낭 날씨 월별 가이드 | 1915184 | 열대 우기+야자수 |
| 베트남 도착 즉시 할 일 | 14433259 | 공항 수하물 |
| 다낭 한 달 생활비 | 19828765 | 아파트 단지 전경 |
| 베트남 여행 사기 주의보 | 36634292 | 경고 표지판 흑백 |
| 다낭 외국인 병원 가이드 | 30348373 | 병원 수술실 |
| 다낭 우기 & 태풍 시즌 | 34959182 | 베트남 홍수 실사 |
| 다낭 아파트 직계약 가이드 | 8112184 | 열쇠 전달 |
| 다낭 워케이션 카페 추천 | 33062499 | 전통 베트남 상차림 |

---

## 주요 파일

| 파일 | 역할 |
|------|------|
| `news-bot/WRITING_GUIDE.md` | 기사 작성 전체 규칙 |
| `news-bot/repub.js` | 발행 기사 리셋 (DB삭제 + Notion APPROVED) |
| `news-bot/fix-content.js` | 본문 이미지·링크 일괄 정리 |
| `news-bot/publish.js` | Notion APPROVED → DB 발행 |
| `server/src/routes/news.ts` | `/api/insight` 라우트 |
