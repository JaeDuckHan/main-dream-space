import { MemoryCache } from "../utils/memory-cache.js";

export type WeatherIcon = "sunny" | "cloudy" | "rainy" | "stormy" | "foggy" | "snowy";

export interface WeatherData {
  temp_c: number;
  icon: WeatherIcon;
  description: string;
  updated_at: string;
}

const WEATHER_TTL_MS = 60 * 60 * 1000;
const WEATHER_TIMEOUT_MS = 5_000;
const lat = process.env.WEATHER_LAT || "16.0678";
const lon = process.env.WEATHER_LON || "108.2208";
const apiKey = process.env.OPENWEATHER_API_KEY;

function mapWeatherIcon(main: string): WeatherIcon {
  const iconMap: Record<string, WeatherIcon> = {
    Clear: "sunny",
    Clouds: "cloudy",
    Rain: "rainy",
    Drizzle: "rainy",
    Thunderstorm: "stormy",
    Mist: "foggy",
    Fog: "foggy",
    Haze: "foggy",
    Smoke: "foggy",
    Dust: "foggy",
    Sand: "foggy",
    Ash: "foggy",
    Snow: "snowy",
  };

  return iconMap[main] || "cloudy";
}

async function fetchWeather(): Promise<WeatherData> {
  if (!apiKey) {
    throw new Error("OPENWEATHER_API_KEY not set");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEATHER_TIMEOUT_MS);
  const url = new URL("https://api.openweathermap.org/data/2.5/weather");

  url.searchParams.set("lat", lat);
  url.searchParams.set("lon", lon);
  url.searchParams.set("appid", apiKey);
  url.searchParams.set("units", "metric");
  url.searchParams.set("lang", "kr");

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`OpenWeatherMap returned ${response.status}`);
    }

    const data = (await response.json()) as {
      main?: { temp?: number };
      weather?: Array<{ main?: string; description?: string }>;
    };

    return {
      temp_c: Math.round(data.main?.temp ?? 0),
      icon: mapWeatherIcon(data.weather?.[0]?.main || "Clouds"),
      description: data.weather?.[0]?.description || "",
      updated_at: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export const weatherCache = new MemoryCache<WeatherData>(WEATHER_TTL_MS, fetchWeather, "weather");
