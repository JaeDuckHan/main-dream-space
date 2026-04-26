/**
 * repub.js — 발행된 기사를 DB에서 삭제하고 Notion 상태를 APPROVED로 리셋
 *
 * 사용법:
 *   node repub.js                  # 최근 10건 목록 확인
 *   node repub.js <slug>           # 해당 기사 리셋
 *   node repub.js <slug1> <slug2>  # 여러 건 동시 리셋
 *
 * 리셋 후: Notion에서 Image URL 등 수정 → npm run publish:morning|afternoon
 */
require('dotenv').config();
const { Pool } = require('pg');
const { updatePage } = require('./notion');

const db = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT) || 5432,
  user:     process.env.DB_USER     || 'dreamspace',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'dreamspace',
});

async function listRecent() {
  const { rows } = await db.query(
    `SELECT slug, title, published_at, notion_id
     FROM news_articles
     ORDER BY published_at DESC
     LIMIT 10`
  );
  if (!rows.length) { console.log('발행된 기사가 없습니다.'); return; }
  console.log('\n최근 발행 기사 (최대 10건):');
  console.log('─'.repeat(80));
  rows.forEach((r, i) => {
    const date = new Date(r.published_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    console.log(`${String(i + 1).padStart(2)}. [${date}]`);
    console.log(`    slug: ${r.slug}`);
    console.log(`    제목: ${r.title}`);
    console.log(`    notion_id: ${r.notion_id || '(없음)'}`);
    console.log();
  });
}

async function resetOne(slug) {
  const { rows } = await db.query(
    `SELECT id, title, notion_id FROM news_articles WHERE slug = $1`, [slug]
  );
  if (!rows.length) {
    console.error(`  ❌ 슬러그를 찾을 수 없음: ${slug}`);
    return false;
  }
  const { title, notion_id } = rows[0];
  console.log(`\n🔄 리셋 대상: "${title}"`);

  await db.query(`DELETE FROM news_articles WHERE slug = $1`, [slug]);
  console.log(`  ✅ DB 삭제 완료`);

  if (notion_id) {
    await updatePage(notion_id, { 'Status': { select: { name: 'APPROVED' } } });
    console.log(`  ✅ Notion 상태 → APPROVED`);
  } else {
    console.log(`  ⚠️  notion_id 없음 — Notion 상태는 수동으로 APPROVED로 변경하세요`);
  }
  return true;
}

async function run() {
  const slugs = process.argv.slice(2);

  if (!slugs.length) {
    await listRecent();
    console.log('리셋하려면: node repub.js <slug>');
    await db.end();
    return;
  }

  let ok = 0;
  for (const slug of slugs) {
    const success = await resetOne(slug);
    if (success) ok++;
  }

  await db.end();

  if (ok) {
    console.log(`\n✅ ${ok}건 리셋 완료`);
    console.log('→ Notion에서 Image URL 등 수정 후 아래 명령어로 재발행:');
    console.log('   npm run publish:morning   또는   npm run publish:afternoon');
  }
}

run().catch(async e => {
  console.error('오류:', e.message);
  await db.end();
  process.exit(1);
});
