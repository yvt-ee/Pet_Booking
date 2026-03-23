import { Router } from "express";
import { withTx } from "../db/pool.js";
import { optionalClientAuth } from "../middlewares/optionalClientAuth.js";

const r = Router();

r.use(optionalClientAuth);

function isOwner(req) {
  const token = req.header("X-Owner-Token");
  return Boolean(token && token === process.env.OWNER_ADMIN_TOKEN);
}

r.get("/request/:requestId", async (req, res) => {
  const { requestId } = req.params;
  const owner = isOwner(req);
  const clientId = req.client_id || null;

  try {
    const out = await withTx(async (db) => {
      const reqQ = await db.query(
        `
        SELECT id, client_id
        FROM requests
        WHERE id = $1
        `,
        [requestId]
      );

      const request = reqQ.rows[0] || null;
      if (!request) return null;

      if (!owner) {
        if (!clientId || request.client_id !== clientId) {
          const err = new Error("UNAUTHORIZED");
          err.code = "UNAUTHORIZED";
          throw err;
        }
      }

      const logsQ = await db.query(
        `
        SELECT
          id,
          request_id,
          log_date,
          mood,
          energy_level,
          appetite,
          health_status,
          notes,
          created_at
        FROM request_daily_logs
        WHERE request_id = $1
        ORDER BY created_at DESC
        `,
        [requestId]
      );

      const logs = [];

      for (const log of logsQ.rows) {
        const photosQ = await db.query(
          `
          SELECT
            id,
            log_id,
            url,
            caption,
            created_at
          FROM request_log_photos
          WHERE log_id = $1
          ORDER BY created_at ASC
          `,
          [log.id]
        );

        logs.push({
          ...log,
          photos: photosQ.rows,
        });
      }

      return { logs };
    });

    if (!out) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }

    return res.json(out);
  } catch (e) {
    if (e?.code === "UNAUTHORIZED") {
      return res.status(401).json({ error: "UNAUTHORIZED" });
    }

    console.error("[GET /logs/request/:requestId] error:", e);
    return res.status(500).json({ error: "INTERNAL" });
  }
});

export default r;