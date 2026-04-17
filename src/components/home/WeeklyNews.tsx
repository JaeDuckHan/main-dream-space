import news from "@/data/weekly-news.json";

type WeeklyNewsItem = {
  id: string;
  date: string;
  tag: string;
  title: string;
  summary: string;
  source: string;
};

export function WeeklyNews() {
  return (
    <section className="bg-background py-16">
      <div className="container">
        <div className="mb-8 flex items-center justify-between gap-4">
          <h2 className="text-[28px] font-[800] text-foreground md:text-[32px]">이번 주 변경사항</h2>
          <span className="text-sm text-muted-foreground">수동 업데이트 · 주 1회</span>
        </div>
        <div className="space-y-4">
          {(news as WeeklyNewsItem[]).map((item) => (
            <article key={item.id} className="rounded-xl border border-border bg-card p-5">
              <div className="mb-2 flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{item.date}</span>
                <span className="rounded-full bg-accent px-2 py-0.5 font-medium text-accent-foreground">{item.tag}</span>
              </div>
              <h3 className="text-lg font-bold text-foreground">{item.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.summary}</p>
              <p className="mt-2 text-xs text-muted-foreground">출처: {item.source}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
