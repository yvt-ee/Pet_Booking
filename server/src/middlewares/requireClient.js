// server/src/middlewares/requireClient.js
import { withTx } from "../db/pool.js";
import { sha256 } from "../services/authTokens.js";

export async function requireClient(req, res, next) {
  try {
    const token = req.cookies?.client_session;
    if (!token) return res.status(401).json({ error: "UNAUTHORIZED" });

    const tokenHash = sha256(token);
    const session = await withTx(async (db) => {
      const q = await db.query(
        `SELECT s.client_id
         FROM client_sessions s
         WHERE s.token_hash=$1
           AND s.revoked_at IS NULL
           AND s.expires_at > now()
         LIMIT 1`,
        [tokenHash]
      );
      return q.rows[0] || null;
    });

    if (!session) return res.status(401).json({ error: "UNAUTHORIZED" });

    req.client_id = session.client_id;
    next();
  } catch (e) {
    console.error("[requireClient] error:", e);
    return res.status(500).json({ error: "INTERNAL" });
  }
}