# 다낭 생활뉴스 작성 가이드

> 이 문서는 Notion DB에 기사를 작성·검수·발행하는 모든 과정의 규칙을 정의합니다.
> Claude에게 기사 작성을 요청할 때도 이 규칙을 참조합니다.

---

## 1. Notion DB 속성 작성 규칙

### Status 흐름
```
RAW → TRANSLATED → (검수) → APPROVED → PUBLISHED
```
| Status | 의미 | 담당 |
|--------|------|------|
| RAW | 수집된 원문(영문) 상태 | collect.js 자동 |
| TRANSLATED | 한국어로 재작성 완료 | Claude 또는 수동 |
| APPROVED | 검수 완료, 발행 대기 | 운영자 직접 변경 |
| PUBLISHED | 사이트 DB에 저장 완료 | publish.js 자동 |
| EXCLUDED | 발행 불필요 (중복·저품질) | 운영자 직접 변경 |

### Category 선택 기준
| 카테고리 | 해당 주제 예시 |
|---------|-------------|
| 관광 | 명소, 액티비티, 투어, 당일치기 |
| 음식 | 맛집, 카페, 로컬 음식, 식재료 |
| 날씨 | 기후, 계절, 태풍, 우기 대비 |
| 교통 | 이동수단, 항공, 버스, 그랩 |
| 안전 | 사기, 병원, 보험, 치안 |
| 문화 | 축제, 전통, 현지 생활양식 |
| 경제 | 생활비, 환율, 임대, ATM |
| 기타 | 비자, 인터넷, 행정, SIM카드 |

### Publish Slot
- **morning** → 서버 cron `0 0 * * *` (KST 09:00) 실행 시 발행
- **afternoon** → 서버 cron `0 6 * * *` (KST 15:00) 실행 시 발행
- 슬롯당 최대 2건 발행

### Image URL
- Pexels CDN (`images.pexels.com`) 또는 Wikimedia Commons(`upload.wikimedia.org`) 사용
- ❌ Unsplash photo ID는 검증 후 사용 (없는 ID는 404)
- ❌ Google Maps 사진 직접 URL 사용 불가 (임시 URL, 시간 지나면 만료)

---

## 2. 본문 작성 규칙

### 서머리 (Summary)
- **한국인 관점의 의견·감상형**으로 작성 (설명문 ❌)
- 2~3문장, 읽고 클릭하고 싶은 톤
- 수치나 비교가 들어가면 임팩트가 강해짐

**나쁜 예:**
> 다낭의 생활비를 정리했습니다. 숙소, 식비, 교통비 항목으로 나눠 설명합니다.

**좋은 예:**
> 강남 고시원 가격으로 수영장 딸린 원룸을 구할 수 있습니다. 서울 외식비 한 달치면 다낭에서 세 끼를 두 달 해결합니다. 2026년 4월 실제 체류자 기준 데이터입니다.

---

### 마크다운 형식 (Notion 본문 작성 시)

#### 제목
```
# 대제목 (H1)
## 소제목 (H2)
### 하위 소제목 (H3)
```

#### 목록
```
- 글머리 항목 1
- 글머리 항목 2

1. 순번 항목 1
2. 순번 항목 2
```
> ⚠️ 번호 목록은 반드시 1. 2. 3. 순서대로 (모두 1.로 쓰면 렌더링 오류)

#### 링크
```
[표시 텍스트](URL)
```

#### 이미지
```
![이미지 설명](https://직접-접근-가능한-이미지-URL)
```

#### 구분선
```
---
```

#### 콜아웃 (강조 박스)
```
> 💡 여기에 팁이나 주의사항
> ⚠️ 경고 메시지
```

---

### 가격 표기 규칙

항상 **VND(동)와 원화를 같이** 표기합니다.

```
50,000동 (약 2,500원)
300,000~500,000동 (약 15,000~25,000원)
```

- 원화 환산: 1,000 VND ≈ 50원 (1동 = 약 0.05원)
- 빠른 계산: VND 뒤 3자리 제거 후 ÷ 20 = 원화 근사치
  - 예) 100,000동 → 100 ÷ 20 = **5,000원**

---

### 구글맵 링크 규칙

#### ✅ 올바른 방법 — place URL 사용
```
[📍 위치 보기](https://www.google.com/maps/place/장소명/@위도,경도,17z/...)
[⭐ 리뷰 보기](https://www.google.com/maps/place/장소명/@위도,경도,17z/.../data=...!9m1!1b1)
```

**place URL 찾는 법:**
1. 구글맵에서 장소 검색
2. 장소 클릭 후 "공유" 버튼
3. "링크 복사" → `maps.app.goo.gl/...` 단축 URL 또는 전체 URL 사용

**리뷰 URL 찾는 법:**
1. 구글맵에서 장소 클릭
2. "리뷰" 탭 클릭
3. 브라우저 주소창 URL 복사 (끝에 `!9m1!1b1` 포함된 URL)

#### ❌ 사용 금지
```
❌ https://www.google.com/maps/search/Mi+Quang+1A+Da+Nang  (search URL — 부정확)
❌ https://www.google.com/maps/place/.../photos             (photos 탭 URL — 미작동)
```

---

### 이미지 삽입 규칙

#### 대표 이미지 (Image URL 속성)
- 기사 상단에 노출되는 대표 이미지
- 본문 첫 `![](url)` 이미지와 같은 URL이면 자동으로 중복 제거됨

#### 본문 이미지
- 상단 1장 + 중간 1~2장 + 하단 1장 권장
- Pexels 예시: `https://images.pexels.com/photos/{ID}/pexels-photo-{ID}.jpeg?w=1200&q=80`
- Wikimedia 예시: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/b/파일명.jpg/1200px-파일명.jpg`

#### 검증 방법
브라우저 새 탭에서 이미지 URL 직접 열어서 이미지가 보이는지 확인 후 사용.

---

## 3. 발행 전 체크리스트

```
[ ] 제목: 30자 이내, 클릭하고 싶은 톤
[ ] 서머리: 한국인 관점 의견형, 2~3문장
[ ] 카테고리: 올바르게 선택됨
[ ] 가격: VND + 원화 병기
[ ] 구글맵 링크: place URL 사용 (search URL 아님)
[ ] 이미지: 브라우저에서 직접 열어 확인됨
[ ] Publish Slot: morning 또는 afternoon 선택
[ ] Status: APPROVED로 변경
```

---

## 4. 발행 실행 (서버)

```bash
cd /var/www/work-luckydanang/news-bot

# morning 슬롯 (KST 09:00)
npm run publish:morning

# afternoon 슬롯 (KST 15:00)
npm run publish:afternoon
```

발행 후 Notion에서 해당 기사 Status가 **PUBLISHED**로 바뀌는지 확인.

---

## 5. Claude에게 기사 요청할 때

Claude(이 대화)에게 기사 작성을 요청할 때 아래 형식으로 요청하면 빠릅니다:

```
주제: [주제명]
카테고리: [관광/음식/날씨/교통/안전/문화/경제/기타]
특이사항: [강조할 내용, 포함할 장소, 특정 정보 등]
```

Claude는 이 가이드를 기반으로 작성 후 Notion DB에 직접 업로드합니다.
