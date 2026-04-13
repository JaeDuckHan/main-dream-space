import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAdmin } from "../lib/auth.js";
import { buildListingWhereClause, listingStatusSchema } from "../lib/listings.js";

const router = Router();

async function addReview(listingId: number, reviewerId: number, action: "approve" | "reject" | "request_changes", reason: string | null) {
  await query(
    `INSERT INTO listing_reviews (listing_id, reviewer_id, action, reason)
     VALUES ($1, $2, $3, $4)`,
    [listingId, reviewerId, action, reason],
  );
}

router.get("/pending", requireAdmin, async (_req, res, next) => {
  try {
    const items = await query<Record<string, unknown>>(
      `SELECT
         l.*,
         u.email AS owner_email
       FROM listings l
       LEFT JOIN users u ON u.id = l.owner_id
       WHERE l.status = 'pending'
       ORDER BY l.created_at ASC`,
    );
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

router.get("/all", requireAdmin, async (req, res, next) => {
  try {
    const status = z.union([listingStatusSchema, z.literal("all")]).optional().parse(req.query.status);
    const { whereSql, params } = buildListingWhereClause({
      status: status && status !== "all" ? status : undefined,
      includeArchived: true,
    });
    const items = await query<Record<string, unknown>>(
      `SELECT
         l.*,
         u.email AS owner_email
       FROM listings l
       LEFT JOIN users u ON u.id = l.owner_id
       WHERE ${whereSql}
       ORDER BY l.created_at DESC`,
      params,
    );
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/approve", requireAdmin, async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    await query(
      `UPDATE listings
       SET status = 'approved',
           rejection_reason = NULL,
           reviewed_by = $2,
           reviewed_at = NOW()
       WHERE id = $1`,
      [id, req.authUser!.id],
    );
    await addReview(id, req.authUser!.id, "approve", null);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/reject", requireAdmin, async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    const { reason } = z.object({ reason: z.string().min(1) }).parse(req.body);
    await query(
      `UPDATE listings
       SET status = 'rejected',
           rejection_reason = $2,
           reviewed_by = $3,
           reviewed_at = NOW()
       WHERE id = $1`,
      [id, reason, req.authUser!.id],
    );
    await addReview(id, req.authUser!.id, "reject", reason);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/request-changes", requireAdmin, async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    const { reason } = z.object({ reason: z.string().min(1) }).parse(req.body);
    await query(
      `UPDATE listings
       SET status = 'rejected',
           rejection_reason = $2,
           reviewed_by = $3,
           reviewed_at = NOW()
       WHERE id = $1`,
      [id, reason, req.authUser!.id],
    );
    await addReview(id, req.authUser!.id, "request_changes", reason);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
