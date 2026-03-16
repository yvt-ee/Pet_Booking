import pg from "pg";
const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.warn("[db] DATABASE_URL is not set. The server will fail when it hits DB routes.");
}

export const pool = new Pool({
  connectionString,
  // For AWS RDS with SSL. Set DB_SSL=true in prod.
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined
});

export async function withTx(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch {}
    throw err;
  } finally {
    client.release();
  }
}
