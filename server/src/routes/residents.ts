import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth } from "../lib/auth.js";
import { buildResidentActiveWhere, stayTypeSchema } from "../lib/community.js";
import { HttpError } from "../lib/http.js";
import {
  deleteImage,
  getAllowedUploadMimes,
  getUploadMaxSizeBytes,
  saveAvatar,
  uploadUrlToRelativePath,
} from "../lib/upload.js";

const router = Router();

const residentAreaSchema = z.string().trim().max(100).optional().nullable();
const residentAgeGroupSchema = z.string().trim().max(20).optional().nullable();
const residentBioSchema = z.string().trim().max(2000).optional().nullable();
const residentBioSummarySchema = z.string().trim().max(80).optional().nullable();
const residentInterestsSchema = z.array(z.string().trim().min(1).max(30)).max(5).optional().nullable();
const residentContactMethodSchema = z.enum(["coffee_chat", "post_only", "none"]).optional().nullable();

const residentCreateSchema = z.object({
  nickname: z.string().trim().min(2).max(50),
  age_group: residentAgeGroupSchema,
  stay_type: stayTypeSchema,
  area: residentAreaSchema,
  stay_from: z.string().date(),
  stay_to: z.string().date().optional().nullable(),
  bio: residentBioSchema,
  bio_summary: residentBioSummarySchema,
  interests: residentInterestsSchema,
  contact_method: residentContactMethodSchema,
  is_public: z.boolean().optional().default(true),
  use_custom_avatar: z.boolean().optional(),
});

const residentUpdateSchema = residentCreateSchema.partial();

const listQuerySchema = z.object({
  stay_type: stayTypeSchema.optional(),
  area: z.string().trim().max(100).optional(),
  age_group: z.string().trim().max(20).optional(),
  active: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((value) => value === true || value === "true"),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: getUploadMaxSizeBytes() },
  fileFilter: (_req, file, cb) => {
    cb(null, getAllowedUploadMimes().includes(file.mimetype));
  },
});

function normalizeNullableText(value: string | null | undefined) {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeInterests(value: string[] | null | undefined) {
  if (!value) return [];
  return value.map((entry) => entry.trim()).filter(Boolean);
}

async function getResidentByUserId(userId: number) {
  const rows = await query<Record<string, unknown>>(
    `SELECT
       r.*,
       CASE
         WHEN r.use_custom_avatar AND r.avatar_url IS NOT NULL THEN r.avatar_url
         ELSE u.avatar_url
       END AS display_avatar
     FROM residents r
     JOIN users u ON u.id = r.user_id
     WHERE r.user_id = $1
     LIMIT 1`,
    [userId],
  );
  return rows[0] ?? null;
}

router.get("/", async (req, res, next) => {
  try {
    const filters = listQuerySchema.parse(req.query);
    const where = [filters.active ? "is_active = TRUE" : "TRUE"];
    const params: unknown[] = [];

    if (filters.stay_type) {
      params.push(filters.stay_type);
      where.push(`stay_type = $${params.length}`);
    }

    if (filters.area) {
      params.push(filters.area);
      where.push(`area = $${params.length}`);
    }

    if (filters.age_group) {
      params.push(filters.age_group);
      where.push(`age_group = $${params.length}`);
    }

    const whereSql = where.join(" AND ");
    const countRows = await query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM residents_public
       WHERE ${whereSql}`,
      params,
    );

    const activeCountRows = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM residents_public
       WHERE is_active = TRUE`,
    );

    params.push(filters.limit, filters.offset);
    const residents = await query<Record<string, unknown>>(
      `SELECT
         id,
         nickname,
         age_group,
         stay_type,
         area,
         stay_from,
         stay_to,
         bio_summary,
         interests,
         display_avatar,
         is_active
       FROM residents_public
       WHERE ${whereSql}
       ORDER BY is_active DESC, created_at DESC
       LIMIT $${params.length - 1}
       OFFSET $${params.length}`,
      params,
    );

    res.json({
      total: Number(countRows[0]?.total ?? 0),
      active_count: Number(activeCountRows[0]?.count ?? 0),
      residents: residents.map((resident) => ({
        ...resident,
        interests: Array.isArray(resident.interests) ? resident.interests : [],
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/active-count", async (_req, res, next) => {
  try {
    const rows = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM residents_public
       WHERE is_active = TRUE`,
    );
    res.json({ count: Number(rows[0]?.count ?? 0) });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const resident = await getResidentByUserId(req.authUser!.id);
    if (!resident) {
      res.json({ resident: null });
      return;
    }

    res.json({
      resident: {
        ...resident,
        interests: Array.isArray(resident.interests) ? resident.interests : [],
        contact_method: resident.contact_method ?? "post_only",
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    const residents = await query<Record<string, unknown>>(
      `SELECT *
       FROM residents_public
       WHERE id = $1
       LIMIT 1`,
      [id],
    );
    const resident = residents[0];
    if (!resident) {
      throw new HttpError(404, "Resident profile not found");
    }

    await query(
      `INSERT INTO resident_profile_views (resident_id, viewer_user_id)
       VALUES ($1, $2)`,
      [id, req.authUser?.id ?? null],
    );

    const [postStats, commentStats, chatStats, recentPosts, recentCoffeeChats] = await Promise.all([
      query<{ post_count: string }>(
        `SELECT COUNT(*)::text AS post_count
         FROM community_posts
         WHERE author_id = $1
           AND is_deleted = FALSE`,
        [resident.user_id],
      ),
      query<{ comment_count: string }>(
        `SELECT COUNT(*)::text AS comment_count
         FROM community_comments
         WHERE author_id = $1
           AND is_deleted = FALSE`,
        [resident.user_id],
      ),
      query<{ coffee_chats_organized: string; coffee_chats_joined: string }>(
        `SELECT
           (SELECT COUNT(*)::text FROM coffee_chats WHERE organizer_id = $1) AS coffee_chats_organized,
           (SELECT COUNT(*)::text
            FROM coffee_chat_participants
            WHERE user_id = $1
              AND status = 'confirmed') AS coffee_chats_joined`,
        [resident.user_id],
      ),
      query<Record<string, unknown>>(
        `SELECT id, category, title, created_at
         FROM community_posts
         WHERE author_id = $1
           AND is_deleted = FALSE
         ORDER BY created_at DESC
         LIMIT 5`,
        [resident.user_id],
      ),
      query<Record<string, unknown>>(
        `SELECT
           c.id,
           c.title,
           c.meetup_at,
           c.status
         FROM coffee_chats c
         WHERE c.organizer_id = $1
            OR EXISTS (
              SELECT 1
              FROM coffee_chat_participants p
              WHERE p.chat_id = c.id
                AND p.user_id = $1
                AND p.status = 'confirmed'
            )
         ORDER BY c.meetup_at DESC
         LIMIT 3`,
        [resident.user_id],
      ),
    ]);

    res.json({
      resident: {
        ...resident,
        interests: Array.isArray(resident.interests) ? resident.interests : [],
        contact_method: resident.contact_method ?? "post_only",
      },
      stats: {
        post_count: Number(postStats[0]?.post_count ?? 0),
        comment_count: Number(commentStats[0]?.comment_count ?? 0),
        coffee_chats_organized: Number(chatStats[0]?.coffee_chats_organized ?? 0),
        coffee_chats_joined: Number(chatStats[0]?.coffee_chats_joined ?? 0),
      },
      recent_posts: recentPosts,
      recent_coffee_chats: recentCoffeeChats,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const payload = residentCreateSchema.parse(req.body);
    const existing = await query<{ id: number }>("SELECT id FROM residents WHERE user_id = $1 LIMIT 1", [req.authUser!.id]);
    if (existing[0]) {
      throw new HttpError(409, "Resident profile already exists");
    }

    const inserted = await query<Record<string, unknown>>(
      `INSERT INTO residents (
         user_id,
         nickname,
         age_group,
         stay_type,
         area,
         stay_from,
         stay_to,
         bio,
         bio_summary,
         contact_method,
         interests,
         is_public,
         use_custom_avatar
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13)
       RETURNING *`,
      [
        req.authUser!.id,
        payload.nickname,
        normalizeNullableText(payload.age_group),
        payload.stay_type,
        normalizeNullableText(payload.area),
        payload.stay_from,
        payload.stay_to || null,
        normalizeNullableText(payload.bio),
        normalizeNullableText(payload.bio_summary),
        payload.contact_method ?? "post_only",
        JSON.stringify(normalizeInterests(payload.interests)),
        payload.is_public,
        payload.use_custom_avatar ?? false,
      ],
    );
    res.status(201).json({ resident: inserted[0] });
  } catch (error) {
    next(error);
  }
});

router.patch("/me", requireAuth, async (req, res, next) => {
  try {
    const payload = residentUpdateSchema.parse(req.body);
    const existing = await query<{ id: number }>("SELECT id FROM residents WHERE user_id = $1 LIMIT 1", [req.authUser!.id]);
    if (!existing[0]) {
      throw new HttpError(404, "Resident profile not found");
    }

    const updates: string[] = [];
    const params: unknown[] = [req.authUser!.id];

    const pushUpdate = (column: string, value: unknown, cast?: string) => {
      params.push(value);
      updates.push(`${column} = $${params.length}${cast ? `::${cast}` : ""}`);
    };

    if (payload.nickname !== undefined) pushUpdate("nickname", payload.nickname);
    if (payload.age_group !== undefined) pushUpdate("age_group", normalizeNullableText(payload.age_group));
    if (payload.stay_type !== undefined) pushUpdate("stay_type", payload.stay_type);
    if (payload.area !== undefined) pushUpdate("area", normalizeNullableText(payload.area));
    if (payload.stay_from !== undefined) pushUpdate("stay_from", payload.stay_from);
    if (payload.stay_to !== undefined) pushUpdate("stay_to", payload.stay_to);
    if (payload.bio !== undefined) pushUpdate("bio", normalizeNullableText(payload.bio));
    if (payload.bio_summary !== undefined) pushUpdate("bio_summary", normalizeNullableText(payload.bio_summary));
    if (payload.contact_method !== undefined) pushUpdate("contact_method", payload.contact_method);
    if (payload.interests !== undefined) pushUpdate("interests", JSON.stringify(normalizeInterests(payload.interests)), "jsonb");
    if (payload.is_public !== undefined) pushUpdate("is_public", payload.is_public);
    if (payload.use_custom_avatar !== undefined) pushUpdate("use_custom_avatar", payload.use_custom_avatar);

    if (updates.length > 0) {
      await query(
        `UPDATE residents
         SET ${updates.join(", ")}
         WHERE user_id = $1`,
        params,
      );
    }

    const resident = await getResidentByUserId(req.authUser!.id);
    res.json({
      resident: {
        ...resident,
        interests: Array.isArray(resident?.interests) ? resident?.interests : [],
        contact_method: resident?.contact_method ?? "post_only",
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post("/me/avatar", requireAuth, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new HttpError(400, "No file uploaded");
    }

    const existing = await query<{ avatar_url: string | null; use_custom_avatar: boolean }>(
      `SELECT avatar_url, use_custom_avatar
       FROM residents
       WHERE user_id = $1
       LIMIT 1`,
      [req.authUser!.id],
    );
    if (!existing[0]) {
      throw new HttpError(404, "Resident profile not found");
    }

    const saved = await saveAvatar(req.file.buffer);
    const previousRelativePath = existing[0].use_custom_avatar ? uploadUrlToRelativePath(existing[0].avatar_url) : null;

    await query(
      `UPDATE residents
       SET avatar_url = $2,
           use_custom_avatar = TRUE
       WHERE user_id = $1`,
      [req.authUser!.id, saved.url],
    );

    if (previousRelativePath) {
      await deleteImage(previousRelativePath);
    }

    res.json({
      avatar_url: saved.url,
      use_custom_avatar: true,
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/me/avatar", requireAuth, async (req, res, next) => {
  try {
    const existing = await query<{ avatar_url: string | null; use_custom_avatar: boolean }>(
      `SELECT avatar_url, use_custom_avatar
       FROM residents
       WHERE user_id = $1
       LIMIT 1`,
      [req.authUser!.id],
    );
    if (!existing[0]) {
      throw new HttpError(404, "Resident profile not found");
    }

    const previousRelativePath = existing[0].use_custom_avatar ? uploadUrlToRelativePath(existing[0].avatar_url) : null;

    await query(
      `UPDATE residents
       SET avatar_url = NULL,
           use_custom_avatar = FALSE
       WHERE user_id = $1`,
      [req.authUser!.id],
    );

    if (previousRelativePath) {
      await deleteImage(previousRelativePath);
    }

    res.json({ avatar_url: null, use_custom_avatar: false });
  } catch (error) {
    next(error);
  }
});

router.delete("/me", requireAuth, async (req, res, next) => {
  try {
    await query(
      `UPDATE residents
       SET is_public = FALSE
       WHERE user_id = $1`,
      [req.authUser!.id],
    );
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
