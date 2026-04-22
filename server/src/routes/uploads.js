import { Router } from "express";
import { makeObjectKey, presignPut, publicUrlForKey } from "../services/s3.js";

const r = Router();

r.post("/presign", async (req, res) => {
  try {
    const { kind, filename, content_type } = req.body ?? {};
    const allowed = new Set(["client_avatar", "pet_avatar", "pet_photo", "log_photo"]);
    if (!kind || !allowed.has(kind)) return res.status(400).json({ error: "INVALID_KIND" });
    if (!filename) return res.status(400).json({ error: "MISSING_FILENAME" });

    const key = makeObjectKey({ kind, originalName: filename });
    const upload_url = await presignPut({ key, contentType: content_type });
    const public_url = publicUrlForKey(key);

    return res.status(201).json({ key, upload_url, public_url });
  } catch (e) {
    console.error("[POST /uploads/presign] error:", e);

    if (e?.code === "S3_CONFIG_MISSING") {
      return res.status(500).json({ error: "S3_CONFIG_MISSING" });
    }

    return res.status(500).json({ error: "INTERNAL" });
  }
});

export default r;