import { spawnSync } from "node:child_process";
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "..");

config({ path: path.join(serverRoot, ".env") });

const databaseUrl = process.env.DATABASE_URL;
const files = process.argv.slice(2);

if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

if (files.length === 0) {
  console.error("At least one SQL file is required");
  process.exit(1);
}

for (const file of files) {
  const result = spawnSync("psql", [databaseUrl, "-f", path.join(serverRoot, file)], {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
