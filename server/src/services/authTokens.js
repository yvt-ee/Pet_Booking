// server/src/services/authTokens.js
import crypto from "node:crypto";

export function sha256(s) {
  return crypto.createHash("sha256").update(String(s)).digest("hex");
}

export function randomToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function randomOtp6() {
  // 000000 - 999999
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
}

export function cookieOpts() {
  const isProd = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
  };
}