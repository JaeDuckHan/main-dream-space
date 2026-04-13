import { query } from "../db.js";
import { MemoryCache } from "../utils/memory-cache.js";

export interface ResidentsCountData {
  active_count: number;
  new_this_week: number;
  updated_at: string;
}

const RESIDENTS_TTL_MS = 5 * 60 * 1000;

async function fetchResidentsCount(): Promise<ResidentsCountData> {
  const rows = await query<{ active_count: string; new_this_week: string }>(
    `SELECT
       COUNT(*) FILTER (
         WHERE is_public = TRUE
           AND stay_from <= CURRENT_DATE
           AND (stay_to IS NULL OR stay_to >= CURRENT_DATE)
       )::text AS active_count,
       COUNT(*) FILTER (
         WHERE is_public = TRUE
           AND created_at >= NOW() - INTERVAL '7 days'
       )::text AS new_this_week
     FROM residents`,
  );

  const row = rows[0];

  return {
    active_count: Number(row?.active_count ?? 0),
    new_this_week: Number(row?.new_this_week ?? 0),
    updated_at: new Date().toISOString(),
  };
}

export const residentsCountCache = new MemoryCache<ResidentsCountData>(
  RESIDENTS_TTL_MS,
  fetchResidentsCount,
  "residents-count",
);
