import { Router } from "express";
import { withTx } from "../db/pool.js";
import { optionalClientAuth } from "../middlewares/optionalClientAuth.js";

const r = Router();

r.use(optionalClientAuth);

function isOwner(req) {
  const token = req.header("X-Owner-Token");
  return Boolean(token && token === process.env.OWNER_ADMIN_TOKEN);
}

async function getConversationWithClient(db, conversationId) {
  const q = await db.query(
    `
    SELECT c.id, c.request_id, c.created_at, r.client_id
    FROM conversations c
    JOIN requests r ON r.id = c.request_id
    WHERE c.id = $1
    `,
    [conversationId]
  );

  return q.rows[0] ?? null;
}

function assertCanAccessConversation(req, conv) {
  const owner = isOwner(req);
  const clientId = req.client_id || null;

  if (owner) return;

  if (!clientId || conv.client_id !== clientId) {
    const err = new Error("UNAUTHORIZED");
    err.code = "UNAUTHORIZED";
    throw err;
  }
}

r.get("/:id", async (req, res) => {
  const { id } = req.params;
  const owner = isOwner(req);
  const clientId = req.client_id || null;

  try {
    const out = await withTx(async (db) => {
      const q = await db.query(
        `
        SELECT c.id, c.request_id, c.created_at, r.client_id
        FROM conversations c
        JOIN requests r ON r.id = c.request_id
        WHERE c.id = $1
        `,
        [id]
      );

      const conv = q.rows[0] ?? null;
      if (!conv) return null;

      if (!owner) {
        if (!clientId || conv.client_id !== clientId) {
          const err = new Error("UNAUTHORIZED");
          err.code = "UNAUTHORIZED";
          throw err;
        }
      }

      return {
        id: conv.id,
        request_id: conv.request_id,
        created_at: conv.created_at,
      };
    });

    if (!out) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }

    return res.json({ conversation: out });
  } catch (e) {
    if (e?.code === "UNAUTHORIZED") {
      return res.status(401).json({ error: "UNAUTHORIZED" });
    }
    console.error("[GET /conversations/:id] error:", e);
    return res.status(500).json({ error: "INTERNAL" });
  }
});

r.get("/:id/messages", async (req, res) => {
  const { id } = req.params;

  try {
    const out = await withTx(async (db) => {
      const conv = await getConversationWithClient(db, id);
      if (!conv) return null;

      assertCanAccessConversation(req, conv);

      const msgQ = await db.query(
        `
        SELECT id, conversation_id, sender, content, created_at
        FROM messages
        WHERE conversation_id = $1
        ORDER BY created_at DESC
        LIMIT 100
        `,
        [id]
      );

      return {
        items: msgQ.rows,
        request_id: conv.request_id,
      };
    });

    if (!out) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }

    return res.json(out);
  } catch (e) {
    if (e?.code === "UNAUTHORIZED") {
      return res.status(401).json({ error: "UNAUTHORIZED" });
    }
    console.error("[GET /conversations/:id/messages] error:", e);
    return res.status(500).json({ error: "INTERNAL" });
  }
});

r.post("/:id/messages", async (req, res) => {
  const { id } = req.params;
  const owner = isOwner(req);
  const { content } = req.body ?? {};

  if (!content || !String(content).trim()) {
    return res.status(400).json({ error: "MISSING_CONTENT" });
  }

  try {
    const out = await withTx(async (db) => {
      const conv = await getConversationWithClient(db, id);
      if (!conv) return null;

      assertCanAccessConversation(req, conv);

      const sender = owner ? "OWNER" : "CLIENT";

      const ins = await db.query(
        `
        INSERT INTO messages (conversation_id, sender, content)
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [id, sender, String(content).trim()]
      );

      return ins.rows[0];
    });

    if (!out) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }

    return res.status(201).json({ message: out });
  } catch (e) {
    if (e?.code === "UNAUTHORIZED") {
      return res.status(401).json({ error: "UNAUTHORIZED" });
    }
    console.error("[POST /conversations/:id/messages] error:", e);
    return res.status(500).json({ error: "INTERNAL" });
  }
});

export default r;