import express from "express";
import { withTx } from "../db/pool.js";
import { stripe } from "../services/stripe.js";

// Stripe webhook requires RAW body
export const stripeWebhookRouter = express.Router();

stripeWebhookRouter.post(
  "/",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!secret) {
      return res.status(500).json({ error: "STRIPE_WEBHOOK_SECRET_MISSING" });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } catch (err) {
      console.error("[stripe webhook] signature verify failed:", err?.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      await withTx(async (client) => {
        // Idempotency: store event id, ignore duplicates
        const ins = await client.query(
          `INSERT INTO stripe_events(event_id, type) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING event_id`,
          [event.id, event.type]
        );
        if (!ins.rows.length) return; // already processed

        // Handle the main happy-path event
        if (event.type === "checkout.session.completed") {
          const session = event.data.object;
          const entityType = session.metadata?.entity_type;
          const entityId = session.metadata?.entity_id;
          const sessionId = session.id;

          if (!entityType || !entityId) return;

          // mark payment succeeded
          await client.query(
            `UPDATE payments SET status='SUCCEEDED' WHERE stripe_session_id=$1`,
            [sessionId]
          );

          if (entityType === "MEET_GREET") {
            await client.query(`UPDATE meet_greets SET status='PAID' WHERE id=$1`, [entityId]);
            // once meet paid, request can become READY_TO_CONFIRM (optional)
            const mg = await client.query(`SELECT request_id FROM meet_greets WHERE id=$1`, [entityId]);
            const requestId = mg.rows[0]?.request_id;
            if (requestId) {
              await client.query(
                `UPDATE requests SET status = CASE WHEN status='REQUESTED' THEN 'READY_TO_CONFIRM' ELSE status END WHERE id=$1`,
                [requestId]
              );
            }
          } else if (entityType === "REQUEST") {
            await client.query(`UPDATE requests SET status='PAID' WHERE id=$1`, [entityId]);
          }
        }
      });

      res.json({ received: true });
    } catch (e) {
      console.error("[stripe webhook] processing failed:", e);
      // Return 200 ONLY if you don't want Stripe retries.
      // For MVP, return 500 so Stripe retries (idempotency will protect you).
      res.status(500).json({ error: "WEBHOOK_PROCESSING_FAILED" });
    }
  }
);
