import { useEffect, useState } from "react";

type StatsSummary = {
  residents: number;
  listings: number;
  newUsersThisWeek: number;
};

export function TrustIndicators() {
  const [stats, setStats] = useState<StatsSummary | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/stats/summary", { signal: controller.signal })
      .then((response) => response.json() as Promise<StatsSummary>)
      .then((payload) => {
        if (!controller.signal.aborted) {
          setStats(payload);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setStats(null);
        }
      });

    return () => controller.abort();
  }, []);

  if (!stats) {
    return null;
  }

  if (stats.residents === 0 && stats.listings === 0 && stats.newUsersThisWeek === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap justify-center gap-6 text-white/90">
      {stats.residents > 0 ? (
        <div>
          <span className="text-2xl font-bold">{stats.residents}</span>
          <span className="ml-1 text-sm">명 공개 체류자</span>
        </div>
      ) : null}
      {stats.listings > 0 ? (
        <div>
          <span className="text-2xl font-bold">{stats.listings}</span>
          <span className="ml-1 text-sm">개 검증 업체</span>
        </div>
      ) : null}
      {stats.newUsersThisWeek > 0 ? (
        <div>
          <span className="text-2xl font-bold">+{stats.newUsersThisWeek}</span>
          <span className="ml-1 text-sm">명 이번 주 가입</span>
        </div>
      ) : null}
    </div>
  );
}
