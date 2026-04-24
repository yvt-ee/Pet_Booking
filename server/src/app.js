import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

import requestsRouter from "./routes/requests.js";
import conversationsRouter from "./routes/conversations.js";
import meetGreetsRouter from "./routes/meetGreets.js";
import paymentsRouter from "./routes/payments.js";
import servicesRouter from "./routes/services.js";
import uploadsRouter from "./routes/uploads.js";
import clientsRouter from "./routes/clients.js";
import petsRouter from "./routes/pets.js";
import logsRouter from "./routes/logs.js";
import reviewsRouter from "./routes/reviews.js";
import ownerRouter from "./routes/owner.js";
import { stripeWebhookRouter } from "./routes/webhooks.js";
import holidaysRouter from "./routes/holidays.js";

import authClientRouter from "./routes/authClient.js";
import authOwnerRouter from "./routes/authOwner.js";

dotenv.config();

const app = express();
app.set("trust proxy", 1);

const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);


const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    return cb(null, allowedOrigins.includes(origin));
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-Owner-Token"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// cookie + json
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));

// Health check
app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, ts: new Date().toISOString() });
});

// Auth
app.use("/auth/client", authClientRouter);
app.use("/auth/owner", authOwnerRouter);

// APIs
app.use("/requests", requestsRouter);
app.use("/conversations", conversationsRouter);
app.use("/meet-greets", meetGreetsRouter);
app.use("/payments", paymentsRouter);
app.use("/services", servicesRouter);
app.use("/uploads", uploadsRouter);
app.use("/clients", clientsRouter);
app.use("/pets", petsRouter);
app.use("/logs", logsRouter);
app.use("/reviews", reviewsRouter);
app.use("/owner", ownerRouter);
app.use("/holidays", holidaysRouter);

// Stripe webhook MUST use raw body (mounted after json)
app.use("/webhooks/stripe", stripeWebhookRouter);

const port = Number(process.env.PORT ?? 8080);
app.listen(port, () => {
  console.log(`[server] listening on :${port}`);
});