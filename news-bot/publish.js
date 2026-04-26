/**
 * publish.js — Notion APPROVED → PostgreSQL → PUBLISHED
 * npm run publish:morning   (권장: 매일 09:00 KST = UTC 00:00)
 * npm run publish:afternoon (권장: 매일 15:00 KST = UTC 06:00)
 */
require('dotenv').config();
const { Pool } = require('pg');
const { queryByStatus, getPageContent, extractText, updatePage } = require('./notion');

const SLOT = process.argv[2]; // 'morning' | 'afternoon'
if (!['morning', 'afternoon'].includes(SLOT)) {
  console.error('사용법: node publish.js [morning|afternoon]');
  process.exit(1);
}
const MAX_PER_SLOT = 2;

const db = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'dreamspace',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'dreamspace',
});

function makeSlug(title) {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const safe = title
    .replace(/[^\w가-힣\s]/g, '')
    .trim()
    .slice(0, 30)
    .replace(/\s+/g, '-');
  const rand = Math.random().toString(36).slice(2, 6);
  return `${dateStr}-${safe}-${rand}`;
}

function buildSourceFooter(sourceName, sourceUrl, imageCredit) {
  const lines = ['\n\n---\n참고/출처'];
  if (sourceName) lines.push(`원문: ${sourceName}`);
  if (imageCredit && imageCredit !== sourceName) lines.push(`이미지: ${imageCredit}`);
  if (sourceUrl) lines.push(`URL: ${sourceUrl}`);
  return lines.join('\n');
}

async function run() {
  console.log(`📦 [${SLOT}] 슬롯 발행 시작`);

  const pages = await queryByStatus('APPROVED');
  console.log(`📋 APPROVED ${pages.length}건 중 최대 ${MAX_PER_SLOT}건 처리`);

  const targets = pages.slice(0, MAX_PER_SLOT);
  let done = 0;

  for (const page of targets) {
    const props = page.properties;
    const title = extractText(props['Title']);
    const summary = extractText(props['Summary']);
    const category = extractText(props['Category']) || '기타';
    const imageUrl = extractText(props['Image URL']);
    const imageCredit = extractText(props['Image Credit']);
    const sourceName = extractText(props['Source Name']);
    const sourceUrl = extractText(props['Source URL']);

    if (!title) {
      console.log('  ⏭ 제목 없음 → 건너뜀');
      continue;
    }

    let content;
    try {
      content = await getPageContent(page.id);
    } catch (e) {
      console.error(`  ❌ 본문 조회 실패: ${e.message}`);
      continue;
    }

    content += buildSourceFooter(sourceName, sourceUrl, imageCredit);

    const slug = makeSlug(title);
    const publishedAt = new Date();

    try {
      await db.query(
        `INSERT INTO news_articles
           (notion_id, title, summary, content, category, image_url, image_credit,
            source_name, source_url, slug, publish_slot, published_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (notion_id) DO UPDATE SET
           title        = EXCLUDED.title,
           summary      = EXCLUDED.summary,
           content      = EXCLUDED.content,
           publish_slot = EXCLUDED.publish_slot,
           published_at = EXCLUDED.published_at`,
        [page.id, title, summary, content, category,
         imageUrl || null, imageCredit || null,
         sourceName || null, sourceUrl || null,
         slug, SLOT, publishedAt]
      );

      await updatePage(page.id, { 'Status': { select: { name: 'PUBLISHED' } } });

      done++;
      console.log(`  ✅ 발행: ${title}`);
    } catch (e) {
      console.error(`  ❌ DB/Notion 오류: ${e.message}`);
    }
  }

  await db.end();
  console.log(`\n📊 완료 — ${done}건 발행`);
}

run().catch(async e => {
  console.error('치명적 오류:', e);
  await db.end();
  process.exit(1);
});
