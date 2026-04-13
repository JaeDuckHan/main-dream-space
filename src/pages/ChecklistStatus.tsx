import Navbar from "@/components/Navbar";

const sections = [
  {
    title: "OAuth / 인증",
    items: [
      "메인 Navbar 로그인 버튼 노출 확인",
      "/login 페이지 3개 버튼 디자인 확인",
      "카카오 로그인 성공 확인",
      "구글 로그인 성공 확인",
      "네이버 로그인 성공 확인",
      "로그인 후 아바타/프로필 노출 확인",
      "로그아웃 후 로그인 버튼 복귀 확인",
      "동일 이메일 user_id 통합 확인",
    ],
  },
  {
    title: "Business Directory",
    items: [
      "/business/register 3-step wizard 동작",
      "카테고리 5개 폼 렌더링 확인",
      "Google Map URL → place_id 추출 확인",
      "등록 후 dashboard pending 상태 확인",
      "관리자 승인 후 approved 노출 확인",
      "반려 사유 입력 및 dashboard 반영 확인",
    ],
  },
  {
    title: "Community",
    items: [
      "/community 목록 실데이터 렌더 확인",
      "이미지 업로드 후 본문 편집 계속 가능",
      "상세 페이지 본문 이미지 렌더 확인",
      "/coffee-chats 화면/API 확인",
      "/residents, /residents/me 동작 확인",
      "resident avatar 업로드 확인",
    ],
  },
  {
    title: "API / 운영",
    items: [
      "/api/health 200 확인",
      "/api/accommodations 호환성 유지 확인",
      "/api/planner/checklist 7개 항목 확인",
      "/api/community/* 404 없음 확인",
      "PM2 dreamspace-api online 확인",
      "업로드 경로 /uploads/ 정적 서빙 확인",
    ],
  },
];

export default function ChecklistStatus() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-10 md:px-6">
        <div className="mb-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-primary">QA Checklist</p>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Lucky Danang 작업 체크리스트</h1>
          <p className="mt-3 text-muted-foreground">
            현재 반영된 기능들의 최종 검증용 페이지입니다. 실제 확인이 끝난 항목부터 체크해서 운영 마감 기준으로 사용하면 됩니다.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {sections.map((section) => (
            <section key={section.title} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-xl font-semibold">{section.title}</h2>
              <ul className="space-y-3">
                {section.items.map((item) => (
                  <li key={item} className="flex items-start gap-3 rounded-xl border border-dashed border-border/80 px-4 py-3">
                    <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-primary" />
                    <span className="text-sm leading-6 text-foreground/90">{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
