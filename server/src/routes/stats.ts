import { Router } from "express";
import { query } from "../db.js";

const router = Router();
const TTL_MS = 5 * 60 * 1000;

let cache: { at: number; data: { residents: number; listings: number; newUsersThisWeek: number } } | null = null;

router.get("/summary", async (_req, res) => {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return res.json(cache.data);
  }

  try {
    const [residentsRows, listingsRows, newUsersRows] = await Promise.all([
      query<{ count: string }>("SELECT COUNT(*)::text AS count FROM residents WHERE is_public = TRUE").catch(() => [{ count: "0" }]),
      query<{ count: string }>("SELECT COUNT(*)::text AS count FROM listings WHERE status = 'approved' AND is_active = TRUE").catch(() => [{ count: "0" }]),
      query<{ count: string }>("SELECT COUNT(*)::text AS count FROM users WHERE created_at > NOW() - INTERVAL '7 days'").catch(() => [{ count: "0" }]),
    ]);

    const data = {
      residents: Number(residentsRows[0]?.count ?? 0),
      listings: Number(listingsRows[0]?.count ?? 0),
      newUsersThisWeek: Number(newUsersRows[0]?.count ?? 0),
    };

    cache = { at: Date.now(), data };
    return res.json(data);
  } catch (error) {
    console.error("[stats] summary error", error);
    return res.json({ residents: 0, listings: 0, newUsersThisWeek: 0 });
  }
});

export default router;
