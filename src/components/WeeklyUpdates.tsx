import news from "@/data/weekly-news.json";

interface UpdateItem {
  id: string;
  date: string;
  tag: string;
  title: string;
  summary: string;
  source: string;
}

const WeeklyUpdates = () => {
  return (
    <section className="py-20 bg-muted/50">
      <div className="container">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-[28px] md:text-[32px] font-[800] text-foreground">이번 주 변경사항</h2>
          <span className="text-[15px] text-muted-foreground">수동 업데이트 · 주 1회</span>
        </div>

        <div className="space-y-4">
          {(news as UpdateItem[]).map((item) => (
            <div
              key={item.id}
              className="flex bg-card rounded-xl border border-border overflow-hidden hover:shadow-sm transition-shadow"
            >
              <div className="w-1 shrink-0 bg-border" />
              <div className="p-5 flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[13px] text-muted-foreground font-number">{item.date}</span>
                  <span className="px-2 py-0.5 text-[13px] font-medium rounded-full bg-accent text-accent-foreground">
                    {item.tag}
                  </span>
                </div>
                <h3 className="text-[18px] font-bold text-foreground">{item.title}</h3>
                <p className="mt-1.5 text-[15px] text-muted-foreground leading-relaxed">
                  {item.summary}
                </p>
                <p className="mt-2 text-[13px] text-muted-foreground/70">출처: {item.source}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WeeklyUpdates;
