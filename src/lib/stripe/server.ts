import Stripe from "stripe";

import { getRequiredEnv } from "@/lib/env";

export function getStripeServer() {
  return new Stripe(getRequiredEnv("STRIPE_SECRET_KEY"));
}

export function calculatePlatformFeeCents(totalAmountCents: number) {
  return Math.round(totalAmountCents * 0.1);
}
