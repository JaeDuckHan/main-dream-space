import { Router, Request, Response } from 'express';
import pool from '../db'; // 서버 기존 Postgres pool 재사용

const router = Router();

// GET /api/insight?page=1&category=날씨&limit=9
router.get('/', async (req: Request, res: Response) => {
  const page     = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit    = Math.min(20, Math.max(1, parseInt(req.query.limit as string) || 9));
  const offset   = (page - 1) * limit;
  const category = (req.query.category as string) || '';

  try {
    const where  = category ? 'WHERE category = $1' : '';
    const cParam = category ? [category] : [];

    const { rows: [{ total }] } = await pool.query(
      `SELECT COUNT(*)::int AS total FROM news_articles ${where}`,
      cParam
    );

    const listParams = category
      ? [category, limit, offset]
      : [limit, offset];
    const listWhere = category ? 'WHERE category = $1' : '';
    const limitIdx  = category ? '$2' : '$1';
    const offsetIdx = category ? '$3' : '$2';

    const { rows } = await pool.query(
      `SELECT id, slug, title, summary, category, image_url, source_name, source_url, published_at
       FROM news_articles ${listWhere}
       ORDER BY published_at DESC
       LIMIT ${limitIdx} OFFSET ${offsetIdx}`,
      listParams
    );

    res.json({ total, page, limit, articles: rows });
  } catch (e) {
    console.error('뉴스 목록 오류:', e);
    res.status(500).json({ message: '서버 오류' });
  }
});

// GET /api/insight/:slug
router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM news_articles WHERE slug = $1 LIMIT 1`,
      [req.params.slug]
    );
    if (!rows.length) return res.status(404).json({ message: '기사를 찾을 수 없습니다.' });
    res.json(rows[0]);
  } catch (e) {
    console.error('뉴스 상세 오류:', e);
    res.status(500).json({ message: '서버 오류' });
  }
});

export default router;
