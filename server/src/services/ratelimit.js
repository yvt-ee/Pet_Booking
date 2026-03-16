// server/src/services/ratelimit.js
const buckets = new Map();

/**
 * In-memory sliding window-ish limiter.
 * key: string (ip or email)
 * limit: number
 * windowMs: number
 */
export function rateLimit({ keyFn, limit, windowMs }) {
  return (req, res, next) => {
    const key = keyFn(req);
    const now = Date.now();
    const b = buckets.get(key) || { ts: [], blockedUntil: 0 };

    if (b.blockedUntil > now) {
      return res.status(429).json({ error: "RATE_LIMITED" });
    }

    // keep only timestamps within window
    b.ts = b.ts.filter((t) => now - t < windowMs);
    b.ts.push(now);

    if (b.ts.length > limit) {
      // block for a short cool-down
      b.blockedUntil = now + Math.min(windowMs, 60_000);
      buckets.set(key, b);
      return res.status(429).json({ error: "RATE_LIMITED" });
    }

    buckets.set(key, b);
    next();
  };
}