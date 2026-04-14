import { Router } from "express";
import { query } from "../db.js";
import { requireAdmin } from "../lib/auth.js";

const router = Router();

router.get("/", requireAdmin, async (_req, res, next) => {
  try {
    const [listingsRow, usersRow] = await Promise.all([
      query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM listings WHERE status = 'pending'`,
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM users`,
      ),
    ]);

    res.json({
      pending_listings: Number(listingsRow[0]?.count ?? 0),
      total_users: Number(usersRow[0]?.count ?? 0),
      monthly_orders: 0,
      pending_payments: 0,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
