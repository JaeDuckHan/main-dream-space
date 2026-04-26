/**
 * translate.js — Notion RAW → Claude 번역/재작성 → TRANSLATED
 *
 * OpenAI 불필요: 번역은 Claude(대화)로 처리.
 * 이 파일은 자동화가 필요할 때만 사용. 평소엔 Claude 대화에서 직접 요청.
 *
 * npm run translate  (선택 실행)
 */
require('dotenv').config();
const { queryByStatus, getPageContent, extractText, updatePage, setPageContent } = require('./notion');

// Claude API를 쓰려면 ANTHROPIC_API_KEY + @anthropic-ai/sdk 필요
// 현재는 수동 실행용 스캐폴드만 제공

async function run() {
  const pages = await queryByStatus('RAW');
  console.log(`📋 RAW 상태 ${pages.length}건`);
  console.log('💡 번역은 Claude 대화에서 직접 요청하거나, ANTHROPIC_API_KEY 설정 후 자동화하세요.');

  for (const page of pages) {
    const title = extractText(page.properties['Title']);
    const content = await getPageContent(page.id);
    console.log(`\n---\n제목: ${title}\n본문 미리보기: ${content.slice(0, 200)}...\nNotion ID: ${page.id}`);
  }
}

run().catch(e => { console.error('오류:', e); process.exit(1); });
