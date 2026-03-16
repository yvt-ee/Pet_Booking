// server/src/middlewares/requireOwnerCookie.js
import { withTx } from "../db/pool.js";
import { sha256 } from "../services/authTokens.js";

export async function requireOwner(req, res, next) {
  try {
    const token = req.cookies?.owner_session;
    if (!token) return res.status(401).json({ error: "UNAUTHORIZED" });

    const tokenHash = sha256(token);
    const ok = await withTx(async (db) => {
      const q = await db.query(
        `SELECT 1 FROM owner_sessions
         WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at > now()
         LIMIT 1`,
        [tokenHash]
      );
      return q.rows.length > 0;
    });

    if (!ok) return res.status(401).json({ error: "UNAUTHORIZED" });
    next();
  } catch (e) {
    console.error("[requireOwner] error:", e);
    return res.status(500).json({ error: "INTERNAL" });
  }
}