import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";

const router = Router();

router.post("/click", async (req, res) => {
  const body = z.object({
    session_id: z.string().min(1).max(64),
    partner: z.enum(["agoda", "booking", "tripcom", "skyscanner"]),
    target_type: z.enum(["checklist_item", "accommodation"]),
    target_id: z.number().int().positive(),
  }).parse(req.body);

  await query(
    `INSERT INTO affiliate_clicks (session_id, partner, target_type, target_id, referrer, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      body.session_id,
      body.partner,
      body.target_type,
      body.target_id,
      req.get("referer") ?? null,
      req.get("user-agent") ?? null,
    ],
  );

  return res.json({ ok: true });
});

export default router;
