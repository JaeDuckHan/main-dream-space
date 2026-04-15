import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { query } from "../db.js";
import type { ChecklistItemRow, ChecklistTemplate } from "../types.js";

const planShareLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
});

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

// ── Plan Share ──────────────────────────────────────────────────────────────

// POST /api/planner/plans — 플랜 저장
router.post("/plans", planShareLimiter, async (req, res, next) => {
  try {
    const body = z.object({
      session_id: z.string().min(1).max(64),
      title: z.string().max(100).default(""),
      data: z.record(z.unknown()),
      is_public: z.boolean().default(false),
    }).parse(req.body);

    const userId = (req as any).authUser?.id ?? null;

    const rows = await query<{ id: string }>(
      `INSERT INTO planner_plans (user_id, session_id, title, data, is_public)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [userId, body.session_id, body.title, JSON.stringify(body.data), body.is_public],
    );

    res.json({ id: rows[0].id });
  } catch (error) {
    next(error);
  }
});

// GET /api/planner/plans/public — 공개 플랜 목록
router.get("/plans/public", async (req, res, next) => {
  try {
    const params = z.object({
      city: z.string().optional(),
      party: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    }).parse(req.query);

    let sql = `SELECT id, title, data, created_at FROM planner_plans WHERE is_public = true`;
    const values: unknown[] = [];

    if (params.city) {
      values.push(params.city);
      sql += ` AND data->>'city' = $${values.length}`;
    }
    if (params.party) {
      values.push(params.party);
      sql += ` AND data->>'party' = $${values.length}`;
    }

    values.push(params.limit);
    sql += ` ORDER BY created_at DESC LIMIT $${values.length}`;

    const rows = await query<{ id: string; title: string; data: Record<string, unknown>; created_at: string }>(sql, values);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/planner/plans/:id — 단일 플랜 조회 (공개만)
router.get("/plans/:id", async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const rows = await query<{ id: string; title: string; data: Record<string, unknown>; created_at: string }>(
      `SELECT id, title, data, created_at FROM planner_plans WHERE id = $1 AND is_public = true`,
      [id],
    );
    if (!rows[0]) return res.status(404).json({ error: "플랜을 찾을 수 없습니다." });
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

// POST /api/planner/plans/:id/reminders — 리마인더 이메일 등록
router.post("/plans/:id/reminders", async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { email } = z.object({ email: z.string().email() }).parse(req.body);

    const plans = await query<{ id: string; data: { startDate?: string } }>(
      `SELECT id, data FROM planner_plans WHERE id = $1`,
      [id],
    );
    if (!plans[0]) return res.status(404).json({ error: "플랜을 찾을 수 없습니다." });

    const startDate = plans[0].data.startDate;
    if (!startDate) return res.status(400).json({ error: "출발일이 설정되지 않았습니다." });

    const start = new Date(startDate);
    const remindDays = [30, 14, 7];
    const now = new Date();

    const inserts = remindDays
      .map(d => {
        const remindAt = new Date(start);
        remindAt.setDate(remindAt.getDate() - d);
        return remindAt > now ? remindAt : null;
      })
      .filter(Boolean);

    for (const remindAt of inserts) {
      await query(
        `INSERT INTO planner_reminders (plan_id, email, remind_at) VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [id, email, remindAt],
      );
    }

    res.json({ ok: true, scheduled: inserts.length });
  } catch (error) {
    next(error);
  }
});

export default router;


