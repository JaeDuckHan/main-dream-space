import { Router } from "express";
import { z } from "zod";
import { pool, query } from "../db.js";
import { coffeeChatStatusSchema, stayTypeSchema } from "../lib/community.js";
import { requireAuth } from "../lib/auth.js";
import { HttpError } from "../lib/http.js";

const router = Router();

const coffeeChatSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  meetup_at: z.string().datetime(),
  duration_minutes: z.coerce.number().int().min(30).max(480).optional().default(120),
  location_name: z.string().trim().max(200).optional().or(z.literal("")),
  location_detail: z.string().trim().max(2000).optional().or(z.literal("")),
  location_map_url: z.string().url().max(500).optional().or(z.literal("")),
  max_participants: z.coerce.number().int().min(2).max(50).optional().default(10),
  target_groups: z.array(stayTypeSchema).max(4).optional().default([]),
  age_range: z.string().trim().max(20).optional().or(z.literal("")),
  status: coffeeChatStatusSchema.optional().default("open"),
});

const listSchema = z.object({
  status: coffeeChatStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(20).optional().default(20),
});

router.get("/", async (req, res, next) => {
  try {
    const filters = listSchema.parse(req.query);
    const where = [];
    const params: unknown[] = [];

    if (filters.status) {
      params.push(filters.status);
      where.push(`c.status = $${params.length}`);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    params.push(filters.limit);
    const chats = await query<Record<string, unknown>>(
      `SELECT
         c.id,
         c.organizer_id,
         c.title,
         c.description,
         c.meetup_at,
         c.duration_minutes,
         c.location_name,
         c.location_map_url,
         c.max_participants,
         c.current_participants,
         c.status,
         c.target_groups,
         c.age_range,
         c.created_at,
         c.updated_at,
         COALESCE(u.display_name, split_part(u.email, '@', 1)) AS organizer_display_name,
         EXISTS (
           SELECT 1 FROM coffee_chat_participants p
           WHERE p.chat_id = c.id
             AND p.user_id = $${params.length + 1}
             AND p.status = 'confirmed'
         ) AS joined_by_me
       FROM coffee_chats c
       JOIN users u ON u.id = c.organizer_id
       ${whereSql}
       ORDER BY c.meetup_at ASC
       LIMIT $${params.length}`,
      [...params, req.authUser?.id ?? 0],
    );
    res.json({ chats });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    const chats = await query<Record<string, unknown>>(
      `SELECT
         c.*,
         COALESCE(u.display_name, split_part(u.email, '@', 1)) AS organizer_display_name,
         EXISTS (
           SELECT 1 FROM coffee_chat_participants p
           WHERE p.chat_id = c.id
             AND p.user_id = $2
             AND p.status = 'confirmed'
         ) AS joined_by_me
       FROM coffee_chats c
       JOIN users u ON u.id = c.organizer_id
       WHERE c.id = $1
       LIMIT 1`,
      [id, req.authUser?.id ?? 0],
    );
    const chat = chats[0];
    if (!chat) {
      throw new HttpError(404, "Coffee chat not found");
    }

    const canSeeLocationDetail =
      req.authUser?.role === "admin" ||
      req.authUser?.id === chat.organizer_id ||
      Boolean(chat.joined_by_me);

    const participants = await query<Record<string, unknown>>(
      `SELECT
         p.user_id,
         p.status,
         p.joined_at,
         COALESCE(u.display_name, split_part(u.email, '@', 1)) AS display_name
       FROM coffee_chat_participants p
       JOIN users u ON u.id = p.user_id
       WHERE p.chat_id = $1
         AND p.status = 'confirmed'
       ORDER BY p.joined_at ASC`,
      [id],
    );

    res.json({
      ...chat,
      location_detail: canSeeLocationDetail ? chat.location_detail : null,
      participants,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  const client = await pool.connect();

  try {
    const payload = coffeeChatSchema.parse(req.body);
    await client.query("BEGIN");
    const inserted = await client.query<{ id: number }>(
      `INSERT INTO coffee_chats (
         organizer_id, title, description, meetup_at, duration_minutes,
         location_name, location_detail, location_map_url,
         max_participants, current_participants, status, target_groups, age_range
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8,
         $9, 1, $10, $11::jsonb, $12
       )
       RETURNING id`,
      [
        req.authUser!.id,
        payload.title,
        payload.description || null,
        payload.meetup_at,
        payload.duration_minutes,
        payload.location_name || null,
        payload.location_detail || null,
        payload.location_map_url || null,
        payload.max_participants,
        payload.status,
        JSON.stringify(payload.target_groups),
        payload.age_range || null,
      ],
    );
    await client.query(
      `INSERT INTO coffee_chat_participants (chat_id, user_id, status)
       VALUES ($1, $2, 'confirmed')`,
      [inserted.rows[0].id, req.authUser!.id],
    );
    await client.query("COMMIT");
    res.status(201).json({ id: inserted.rows[0].id });
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
});

router.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    const payload = coffeeChatSchema.partial().parse(req.body);
    const chats = await query<{ organizer_id: number }>(
      "SELECT organizer_id FROM coffee_chats WHERE id = $1 LIMIT 1",
      [id],
    );
    const chat = chats[0];
    if (!chat) {
      throw new HttpError(404, "Coffee chat not found");
    }
    if (chat.organizer_id !== req.authUser!.id) {
      throw new HttpError(403, "Forbidden");
    }

    await query(
      `UPDATE coffee_chats
       SET title = COALESCE($2, title),
           description = COALESCE($3, description),
           meetup_at = COALESCE($4, meetup_at),
           duration_minutes = COALESCE($5, duration_minutes),
           location_name = COALESCE($6, location_name),
           location_detail = COALESCE($7, location_detail),
           location_map_url = COALESCE($8, location_map_url),
           max_participants = COALESCE($9, max_participants),
           status = COALESCE($10, status),
           target_groups = COALESCE($11::jsonb, target_groups),
           age_range = COALESCE($12, age_range)
       WHERE id = $1`,
      [
        id,
        payload.title ?? null,
        payload.description ?? null,
        payload.meetup_at ?? null,
        payload.duration_minutes ?? null,
        payload.location_name ?? null,
        payload.location_detail ?? null,
        payload.location_map_url ?? null,
        payload.max_participants ?? null,
        payload.status ?? null,
        payload.target_groups ? JSON.stringify(payload.target_groups) : null,
        payload.age_range ?? null,
      ],
    );
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/join", requireAuth, async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    await client.query("BEGIN");
    const chats = await client.query<{ max_participants: number; current_participants: number; status: string; organizer_id: number }>(
      `SELECT max_participants, current_participants, status, organizer_id
       FROM coffee_chats
       WHERE id = $1
       FOR UPDATE`,
      [id],
    );
    const chat = chats.rows[0];
    if (!chat) {
      throw new HttpError(404, "Coffee chat not found");
    }
    if (chat.status !== "open") {
      throw new HttpError(400, "Coffee chat is not open");
    }

    const existing = await client.query<{ status: string }>(
      `SELECT status
       FROM coffee_chat_participants
       WHERE chat_id = $1
         AND user_id = $2
       LIMIT 1`,
      [id, req.authUser!.id],
    );

    if (!existing.rows[0] && chat.current_participants >= chat.max_participants) {
      throw new HttpError(400, "Coffee chat is full");
    }

    if (!existing.rows[0]) {
      await client.query(
        `INSERT INTO coffee_chat_participants (chat_id, user_id, status)
         VALUES ($1, $2, 'confirmed')`,
        [id, req.authUser!.id],
      );
      await client.query(
        `UPDATE coffee_chats
         SET current_participants = current_participants + 1,
             status = CASE WHEN current_participants + 1 >= max_participants THEN 'full' ELSE status END
         WHERE id = $1`,
        [id],
      );
    } else if (existing.rows[0].status !== "confirmed") {
      if (chat.current_participants >= chat.max_participants) {
        throw new HttpError(400, "Coffee chat is full");
      }
      await client.query(
        `UPDATE coffee_chat_participants
         SET status = 'confirmed',
             joined_at = NOW()
         WHERE chat_id = $1
           AND user_id = $2`,
        [id, req.authUser!.id],
      );
      await client.query(
        `UPDATE coffee_chats
         SET current_participants = current_participants + 1,
             status = CASE WHEN current_participants + 1 >= max_participants THEN 'full' ELSE status END
         WHERE id = $1`,
        [id],
      );
    }

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
});

router.delete("/:id/join", requireAuth, async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    await client.query("BEGIN");
    const existing = await client.query<{ status: string }>(
      `SELECT status
       FROM coffee_chat_participants
       WHERE chat_id = $1
         AND user_id = $2
       FOR UPDATE`,
      [id, req.authUser!.id],
    );
    if (!existing.rows[0] || existing.rows[0].status !== "confirmed") {
      throw new HttpError(400, "You are not joined");
    }

    await client.query(
      `UPDATE coffee_chat_participants
       SET status = 'cancelled'
       WHERE chat_id = $1
         AND user_id = $2`,
      [id, req.authUser!.id],
    );
    await client.query(
      `UPDATE coffee_chats
       SET current_participants = GREATEST(1, current_participants - 1),
           status = CASE WHEN status = 'full' THEN 'open' ELSE status END
       WHERE id = $1`,
      [id],
    );
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
});

export default router;
