import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db';
import { requireAuth, requireAdmin } from '../lib/auth';

const router = Router();

// ── 목록 GET /api/insight ─────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  const page     = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit    = Math.min(20, Math.max(1, parseInt(req.query.limit as string) || 9));
  const offset   = (page - 1) * limit;
  const category = (req.query.category as string) || '';

  try {
    const where  = category ? 'WHERE category = $1' : '';
    const cParam = category ? [category] : [];

    const { rows: [{ total }] } = await pool.query(
      `SELECT COUNT(*)::int AS total FROM news_articles ${where}`, cParam
    );

    const listParams = category ? [category, limit, offset] : [limit, offset];
    const listWhere  = category ? 'WHERE category = $1' : '';
    const L = category ? '$2' : '$1';
    const O = category ? '$3' : '$2';

    const { rows } = await pool.query(
      `SELECT id, slug, title, summary, category, image_url, source_name, source_url, published_at
       FROM news_articles ${listWhere}
       ORDER BY published_at DESC LIMIT ${L} OFFSET ${O}`,
      listParams
    );

    res.json({ total, page, limit, articles: rows });
  } catch (e) {
    console.error('뉴스 목록 오류:', e);
    res.status(500).json({ message: '서버 오류' });
  }
});

// ── 관리자 작성 POST /api/insight ─────────────────────────────────────────
const articleSchema = z.object({
  title:        z.string().min(1).max(500),
  summary:      z.string().max(2000).optional(),
  content:      z.string().min(1),
  category:     z.string().default('기타'),
  image_url:    z.string().url().optional().nullable(),
  image_credit: z.string().max(500).optional().nullable(),
  source_name:  z.string().max(200).optional().nullable(),
  source_url:   z.string().url().optional().nullable(),
  publish_slot: z.enum(['morning', 'afternoon']).default('morning'),
});

router.post('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = articleSchema.parse(req.body);
    const slug = `${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${
      data.title.replace(/[^\w가-힣\s]/g,'').trim().slice(0,30).replace(/\s+/g,'-')
    }-${Math.random().toString(36).slice(2,6)}`;

    const { rows } = await pool.query(
      `INSERT INTO news_articles
         (title, summary, content, category, image_url, image_credit,
          source_name, source_url, slug, publish_slot, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
       RETURNING *`,
      [data.title, data.summary ?? null, data.content, data.category,
       data.image_url ?? null, data.image_credit ?? null,
       data.source_name ?? null, data.source_url ?? null, slug, data.publish_slot]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0].message });
    console.error('기사 작성 오류:', e);
    res.status(500).json({ message: '서버 오류' });
  }
});

// ── 상세 GET /api/insight/:slug ───────────────────────────────────────────
router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM news_articles WHERE slug = $1 LIMIT 1`, [req.params.slug]
    );
    if (!rows.length) return res.status(404).json({ message: '기사를 찾을 수 없습니다.' });
    res.json(rows[0]);
  } catch (e) {
    console.error('뉴스 상세 오류:', e);
    res.status(500).json({ message: '서버 오류' });
  }
});

// ── 관리자 수정 PATCH /api/insight/:slug ──────────────────────────────────
router.patch('/:slug', requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = articleSchema.partial().parse(req.body);
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    for (const [k, v] of Object.entries(data)) {
      sets.push(`${k} = $${i++}`);
      vals.push(v);
    }
    if (!sets.length) return res.status(400).json({ message: '수정할 내용이 없습니다.' });
    vals.push(req.params.slug);

    const { rows } = await pool.query(
      `UPDATE news_articles SET ${sets.join(', ')} WHERE slug = $${i} RETURNING *`, vals
    );
    if (!rows.length) return res.status(404).json({ message: '기사를 찾을 수 없습니다.' });
    res.json(rows[0]);
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0].message });
    console.error('기사 수정 오류:', e);
    res.status(500).json({ message: '서버 오류' });
  }
});

// ── 관리자 삭제 DELETE /api/insight/:slug ────────────────────────────────
router.delete('/:slug', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM news_articles WHERE slug = $1`, [req.params.slug]
    );
    if (!rowCount) return res.status(404).json({ message: '기사를 찾을 수 없습니다.' });
    res.json({ message: '삭제됐습니다.' });
  } catch (e) {
    console.error('기사 삭제 오류:', e);
    res.status(500).json({ message: '서버 오류' });
  }
});

// ── 댓글 목록 GET /api/insight/:slug/comments ─────────────────────────────
router.get('/:slug/comments', async (req: Request, res: Response) => {
  try {
    const { rows: [article] } = await pool.query(
      `SELECT id FROM news_articles WHERE slug = $1`, [req.params.slug]
    );
    if (!article) return res.status(404).json({ message: '기사를 찾을 수 없습니다.' });

    const { rows } = await pool.query(
      `SELECT c.id, c.content, c.created_at,
              u.id AS user_id, u.display_name, u.avatar_url
       FROM news_comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.article_id = $1
       ORDER BY c.created_at ASC`,
      [article.id]
    );
    res.json(rows);
  } catch (e) {
    console.error('댓글 목록 오류:', e);
    res.status(500).json({ message: '서버 오류' });
  }
});

// ── 댓글 작성 POST /api/insight/:slug/comments ───────────────────────────
router.post('/:slug/comments', requireAuth, async (req: Request, res: Response) => {
  const contentSchema = z.object({ content: z.string().min(1).max(1000) });
  try {
    const { content } = contentSchema.parse(req.body);
    const { rows: [article] } = await pool.query(
      `SELECT id FROM news_articles WHERE slug = $1`, [req.params.slug]
    );
    if (!article) return res.status(404).json({ message: '기사를 찾을 수 없습니다.' });

    const { rows } = await pool.query(
      `INSERT INTO news_comments (article_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, content, created_at`,
      [article.id, req.authUser!.id, content]
    );

    res.status(201).json({
      ...rows[0],
      user_id:      req.authUser!.id,
      display_name: req.authUser!.display_name,
      avatar_url:   req.authUser!.avatar_url,
    });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0].message });
    console.error('댓글 작성 오류:', e);
    res.status(500).json({ message: '서버 오류' });
  }
});

// ── 댓글 삭제 DELETE /api/insight/comments/:id ───────────────────────────
router.delete('/comments/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const commentId = parseInt(req.params.id);
    const { rows: [comment] } = await pool.query(
      `SELECT user_id FROM news_comments WHERE id = $1`, [commentId]
    );
    if (!comment) return res.status(404).json({ message: '댓글을 찾을 수 없습니다.' });

    const isOwner = comment.user_id === req.authUser!.id;
    const isAdmin = req.authUser!.role === 'admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ message: '권한이 없습니다.' });

    await pool.query(`DELETE FROM news_comments WHERE id = $1`, [commentId]);
    res.json({ message: '삭제됐습니다.' });
  } catch (e) {
    console.error('댓글 삭제 오류:', e);
    res.status(500).json({ message: '서버 오류' });
  }
});

export default router;
