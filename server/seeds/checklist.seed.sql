INSERT INTO checklist_templates (slug, title, description)
VALUES ('danang-basic', '다낭 여행 준비 체크리스트', '출발 전 꼭 해야 할 일들')
ON CONFLICT (slug) DO UPDATE
SET title = EXCLUDED.title,
    description = EXCLUDED.description;

TRUNCATE TABLE checklist_progress, checklist_items RESTART IDENTITY CASCADE;

INSERT INTO checklist_items
  (id, template_id, sort_order, title, description, action_type, action_url, action_label, affiliate_partner, icon)
SELECT
  v.id,
  t.id,
  v.sort_order,
  v.title,
  v.description,
  v.action_type::action_type_enum,
  v.action_url,
  v.action_label,
  v.partner::affiliate_partner_enum,
  v.icon
FROM checklist_templates t
CROSS JOIN (
  VALUES
    (1, 1, '항공권 예약', '다낭 항공편 가격을 먼저 확인하세요.', 'external', 'https://www.skyscanner.co.kr/transport/flights/sel/dad/', '검색하기', 'skyscanner', 'plane'),
    (2, 2, '숙소 정하기', '미케비치 우선으로 가격대를 비교해보세요.', 'internal', '/compare?district=My%20Khe', '비교하기', 'none', 'hotel'),
    (3, 3, '다낭 숙소 예약 (Agoda)', 'Agoda 제휴 링크로 예약 페이지를 엽니다.', 'external', 'https://www.agoda.com/city/da-nang-vn.html?cid={AFFILIATE_ID}', '예약하기', 'agoda', 'bed'),
    (4, 4, '공항 픽업 업체 보기', '디렉터리에서 공항 픽업 업체를 확인하세요.', 'internal', '/directory', '보러가기', 'none', 'car'),
    (5, 5, '여행자 보험 가입', '출국 전 보험 보장 범위를 체크하세요.', 'none', NULL, NULL, 'none', 'shield'),
    (6, 6, '환전/트래블월렛 준비', '현금과 카드 사용 계획을 미리 정리하세요.', 'none', NULL, NULL, 'none', 'wallet'),
    (7, 7, '유심/로밍 준비', '현지 통신 수단을 출국 전에 준비하세요.', 'none', NULL, NULL, 'none', 'smartphone')
) AS v(id, sort_order, title, description, action_type, action_url, action_label, partner, icon)
WHERE t.slug = 'danang-basic';

SELECT setval('checklist_items_id_seq', 7, true);
