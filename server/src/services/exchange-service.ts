import { MemoryCache } from "../utils/memory-cache.js";

export interface ExchangeData {
  krw_to_vnd: number;
  vnd_to_krw: number;
  usd_to_krw: number;
  updated_at: string;
}

const EXCHANGE_TTL_MS = 24 * 60 * 60 * 1000;
const EXCHANGE_TIMEOUT_MS = 5_000;
const apiKey = process.env.EXCHANGE_RATE_API_KEY;

interface OpenErApiResponse {
  result?: string;
  rates?: Record<string, number>;
  time_last_update_utc?: string;
}

interface ExchangeRateApiResponse {
  result?: string;
  conversion_rates?: Record<string, number>;
  time_last_update_utc?: string;
}

function roundRate(value: number) {
  return Number(value.toFixed(4));
}

async function fetchExchangeFromOpenErApi(signal: AbortSignal): Promise<ExchangeData> {
  const response = await fetch("https://open.er-api.com/v6/latest/KRW", { signal });

  if (!response.ok) {
    throw new Error(`open.er-api.com returned ${response.status}`);
  }

  const data = (await response.json()) as OpenErApiResponse;
  if (data.result !== "success") {
    throw new Error("open.er-api.com result not success");
  }

  const vnd = data.rates?.VND;
  const usd = data.rates?.USD;

  if (!vnd || !usd) {
    throw new Error("open.er-api.com missing VND or USD rate");
  }

  return {
    krw_to_vnd: roundRate(vnd),
    vnd_to_krw: roundRate(1 / vnd),
    usd_to_krw: roundRate(1 / usd),
    updated_at: data.time_last_update_utc
      ? new Date(data.time_last_update_utc).toISOString()
      : new Date().toISOString(),
  };
}

async function fetchExchangeFromExchangeRateApi(signal: AbortSignal): Promise<ExchangeData> {
  if (!apiKey) {
    throw new Error("EXCHANGE_RATE_API_KEY not set");
  }

  const response = await fetch(`https://v6.exchangerate-api.com/v6/${apiKey}/latest/KRW`, { signal });

  if (!response.ok) {
    throw new Error(`ExchangeRate-API returned ${response.status}`);
  }

  const data = (await response.json()) as ExchangeRateApiResponse;
  if (data.result !== "success") {
    throw new Error("ExchangeRate-API result not success");
  }

  const vnd = data.conversion_rates?.VND;
  const usd = data.conversion_rates?.USD;

  if (!vnd || !usd) {
    throw new Error("ExchangeRate-API missing VND or USD rate");
  }

  return {
    krw_to_vnd: roundRate(vnd),
    vnd_to_krw: roundRate(1 / vnd),
    usd_to_krw: roundRate(1 / usd),
    updated_at: data.time_last_update_utc
      ? new Date(data.time_last_update_utc).toISOString()
      : new Date().toISOString(),
  };
}

async function fetchExchange(): Promise<ExchangeData> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EXCHANGE_TIMEOUT_MS);

  try {
    if (apiKey) {
      try {
        return await fetchExchangeFromExchangeRateApi(controller.signal);
      } catch (error) {
        console.warn("[exchange] ExchangeRate-API failed, falling back to open.er-api.com", error);
      }
    }

    return await fetchExchangeFromOpenErApi(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

export const exchangeCache = new MemoryCache<ExchangeData>(EXCHANGE_TTL_MS, fetchExchange, "exchange");
