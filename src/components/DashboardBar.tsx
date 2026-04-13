import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { communityFetch } from "@/lib/community";

type WeatherIcon = "sunny" | "cloudy" | "rainy" | "stormy" | "foggy" | "snowy";

interface DashboardWeather {
  temp_c: number;
  icon: WeatherIcon;
  description: string;
  updated_at: string;
}

interface DashboardExchange {
  krw_to_vnd: number;
  vnd_to_krw: number;
  usd_to_krw: number;
  updated_at: string;
}

interface DashboardResidents {
  active_count: number;
  new_this_week: number;
  updated_at: string;
}

interface DashboardResponse {
  weather: DashboardWeather | null;
  exchange: DashboardExchange | null;
  residents: DashboardResidents | null;
}

const REFRESH_MS = 5 * 60 * 1000;

const WEATHER_EMOJI: Record<WeatherIcon, string> = {
  sunny: "☀️",
  cloudy: "☁️",
  rainy: "🌧️",
  stormy: "⛈️",
  foggy: "🌫️",
  snowy: "❄️",
};

export default function DashboardBar() {
  const [data, setData] = useState<DashboardResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await communityFetch<DashboardResponse>("/api/dashboard");
        if (!cancelled) {
          setData(response);
        }
      } catch {
        // Preserve last known frontend state on fetch failures.
      }
    };

    void load();
    const interval = window.setInterval(() => {
      void load();
    }, REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const items = useMemo(() => {
    if (!data) {
      return [];
    }

    const nextItems: Array<{ key: string; content: ReactNode }> = [];

    if (data.weather) {
      nextItems.push({
        key: "weather",
        content: (
          <>
            <span>{WEATHER_EMOJI[data.weather.icon]}</span>
            <span className="font-semibold">{data.weather.temp_c}°C</span>
            <span className="hidden text-muted-foreground sm:inline">{data.weather.description}</span>
          </>
        ),
      });
    }

    if (data.exchange) {
      nextItems.push({
        key: "exchange",
        content: (
          <>
            <span>💱</span>
            <span className="font-semibold">₩1 = {data.exchange.krw_to_vnd.toFixed(1)}동</span>
            <span className="hidden text-muted-foreground sm:inline">$1 = ₩{Math.round(data.exchange.usd_to_krw).toLocaleString()}</span>
          </>
        ),
      });
    }

    if (data.residents) {
      nextItems.push({
        key: "residents",
        content: (
          <>
            <span>📍</span>
            <span className="font-semibold">공개 체류자 {data.residents.active_count}명</span>
            <span className="hidden text-muted-foreground sm:inline">이번 주 신규 {data.residents.new_this_week}명</span>
          </>
        ),
      });
    }

    return nextItems;
  }, [data]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-border bg-muted/40">
      <div className="container flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 text-sm text-foreground">
        {items.map((item, index) => (
          <div key={item.key} className="flex items-center gap-2">
            {item.content}
            {index < items.length - 1 ? <span className="hidden text-muted-foreground sm:inline">·</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
