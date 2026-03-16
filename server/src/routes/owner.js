import { Router } from "express";
import { withTx } from "../db/pool.js";
import { requireOwner } from "../middlewares/requireOwnerCookie.js";

const r = Router();

r.get("/requests", requireOwner, async (_req, res) => {
  try {
    const out = await withTx(async (db) => {
      const q = await db.query(
        `SELECT r.id, r.status, r.start_at, r.end_at, r.created_at,
                c.name AS client_name, c.email AS client_email,
                p.name AS pet_name, p.pet_type,
                s.service_type
         FROM requests r
         JOIN clients c ON c.id = r.client_id
         JOIN pets p ON p.id = r.pet_id
         JOIN services s ON s.id = r.service_id
         ORDER BY r.created_at DESC
         LIMIT 200`
      );
      return q.rows;
    });
    return res.json({ requests: out });
  } catch (e) {
    console.error("[GET /owner/requests] error:", e);
    return res.status(500).json({ error: "INTERNAL" });
  }
});

export default r;
