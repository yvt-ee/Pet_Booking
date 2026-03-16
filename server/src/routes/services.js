import { Router } from "express";
import { withTx } from "../db/pool.js";

const r = Router();

r.get("/", async (_req, res) => {
  try {
    const services = await withTx(async (db) => {
      const q = await db.query(
        `SELECT id, service_type, base_rate_per_day, cat_rate_per_day, holiday_rate_per_day,
                additional_dog_rate_per_day, additional_cat_rate_per_day
         FROM services
         WHERE is_active = TRUE
         ORDER BY service_type`
      );
      return q.rows;
    });
    return res.json({ services });
  } catch (e) {
    console.error("[GET /services] error:", e);
    return res.status(500).json({ error: "INTERNAL" });
  }
});

export default r;
