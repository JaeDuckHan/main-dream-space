/**
 * publish.js — Notion APPROVED → MySQL → PUBLISHED
 * npm run publish:morning   (권장: 매일 09:00 KST)
 * npm run publish:afternoon (권장: 매일 15:00 KST)
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const { queryByStatus, getPageContent, extractText, updatePage } = require('./notion');

const SLOT = process.argv[2]; // 'morning' | 'afternoon'
if (!['morning', 'afternoon'].includes(SLOT)) {
  console.error('사용법: node publish.js [morning|afternoon]');
  process.exit(1);
}
const MAX_PER_SLOT = 2;

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'luckydanang',
  charset: 'utf8mb4',
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

    // 출처 자동 추가
    content += buildSourceFooter(sourceName, sourceUrl, imageCredit);

    const slug = makeSlug(title);
    const publishedAt = new Date();

    try {
      await db.execute(
        `INSERT INTO news_articles
          (notion_id, title, summary, content, category, image_url, image_credit,
           source_name, source_url, slug, publish_slot, published_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           title=VALUES(title), summary=VALUES(summary), content=VALUES(content),
           publish_slot=VALUES(publish_slot), published_at=VALUES(published_at)`,
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

run().catch(e => { console.error('치명적 오류:', e); db.end(); process.exit(1); });
