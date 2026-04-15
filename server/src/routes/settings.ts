import { Router } from "express";
import { query } from "../db.js";

const router = Router();

const SETTING_KEYS = [
  "bank_name", "bank_account", "bank_holder", "bank_notice",
  "company_name", "company_ceo", "company_biz_no", "company_email", "company_address",
] as const;

router.get("/", async (_req, res, next) => {
  try {
    const rows = await query<{ key: string; value: string }>(
      `SELECT key, value FROM site_settings WHERE key = ANY($1)`,
      [SETTING_KEYS],
    );
    const result: Record<string, string> = {};
    for (const key of SETTING_KEYS) {
      result[key] = rows.find((r) => r.key === key)?.value ?? "";
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
