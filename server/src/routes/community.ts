import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { pool, query } from "../db.js";
import { requireAuth } from "../lib/auth.js";
import {
  communityCategorySchema,
  extractImageUrls,
  renderMarkdownHtml,
  reportReasonSchema,
  reportTargetSchema,
} from "../lib/community.js";
import { HttpError } from "../lib/http.js";
import { createRateLimit } from "../lib/rate-limit.js";
import { getAllowedUploadMimes, getUploadMaxSizeBytes, saveImage } from "../lib/upload.js";

const router = Router();

const listQuerySchema = z.object({
  category: communityCategorySchema.optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  sort: z.enum(["latest", "popular"]).optional().default("latest"),
});

const postSchema = z.object({
  category: communityCategorySchema,
  title: z.string().trim().min(3).max(300),
  content: z.string().trim().min(10).max(50000),
});

const commentSchema = z.object({
  content: z.string().trim().min(1).max(2000),
  parent_id: z.coerce.number().int().positive().nullable().optional(),
});

const reportSchema = z.object({
  target_type: reportTargetSchema,
  target_id: z.coerce.number().int().positive(),
  reason: reportReasonSchema,
  detail: z.string().trim().max(1000).optional().or(z.literal("")),
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: getUploadMaxSizeBytes() },
  fileFilter: (_req, file, cb) => {
    cb(null, getAllowedUploadMimes().includes(file.mimetype));
  },
});

const createPostMinuteLimit = createRateLimit({ key: "community:post:minute", windowMs: 60_000, max: 5 });
const createPostDayLimit = createRateLimit({ key: "community:post:day", windowMs: 86_400_000, max: 20 });
const createCommentMinuteLimit = createRateLimit({ key: "community:comment:minute", windowMs: 60_000, max: 10 });
const createCommentDayLimit = createRateLimit({ key: "community:comment:day", windowMs: 86_400_000, max: 100 });
const uploadMinuteLimit = createRateLimit({ key: "community:upload:minute", windowMs: 60_000, max: 10 });
const uploadDayLimit = createRateLimit({ key: "community:upload:day", windowMs: 86_400_000, max: 50 });
const likeLimit = createRateLimit({ key: "community:like:minute", windowMs: 60_000, max: 30 });

function buildPostOrder(sort: "latest" | "popular") {
  if (sort === "popular") {
    return "p.is_pinned DESC, p.like_count DESC, p.comment_count DESC, p.created_at DESC";
  }

  return "p.is_pinned DESC, p.created_at DESC";
}

async function getPostById(postId: number) {
  const rows = await query<{ id: number; author_id: number; is_deleted: boolean }>(
    `SELECT id, author_id, is_deleted
     FROM community_posts
     WHERE id = $1
     LIMIT 1`,
    [postId],
  );
  return rows[0] ?? null;
}

async function ensurePostWriter(userId: number, role: "user" | "admin", postId: number, allowAdminDelete = false) {
  const post = await getPostById(postId);
  if (!post || post.is_deleted) {
    throw new HttpError(404, "Post not found");
  }

  if (post.author_id !== userId && !(allowAdminDelete && role === "admin")) {
    throw new HttpError(403, "Forbidden");
  }

  return post;
}

async function ensureCommentWriter(userId: number, role: "user" | "admin", commentId: number, allowAdminDelete = false) {
  const rows = await query<{ id: number; author_id: number; post_id: number; is_deleted: boolean }>(
    `SELECT id, author_id, post_id, is_deleted
     FROM community_comments
     WHERE id = $1
     LIMIT 1`,
    [commentId],
  );
  const comment = rows[0];

  if (!comment) {
    throw new HttpError(404, "Comment not found");
  }

  if (comment.author_id !== userId && !(allowAdminDelete && role === "admin")) {
    throw new HttpError(403, "Forbidden");
  }

  return comment;
}

router.get("/posts", async (req, res, next) => {
  try {
    const filters = listQuerySchema.parse(req.query);
    const offset = (filters.page - 1) * filters.limit;
    const where = ["p.is_deleted = FALSE"];
    const params: unknown[] = [];

    if (filters.category) {
      params.push(filters.category);
      where.push(`p.category = $${params.length}`);
    }

    const whereSql = where.join(" AND ");
    const countRows = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM community_posts p
       WHERE ${whereSql}`,
      params,
    );

    params.push(filters.limit, offset);
    const posts = await query<Record<string, unknown>>(
      `SELECT
         p.id,
         p.category,
         p.title,
         p.view_count,
         p.like_count,
         p.comment_count,
         p.is_pinned,
         p.created_at,
         u.id AS author_id,
         COALESCE(u.display_name, split_part(u.email, '@', 1)) AS author_display_name,
         u.avatar_url AS author_avatar_url
       FROM community_posts p
       JOIN users u ON u.id = p.author_id
       WHERE ${whereSql}
       ORDER BY ${buildPostOrder(filters.sort)}
       LIMIT $${params.length - 1}
       OFFSET $${params.length}`,
      params,
    );

    const total = Number(countRows[0]?.count ?? 0);
    res.json({
      posts: posts.map((row) => ({
        id: row.id,
        category: row.category,
        title: row.title,
        view_count: row.view_count,
        like_count: row.like_count,
        comment_count: row.comment_count,
        is_pinned: row.is_pinned,
        created_at: row.created_at,
        author: {
          id: row.author_id,
          display_name: row.author_display_name,
          avatar_url: row.author_avatar_url,
        },
      })),
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        total_pages: Math.max(1, Math.ceil(total / filters.limit)),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/posts/:id", async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    await query(
      `UPDATE community_posts
       SET view_count = view_count + 1
       WHERE id = $1
         AND is_deleted = FALSE`,
      [id],
    );

    const rows = await query<Record<string, unknown>>(
      `SELECT
         p.id,
         p.category,
         p.title,
         p.content,
         p.content_html,
         p.view_count,
         p.like_count,
         p.comment_count,
         p.is_pinned,
         p.created_at,
         p.updated_at,
         u.id AS author_id,
         COALESCE(u.display_name, split_part(u.email, '@', 1)) AS author_display_name,
         u.avatar_url AS author_avatar_url,
         EXISTS (
           SELECT 1 FROM community_likes l
           WHERE l.target_type = 'post'
             AND l.target_id = p.id
             AND l.user_id = $2
         ) AS liked_by_me,
         EXISTS (
           SELECT 1 FROM community_bookmarks b
           WHERE b.post_id = p.id
             AND b.user_id = $2
         ) AS bookmarked_by_me
       FROM community_posts p
       JOIN users u ON u.id = p.author_id
       WHERE p.id = $1
         AND p.is_deleted = FALSE
       LIMIT 1`,
      [id, req.authUser?.id ?? 0],
    );

    const row = rows[0];
    if (!row) {
      throw new HttpError(404, "Post not found");
    }

    res.json({
      id: row.id,
      category: row.category,
      title: row.title,
      content: row.content,
      content_html: row.content_html,
      view_count: row.view_count,
      like_count: row.like_count,
      comment_count: row.comment_count,
      is_pinned: row.is_pinned,
      created_at: row.created_at,
      updated_at: row.updated_at,
      liked_by_me: Boolean(row.liked_by_me),
      bookmarked_by_me: Boolean(row.bookmarked_by_me),
      author: {
        id: row.author_id,
        display_name: row.author_display_name,
        avatar_url: row.author_avatar_url,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/posts/:id/comments", async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    const comments = await query<Record<string, unknown>>(
      `SELECT
         c.id,
         c.post_id,
         c.parent_id,
         c.content,
         c.is_deleted,
         c.created_at,
         c.updated_at,
         u.id AS author_id,
         COALESCE(u.display_name, split_part(u.email, '@', 1)) AS author_display_name,
         u.avatar_url AS author_avatar_url,
         COALESCE((
           SELECT COUNT(*)::int
           FROM community_likes l
           WHERE l.target_type = 'comment'
             AND l.target_id = c.id
         ), 0) AS like_count,
         EXISTS (
           SELECT 1 FROM community_likes l
           WHERE l.target_type = 'comment'
             AND l.target_id = c.id
             AND l.user_id = $2
         ) AS liked_by_me
       FROM community_comments c
       JOIN users u ON u.id = c.author_id
       WHERE c.post_id = $1
       ORDER BY c.created_at ASC`,
      [id, req.authUser?.id ?? 0],
    );

    res.json({
      comments: comments.map((row) => ({
        id: row.id,
        post_id: row.post_id,
        parent_id: row.parent_id,
        content: row.content,
        is_deleted: row.is_deleted,
        created_at: row.created_at,
        updated_at: row.updated_at,
        like_count: Number(row.like_count ?? 0),
        liked_by_me: Boolean(row.liked_by_me),
        author: {
          id: row.author_id,
          display_name: row.author_display_name,
          avatar_url: row.author_avatar_url,
        },
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/posts", requireAuth, createPostMinuteLimit, createPostDayLimit, async (req, res, next) => {
  const client = await pool.connect();

  try {
    const payload = postSchema.parse(req.body);
    if (payload.category === "notice" && req.authUser!.role !== "admin") {
      throw new HttpError(403, "공지 작성은 관리자만 가능합니다");
    }

    const contentHtml = renderMarkdownHtml(payload.content);
    const imageUrls = extractImageUrls(payload.content);

    await client.query("BEGIN");
    const inserted = await client.query<{ id: number; created_at: string }>(
      `INSERT INTO community_posts (author_id, category, title, content, content_html, is_pinned)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, created_at`,
      [req.authUser!.id, payload.category, payload.title, payload.content, contentHtml, payload.category === "notice"],
    );

    if (imageUrls.length > 0) {
      await client.query(
        `UPDATE community_images
         SET post_id = $1
         WHERE uploader_id = $2
           AND post_id IS NULL
           AND url = ANY($3::text[])`,
        [inserted.rows[0].id, req.authUser!.id, imageUrls],
      );
    }

    await client.query("COMMIT");
    res.status(201).json(inserted.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
});

router.patch("/posts/:id", requireAuth, async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    const payload = postSchema.parse(req.body);
    await ensurePostWriter(req.authUser!.id, req.authUser!.role, id, true);

    if (payload.category === "notice" && req.authUser!.role !== "admin") {
      throw new HttpError(403, "공지 작성은 관리자만 가능합니다");
    }

    const contentHtml = renderMarkdownHtml(payload.content);
    const imageUrls = extractImageUrls(payload.content);

    await client.query("BEGIN");
    const updated = await client.query<{ id: number }>(
      `UPDATE community_posts
       SET category = $2,
           title = $3,
           content = $4,
           content_html = $5,
           is_pinned = CASE WHEN $2 = 'notice' THEN is_pinned ELSE FALSE END
       WHERE id = $1
         AND is_deleted = FALSE
       RETURNING id`,
      [id, payload.category, payload.title, payload.content, contentHtml],
    );

    if (!updated.rows[0]) {
      throw new HttpError(404, "Post not found");
    }

    await client.query(
      `UPDATE community_images
       SET post_id = NULL
       WHERE post_id = $1`,
      [id],
    );

    if (imageUrls.length > 0) {
      await client.query(
        `UPDATE community_images
         SET post_id = $1
         WHERE uploader_id = $2
           AND url = ANY($3::text[])`,
        [id, req.authUser!.id, imageUrls],
      );
    }

    await client.query("COMMIT");
    res.json({ ok: true, id });
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
});

router.delete("/posts/:id", requireAuth, async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    await ensurePostWriter(req.authUser!.id, req.authUser!.role, id, true);
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

router.post("/posts/:id/comments", requireAuth, createCommentMinuteLimit, createCommentDayLimit, async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    const payload = commentSchema.parse(req.body);
    const post = await getPostById(id);

    if (!post || post.is_deleted) {
      throw new HttpError(404, "Post not found");
    }

    if (payload.parent_id) {
      const parents = await query<{ id: number; post_id: number; parent_id: number | null; is_deleted: boolean }>(
        `SELECT id, post_id, parent_id, is_deleted
         FROM community_comments
         WHERE id = $1
         LIMIT 1`,
        [payload.parent_id],
      );
      const parent = parents[0];
      if (!parent || parent.post_id !== id || parent.parent_id !== null || parent.is_deleted) {
        throw new HttpError(400, "Invalid parent comment");
      }
    }

    const inserted = await query<Record<string, unknown>>(
      `INSERT INTO community_comments (post_id, parent_id, author_id, content)
       VALUES ($1, $2, $3, $4)
       RETURNING id, post_id, parent_id, content, is_deleted, created_at, updated_at`,
      [id, payload.parent_id ?? null, req.authUser!.id, payload.content],
    );

    res.status(201).json({
      comment: {
        ...inserted[0],
        like_count: 0,
        liked_by_me: false,
        author: {
          id: req.authUser!.id,
          display_name: req.authUser!.display_name ?? req.authUser!.email.split("@")[0],
          avatar_url: req.authUser!.avatar_url,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/comments/:id", requireAuth, async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    const payload = z.object({ content: z.string().trim().min(1).max(2000) }).parse(req.body);
    await ensureCommentWriter(req.authUser!.id, req.authUser!.role, id, false);
    await query(
      `UPDATE community_comments
       SET content = $2
       WHERE id = $1
         AND author_id = $3
         AND is_deleted = FALSE`,
      [id, payload.content, req.authUser!.id],
    );
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.delete("/comments/:id", requireAuth, async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    await ensureCommentWriter(req.authUser!.id, req.authUser!.role, id, true);
    await query(
      `UPDATE community_comments
       SET is_deleted = TRUE,
           deleted_at = NOW(),
           content = ''
       WHERE id = $1`,
      [id],
    );
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post("/posts/:id/like", requireAuth, likeLimit, async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    const existing = await query<{ id: number }>(
      `SELECT id
       FROM community_likes
       WHERE user_id = $1
         AND target_type = 'post'
         AND target_id = $2
       LIMIT 1`,
      [req.authUser!.id, id],
    );

    const liked = existing.length === 0;
    if (liked) {
      await query(
        `INSERT INTO community_likes (user_id, target_type, target_id)
         VALUES ($1, 'post', $2)`,
        [req.authUser!.id, id],
      );
    } else {
      await query("DELETE FROM community_likes WHERE id = $1", [existing[0].id]);
    }

    const posts = await query<{ like_count: number }>("SELECT like_count FROM community_posts WHERE id = $1 LIMIT 1", [id]);
    res.json({ liked, like_count: posts[0]?.like_count ?? 0 });
  } catch (error) {
    next(error);
  }
});

router.post("/comments/:id/like", requireAuth, likeLimit, async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    const existing = await query<{ id: number }>(
      `SELECT id
       FROM community_likes
       WHERE user_id = $1
         AND target_type = 'comment'
         AND target_id = $2
       LIMIT 1`,
      [req.authUser!.id, id],
    );

    const liked = existing.length === 0;
    if (liked) {
      await query(
        `INSERT INTO community_likes (user_id, target_type, target_id)
         VALUES ($1, 'comment', $2)`,
        [req.authUser!.id, id],
      );
    } else {
      await query("DELETE FROM community_likes WHERE id = $1", [existing[0].id]);
    }

    const rows = await query<{ like_count: number }>(
      `SELECT COUNT(*)::int AS like_count
       FROM community_likes
       WHERE target_type = 'comment'
         AND target_id = $1`,
      [id],
    );
    res.json({ liked, like_count: rows[0]?.like_count ?? 0 });
  } catch (error) {
    next(error);
  }
});

router.post("/posts/:id/bookmark", requireAuth, async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    const existing = await query<{ id: number }>(
      `SELECT id
       FROM community_bookmarks
       WHERE user_id = $1
         AND post_id = $2
       LIMIT 1`,
      [req.authUser!.id, id],
    );

    const bookmarked = existing.length === 0;
    if (bookmarked) {
      await query(
        `INSERT INTO community_bookmarks (user_id, post_id)
         VALUES ($1, $2)`,
        [req.authUser!.id, id],
      );
    } else {
      await query("DELETE FROM community_bookmarks WHERE id = $1", [existing[0].id]);
    }

    res.json({ bookmarked });
  } catch (error) {
    next(error);
  }
});

router.post("/reports", requireAuth, async (req, res, next) => {
  try {
    const payload = reportSchema.parse(req.body);
    await query(
      `INSERT INTO community_reports (reporter_id, target_type, target_id, reason, detail)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.authUser!.id, payload.target_type, payload.target_id, payload.reason, payload.detail || null],
    );
    res.status(201).json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post("/upload", requireAuth, uploadMinuteLimit, uploadDayLimit, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new HttpError(400, "No file uploaded");
    }

    if (!getAllowedUploadMimes().includes(req.file.mimetype)) {
      throw new HttpError(400, "Unsupported file type");
    }

    const saved = await saveImage(req.file.buffer, "community");
    const rows = await query<{ id: number; url: string; width: number; height: number }>(
      `INSERT INTO community_images (uploader_id, url, relative_path, file_size_bytes, mime_type, width, height)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, url, width, height`,
      [req.authUser!.id, saved.url, saved.relativePath, saved.sizeBytes, saved.mimeType, saved.width, saved.height],
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    next(error);
  }
});

export default router;
