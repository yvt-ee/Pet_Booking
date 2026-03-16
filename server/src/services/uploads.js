import fs from "node:fs";
import path from "node:path";
import multer from "multer";

export function ensureUploadsDir() {
  const dir = path.resolve(process.env.UPLOAD_DIR ?? "uploads");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function uploadMiddleware({ fieldName = "file", maxSizeMB = 8 } = {}) {
  const dir = ensureUploadsDir();
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dir),
    filename: (_req, file, cb) => {
      const safeOrig = (file.originalname || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
      const stamp = Date.now();
      cb(null, `${stamp}-${Math.random().toString(16).slice(2)}-${safeOrig}`);
    }
  });

  const upload = multer({
    storage,
    limits: { fileSize: maxSizeMB * 1024 * 1024 }
  });

  return upload.single(fieldName);
}

export function buildPublicUrl(req, filename) {
  const base = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
  return `${base}/uploads/${encodeURIComponent(filename)}`;
}
