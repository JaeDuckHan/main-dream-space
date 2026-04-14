/**
 * Notion → Community Posts Import Script
 *
 * 사용법:
 *   node scripts/notion-import.mjs [--dry-run] [--author-id 1]
 *
 * 필수 환경변수 (.env):
 *   NOTION_TOKEN        Notion Integration Token
 *   NOTION_DATABASE_ID  Notion 데이터베이스 ID
 *   DATABASE_URL        PostgreSQL 연결 문자열
 *
 * 선택 환경변수:
 *   NOTION_AUTHOR_ID    게시글 작성자 user.id (기본값: 1)
 *
 * Notion 데이터베이스 속성 구조:
 *   - Title     (title)   게시글 제목
 *   - Category  (select)  notice | question | review | info
 *   - Status    (select)  Draft | Ready | Published
 *   - 페이지 본문          게시글 내용 (마크다운으로 변환됨)
 */

import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { Client } from "pg";
import { Client as NotionClient } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";
import { marked } from "marked";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "..");
config({ path: path.join(serverRoot, ".env") });

// ── CLI 인수 파싱 ──────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const authorIdArg = (() => {
  const idx = args.indexOf("--author-id");
  return idx >= 0 ? Number(args[idx + 1]) : null;
})();

// ── 환경변수 검증 ─────────────────────────────────────────────
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;
const DATABASE_URL = process.env.DATABASE_URL;
const AUTHOR_ID = authorIdArg ?? Number(process.env.NOTION_AUTHOR_ID ?? "1");

if (!NOTION_TOKEN) { console.error("❌  NOTION_TOKEN 이 설정되지 않았습니다."); process.exit(1); }
if (!NOTION_DATABASE_ID) { console.error("❌  NOTION_DATABASE_ID 가 설정되지 않았습니다."); process.exit(1); }
if (!DATABASE_URL) { console.error("❌  DATABASE_URL 이 설정되지 않았습니다."); process.exit(1); }

const VALID_CATEGORIES = ["notice", "question", "review", "info"];

// ── Notion 클라이언트 초기화 ─────────────────────────────────
const notion = new NotionClient({ auth: NOTION_TOKEN });
const n2m = new NotionToMarkdown({ notionClient: notion });

// ── 마크다운 → HTML 변환 (서버와 동일 방식) ──────────────────
function renderHtml(markdown) {
  return marked.parse(markdown);
}

// ── Notion 페이지에서 필드 추출 ───────────────────────────────
function extractTitle(page) {
  const titleProp = page.properties?.Title ?? page.properties?.이름;
  if (!titleProp || titleProp.type !== "title") return null;
  return titleProp.title.map((t) => t.plain_text).join("").trim() || null;
}

function extractCategory(page) {
  const catProp = page.properties?.Category ?? page.properties?.카테고리;
  if (!catProp || catProp.type !== "select") return null;
  return catProp.select?.name?.toLowerCase() ?? null;
}

function extractStatus(page) {
  const statusProp = page.properties?.Status ?? page.properties?.상태;
  if (!statusProp || statusProp.type !== "select") return null;
  return statusProp.select?.name ?? null;
}

// ── Notion 페이지 본문 → 마크다운 변환 ───────────────────────
async function pageToMarkdown(pageId) {
  const mdBlocks = await n2m.pageToMarkdown(pageId);
  const result = n2m.toMarkdownString(mdBlocks);
  return (result.parent ?? "").trim();
}

// ── Notion 페이지 상태를 "Published" 로 업데이트 ─────────────
async function markAsPublished(pageId) {
  await notion.pages.update({
    page_id: pageId,
    properties: {
      Status: { select: { name: "Published" } },
      상태: { select: { name: "Published" } },
    },
  });
}

// ── Notion DB에서 "Ready" 상태 페이지 조회 ───────────────────
async function fetchReadyPages() {
  const pages = [];
  let cursor;

  do {
    const response = await notion.databases.query({
      database_id: NOTION_DATABASE_ID,
      filter: {
        or: [
          { property: "Status", select: { equals: "Ready" } },
          { property: "상태", select: { equals: "Ready" } },
        ],
      },
      start_cursor: cursor,
      page_size: 100,
    });

    pages.push(...response.results);
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);

  return pages;
}

// ── 메인 ─────────────────────────────────────────────────────
async function main() {
  console.log(`🔍  Notion DB에서 "Ready" 상태 게시글 조회 중...`);
  if (dryRun) console.log("⚠️   DRY RUN 모드 — DB에 실제로 저장하지 않습니다.\n");

  const pages = await fetchReadyPages();
  console.log(`📄  ${pages.length}개 페이지 발견\n`);

  if (pages.length === 0) {
    console.log("✅  임포트할 게시글이 없습니다.");
    return;
  }

  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();

  let imported = 0;
  let skipped = 0;

  for (const page of pages) {
    const pageId = page.id;
    const title = extractTitle(page);
    const category = extractCategory(page);
    const status = extractStatus(page);

    // 유효성 검사
    if (!title) {
      console.warn(`⏭️   [${pageId}] 제목 없음 — 스킵`);
      skipped++;
      continue;
    }
    if (!category || !VALID_CATEGORIES.includes(category)) {
      console.warn(`⏭️   "${title}" — 카테고리 오류 (값: ${category ?? "없음"}, 허용: ${VALID_CATEGORIES.join("/")}) — 스킵`);
      skipped++;
      continue;
    }
    if (status !== "Ready" && status !== "Ready") {
      skipped++;
      continue;
    }

    console.log(`📝  처리 중: "${title}" [${category}]`);

    // 본문 마크다운 변환
    const content = await pageToMarkdown(pageId);
    if (!content || content.length < 10) {
      console.warn(`⏭️   "${title}" — 본문이 너무 짧습니다 (최소 10자) — 스킵`);
      skipped++;
      continue;
    }

    const contentHtml = renderHtml(content);
    const isPinned = category === "notice";

    if (dryRun) {
      console.log(`   ✔  [DRY RUN] INSERT 대상: author_id=${AUTHOR_ID}, category=${category}, title="${title}", content 길이=${content.length}자`);
      imported++;
      continue;
    }

    try {
      await db.query(
        `INSERT INTO community_posts (author_id, category, title, content, content_html, is_pinned)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [AUTHOR_ID, category, title, content, contentHtml, isPinned],
      );

      await markAsPublished(pageId);
      console.log(`   ✅  저장 완료: "${title}"`);
      imported++;
    } catch (err) {
      console.error(`   ❌  "${title}" 저장 실패:`, err.message);
      skipped++;
    }
  }

  await db.end();

  console.log(`\n🎉  완료 — 저장: ${imported}개, 스킵: ${skipped}개`);
}

main().catch((err) => {
  console.error("❌  오류:", err.message);
  process.exit(1);
});
