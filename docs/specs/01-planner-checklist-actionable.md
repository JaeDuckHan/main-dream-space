# 01. Planner 개선 1: 체크리스트 액션화

## Context
- 현재: `src/pages/Planner.tsx`의 체크리스트는 단순 체크박스
- 목표: 각 항목을 클릭 가능한 **액션**으로 변환 (external 딥링크 + internal 라우팅 혼합)
- 선행: `00-infrastructure.md` 완료 필수
- DB: **PostgreSQL 14+** (ENUM은 `CREATE TYPE`으로 별도 정의됨)

## 데이터 플로우
```
MySQL (checklist_items)
   ↓ GET /api/planner/checklist/:slug
API Server
   ↓ JSON
Planner.tsx → ChecklistItem
   ↓ 클릭 시 action_type 분기:
     - external → window.open(action_url) + POST /api/affiliate/click
     - internal → navigate(action_url)
     - none     → 단순 체크 토글
```

## API 엔드포인트

### 1. 체크리스트 조회
```
GET /api/planner/checklist/:slug?session_id=xxx
```
Response:
```typescript
{
  template: { id, slug, title, description },
  items: Array<{
    id: number;
    title: string;
    description: string | null;
    sort_order: number;
    action_type: 'external' | 'internal' | 'none';
    action_url: string | null;
    action_label: string | null;
    affiliate_partner: 'agoda' | 'booking' | 'tripcom' | 'skyscanner' | 'none';
    icon: string | null;
    checked: boolean;  // checklist_progress JOIN
  }>
}
```

### 2. 체크 토글
```
POST /api/planner/progress
Body: { session_id, item_id, checked }
Response: { ok: true }
```

### 3. 어필리에이트 클릭 로깅
```
POST /api/affiliate/click
Body: { session_id, partner, target_type, target_id }
Response: { ok: true }
```

## 시드 데이터 (seeds/checklist.seed.sql)

```sql
-- PostgreSQL: WITH RETURNING 패턴으로 LAST_INSERT_ID 대체
WITH t AS (
  INSERT INTO checklist_templates (slug, title, description)
  VALUES ('danang-basic', '다낭 여행 준비 체크리스트', '출발 전 꼭 해야 할 일들')
  RETURNING id
)
INSERT INTO checklist_items 
  (template_id, sort_order, title, action_type, action_url, action_label, affiliate_partner, icon)
SELECT t.id, v.sort_order, v.title, v.action_type::action_type_enum, v.action_url, v.action_label, v.partner::affiliate_partner_enum, v.icon
FROM t, (VALUES
  (1, '항공권 예약', 'external', 'https://www.skyscanner.co.kr/transport/flights/sel/dad/', '검색하기', 'skyscanner', 'plane'),
  (2, '숙소 정하기', 'internal', '/compare?district=my-khe', '비교하기', 'none', 'hotel'),
  (3, '다낭 숙소 예약 (Agoda)', 'external', 'https://www.agoda.com/city/da-nang-vn.html?cid={AFFILIATE_ID}', '예약하기', 'agoda', 'bed'),
  (4, '공항 픽업 신청', 'internal', '/services/airport-pickup', '신청하기', 'none', 'car'),
  (5, '여행자 보험 가입', 'none', NULL, NULL, 'none', 'shield'),
  (6, '환전/트래블월렛 준비', 'none', NULL, NULL, 'none', 'wallet'),
  (7, '유심/로밍 준비', 'none', NULL, NULL, 'none', 'smartphone')
) AS v(sort_order, title, action_type, action_url, action_label, partner, icon);
```

⚠️ `{AFFILIATE_ID}` 플레이스홀더는 서버 응답 시 `.env.AGODA_AFFILIATE_ID`로 치환.

## 서버 URL 주입 로직
```typescript
// server/src/routes/planner.ts
function injectAffiliate(url: string | null): string | null {
  if (!url) return null;
  return url.replace('{AFFILIATE_ID}', process.env.AGODA_AFFILIATE_ID || '');
}
```

## 프론트엔드 변경 (src/pages/Planner.tsx)

```diff
+ import { useEffect, useState } from 'react';
+ import { useNavigate } from 'react-router-dom';

+ interface ChecklistItem {
+   id: number;
+   title: string;
+   action_type: 'external' | 'internal' | 'none';
+   action_url: string | null;
+   action_label: string | null;
+   affiliate_partner: string;
+   checked: boolean;
+ }

+ function getSessionId(): string {
+   let sid = localStorage.getItem('ds_session');
+   if (!sid) {
+     sid = crypto.randomUUID();
+     localStorage.setItem('ds_session', sid);
+   }
+   return sid;
+ }

  export default function Planner() {
+   const navigate = useNavigate();
+   const [items, setItems] = useState<ChecklistItem[]>([]);
+   const sessionId = getSessionId();

+   useEffect(() => {
+     fetch(`/api/planner/checklist/danang-basic?session_id=${sessionId}`)
+       .then(r => r.json())
+       .then(data => setItems(data.items));
+   }, []);

+   const handleAction = (item: ChecklistItem) => {
+     if (item.action_type === 'external' && item.action_url) {
+       if (item.affiliate_partner !== 'none') {
+         fetch('/api/affiliate/click', {
+           method: 'POST',
+           headers: { 'Content-Type': 'application/json' },
+           body: JSON.stringify({
+             session_id: sessionId,
+             partner: item.affiliate_partner,
+             target_type: 'checklist_item',
+             target_id: item.id,
+           }),
+         });
+       }
+       window.open(item.action_url, '_blank', 'noopener');
+     } else if (item.action_type === 'internal' && item.action_url) {
+       navigate(item.action_url);
+     }
+   };

+   const handleToggle = (itemId: number, checked: boolean) => {
+     setItems(prev => prev.map(i => i.id === itemId ? {...i, checked} : i));
+     fetch('/api/planner/progress', {
+       method: 'POST',
+       headers: { 'Content-Type': 'application/json' },
+       body: JSON.stringify({ session_id: sessionId, item_id: itemId, checked }),
+     });
+   };
  }
```

## UI 요구사항 (Lovable에게 전달)
- 항목 우측 액션 버튼: external은 `<ExternalLink>`, internal은 `<ArrowRight>`, none은 없음
- 체크박스와 액션 버튼은 **독립 동작**
- 어필리에이트 항목은 "제휴" 배지 (법적 고지)

## 수익화 💰
1. Agoda/Skyscanner 딥링크 클릭 수수료
2. `affiliate_clicks` 데이터로 상위 전환 항목 파악 → UI 강조
3. 단기: 다낭 템플릿 1개, 중기: 치앙마이/발리 확장

## DoD
- [ ] `/api/planner/checklist/danang-basic` 응답 200
- [ ] 체크 토글 DB 반영
- [ ] external 클릭 시 새탭 + affiliate_clicks row 추가
- [ ] internal 클릭 시 `/compare?district=my-khe` 이동
- [ ] Vitest 3개 이상 통과
