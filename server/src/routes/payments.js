// server/src/routes/payments.js
import { Router } from "express";
import Stripe from "stripe";
import { withTx } from "../db/pool.js";
import { requireClient } from "../middlewares/requireClient.js";

const r = Router();

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    const err = new Error("STRIPE_NOT_CONFIGURED");
    err.code = "STRIPE_NOT_CONFIGURED";
    throw err;
  }
  return new Stripe(key);
}

function getAppBaseUrl() {
  return process.env.APP_BASE_URL || "http://localhost:5173";
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function toCents(n) {
  return Math.round(Number(n) * 100);
}


// DEV ONLY: mock pay meet & greet
r.post("/meet-greet/:requestId/dev-pay", requireClient, async (req, res) => {
  const { requestId } = req.params;
  const clientId = req.client_id;

  try {
    const out = await withTx(async (db) => {
      const rq = await db.query(
        `SELECT id, client_id FROM requests WHERE id = $1`,
        [requestId]
      );

      if (!rq.rows.length) {
        const err = new Error("REQUEST_NOT_FOUND");
        err.code = "REQUEST_NOT_FOUND";
        throw err;
      }

      if (rq.rows[0].client_id !== clientId) {
        const err = new Error("FORBIDDEN");
        err.code = "FORBIDDEN";
        throw err;
      }

      const mg = await db.query(
        `SELECT * FROM meet_greets WHERE request_id = $1 FOR UPDATE`,
        [requestId]
      );

      if (!mg.rows.length) {
        const err = new Error("MEET_GREET_NOT_FOUND");
        err.code = "MEET_GREET_NOT_FOUND";
        throw err;
      }

      await db.query(
        `UPDATE meet_greets SET status = 'PAID' WHERE request_id = $1`,
        [requestId]
      );

      const updated = await db.query(
        `SELECT * FROM meet_greets WHERE request_id = $1`,
        [requestId]
      );

      return updated.rows[0];
    });

    return res.json({ meet_greet: out });
  } catch (e) {
    if (e?.code === "REQUEST_NOT_FOUND") {
      return res.status(404).json({ error: "REQUEST_NOT_FOUND" });
    }
    if (e?.code === "MEET_GREET_NOT_FOUND") {
      return res.status(404).json({ error: "MEET_GREET_NOT_FOUND" });
    }
    if (e?.code === "FORBIDDEN") {
      return res.status(403).json({ error: "FORBIDDEN" });
    }
    console.error("[POST /payments/meet-greet/:requestId/dev-pay] error:", e);
    return res.status(500).json({ error: "INTERNAL" });
  }
});

// DEV ONLY: mock pay request
r.post("/request/:requestId/dev-pay", requireClient, async (req, res) => {
  const { requestId } = req.params;
  const clientId = req.client_id;

  try {
    const out = await withTx(async (db) => {
      const rq = await db.query(
        `SELECT * FROM requests WHERE id = $1 FOR UPDATE`,
        [requestId]
      );

      if (!rq.rows.length) {
        const err = new Error("REQUEST_NOT_FOUND");
        err.code = "REQUEST_NOT_FOUND";
        throw err;
      }

      const request = rq.rows[0];

      if (request.client_id !== clientId) {
        const err = new Error("FORBIDDEN");
        err.code = "FORBIDDEN";
        throw err;
      }

      await db.query(
        `UPDATE requests SET status = 'PAID' WHERE id = $1`,
        [requestId]
      );

      const updated = await db.query(
        `SELECT * FROM requests WHERE id = $1`,
        [requestId]
      );

      return updated.rows[0];
    });

    return res.json({ request: out });
  } catch (e) {
    if (e?.code === "REQUEST_NOT_FOUND") {
      return res.status(404).json({ error: "REQUEST_NOT_FOUND" });
    }
    if (e?.code === "FORBIDDEN") {
      return res.status(403).json({ error: "FORBIDDEN" });
    }
    console.error("[POST /payments/request/:requestId/dev-pay] error:", e);
    return res.status(500).json({ error: "INTERNAL" });
  }
});

/**
 * Create Stripe Checkout for Meet & Greet
 * Fixed price: $15
 *
 * POST /payments/meet-greet/:requestId/checkout
 *//**
 * Create Stripe Checkout for Meet & Greet
 *
 * POST /payments/meet-greet/:requestId/checkout
 */
r.post("/meet-greet/:requestId/checkout", requireClient, async (req, res) => {
  const { requestId } = req.params;
  const clientId = req.client_id;

  try {
    const stripe = getStripe();
    const appBaseUrl = getAppBaseUrl();

    const out = await withTx(async (db) => {
      // request must belong to logged-in client
      const rq = await db.query(
        `SELECT id, client_id, status
         FROM requests
         WHERE id = $1`,
        [requestId]
      );

      if (!rq.rows.length) {
        const err = new Error("REQUEST_NOT_FOUND");
        err.code = "REQUEST_NOT_FOUND";
        throw err;
      }

      const request = rq.rows[0];
      if (request.client_id !== clientId) {
        const err = new Error("FORBIDDEN");
        err.code = "FORBIDDEN";
        throw err;
      }

      const mg = await db.query(
        `SELECT *
         FROM meet_greets
         WHERE request_id = $1
         FOR UPDATE`,
        [requestId]
      );

      if (!mg.rows.length) {
        const err = new Error("MEET_GREET_NOT_FOUND");
        err.code = "MEET_GREET_NOT_FOUND";
        throw err;
      }

      const meet = mg.rows[0];

      if (["PAID", "COMPLETED"].includes(meet.status)) {
        const err = new Error("MEET_GREET_ALREADY_PAID");
        err.code = "MEET_GREET_ALREADY_PAID";
        throw err;
      }

      const clientQ = await db.query(
        `SELECT id, name, email
         FROM clients
         WHERE id = $1`,
        [clientId]
      );
      const client = clientQ.rows[0] ?? null;

      const convoQ = await db.query(
        `SELECT id
         FROM conversations
         WHERE request_id = $1`,
        [requestId]
      );
      const conversationId = convoQ.rows[0]?.id ?? null;

      const amountCents = Number(meet.price_cents || 1500);
      const currency = (meet.currency || "usd").toLowerCase();

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        success_url: `${appBaseUrl}/chat/${conversationId ?? ""}?meet_paid=1`,
        cancel_url: `${appBaseUrl}/chat/${conversationId ?? ""}?meet_cancelled=1`,
        customer_email: client?.email || undefined,
        metadata: {
          kind: "MEET_GREET",
          request_id: requestId,
          meet_greet_id: meet.id,
          client_id: clientId,
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency,
              unit_amount: amountCents,
              product_data: {
                name: "Meet & Greet",
                description: "One-time meet & greet payment",
              },
            },
          },
        ],
      });

      await db.query(
        `
        UPDATE meet_greets
        SET
          status = 'PAYMENT_PENDING',
          stripe_session_id = $2
        WHERE id = $1
        `,
        [meet.id, session.id]
      );

      return {
        checkout_url: session.url,
        session_id: session.id,
        amount_cents: amountCents,
        currency,
      };
    });

    return res.status(201).json(out);
  } catch (e) {
    if (e?.code === "STRIPE_NOT_CONFIGURED") {
      return res.status(500).json({ error: "STRIPE_NOT_CONFIGURED" });
    }
    if (e?.code === "REQUEST_NOT_FOUND") {
      return res.status(404).json({ error: "REQUEST_NOT_FOUND" });
    }
    if (e?.code === "MEET_GREET_NOT_FOUND") {
      return res.status(404).json({ error: "MEET_GREET_NOT_FOUND" });
    }
    if (e?.code === "MEET_GREET_ALREADY_PAID") {
      return res.status(400).json({ error: "MEET_GREET_ALREADY_PAID" });
    }
    if (e?.code === "FORBIDDEN") {
      return res.status(403).json({ error: "FORBIDDEN" });
    }

    console.error("[POST /payments/meet-greet/:requestId/checkout] error:", e);
    return res.status(500).json({ error: "INTERNAL" });
  }
});

/**
 * Create Stripe Checkout for final request payment
 *
 * POST /payments/request/:requestId/checkout
 */
r.post("/request/:requestId/checkout", requireClient, async (req, res) => {
  const { requestId } = req.params;
  const clientId = req.client_id;

  try {
    const stripe = getStripe();
    const appBaseUrl = getAppBaseUrl();

    const out = await withTx(async (db) => {
      const rq = await db.query(
        `SELECT *
         FROM requests
         WHERE id = $1
         FOR UPDATE`,
        [requestId]
      );

      if (!rq.rows.length) {
        const err = new Error("REQUEST_NOT_FOUND");
        err.code = "REQUEST_NOT_FOUND";
        throw err;
      }

      const request = rq.rows[0];
      if (request.client_id !== clientId) {
        const err = new Error("FORBIDDEN");
        err.code = "FORBIDDEN";
        throw err;
      }

      if (["PAID", "COMPLETED"].includes(request.status)) {
        const err = new Error("REQUEST_ALREADY_PAID");
        err.code = "REQUEST_ALREADY_PAID";
        throw err;
      }

      const clientQ = await db.query(
        `SELECT id, name, email
         FROM clients
         WHERE id = $1`,
        [clientId]
      );
      const client = clientQ.rows[0] ?? null;

      const convoQ = await db.query(
        `SELECT id
         FROM conversations
         WHERE request_id = $1`,
        [requestId]
      );
      const conversationId = convoQ.rows[0]?.id ?? null;

      const serviceQ = await db.query(
        `SELECT
           id,
           service_type,
           base_rate_per_day,
           cat_rate_per_day,
           holiday_rate_per_day,
           additional_dog_rate_per_day,
           additional_cat_rate_per_day
         FROM services
         WHERE id = $1`,
        [request.service_id]
      );
      const service = serviceQ.rows[0];
      if (!service) {
        const err = new Error("SERVICE_NOT_FOUND");
        err.code = "SERVICE_NOT_FOUND";
        throw err;
      }

      const petsQ = await db.query(
        `
        SELECT p.*
        FROM request_pets rp
        JOIN pets p ON p.id = rp.pet_id
        WHERE rp.request_id = $1
        ORDER BY rp.created_at ASC, p.created_at ASC
        `,
        [requestId]
      );
      const pets = petsQ.rows;

      if (!pets.length) {
        const err = new Error("REQUEST_HAS_NO_PETS");
        err.code = "REQUEST_HAS_NO_PETS";
        throw err;
      }

      const holidaysQ = await db.query(
        `SELECT holiday_date
         FROM holidays`
      );
      const holidayDates = new Set(
        holidaysQ.rows.map((r) => String(r.holiday_date).slice(0, 10))
      );

      const quote = quoteRequest({
        startAt: request.start_at,
        endAt: request.end_at,
        pets,
        service,
        holidayDates,
      });

      const amountCents = toCents(quote.total);

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        success_url: `${appBaseUrl}/chat/${conversationId ?? ""}?paid=1`,
        cancel_url: `${appBaseUrl}/chat/${conversationId ?? ""}?payment_cancelled=1`,
        customer_email: client?.email || undefined,
        metadata: {
          kind: "REQUEST_BOOKING",
          request_id: requestId,
          client_id: clientId,
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: amountCents,
              product_data: {
                name: `${service.service_type} booking`,
                description: `Final booking payment for request ${requestId}`,
              },
            },
          },
        ],
      });

      await db.query(
        `
        UPDATE requests
        SET status = 'PAYMENT_PENDING'
        WHERE id = $1
        `,
        [requestId]
      );

      return {
        checkout_url: session.url,
        session_id: session.id,
        amount_cents: amountCents,
        quote,
      };
    });

    return res.status(201).json(out);
  } catch (e) {
    if (e?.code === "STRIPE_NOT_CONFIGURED") {
      return res.status(500).json({ error: "STRIPE_NOT_CONFIGURED" });
    }
    if (e?.code === "REQUEST_NOT_FOUND") {
      return res.status(404).json({ error: "REQUEST_NOT_FOUND" });
    }
    if (e?.code === "REQUEST_ALREADY_PAID") {
      return res.status(400).json({ error: "REQUEST_ALREADY_PAID" });
    }
    if (e?.code === "REQUEST_HAS_NO_PETS") {
      return res.status(400).json({ error: "REQUEST_HAS_NO_PETS" });
    }
    if (e?.code === "SERVICE_NOT_FOUND") {
      return res.status(404).json({ error: "SERVICE_NOT_FOUND" });
    }
    if (e?.code === "FORBIDDEN") {
      return res.status(403).json({ error: "FORBIDDEN" });
    }

    console.error("[POST /payments/request/:requestId/checkout] error:", e);
    return res.status(500).json({ error: "INTERNAL" });
  }
});

export default r;

/* ---------------- pricing helpers ---------------- */

function quoteRequest({ startAt, endAt, pets, service, holidayDates }) {
  const unitsMeta = computeDayUnits(startAt, endAt);
  if (!unitsMeta) {
    const err = new Error("INVALID_TIME_RANGE");
    err.code = "INVALID_TIME_RANGE";
    throw err;
  }

  const holidayUnits = computeHolidayUnits(startAt, unitsMeta, holidayDates);
  const normalUnits = round2(unitsMeta.dayUnits - holidayUnits);

  const base = Number(service.base_rate_per_day || 0);
  const holiday = Number(service.holiday_rate_per_day || base * 1.2);
  const catRate = Number(service.cat_rate_per_day || base * 0.8);
  const addDog = Number(service.additional_dog_rate_per_day || base * 0.8);
  const addCat = Number(service.additional_cat_rate_per_day || catRate * 0.8);

  let total = 0;
  let firstDogNormal = 0;
  let firstDogHoliday = 0;
  let firstCat = 0;
  let additionalDogs = 0;
  let additionalCats = 0;

  pets.forEach((pet, idx) => {
    const type = pet.pet_type;

    if (idx === 0) {
      if (type === "DOG") {
        firstDogNormal = round2(normalUnits * base);
        firstDogHoliday = round2(holidayUnits * holiday);
        total += firstDogNormal + firstDogHoliday;
      } else if (type === "CAT") {
        firstCat = round2(unitsMeta.dayUnits * catRate);
        total += firstCat;
      } else {
        firstDogNormal = round2(normalUnits * base);
        firstDogHoliday = round2(holidayUnits * holiday);
        total += firstDogNormal + firstDogHoliday;
      }
      return;
    }

    if (type === "DOG") {
      const cost = round2(unitsMeta.dayUnits * addDog);
      additionalDogs += cost;
      total += cost;
    } else if (type === "CAT") {
      const cost = round2(unitsMeta.dayUnits * addCat);
      additionalCats += cost;
      total += cost;
    } else {
      const cost = round2(unitsMeta.dayUnits * addDog);
      additionalDogs += cost;
      total += cost;
    }
  });

  return {
    duration: unitsMeta,
    units: {
      holiday_units: holidayUnits,
      normal_units: normalUnits,
    },
    breakdown: {
      first_dog_normal: round2(firstDogNormal),
      first_dog_holiday: round2(firstDogHoliday),
      first_cat: round2(firstCat),
      additional_dogs: round2(additionalDogs),
      additional_cats: round2(additionalCats),
      total: round2(total),
    },
    total: round2(total),
  };
}

function computeDayUnits(startAt, endAt) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const ms = end.getTime() - start.getTime();

  if (!Number.isFinite(ms) || ms <= 0) return null;

  const hours = ms / 3600e3;

  if (hours < 24) {
    return {
      hours: round2(hours),
      fullDays: 0,
      extraHours: round2(hours),
      dayUnits: 1,
      extraUnits: 1,
    };
  }

  const fullDays = Math.floor(hours / 24);
  const extraHours = hours - fullDays * 24;

  let extraUnits = 0;
  if (extraHours === 0) extraUnits = 0;
  else if (extraHours <= 12) extraUnits = 0.5;
  else extraUnits = 1;

  return {
    hours: round2(hours),
    fullDays,
    extraHours: round2(extraHours),
    dayUnits: fullDays + extraUnits,
    extraUnits,
  };
}

function computeHolidayUnits(startAt, unitsMeta, holidayDates) {
  const start = new Date(startAt);
  let holidayUnits = 0;

  function ymdLocal(date) {
    const d = new Date(date);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function addHours(date, h) {
    return new Date(date.getTime() + h * 3600 * 1000);
  }

  function touchesHoliday(unitStart, unitEnd) {
    const startKey = ymdLocal(unitStart);
    const endKey = ymdLocal(new Date(unitEnd.getTime() - 1));
    return holidayDates.has(startKey) || holidayDates.has(endKey);
  }

  for (let i = 0; i < unitsMeta.fullDays; i++) {
    const unitStart = addHours(start, i * 24);
    const unitEnd = addHours(unitStart, 24);
    if (touchesHoliday(unitStart, unitEnd)) holidayUnits += 1;
  }

  if (unitsMeta.fullDays === 0 && unitsMeta.dayUnits === 1) {
    const unitStart = start;
    const unitEnd = addHours(start, Math.min(unitsMeta.hours, 24));
    if (touchesHoliday(unitStart, unitEnd)) holidayUnits += 1;
  } else if (unitsMeta.extraUnits === 0.5) {
    const unitStart = addHours(start, unitsMeta.fullDays * 24);
    const unitEnd = addHours(unitStart, 12);
    if (touchesHoliday(unitStart, unitEnd)) holidayUnits += 0.5;
  } else if (unitsMeta.extraUnits === 1) {
    const unitStart = addHours(start, unitsMeta.fullDays * 24);
    const unitEnd = addHours(unitStart, 24);
    if (touchesHoliday(unitStart, unitEnd)) holidayUnits += 1;
  }

  return holidayUnits;
}