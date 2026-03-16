import { Router } from "express";
import { withTx } from "../db/pool.js";
import { requireClient } from "../middlewares/requireClient.js";
import { requireOwner } from "../middlewares/requireOwnerCookie.js";

const r = Router();

/**
 * POST /requests
 * client submits a request first, then chat opens immediately
 * request is NOT a confirmed booking yet
 */
r.post("/", requireClient, async (req, res) => {
  try {
    const clientId = req.client_id;
    const { service_id, start_at, end_at, notes, pet_ids } = req.body ?? {};

    if (!service_id || !start_at || !end_at) {
      return res.status(400).json({ error: "MISSING_FIELDS" });
    }

    if (!Array.isArray(pet_ids) || pet_ids.length === 0) {
      return res.status(400).json({ error: "MISSING_PET_IDS" });
    }

    const startAt = new Date(start_at);
    const endAt = new Date(end_at);

    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      return res.status(400).json({ error: "INVALID_DATES" });
    }

    if (endAt <= startAt) {
      return res.status(400).json({ error: "END_BEFORE_START" });
    }

    const out = await withTx(async (db) => {
      // validate service
      const svc = await db.query(
        `SELECT *
         FROM services
         WHERE id = $1 AND is_active = TRUE`,
        [service_id]
      );

      if (!svc.rows.length) {
        const err = new Error("SERVICE_NOT_FOUND");
        err.code = "SERVICE_NOT_FOUND";
        throw err;
      }

      // validate all selected pets belong to logged-in client
      const petsQ = await db.query(
        `SELECT *
         FROM pets
         WHERE client_id = $1
           AND id = ANY($2::uuid[])`,
        [clientId, pet_ids]
      );

      if (petsQ.rows.length !== pet_ids.length) {
        const err = new Error("INVALID_PET_IDS");
        err.code = "INVALID_PET_IDS";
        throw err;
      }

      // create request (request only, not final booking)
      const rq = await db.query(
        `
        INSERT INTO requests (
          client_id, service_id, start_at, end_at, notes, status
        )
        VALUES ($1, $2, $3, $4, $5, 'REQUESTED')
        RETURNING *
        `,
        [clientId, service_id, startAt, endAt, notes ?? null]
      );

      const request = rq.rows[0];

      // attach multiple pets
      for (const petId of pet_ids) {
        await db.query(
          `
          INSERT INTO request_pets (request_id, pet_id)
          VALUES ($1, $2)
          `,
          [request.id, petId]
        );
      }

      // create conversation immediately
      const convo = await db.query(
        `INSERT INTO conversations(request_id) VALUES ($1) RETURNING id`,
        [request.id]
      );

      return {
        request,
        conversation_id: convo.rows[0].id,
        pets: petsQ.rows,
        service: svc.rows[0],
      };
    });

    return res.status(201).json(out);
  } catch (e) {
    if (e?.code === "SERVICE_NOT_FOUND") {
      return res.status(404).json({ error: "SERVICE_NOT_FOUND" });
    }
    if (e?.code === "INVALID_PET_IDS") {
      return res.status(400).json({ error: "INVALID_PET_IDS" });
    }
    console.error("[POST /requests] error:", e);
    return res.status(500).json({ error: "INTERNAL" });
  }
});

r.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const out = await withTx(async (db) => {
      const rq = await db.query(`SELECT * FROM requests WHERE id = $1`, [id]);
      if (!rq.rows.length) return null;

      const request = rq.rows[0];

      const convo = await db.query(
        `SELECT id FROM conversations WHERE request_id = $1`,
        [id]
      );

      const meet = await db.query(
        `SELECT * FROM meet_greets WHERE request_id = $1`,
        [id]
      );

      const clientQ = await db.query(
        `SELECT id, name, email, phone, avatar_url
         FROM clients
         WHERE id = $1`,
        [request.client_id]
      );

      const petsQ = await db.query(
        `
        SELECT p.*
        FROM request_pets rp
        JOIN pets p ON p.id = rp.pet_id
        WHERE rp.request_id = $1
        ORDER BY p.created_at ASC
        `,
        [id]
      );

      const svcQ = await db.query(
        `
        SELECT
          id,
          service_type,
          base_rate_per_day,
          cat_rate_per_day,
          holiday_rate_per_day,
          additional_dog_rate_per_day,
          additional_cat_rate_per_day
        FROM services
        WHERE id = $1
        `,
        [request.service_id]
      );

      return {
        request,
        conversation_id: convo.rows[0]?.id ?? null,
        meet_greet: meet.rows[0] ?? null,
        client: clientQ.rows[0] ?? null,
        pets: petsQ.rows,
        service: svcQ.rows[0] ?? null,
      };
    });

    if (!out) return res.status(404).json({ error: "NOT_FOUND" });
    return res.json(out);
  } catch (e) {
    console.error("[GET /requests/:id] error:", e);
    return res.status(500).json({ error: "INTERNAL" });
  }
});

/**
 * Called in chat: request a meet
 */
r.post("/:id/meet-greet", async (req, res) => {
  const { id } = req.params;
  const { scheduled_at, location } = req.body ?? {};

  if (!scheduled_at) {
    return res.status(400).json({ error: "MISSING_SCHEDULED_AT" });
  }

  const scheduledAt = new Date(scheduled_at);
  if (Number.isNaN(scheduledAt.getTime())) {
    return res.status(400).json({ error: "INVALID_SCHEDULED_AT" });
  }

  try {
    const out = await withTx(async (db) => {
      const rq = await db.query(`SELECT id FROM requests WHERE id = $1`, [id]);
      if (!rq.rows.length) return null;

      const existing = await db.query(
        `SELECT * FROM meet_greets WHERE request_id = $1`,
        [id]
      );
      if (existing.rows.length) return existing.rows[0];

      const ins = await db.query(
        `
        INSERT INTO meet_greets(request_id, scheduled_at, location, status)
        VALUES ($1, $2, $3, 'REQUESTED')
        RETURNING *
        `,
        [id, scheduledAt, location ?? null]
      );

      return ins.rows[0];
    });

    if (!out) return res.status(404).json({ error: "NOT_FOUND" });
    return res.status(201).json({ meet_greet: out });
  } catch (e) {
    console.error("[POST /requests/:id/meet-greet] error:", e);
    return res.status(500).json({ error: "INTERNAL" });
  }
});

/**
 * Owner confirms request after chat / review
 * If meet exists -> must be PAID/COMPLETED first
 */
r.post("/:id/confirm", requireOwner, async (req, res) => {
  const { id } = req.params;

  try {
    const out = await withTx(async (db) => {
      const q = await db.query(`SELECT * FROM requests WHERE id = $1 FOR UPDATE`, [id]);
      if (!q.rows.length) return null;

      const request = q.rows[0];

      if (["CANCELLED", "EXPIRED", "FAILED", "PAID"].includes(request.status)) {
        const err = new Error("INVALID_STATE");
        err.code = "INVALID_STATE";
        throw err;
      }

      const meet = await db.query(
        `SELECT status FROM meet_greets WHERE request_id = $1`,
        [id]
      );

      if (meet.rows.length && !["PAID", "COMPLETED"].includes(meet.rows[0].status)) {
        const err = new Error("MEET_NOT_PAID");
        err.code = "MEET_NOT_PAID";
        throw err;
      }

      await db.query(`UPDATE requests SET status = 'CONFIRMED' WHERE id = $1`, [id]);
      const updated = await db.query(`SELECT * FROM requests WHERE id = $1`, [id]);
      return updated.rows[0];
    });

    if (!out) return res.status(404).json({ error: "NOT_FOUND" });
    return res.json({ request: out });
  } catch (e) {
    if (e?.code === "MEET_NOT_PAID") {
      return res.status(400).json({ error: "MEET_NOT_PAID" });
    }
    if (e?.code === "INVALID_STATE") {
      return res.status(400).json({ error: "INVALID_STATE" });
    }
    console.error("[POST /requests/:id/confirm] error:", e);
    return res.status(500).json({ error: "INTERNAL" });
  }
});

r.post("/:id/cancel", async (req, res) => {
  const { id } = req.params;

  try {
    const out = await withTx(async (db) => {
      const q = await db.query(`SELECT * FROM requests WHERE id = $1 FOR UPDATE`, [id]);
      if (!q.rows.length) return null;

      await db.query(`UPDATE requests SET status = 'CANCELLED' WHERE id = $1`, [id]);
      const updated = await db.query(`SELECT * FROM requests WHERE id = $1`, [id]);
      return updated.rows[0];
    });

    if (!out) return res.status(404).json({ error: "NOT_FOUND" });
    return res.json({ request: out });
  } catch (e) {
    console.error("[POST /requests/:id/cancel] error:", e);
    return res.status(500).json({ error: "INTERNAL" });
  }
});

export default r;