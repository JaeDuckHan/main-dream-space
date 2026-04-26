require('dotenv').config();
const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_ID = process.env.NOTION_DB_ID;

// Notion 텍스트 추출 헬퍼
function extractText(prop) {
  if (!prop) return '';
  if (prop.type === 'title') return prop.title.map(t => t.plain_text).join('');
  if (prop.type === 'rich_text') return prop.rich_text.map(t => t.plain_text).join('');
  if (prop.type === 'select') return prop.select?.name || '';
  if (prop.type === 'url') return prop.url || '';
  if (prop.type === 'date') return prop.date?.start || '';
  return '';
}

// 페이지 본문 블록을 마크다운 스타일 텍스트로 변환
async function getPageContent(pageId) {
  const blocks = [];
  let cursor;
  do {
    const res = await notion.blocks.children.list({ block_id: pageId, start_cursor: cursor, page_size: 100 });
    blocks.push(...res.results);
    cursor = res.next_cursor;
  } while (cursor);

  return blocks.map(b => {
    const rt = b[b.type]?.rich_text;
    if (!rt) return '';
    return rt.map(t => t.plain_text).join('');
  }).filter(Boolean).join('\n\n');
}

// 주어진 status로 DB 쿼리
async function queryByStatus(status) {
  const pages = [];
  let cursor;
  do {
    const res = await notion.databases.query({
      database_id: DB_ID,
      filter: { property: 'Status', select: { equals: status } },
      start_cursor: cursor,
      page_size: 100,
    });
    pages.push(...res.results);
    cursor = res.next_cursor;
  } while (cursor);
  return pages;
}

// source_url 중복 체크
async function existsBySourceUrl(sourceUrl) {
  const res = await notion.databases.query({
    database_id: DB_ID,
    filter: { property: 'Source URL', url: { equals: sourceUrl } },
    page_size: 1,
  });
  return res.results.length > 0;
}

// RAW 페이지 생성
async function createRaw({ title, originalTitle, sourceUrl, sourceName, imageUrl, imageCredit, rawContent, category }) {
  return notion.pages.create({
    parent: { database_id: DB_ID },
    properties: {
      'Title': { title: [{ text: { content: title || originalTitle } }] },
      'Status': { select: { name: 'RAW' } },
      'Original Title': { rich_text: [{ text: { content: originalTitle || '' } }] },
      'Source URL': { url: sourceUrl || null },
      'Source Name': { rich_text: [{ text: { content: sourceName || '' } }] },
      'Image URL': { url: imageUrl || null },
      'Image Credit': { rich_text: [{ text: { content: imageCredit || '' } }] },
      'Category': { select: { name: category || '기타' } },
    },
    children: rawContent ? [{
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: [{ text: { content: rawContent.slice(0, 2000) } }] },
    }] : [],
  });
}

// 페이지 속성 + 상태 업데이트
async function updatePage(pageId, props) {
  return notion.pages.update({ page_id: pageId, properties: props });
}

// 페이지 본문 전체 교체
async function setPageContent(pageId, text) {
  // 기존 블록 삭제
  const res = await notion.blocks.children.list({ block_id: pageId, page_size: 100 });
  for (const b of res.results) {
    await notion.blocks.delete({ block_id: b.id });
  }
  // 2000자 단위로 나눠 삽입
  const chunks = [];
  for (let i = 0; i < text.length; i += 1900) chunks.push(text.slice(i, i + 1900));
  await notion.blocks.children.append({
    block_id: pageId,
    children: chunks.map(chunk => ({
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: [{ text: { content: chunk } }] },
    })),
  });
}

module.exports = { extractText, getPageContent, queryByStatus, existsBySourceUrl, createRaw, updatePage, setPageContent };
