/**
 * Minimal "owner" auth for a solo-sitter site.
 * - Public endpoints: create request, chat as client, checkout
 * - Owner-only endpoints: confirm request, send owner messages, etc.
 *
 * For speed: pass header `x-owner-token` and compare with OWNER_ADMIN_TOKEN.
 */
export function requireOwner(req, res, next) {
  const expected = process.env.OWNER_ADMIN_TOKEN;
  if (!expected) {
    // In dev, allow if not set (but set it in prod!)
    return next();
  }
  const token = req.header("x-owner-token");
  if (!token || token !== expected) {
    return res.status(401).json({ error: "OWNER_UNAUTHORIZED" });
  }
  return next();
}
