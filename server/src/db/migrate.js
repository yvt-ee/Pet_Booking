// server/src/db/migrate.js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withTx } from "./pool.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function isMigrationFile(name) {
  // 只跑以数字开头的 schema migration
  // 显式跳过 seed 文件
  return /^\d+.*\.sql$/i.test(name) && !/seed/i.test(name);
}

async function run() {
  const dir = path.join(__dirname, "sql");
  const files = fs
    .readdirSync(dir)
    .filter(isMigrationFile)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (!files.length) {
    console.log("[migrate] no migration files found");
    return;
  }

  await withTx(async (db) => {
    for (const file of files) {
      const full = path.join(dir, file);
      const sql = fs.readFileSync(full, "utf8");
      console.log(`[migrate] applying ${file}`);
      await db.query(sql);
    }
  });

  console.log("[migrate] done");
}

run().catch((e) => {
  console.error("[migrate] failed:", e);
  process.exit(1);
});