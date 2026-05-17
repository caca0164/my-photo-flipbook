import Stripe from "stripe";

let stripe: Stripe | null = null;

function isValidStripeSecretKey(key: string): boolean {
  return key.startsWith("sk_live_") || key.startsWith("sk_test_");
}

/** Use in server actions to show a clear message when Stripe env is wrong. */
export function getStripeSecretKeyIssue(): "missing" | "invalid_format" | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return "missing";
  if (!isValidStripeSecretKey(key)) return "invalid_format";
  return null;
}

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  if (!isValidStripeSecretKey(key)) {
    return null;
  }
  if (!stripe) stripe = new Stripe(key);
  return stripe;
}
