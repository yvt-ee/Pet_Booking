// server/src/routes/authClient.js
import { Router } from "express";
import { withTx } from "../db/pool.js";
import { rateLimit } from "../services/ratelimit.js";
import { randomOtp6, randomToken, sha256, cookieOpts } from "../services/authTokens.js";
import { requireClient } from "../middlewares/requireClient.js";

const r = Router();

const OTP_TTL_MIN = Number(process.env.CLIENT_OTP_TTL_MIN || 10);
const CLIENT_SESSION_DAYS = Number(process.env.CLIENT_SESSION_DAYS || 14);

function normEmail(email) {
  return String(email || "").trim().toLowerCase();
}
function ip(req) {
  return (req.headers["x-forwarded-for"]?.toString().split(",")[0] || req.socket.remoteAddress || "ip").trim();
}

// 1) request otp (rate limited)
r.post(
  "/request-otp",
  rateLimit({ keyFn: (req) => `otp-ip:${ip(req)}`, limit: 10, windowMs: 10 * 60_000 }),
  rateLimit({ keyFn: (req) => `otp-email:${normEmail(req.body?.email)}`, limit: 3, windowMs: 10 * 60_000 }),
  async (req, res) => {
    const email = normEmail(req.body?.email);
    if (!email || !email.includes("@")) return res.status(400).json({ error: "INVALID_EMAIL" });

    const code = randomOtp6();
    const codeHash = sha256(`${email}:${code}:${process.env.OTP_PEPPER || "dev_pepper"}`);
    const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60_000);

    try {
      await withTx(async (db) => {
        // prevent spamming: if last otp within 60s, reject
        const last = await db.query(
          `SELECT created_at FROM client_login_otps
           WHERE lower(email)=lower($1)
           ORDER BY created_at DESC
           LIMIT 1`,
          [email]
        );
        if (last.rows[0]) {
          const createdAt = new Date(last.rows[0].created_at).getTime();
          if (Date.now() - createdAt < 60_000) {
            const e = new Error("TOO_FREQUENT");
            e.code = "TOO_FREQUENT";
            throw e;
          }
        }

        await db.query(
          `INSERT INTO client_login_otps(email, code_hash, expires_at)
           VALUES ($1,$2,$3)`,
          [email, codeHash, expiresAt]
        );
      });

      // TODO: replace with real email provider (SES/SendGrid/Mailgun)
      console.log(`[OTP] email=${email} code=${code} (expires in ${OTP_TTL_MIN}min)`);

      return res.status(201).json({ ok: true });
    } catch (e) {
      if (e.code === "TOO_FREQUENT") return res.status(429).json({ error: "TOO_FREQUENT" });
      console.error("[POST /auth/client/request-otp] error:", e);
      return res.status(500).json({ error: "INTERNAL" });
    }
  }
);

// 2) verify otp -> set cookie
r.post(
  "/verify-otp",
  rateLimit({ keyFn: (req) => `verify-ip:${ip(req)}`, limit: 20, windowMs: 10 * 60_000 }),
  async (req, res) => {
    const email = normEmail(req.body?.email);
    const code = String(req.body?.code || "").trim();
    if (!email || !email.includes("@") || !/^\d{6}$/.test(code)) return res.status(400).json({ error: "INVALID_INPUT" });

    const codeHash = sha256(`${email}:${code}:${process.env.OTP_PEPPER || "dev_pepper"}`);

    try {
      const out = await withTx(async (db) => {
        // find latest valid otp
        const q = await db.query(
          `SELECT id, attempts, max_attempts
           FROM client_login_otps
           WHERE lower(email)=lower($1)
             AND used_at IS NULL
             AND expires_at > now()
           ORDER BY created_at DESC
           LIMIT 1`,
          [email]
        );
        if (!q.rows.length) {
          const e = new Error("OTP_NOT_FOUND");
          e.code = "OTP_NOT_FOUND";
          throw e;
        }

        const otpId = q.rows[0].id;

        // compare hash
        const match = await db.query(
          `SELECT 1 FROM client_login_otps WHERE id=$1 AND code_hash=$2`,
          [otpId, codeHash]
        );

        if (!match.rows.length) {
          // increment attempts
          const upd = await db.query(
            `UPDATE client_login_otps
             SET attempts = attempts + 1
             WHERE id=$1
             RETURNING attempts, max_attempts`,
            [otpId]
          );
          const { attempts, max_attempts } = upd.rows[0];
          if (attempts >= max_attempts) {
            await db.query(`UPDATE client_login_otps SET used_at=now() WHERE id=$1`, [otpId]); // burn it
          }
          const e = new Error("OTP_INVALID");
          e.code = "OTP_INVALID";
          throw e;
        }

        // burn otp
        await db.query(`UPDATE client_login_otps SET used_at=now() WHERE id=$1`, [otpId]);

        // ensure client exists
        const c = await db.query(
          `SELECT id FROM clients WHERE lower(email)=lower($1) LIMIT 1`,
          [email]
        );
        let clientId = c.rows[0]?.id;
        if (!clientId) {
          const ins = await db.query(
            `INSERT INTO clients(name, email, phone)
             VALUES ($1,$2,$3)
             RETURNING id`,
            ["New Client", email, `tmp_${Date.now()}`] // phone required in your schema; consider making phone nullable later
          );
          clientId = ins.rows[0].id;
        }

        // create session
        const token = randomToken();
        const tokenHash = sha256(token);
        const expiresAt = new Date(Date.now() + CLIENT_SESSION_DAYS * 24 * 3600_000);

        await db.query(
          `INSERT INTO client_sessions(client_id, token_hash, expires_at)
           VALUES ($1,$2,$3)`,
          [clientId, tokenHash, expiresAt]
        );

        return { client_id: clientId, token, expires_at: expiresAt };
      });

      res.cookie("client_session", out.token, { ...cookieOpts(), maxAge: CLIENT_SESSION_DAYS * 24 * 3600_000, path: "/" });
      return res.json({ ok: true, client_id: out.client_id });
    } catch (e) {
      if (e.code === "OTP_NOT_FOUND") return res.status(400).json({ error: "OTP_EXPIRED_OR_NOT_FOUND" });
      if (e.code === "OTP_INVALID") return res.status(400).json({ error: "OTP_INVALID" });
      console.error("[POST /auth/client/verify-otp] error:", e);
      return res.status(500).json({ error: "INTERNAL" });
    }
  }
);

// 3) me (authenticated)
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
        LEFT JOIN services s
          ON s.id = r.service_id
        LEFT JOIN conversations c
          ON c.request_id = r.id
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
    console.error("[GET /auth/client/me] error:", e);
    return res.status(500).json({ error: "INTERNAL" });
  }
});

// 4) logout
r.post("/logout", requireClient, async (req, res) => {
  try {
    const token = req.cookies?.client_session;
    if (token) {
      const tokenHash = sha256(token);
      await withTx((db) => db.query(`UPDATE client_sessions SET revoked_at=now() WHERE token_hash=$1`, [tokenHash]));
    }
  } catch {}
  res.clearCookie("client_session", { ...cookieOpts(), path: "/" });
  return res.json({ ok: true });
});

export default r;