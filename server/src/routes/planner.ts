import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import type { ChecklistItemRow, ChecklistTemplate } from "../types.js";

const router = Router();

function injectAffiliate(url: string | null) {
  if (!url) return null;
  return url.replace("{AFFILIATE_ID}", process.env.AGODA_AFFILIATE_ID || "");
}

router.get("/checklist/:slug", async (req, res) => {
  const params = z.object({
    slug: z.string().min(1),
    session_id: z.string().max(64).optional(),
  }).parse({
    slug: req.params.slug,
    session_id: req.query.session_id,
  });

  const templates = await query<ChecklistTemplate>(
    "SELECT id, slug, title, description FROM checklist_templates WHERE slug = $1 LIMIT 1",
    [params.slug],
  );

  const template = templates[0];
  if (!template) {
    return res.status(404).json({ error: "Checklist template not found" });
  }

  const items = await query<ChecklistItemRow>(
    `SELECT
       ci.id,
       ci.title,
       ci.description,
       ci.sort_order,
       ci.action_type,
       ci.action_url,
       ci.action_label,
       ci.affiliate_partner,
       ci.icon,
       COALESCE(cp.checked, false) AS checked
     FROM checklist_items ci
     LEFT JOIN checklist_progress cp
       ON cp.item_id = ci.id
      AND cp.session_id = COALESCE($2, '')
     WHERE ci.template_id = $1
     ORDER BY ci.sort_order ASC, ci.id ASC`,
    [template.id, params.session_id ?? null],
  );

  return res.json({
    template,
    items: items.map((item) => ({
      ...item,
      checked: Boolean(item.checked),
      action_url: injectAffiliate(item.action_url),
    })),
  });
});

router.post("/progress", async (req, res) => {
  const body = z.object({
    session_id: z.string().min(1).max(64),
    item_id: z.number().int().positive(),
    checked: z.boolean(),
  }).parse(req.body);

  await query(
    `INSERT INTO checklist_progress (session_id, item_id, checked, checked_at)
     VALUES ($1, $2, $3, CASE WHEN $3 THEN NOW() ELSE NULL END)
     ON CONFLICT (session_id, item_id)
     DO UPDATE SET
       checked = EXCLUDED.checked,
       checked_at = CASE WHEN EXCLUDED.checked THEN NOW() ELSE NULL END`,
    [body.session_id, body.item_id, body.checked],
  );

  return res.json({ ok: true });
});

export default router;
