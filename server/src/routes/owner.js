import { Router } from "express";
import { withTx } from "../db/pool.js";
import { requireOwner } from "../middlewares/requireOwnerToken.js";

const r = Router();

r.get("/requests", requireOwner, async (_req, res) => {
  try {
    const out = await withTx(async (db) => {
      const q = await db.query(
        `
        SELECT
          r.id,
          r.status,
          r.start_at,
          r.end_at,
          r.created_at,
          r.notes,
          c.name AS client_name,
          c.email AS client_email,
          s.service_type,
          conv.id AS conversation_id
        FROM requests r
        JOIN clients c
          ON c.id = r.client_id
        JOIN services s
          ON s.id = r.service_id
        LEFT JOIN conversations conv
          ON conv.request_id = r.id
        ORDER BY r.created_at DESC
        LIMIT 200
        `
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