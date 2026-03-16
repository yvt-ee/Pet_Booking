// server/src/routes/holidays.js
import { Router } from "express";
import { withTx } from "../db/pool.js";

const r = Router();

r.get("/", async (_req, res) => {
  try {
    const out = await withTx(async (db) => {
      const q = await db.query(
        `SELECT holiday_date, name
         FROM holidays
         ORDER BY holiday_date ASC`
      );
      return q.rows;
    });

    return res.json({ holidays: out });
  } catch (e) {
    console.error("[GET /holidays] error:", e);
    return res.status(500).json({ error: "INTERNAL" });
  }
});

export default r;