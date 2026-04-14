// server/src/routes/admin-users.ts
import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAdmin } from "../lib/auth.js";

const router = Router();

// 회원 목록
router.get("/", requireAdmin, async (req, res, next) => {
  try {
    const { search, role, status, page, limit } = z.object({
      search: z.string().optional(),
      role: z.enum(["user", "admin"]).optional(),
      status: z.enum(["active", "inactive"]).optional(),
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(100).default(20),
    }).parse(req.query);

    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (search) {
      params.push(`%${search}%`);
      const searchIdx = params.length;
      conditions.push(`(u.email ILIKE $${searchIdx} OR u.display_name ILIKE $${searchIdx})`);
    }
    if (role) {
      params.push(role);
      conditions.push(`u.role = $${params.length}`);
    }
    if (status === "active") {
      conditions.push(`u.is_active = TRUE`);
    } else if (status === "inactive") {
      conditions.push(`u.is_active = FALSE`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const [totalRows, items] = await Promise.all([
      query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM users u ${where}`,
        params,
      ),
      query<Record<string, unknown>>(
        `SELECT
           u.id,
           u.email,
           u.display_name,
           u.avatar_url,
           u.role,
           u.is_active,
           u.created_at,
           u.last_login_at,
           COALESCE(
             json_agg(DISTINCT oa.provider) FILTER (WHERE oa.provider IS NOT NULL),
             '[]'
           ) AS providers
         FROM users u
         LEFT JOIN user_oauth_accounts oa ON oa.user_id = u.id
         ${where}
         GROUP BY u.id
         ORDER BY u.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      ),
    ]);

    res.json({ total: Number(totalRows[0]?.count ?? 0), items });
  } catch (error) {
    next(error);
  }
});

// 회원 상세 (글 + 업체 + 주문 목록 포함)
router.get("/:id", requireAdmin, async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);

    const userRows = await query<Record<string, unknown>>(
      `SELECT
         u.id, u.email, u.display_name, u.avatar_url, u.role,
         u.is_active, u.created_at, u.last_login_at,
         COALESCE(
           json_agg(DISTINCT oa.provider) FILTER (WHERE oa.provider IS NOT NULL),
           '[]'
         ) AS providers
       FROM users u
       LEFT JOIN user_oauth_accounts oa ON oa.user_id = u.id
       WHERE u.id = $1
       GROUP BY u.id`,
      [id],
    );

    if (!userRows[0]) {
      return res.status(404).json({ error: "User not found" });
    }

    const [posts, listings] = await Promise.all([
      query<Record<string, unknown>>(
        `SELECT id, title, created_at FROM community_posts WHERE author_id = $1 ORDER BY created_at DESC LIMIT 20`,
        [id],
      ),
      query<Record<string, unknown>>(
        `SELECT id, name, name_ko, category, status, created_at FROM listings WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 20`,
        [id],
      ),
    ]);

    res.json({ ...userRows[0], posts, listings, orders: [] });
  } catch (error) {
    next(error);
  }
});

// 역할 변경
router.patch("/:id/role", requireAdmin, async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    const { role } = z.object({ role: z.enum(["user", "admin"]) }).parse(req.body);

    // 본인 역할을 낮추는 것 방지
    if (req.authUser!.id === id && role === "user") {
      return res.status(400).json({ error: "자기 자신의 관리자 권한을 해제할 수 없습니다." });
    }

    await query(`UPDATE users SET role = $1 WHERE id = $2`, [role, id]);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// 활성/비활성 토글
router.patch("/:id/status", requireAdmin, async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    const { active } = z.object({ active: z.boolean() }).parse(req.body);

    if (req.authUser!.id === id && !active) {
      return res.status(400).json({ error: "자기 자신의 계정을 비활성화할 수 없습니다." });
    }

    await query(`UPDATE users SET is_active = $1 WHERE id = $2`, [active, id]);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
