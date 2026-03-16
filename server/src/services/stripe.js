import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2024-06-20"
});

export function requireStripeConfig() {
  if (!process.env.STRIPE_SECRET_KEY) {
    const err = new Error("STRIPE_SECRET_KEY is not set");
    err.code = "STRIPE_CONFIG_MISSING";
    throw err;
  }
  if (!process.env.APP_BASE_URL) {
    const err = new Error("APP_BASE_URL is not set (used for redirect URLs)");
    err.code = "APP_BASE_URL_MISSING";
    throw err;
  }
}

export function moneyToCentsUSD(amount) {
  // amount as number dollars
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}
