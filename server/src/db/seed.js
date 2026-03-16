// server/src/db/seed.js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withTx } from "./pool.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function isSeedFile(name) {
  return /\.sql$/i.test(name) && /seed/i.test(name);
}

async function run() {
  const dir = path.join(__dirname, "sql");
  const files = fs
    .readdirSync(dir)
    .filter(isSeedFile)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (!files.length) {
    console.log("[seed] no seed files found");
    return;
  }

  await withTx(async (db) => {
    for (const file of files) {
      const full = path.join(dir, file);
      const sql = fs.readFileSync(full, "utf8");
      console.log(`[seed] applying ${file}`);
      await db.query(sql);
    }
  });

  console.log("[seed] done");
}

run().catch((e) => {
  console.error("[seed] failed:", e);
  process.exit(1);
});