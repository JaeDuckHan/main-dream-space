import { Pool, type QueryResultRow } from "pg";
import "dotenv/config";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

export async function query<T extends QueryResultRow>(text: string, params: unknown[] = []) {
  const result = await pool.query<T>(text, params);
  return result.rows;
}
