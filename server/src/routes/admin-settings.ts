import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAdmin } from "../lib/auth.js";

const router = Router();

const ALLOWED_KEYS = new Set([
  "bank_name", "bank_account", "bank_holder", "bank_notice",
  "company_name", "company_ceo", "company_biz_no", "company_email", "company_address",
]);

router.put("/", requireAdmin, async (req, res, next) => {
  try {
    const body = z.record(z.string(), z.string()).parse(req.body);
    const entries = Object.entries(body).filter(([k]) => ALLOWED_KEYS.has(k));
    if (entries.length === 0) return res.json({ ok: true });

    for (const [key, value] of entries) {
      await query(
        `INSERT INTO site_settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, value],
      );
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
