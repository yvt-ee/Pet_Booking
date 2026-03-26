import { Router } from "express";
import { withTx } from "../db/pool.js";

const r = Router();

/**
 * POST /reviews/request/:requestId
 * Allows a client to submit a review after completion.
 * MVP auth: requires client_email in body and matches request's client email.
 *
 * Body: { client_email, rating, comment? }
 */
r.post("/request/:requestId", async (req, res) => {
  const { requestId } = req.params;
  const { client_email, rating, comment } = req.body ?? {};

  if (!client_email || rating == null) return res.status(400).json({ error: "MISSING_FIELDS" });
  const stars = Number(rating);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return res.status(400).json({ error: "INVALID_RATING" });

  try {
    const out = await withTx(async (db) => {
      const rq = await db.query(`SELECT id, client_id, status FROM requests WHERE id=$1 FOR UPDATE`, [requestId]);
      if (!rq.rows.length) return { kind: "NOT_FOUND" };

      const status = rq.rows[0].status;
      if (status !== "COMPLETED") return { kind: "NOT_COMPLETED" };

      const cl = await db.query(`SELECT id, email FROM clients WHERE id=$1`, [rq.rows[0].client_id]);
      const email = (cl.rows[0]?.email ?? "").toLowerCase();
      if (email !== String(client_email).toLowerCase()) return { kind: "UNAUTHORIZED" };

      const ins = await db.query(
        `
        INSERT INTO reviews(request_id, client_id, rating, comment)
        VALUES ($1,$2,$3,$4)
        ON CONFLICT (request_id)
        DO UPDATE SET rating=EXCLUDED.rating, comment=EXCLUDED.comment
        RETURNING *
        `,
        [requestId, rq.rows[0].client_id, stars, comment ?? null]
      );
      return { kind: "OK", review: ins.rows[0] };
    });

    if (out.kind == "NOT_FOUND") return res.status(404).json({ error: "NOT_FOUND" });
    if (out.kind == "NOT_COMPLETED") return res.status(400).json({ error: "NOT_COMPLETED" });
    if (out.kind == "UNAUTHORIZED") return res.status(401).json({ error: "UNAUTHORIZED" });
    return res.status(201).json({ review: out.review });
  } catch (e) {
    console.error("[POST /reviews/request/:id] error:", e);
    return res.status(500).json({ error: "INTERNAL" });
  }
});

/**
 * GET /reviews/request/:requestId
 */
r.get("/request/:requestId", async (req, res) => {
  const { requestId } = req.params;
  try {
    const review = await withTx(async (db) => {
      const q = await db.query(`SELECT * FROM reviews WHERE request_id=$1`, [requestId]);
      return q.rows[0] ?? null;
    });
    if (!review) return res.status(404).json({ error: "NOT_FOUND" });
    return res.json({ review });
  } catch (e) {
    console.error("[GET /reviews/request/:id] error:", e);
    return res.status(500).json({ error: "INTERNAL" });
  }
});

// 追加到 server/src/routes/reviews.js 里（在 export default r 前）
r.get("/public", async (req, res) => {
  const limit = Math.max(1, Math.min(30, Number(req.query.limit ?? 8)));
  try {
    const out = await withTx(async (db) => {
      const q = await db.query(
        `
        SELECT
          rv.id,
          rv.rating,
          rv.comment,
          rv.created_at,
          LEFT(c.name, 1) AS client_initial,
          s.service_type
        FROM reviews rv
        JOIN requests r ON r.id = rv.request_id
        JOIN clients c ON c.id = rv.client_id
        JOIN services s ON s.id = r.service_id
        WHERE r.status = 'COMPLETED'
        ORDER BY rv.created_at DESC
        LIMIT $1
        `,
        [limit]
      );
      return q.rows;
    });

    return res.json({ reviews: out });
  } catch (e) {
    console.error("[GET /reviews/public] error:", e);
    return res.status(500).json({ error: "INTERNAL" });
  }
});

export default r;
