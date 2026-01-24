import { loadStripe } from "@stripe/stripe-js";

import { getRequiredEnv } from "@/lib/env";

export const stripePromise = loadStripe(
  getRequiredEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"),
);

