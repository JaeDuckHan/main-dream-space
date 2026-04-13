# main-dream-space / 플래너 개선 스프린트 스펙

## 📋 작업 순서

| 순서 | 파일 | 담당 | 병렬 가능 |
|---|---|---|---|
| 1 | `00-infrastructure.md` | Codex (서버) | - |
| 2 | `01-planner-checklist-actionable.md` | Codex (서버) + Lovable (UI) | 02와 동시 |
| 3 | `02-accommodation-compare.md` | Codex (서버) + Lovable (UI) | 01과 동시 |

**규칙**: 00은 반드시 선행. 01/02는 00 완료 후 병렬 진행 가능.

## 👥 역할 분담

| 담당 | 범위 |
|---|---|
| **Claude** | 스펙 작성 (이 문서들) |
| **Codex** | `server/` 전체, `src/pages/*.tsx` 로직 부분, `src/hooks/` |
| **Lovable** | `src/pages/*.tsx` UI 레이아웃, `src/components/` |

⚠️ Lovable 작업 시 Codex가 건드린 로직 훅/fetch 코드는 보존.

## 🔑 Jeff님이 직접 준비할 것

```
[ ] Agoda Partners 가입 (https://partners.agoda.com/)
[ ] Node.js 20 LTS 설치
[ ] PostgreSQL 16 설치 + dreamspace DB/사용자 생성
[ ] server/.env 파일 작성 (접속정보 + AGODA_AFFILIATE_ID)
[ ] (선택) 실제 다낭 숙소 이름/가격대 15건 → seeds 교체용
```

## 🎯 이번 스프린트 목표

1. 로컬 PostgreSQL 기반 API 서버 구축
2. Planner 체크리스트 → 액션형 (external/internal 혼합)
3. Compare 페이지 → 가격대 필터 + Agoda 어필리에이트 연동
4. 어필리에이트 클릭 추적 테이블로 수익 분석 기반 확보

## 💰 수익화 포인트

| 지점 | 파트너 | 예상 수수료 |
|---|---|---|
| Planner 항공권 링크 | Skyscanner | 클릭당 or 전환당 |
| Planner 숙소 예약 | Agoda | ~4-7% |
| Compare 카드 CTA | Agoda | ~4-7% |

## ⚠️ 법적 체크리스트

- [ ] "제휴 링크 포함" 고지 (한국 공정위 의무)
- [ ] `.env` → `.gitignore` 등록 (크리덴셜 보호)
- [ ] 세션 ID는 익명 uuid (개인정보 미수집)
