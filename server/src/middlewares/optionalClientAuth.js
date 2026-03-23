import crypto from "crypto";
import { withTx } from "../db/pool.js";

function sha256Hex(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

export async function optionalClientAuth(req, _res, next) {
  try {
    const rawToken = req.cookies?.client_session || null;

    if (!rawToken) {
      req.client_id = null;
      return next();
    }

    const tokenHash = sha256Hex(rawToken);

    const session = await withTx(async (db) => {
      const q = await db.query(
        `
        SELECT client_id
        FROM client_sessions
        WHERE token_hash = $1
          AND revoked_at IS NULL
          AND expires_at > NOW()
        LIMIT 1
        `,
        [tokenHash]
      );

      return q.rows[0] || null;
    });

    req.client_id = session?.client_id || null;
    return next();
  } catch (e) {
    console.error("[optionalClientAuth] error:", e);
    req.client_id = null;
    return next();
  }
}