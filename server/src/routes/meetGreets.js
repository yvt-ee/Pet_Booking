import { Router } from "express";
import { withTx } from "../db/pool.js";
import { stripe, requireStripeConfig } from "../services/stripe.js";

const r = Router();

/**
 * POST /meet-greets/:id/checkout
 * Creates Stripe Checkout for a fixed $15 (or price_cents in DB).
 */
r.post("/:id/checkout", async (req, res) => {
  const { id } = req.params;
  try {
    requireStripeConfig();

    const out = await withTx(async (client) => {
      const q = await client.query(`SELECT * FROM meet_greets WHERE id=$1 FOR UPDATE`, [id]);
      if (!q.rows.length) return null;
      const mg = q.rows[0];

      if (["PAID","COMPLETED","CANCELLED"].includes(mg.status)) {
        const err = new Error("INVALID_STATE");
        err.code = "INVALID_STATE";
        throw err;
      }

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        success_url: `${process.env.APP_BASE_URL}/success?type=meet_greet&id=${mg.id}`,
        cancel_url: `${process.env.APP_BASE_URL}/cancel?type=meet_greet&id=${mg.id}`,
        line_items: [{
          quantity: 1,
          price_data: {
            currency: mg.currency ?? "usd",
            unit_amount: mg.price_cents,
            product_data: { name: "Meet & Greet (15 minutes)" }
          }
        }],
        metadata: {
          entity_type: "MEET_GREET",
          entity_id: mg.id
        }
      });

      await client.query(
        `UPDATE meet_greets SET status='PAYMENT_PENDING', stripe_session_id=$1 WHERE id=$2`,
        [session.id, mg.id]
      );

      await client.query(
        `
        INSERT INTO payments(entity_type, entity_id, stripe_session_id, status, amount_cents, currency)
        VALUES ('MEET_GREET',$1,$2,'INITIATED',$3,$4)
        ON CONFLICT (stripe_session_id) DO NOTHING
        `,
        [mg.id, session.id, mg.price_cents, mg.currency ?? "usd"]
      );

      return { checkout_url: session.url, stripe_session_id: session.id };
    });

    if (!out) return res.status(404).json({ error: "NOT_FOUND" });
    return res.json(out);
  } catch (e) {
    if (e?.code === "INVALID_STATE") return res.status(400).json({ error: "INVALID_STATE" });
    if (e?.code === "STRIPE_CONFIG_MISSING" || e?.code === "APP_BASE_URL_MISSING") {
      return res.status(500).json({ error: "STRIPE_CONFIG_MISSING" });
    }
    console.error("[POST /meet-greets/:id/checkout] error:", e);
    return res.status(500).json({ error: "INTERNAL" });
  }
});

export default r;
