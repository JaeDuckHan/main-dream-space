/**
 * fix-content.js — 기사 본문 일괄 정리
 *
 * 적용 규칙:
 *   1. [사진 보기](url) 류 링크 제거
 *   2. [예약하기](url) 류 링크 제거
 *   3. 본문 인라인 이미지 ![](url) 전체 제거
 *   4. 빈 줄 연속 2줄 이상 → 1줄로 정리
 *
 * 사용법:
 *   node fix-content.js              # dry-run (변경 내용만 출력, DB 미수정)
 *   node fix-content.js --apply      # 실제 DB 반영
 *   node fix-content.js <slug>       # 특정 기사만 dry-run
 *   node fix-content.js <slug> --apply
 */
require('dotenv').config();
const { Pool } = require('pg');

const db = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT) || 5432,
  user:     process.env.DB_USER     || 'dreamspace',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'dreamspace',
});

const args    = process.argv.slice(2);
const APPLY   = args.includes('--apply');
const SLUG    = args.find(a => !a.startsWith('--')) || null;

function fixContent(raw) {
  let text = raw;

  // 1. 사진 관련 링크 제거: [🖼 사진 보기], [📸 사진], [사진보기] 등
  text = text.replace(/\[([^\]]*사진[^\]]*)\]\([^)]*\)/g, '');

  // 2. 예약 관련 링크 제거: [예약하기], [예약], [Book Now] 등
  text = text.replace(/\[([^\]]*(?:예약|book\s*now|reserve|booking)[^\]]*)\]\([^)]*\)/gi, '');

  // 3. 본문 인라인 이미지 제거: 단독 줄의 ![alt](url)
  text = text.replace(/^!\[[^\]]*\]\([^)]*\)\s*$/gm, '');

  // 4. 빈 줄 3개 이상 → 2개로
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

function diff(before, after) {
  const bLines = before.split('\n');
  const aLines = after.split('\n');
  const removed = bLines.filter(l => !aLines.includes(l) && l.trim());
  return removed;
}

async function run() {
  const where  = SLUG ? 'WHERE slug = $1' : '';
  const params = SLUG ? [SLUG] : [];

  const { rows } = await db.query(
    `SELECT id, slug, title, content FROM news_articles ${where} ORDER BY published_at DESC`,
    params
  );

  if (!rows.length) {
    console.log(SLUG ? `슬러그를 찾을 수 없음: ${SLUG}` : '기사가 없습니다.');
    await db.end(); return;
  }

  let changed = 0;

  for (const row of rows) {
    const fixed = fixContent(row.content);
    if (fixed === row.content.trim()) continue;

    changed++;
    const removed = diff(row.content, fixed);

    console.log(`\n${'─'.repeat(70)}`);
    console.log(`📰 ${row.title}`);
    console.log(`   slug: ${row.slug}`);
    console.log(`   제거될 줄 (${removed.length}개):`);
    removed.forEach(l => console.log(`     - ${l.trim().slice(0, 100)}`));

    if (APPLY) {
      await db.query(`UPDATE news_articles SET content = $1 WHERE id = $2`, [fixed, row.id]);
      console.log(`   ✅ 적용 완료`);
    }
  }

  await db.end();

  console.log(`\n${'═'.repeat(70)}`);
  if (changed === 0) {
    console.log('변경 대상 없음 — 모든 기사가 이미 정리된 상태입니다.');
  } else if (APPLY) {
    console.log(`✅ ${changed}건 수정 완료`);
  } else {
    console.log(`📋 ${changed}건 수정 대상 (dry-run — 실제 반영하려면 --apply 추가)`);
  }
}

run().catch(async e => {
  console.error('오류:', e.message);
  await db.end();
  process.exit(1);
});
