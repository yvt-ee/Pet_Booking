import { Router } from "express";
import { withTx } from "../db/pool.js";
import { requireOwner } from "../middlewares/requireOwnerCookie.js";

const r = Router();

r.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const out = await withTx(async (db) => {
      const q = await db.query(
        `
        SELECT id, request_id, created_at
        FROM conversations
        WHERE id = $1
        `,
        [id]
      );

      return q.rows[0] ?? null;
    });

    if (!out) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }

    return res.json({ conversation: out });

  } catch (e) {
    console.error("[GET /conversations/:id] error:", e);
    return res.status(500).json({ error: "INTERNAL" });
  }
});

/**
 * GET /conversations/:id/messages?cursor=&limit=
 * cursor: ISO timestamp or message UUID (simple timestamp cursor here)
 */
r.get("/:id/messages", async (req, res) => {
  const { id } = req.params;
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 30)));
  const cursor = req.query.cursor ? new Date(String(req.query.cursor)) : null;

  try {
    const out = await withTx(async (client) => {
      const exists = await client.query(`SELECT 1 FROM conversations WHERE id=$1`, [id]);
      if (!exists.rows.length) return null;

      const params = [id];
      let where = "conversation_id = $1";
      if (cursor && !isNaN(cursor)) {
        params.push(cursor);
        where += ` AND created_at < $2`;
      }
      params.push(limit);

      const q = await client.query(
        `
        SELECT id, sender, content, created_at
        FROM messages
        WHERE ${where}
        ORDER BY created_at DESC
        LIMIT $${params.length}
        `,
        params
      );

      const items = q.rows;
      const nextCursor = items.length ? items[items.length - 1].created_at : null;
      return { items, next_cursor: nextCursor };
    });

    if (!out) return res.status(404).json({ error: "NOT_FOUND" });
    return res.json(out);
  } catch (e) {
    console.error("[GET /conversations/:id/messages] error:", e);
    return res.status(500).json({ error: "INTERNAL" });
  }
});

/**
 * POST /conversations/:id/messages
 * sender: CLIENT or OWNER (owner may require token if configured)
 */
r.post("/:id/messages", async (req, res) => {
  const { id } = req.params;
  const { sender, content } = req.body ?? {};

  if (!sender || !["CLIENT", "OWNER"].includes(sender)) {
    return res.status(400).json({ error: "INVALID_SENDER" });
  }
  if (!content || typeof content !== "string" || content.trim().length < 1) {
    return res.status(400).json({ error: "INVALID_CONTENT" });
  }

  // If sender is OWNER, require owner token (optional in dev)
  const guard = (req, res, next) => next();
  const ownerGuard = sender === "OWNER" ? requireOwner : guard;

  return ownerGuard(req, res, async () => {
    try {
      const out = await withTx(async (client) => {
        const exists = await client.query(`SELECT 1 FROM conversations WHERE id=$1`, [id]);
        if (!exists.rows.length) return null;

        const ins = await client.query(
          `
          INSERT INTO messages(conversation_id, sender, content)
          VALUES ($1,$2,$3)
          RETURNING id, sender, content, created_at
          `,
          [id, sender, content.trim()]
        );
        return ins.rows[0];
      });

      if (!out) return res.status(404).json({ error: "NOT_FOUND" });
      return res.status(201).json({ message: out });
    } catch (e) {
      console.error("[POST /conversations/:id/messages] error:", e);
      return res.status(500).json({ error: "INTERNAL" });
    }
  });
});

export default r;
