/**
 * collect.js — RSS 뉴스 수집 → Notion RAW 저장
 * npm run collect  (권장: 매일 20:00 KST)
 */
require('dotenv').config();
const Parser = require('rss-parser');
const { createRaw, existsBySourceUrl } = require('./notion');

const parser = new Parser({ timeout: 15000, headers: { 'User-Agent': 'DreamSpace-NewsBot/1.0' } });

const SOURCES = [
  { url: 'https://e.vnexpress.net/rss/news.rss', name: 'VnExpress International', credit: 'VnExpress International' },
  { url: 'https://e.vnexpress.net/rss/travel.rss', name: 'VnExpress Travel', credit: 'VnExpress International' },
  { url: 'https://vietnamnews.vn/rss/home.rss', name: 'Vietnam News', credit: 'Vietnam News' },
];

const DA_NANG_KEYWORDS = ['da nang', 'danang', 'đà nẵng', 'han river', 'marble mountains', 'my khe', 'non nuoc'];
const TRAVEL_KEYWORDS  = ['vietnam travel', 'vietnam tourism', 'vietnam beach', 'resort', 'tourist', 'hoi an', 'central vietnam', 'long stay', 'digital nomad', 'expat'];

// Insight.tsx 카테고리 기준
function mapCategory(feedCategory = '', title = '') {
  const cat = (feedCategory + ' ' + title).toLowerCase();
  if (cat.includes('visa') || cat.includes('policy') || cat.includes('regulation') || cat.includes('law')) return '비자/정책';
  if (cat.includes('price') || cat.includes('cost') || cat.includes('living') || cat.includes('rent') || cat.includes('expense')) return '생활비/물가';
  if (cat.includes('weather') || cat.includes('rain') || cat.includes('typhoon') || cat.includes('season')) return '날씨/시기';
  if (cat.includes('traffic') || cat.includes('transport') || cat.includes('flight') || cat.includes('airport') || cat.includes('bus')) return '교통/이동';
  if (cat.includes('food') || cat.includes('restaurant') || cat.includes('cuisine') || cat.includes('eat') || cat.includes('cafe')) return '음식/맛집';
  return '한달살기 팁';
}

function isRelevant(item) {
  const text = ((item.title || '') + ' ' + (item.contentSnippet || '') + ' ' + (item.content || '')).toLowerCase();
  return DA_NANG_KEYWORDS.some(k => text.includes(k)) || TRAVEL_KEYWORDS.some(k => text.includes(k));
}

function extractImage(item) {
  if (item['media:content']?.$.url) return item['media:content'].$.url;
  if (item['media:thumbnail']?.$.url) return item['media:thumbnail'].$.url;
  const match = (item.content || '').match(/<img[^>]+src="([^"]+)"/i);
  return match?.[1] || null;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  let total = 0, saved = 0, skipped = 0;

  for (const source of SOURCES) {
    console.log(`\n📡 수집 중: ${source.name}`);
    let feed;
    try {
      feed = await parser.parseURL(source.url);
    } catch (e) {
      console.error(`  ❌ 피드 오류: ${e.message}`);
      continue;
    }

    for (const item of (feed.items || [])) {
      total++;
      if (!isRelevant(item)) { skipped++; continue; }

      const sourceUrl = item.link || item.guid;
      if (!sourceUrl) { skipped++; continue; }

      if (await existsBySourceUrl(sourceUrl)) { skipped++; continue; }

      const title = item.title || '';
      const rawContent = (item.content || item.contentSnippet || item['content:encoded'] || '').slice(0, 3000);
      const imageUrl = item.enclosure?.url || extractImage(item) || null;
      const category = mapCategory(item.categories?.[0] || '', title);

      try {
        await createRaw({ title, originalTitle: title, sourceUrl, sourceName: source.name, imageUrl, imageCredit: imageUrl ? source.credit : '', rawContent, category });
        saved++;
        console.log(`  ✅ 저장: ${title.slice(0, 60)}`);
      } catch (e) {
        console.error(`  ❌ Notion 저장 오류: ${e.message}`);
      }
      await sleep(350);
    }
  }

  console.log(`\n📊 완료 — 총 ${total}건 중 ${saved}건 저장, ${skipped}건 건너뜀`);
}

run().catch(e => { console.error('치명적 오류:', e); process.exit(1); });
