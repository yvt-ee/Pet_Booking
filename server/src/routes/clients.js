import { Router } from "express";
import { withTx } from "../db/pool.js";
import { requireClient } from "../middlewares/requireClient.js";

const r = Router();

r.get("/me", requireClient, async (req, res) => {
  const clientId = req.client_id;

  try {
    const out = await withTx(async (db) => {
      const clientQ = await db.query(
        `
        SELECT id, name, email, phone, avatar_url, created_at
        FROM clients
        WHERE id = $1
        `,
        [clientId]
      );

      if (!clientQ.rows.length) return null;

      const petsQ = await db.query(
        `
        SELECT *
        FROM pets
        WHERE client_id = $1
        ORDER BY created_at DESC
        `,
        [clientId]
      );

      const requestsQ = await db.query(
        `
        SELECT
          r.id,
          r.status,
          r.start_at,
          r.end_at,
          r.notes,
          r.created_at,
          s.service_type,
          c.id AS conversation_id
        FROM requests r
        LEFT JOIN services s ON s.id = r.service_id
        LEFT JOIN conversations c ON c.request_id = r.id
        WHERE r.client_id = $1
        ORDER BY r.created_at DESC
        `,
        [clientId]
      );

      return {
        client: clientQ.rows[0],
        pets: petsQ.rows,
        requests: requestsQ.rows,
      };
    });

    if (!out) return res.status(404).json({ error: "NOT_FOUND" });
    return res.json(out);
  } catch (e) {
    console.error("[GET /clients/me] error:", e);
    return res.status(500).json({ error: "INTERNAL" });
  }
});

export default r;