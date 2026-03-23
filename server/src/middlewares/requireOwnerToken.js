// server/src/middlewares/requireOwnerToken.js
export function requireOwner(req, res, next) {
  const token = req.header("X-Owner-Token");
  if (!token || token !== process.env.OWNER_ADMIN_TOKEN) {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }
  next();
}