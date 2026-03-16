import { Router } from "express";
import { withTx } from "../db/pool.js";
import { requireClient } from "../middlewares/requireClient.js";

const r = Router();

r.post("/me", requireClient, async (req, res) => {
  const clientId = req.client_id;
  const b = req.body ?? {};

  // Required fields (based on your pets table)
  const requiredText = ["name","pet_type","breed","energy_level","veterinary_info","pet_insurance","notes","avatar_url"];
  for (const k of requiredText) {
    if (!b[k] || typeof b[k] !== "string" || !b[k].trim()) {
      return res.status(400).json({ error: `MISSING_${k.toUpperCase()}` });
    }
  }

  // Required numeric
  if (b.age_years === undefined || b.age_years === null || Number.isNaN(Number(b.age_years))) {
    return res.status(400).json({ error: "MISSING_AGE_YEARS" });
  }
  if (b.weight_lbs === undefined || b.weight_lbs === null || Number.isNaN(Number(b.weight_lbs))) {
    return res.status(400).json({ error: "MISSING_WEIGHT_LBS" });
  }

  // Required booleans
  if (typeof b.microchipped !== "boolean") return res.status(400).json({ error: "MISSING_MICROCHIPPED" });
  if (typeof b.spayed_neutered !== "boolean") return res.status(400).json({ error: "MISSING_SPAYED_NEUTERED" });

  // Basic enum checks (optional but helpful)
  if (!["DOG","CAT","OTHER"].includes(b.pet_type)) return res.status(400).json({ error: "INVALID_PET_TYPE" });
  if (!["High","Moderate","Low"].includes(b.energy_level)) return res.status(400).json({ error: "INVALID_ENERGY_LEVEL" });

  // Quick avatar URL sanity check
  if (!/^https?:\/\//i.test(b.avatar_url.trim())) return res.status(400).json({ error: "INVALID_AVATAR_URL" });

  try {
    const pet = await withTx(async (db) => {
      const ins = await db.query(
        `INSERT INTO pets(
          client_id, name, pet_type, breed, age_years, weight_lbs, energy_level,
          microchipped, spayed_neutered, veterinary_info, pet_insurance, notes, avatar_url
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        RETURNING id, client_id, name, pet_type, breed, age_years, weight_lbs, energy_level,
                  microchipped, spayed_neutered, veterinary_info, pet_insurance, notes, avatar_url, created_at`,
        [
          clientId,
          b.name.trim(),
          b.pet_type,
          b.breed.trim(),
          Number(b.age_years),
          Number(b.weight_lbs),
          b.energy_level,
          b.microchipped,
          b.spayed_neutered,
          b.veterinary_info.trim(),
          b.pet_insurance.trim(),
          b.notes.trim(),
          b.avatar_url.trim(),
        ]
      );
      return ins.rows[0];
    });

    return res.status(201).json({ pet });
  } catch (e) {
    console.error("[POST /pets/me] error:", e);
    return res.status(500).json({ error: "INTERNAL" });
  }
});

r.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const pet = await withTx(async (db) => {
      const p = await db.query(`SELECT * FROM pets WHERE id=$1`, [id]);
      if (!p.rows.length) return null;
      const photos = await db.query(
        `SELECT id, url, caption, created_at FROM pet_photos WHERE pet_id=$1 ORDER BY created_at DESC`,
        [id]
      );
      return { ...p.rows[0], photos: photos.rows };
    });
    if (!pet) return res.status(404).json({ error: "NOT_FOUND" });
    return res.json({ pet });
  } catch (e) {
    console.error("[GET /pets/:id] error:", e);
    return res.status(500).json({ error: "INTERNAL" });
  }
});

r.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const body = req.body ?? {};

  const allowed = [
    "name","pet_type","breed","age_years","weight_lbs","energy_level",
    "microchipped","spayed_neutered","veterinary_info","pet_insurance","notes"
  ];

  const sets = [];
  const vals = [];
  let i = 1;
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, k)) {
      sets.push(`${k}=$${i++}`);
      vals.push(body[k]);
    }
  }
  if (!sets.length) return res.status(400).json({ error: "NO_FIELDS" });

  try {
    const pet = await withTx(async (db) => {
      const q = await db.query(
        `UPDATE pets SET ${sets.join(", ")} WHERE id=$${i} RETURNING *`,
        [...vals, id]
      );
      return q.rows[0] ?? null;
    });
    if (!pet) return res.status(404).json({ error: "NOT_FOUND" });
    return res.json({ pet });
  } catch (e) {
    console.error("[PATCH /pets/:id] error:", e);
    return res.status(500).json({ error: "INTERNAL" });
  }
});

r.patch("/:id/avatar", async (req, res) => {
  const { id } = req.params;
  const { url } = req.body ?? {};
  if (!url || typeof url !== "string") return res.status(400).json({ error: "INVALID_URL" });

  try {
    const out = await withTx(async (db) => {
      const q = await db.query(`UPDATE pets SET avatar_url=$1 WHERE id=$2 RETURNING id, avatar_url`, [url, id]);
      return q.rows[0] ?? null;
    });
    if (!out) return res.status(404).json({ error: "NOT_FOUND" });
    return res.json({ pet: out });
  } catch (e) {
    console.error("[PATCH /pets/:id/avatar] error:", e);
    return res.status(500).json({ error: "INTERNAL" });
  }
});

r.post("/:id/photos", async (req, res) => {
  const { id } = req.params;
  const { url, caption } = req.body ?? {};
  if (!url || typeof url !== "string") return res.status(400).json({ error: "INVALID_URL" });

  try {
    const out = await withTx(async (db) => {
      const exists = await db.query(`SELECT 1 FROM pets WHERE id=$1`, [id]);
      if (!exists.rows.length) return null;

      const ins = await db.query(
        `INSERT INTO pet_photos(pet_id, url, caption) VALUES ($1,$2,$3)
         RETURNING id, url, caption, created_at`,
        [id, url, caption ?? null]
      );
      return ins.rows[0];
    });

    if (!out) return res.status(404).json({ error: "NOT_FOUND" });
    return res.status(201).json({ photo: out });
  } catch (e) {
    console.error("[POST /pets/:id/photos] error:", e);
    return res.status(500).json({ error: "INTERNAL" });
  }
});

export default r;
