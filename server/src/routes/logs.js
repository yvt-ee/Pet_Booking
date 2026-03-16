import { Router } from "express";
import { withTx } from "../db/pool.js";
import { requireOwner } from "../middlewares/requireOwnerCookie.js";

const r = Router();

r.get("/request/:requestId", async (req, res) => {
  const { requestId } = req.params;
  try {
    const logs = await withTx(async (db) => {
      const q = await db.query(
        `SELECT * FROM request_daily_logs WHERE request_id=$1 ORDER BY log_date DESC`,
        [requestId]
      );
      const ids = q.rows.map(x => x.id);
      let photosByLog = {};
      if (ids.length) {
        const ph = await db.query(
          `SELECT id, log_id, url, caption, created_at
           FROM request_log_photos
           WHERE log_id = ANY($1::uuid[])
           ORDER BY created_at DESC`,
          [ids]
        );
        for (const p of ph.rows) {
          photosByLog[p.log_id] = photosByLog[p.log_id] || [];
          photosByLog[p.log_id].push(p);
        }
      }
      return q.rows.map(l => ({ ...l, photos: photosByLog[l.id] || [] }));
    });
    return res.json({ logs });
  } catch (e) {
    console.error("[GET /logs/request/:id] error:", e);
    return res.status(500).json({ error: "INTERNAL" });
  }
});

r.post("/request/:requestId", requireOwner, async (req, res) => {
  const { requestId } = req.params;
  const { log_date, mood, energy_level, appetite, health_status, notes } = req.body ?? {};
  if (!log_date) return res.status(400).json({ error: "MISSING_LOG_DATE" });

  try {
    const out = await withTx(async (db) => {
      const exists = await db.query(`SELECT 1 FROM requests WHERE id=$1`, [requestId]);
      if (!exists.rows.length) return null;

      const ins = await db.query(
        `
        INSERT INTO request_daily_logs(request_id, log_date, mood, energy_level, appetite, health_status, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (request_id, log_date)
        DO UPDATE SET mood=EXCLUDED.mood, energy_level=EXCLUDED.energy_level,
                      appetite=EXCLUDED.appetite, health_status=EXCLUDED.health_status,
                      notes=EXCLUDED.notes
        RETURNING *
        `,
        [requestId, log_date, mood ?? null, energy_level ?? null, appetite ?? null, health_status ?? null, notes ?? null]
      );
      return ins.rows[0];
    });

    if (!out) return res.status(404).json({ error: "NOT_FOUND" });
    return res.status(201).json({ log: out });
  } catch (e) {
    console.error("[POST /logs/request/:id] error:", e);
    return res.status(500).json({ error: "INTERNAL" });
  }
});

r.post("/:logId/photos", requireOwner, async (req, res) => {
  const { logId } = req.params;
  const { url, caption } = req.body ?? {};
  if (!url || typeof url !== "string") return res.status(400).json({ error: "INVALID_URL" });

  try {
    const out = await withTx(async (db) => {
      const exists = await db.query(`SELECT 1 FROM request_daily_logs WHERE id=$1`, [logId]);
      if (!exists.rows.length) return null;

      const ins = await db.query(
        `INSERT INTO request_log_photos(log_id, url, caption) VALUES ($1,$2,$3)
         RETURNING id, url, caption, created_at`,
        [logId, url, caption ?? null]
      );
      return ins.rows[0];
    });

    if (!out) return res.status(404).json({ error: "NOT_FOUND" });
    return res.status(201).json({ photo: out });
  } catch (e) {
    console.error("[POST /logs/:logId/photos] error:", e);
    return res.status(500).json({ error: "INTERNAL" });
  }
});

export default r;
