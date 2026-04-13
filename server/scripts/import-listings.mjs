import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";
import { config } from "dotenv";
import { Client } from "pg";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "..");
config({ path: path.join(serverRoot, ".env") });

const args = process.argv.slice(2);
const getArg = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
};
const hasFlag = (flag) => args.includes(flag);

const file = getArg("--file");
const categoryFilter = getArg("--category");
const dryRun = hasFlag("--dry-run");
const allowUpdate = hasFlag("--update");

if (!file) {
  console.error("--file is required");
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const rowSchema = z.object({
  category: z.enum(["accommodation", "restaurant", "massage", "real_estate", "tour"]),
  name: z.string().min(1),
  name_ko: z.string().optional().default(""),
  district: z.string().min(1),
  address: z.string().min(1),
  google_maps_url: z.string().url(),
  google_maps_place_id: z.string().min(1),
  thumbnail_url: z.string().optional().default(""),
  image_urls: z.string().optional().default("[]"),
  rating: z.coerce.number().optional(),
  review_count: z.coerce.number().int().optional().default(0),
  description: z.string().optional().default(""),
  category_data: z.string().optional().default("{}"),
  agoda_url: z.string().optional().default(""),
  agoda_hotel_id: z.string().optional().default(""),
  booking_url: z.string().optional().default(""),
  tripcom_url: z.string().optional().default(""),
  source: z.string().optional().default("mika_collected"),
  source_url: z.string().optional().default(""),
  collected_by: z.string().optional().default("mika"),
});

function slugifyPart(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function makeSlug(name, district) {
  const base = `${slugifyPart(name)}-${slugifyPart(district)}`.replace(/^-+|-+$/g, "");
  return base || `listing-${Math.random().toString(36).slice(2, 6)}`;
}

function parseJsonField(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function validateImageUrls(imageUrls) {
  if (!Array.isArray(imageUrls)) {
    return "image_urls must be a JSON array";
  }

  for (const image of imageUrls) {
    if (typeof image?.url !== "string" || !image.url.startsWith("http")) {
      return `invalid image url: ${JSON.stringify(image)}`;
    }
  }

  return null;
}

const content = await fs.readFile(file, "utf8");
const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });
const report = {
  imported_at: new Date().toISOString(),
  file,
  total_rows: 0,
  inserted: 0,
  updated: 0,
  skipped: 0,
  errors: [],
};

if (parsed.errors.length > 0) {
  console.error(parsed.errors);
  process.exit(1);
}

const rows = parsed.data
  .map((row) => rowSchema.safeParse(row))
  .filter((result) => {
    if (!result.success) {
      report.errors.push({ row: result.error.flatten() });
    }
    return result.success;
  })
  .map((result) => result.data)
  .filter((row) => (categoryFilter ? row.category === categoryFilter : true));

report.total_rows = rows.length;

const client = new Client({ connectionString: databaseUrl });
await client.connect();

try {
  await client.query("BEGIN");

  for (const [index, row] of rows.entries()) {
    const categoryData = parseJsonField(row.category_data, {});
    const imageUrls = parseJsonField(row.image_urls, []);
    const imageError = validateImageUrls(imageUrls);
    if (imageError) {
      report.errors.push({ row: index + 2, error: imageError });
      continue;
    }

    if (!String(row.google_maps_place_id).startsWith("ChIJ") && !String(row.google_maps_place_id).startsWith("seed-")) {
      report.errors.push({ row: index + 2, error: "google_maps_place_id must start with ChIJ or be an approved seed id" });
      continue;
    }

    const slug = makeSlug(row.name, row.district);
    const existing = await client.query(
      "SELECT id, owner_id FROM listings WHERE google_maps_place_id = $1 LIMIT 1",
      [row.google_maps_place_id],
    );

    if (existing.rows[0]) {
      if (!allowUpdate) {
        report.skipped += 1;
        continue;
      }

      if (existing.rows[0].owner_id) {
        report.errors.push({ row: index + 2, error: "refusing to update a user-owned listing" });
        continue;
      }

      if (!dryRun) {
        await client.query(
          `UPDATE listings
           SET
             slug = $2,
             category = $3,
             name = $4,
             name_ko = NULLIF($5, ''),
             district = $6,
             address = $7,
             google_maps_url = $8,
             thumbnail_url = NULLIF($9, ''),
             image_urls = $10::jsonb,
             rating = $11,
             review_count = $12,
             description = NULLIF($13, ''),
             category_data = $14::jsonb,
             agoda_url = NULLIF($15, ''),
             agoda_hotel_id = NULLIF($16, ''),
             booking_url = NULLIF($17, ''),
             tripcom_url = NULLIF($18, ''),
             source = $19,
             source_url = NULLIF($20, ''),
             collected_by = NULLIF($21, ''),
             collected_at = NOW(),
             status = 'approved',
             is_active = TRUE
           WHERE id = $1`,
          [
            existing.rows[0].id,
            slug,
            row.category,
            row.name,
            row.name_ko,
            row.district,
            row.address,
            row.google_maps_url,
            row.thumbnail_url,
            JSON.stringify(imageUrls),
            row.rating ?? null,
            row.review_count ?? 0,
            row.description,
            JSON.stringify(categoryData),
            row.agoda_url,
            row.agoda_hotel_id,
            row.booking_url,
            row.tripcom_url,
            row.source,
            row.source_url,
            row.collected_by,
          ],
        );
      }

      report.updated += 1;
      continue;
    }

    if (!dryRun) {
      await client.query(
        `INSERT INTO listings (
           slug, category, name, name_ko, district, address, google_maps_url, google_maps_place_id,
           thumbnail_url, image_urls, rating, review_count, description, category_data,
           agoda_url, agoda_hotel_id, booking_url, tripcom_url,
           source, source_url, collected_by, collected_at,
           status, is_active, place_id_verified, url_verified
         ) VALUES (
           $1, $2, $3, NULLIF($4, ''), $5, $6, $7, $8,
           NULLIF($9, ''), $10::jsonb, $11, $12, NULLIF($13, ''), $14::jsonb,
           NULLIF($15, ''), NULLIF($16, ''), NULLIF($17, ''), NULLIF($18, ''),
           $19, NULLIF($20, ''), NULLIF($21, ''), NOW(),
           'approved', TRUE, FALSE, TRUE
         )`,
        [
          slug,
          row.category,
          row.name,
          row.name_ko,
          row.district,
          row.address,
          row.google_maps_url,
          row.google_maps_place_id,
          row.thumbnail_url,
          JSON.stringify(imageUrls),
          row.rating ?? null,
          row.review_count ?? 0,
          row.description,
          JSON.stringify(categoryData),
          row.agoda_url,
          row.agoda_hotel_id,
          row.booking_url,
          row.tripcom_url,
          row.source,
          row.source_url,
          row.collected_by,
        ],
      );
    }

    report.inserted += 1;
  }

  if (dryRun || report.errors.length > 0) {
    await client.query("ROLLBACK");
  } else {
    await client.query("COMMIT");
  }
} finally {
  await client.end();
}

const reportDir = process.env.IMPORT_REPORT_DIR || path.join(serverRoot, "imports");
await fs.mkdir(reportDir, { recursive: true });
const reportPath = path.join(reportDir, `import_${Date.now()}${dryRun ? "_dryrun" : ""}.log.json`);
await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

console.log(JSON.stringify({ ...report, report_path: reportPath }, null, 2));

if (report.errors.length > 0) {
  process.exit(1);
}
