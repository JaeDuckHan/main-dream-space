import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAdmin } from "../lib/auth.js";

const router = Router();

router.post("/posts/:id/pin", requireAdmin, async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    const { is_pinned } = z.object({ is_pinned: z.boolean().optional().default(true) }).parse(req.body ?? {});
    await query(
      `UPDATE community_posts
       SET is_pinned = $2
       WHERE id = $1`,
      [id, is_pinned],
    );
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.delete("/posts/:id", requireAdmin, async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    await query(
      `UPDATE community_posts
       SET is_deleted = TRUE,
           deleted_at = NOW()
       WHERE id = $1`,
      [id],
    );
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get("/reports", requireAdmin, async (_req, res, next) => {
  try {
    const reports = await query<Record<string, unknown>>(
      `SELECT
         r.*,
         COALESCE(u.display_name, split_part(u.email, '@', 1)) AS reporter_display_name
       FROM community_reports r
       JOIN users u ON u.id = r.reporter_id
       ORDER BY r.created_at DESC`,
    );
    res.json({ reports });
  } catch (error) {
    next(error);
  }
});

router.patch("/reports/:id/resolve", requireAdmin, async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    const { status } = z.object({ status: z.enum(["resolved", "dismissed"]).default("resolved") }).parse(req.body ?? {});
    await query(
      `UPDATE community_reports
       SET status = $2,
           resolved_by = $3,
           resolved_at = NOW()
       WHERE id = $1`,
      [id, status, req.authUser!.id],
    );
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
