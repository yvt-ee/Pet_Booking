// server/src/routes/authOwner.js
import { Router } from "express";
import bcrypt from "bcrypt";
import { withTx } from "../db/pool.js";
import { randomToken, sha256, cookieOpts } from "../services/authTokens.js";

const r = Router();

const OWNER_SESSION_DAYS = Number(process.env.OWNER_SESSION_DAYS || 30);

// You should store OWNER_PASSWORD_HASH in env (bcrypt hash)
function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is missing`);
  return v;
}

r.post("/login", async (req, res) => {
  const password = String(req.body?.password || "");
  if (!password) return res.status(400).json({ error: "MISSING_PASSWORD" });

  try {
    const hash = requireEnv("OWNER_PASSWORD_HASH");
    const ok = await bcrypt.compare(password, hash);
    if (!ok) return res.status(401).json({ error: "INVALID_CREDENTIALS" });

    const token = randomToken();
    const tokenHash = sha256(token);
    const expiresAt = new Date(Date.now() + OWNER_SESSION_DAYS * 24 * 3600_000);

    await withTx((db) =>
      db.query(`INSERT INTO owner_sessions(token_hash, expires_at) VALUES ($1,$2)`, [tokenHash, expiresAt])
    );

    res.cookie("owner_session", token, { ...cookieOpts(), maxAge: OWNER_SESSION_DAYS * 24 * 3600_000, path: "/" });
    return res.json({ ok: true });
  } catch (e) {
    console.error("[POST /auth/owner/login] error:", e);
    return res.status(500).json({ error: "INTERNAL" });
  }
});

r.post("/logout", async (req, res) => {
  try {
    const token = req.cookies?.owner_session;
    if (token) {
      const tokenHash = sha256(token);
      await withTx((db) => db.query(`UPDATE owner_sessions SET revoked_at=now() WHERE token_hash=$1`, [tokenHash]));
    }
  } catch {}
  res.clearCookie("owner_session", { ...cookieOpts(), path: "/" });
  return res.json({ ok: true });
});

export default r;