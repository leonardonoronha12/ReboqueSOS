import { NextResponse } from "next/server";

import { getRequiredEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripeServer } from "@/lib/stripe/server";

export async function POST(request: Request) {
  const stripe = getStripeServer();
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature." }, { status: 400 });

  const rawBody = await request.text();
  const webhookSecret = getRequiredEnv("STRIPE_WEBHOOK_SECRET");

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const supabaseAdmin = createSupabaseAdminClient();

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as { id: string; status: string; metadata?: Record<string, string> };
    const requestId = pi.metadata?.request_id;
    const now = new Date().toISOString();

    await supabaseAdmin
      .from("payments")
      .update({ status: "succeeded", updated_at: now })
      .eq("stripe_intent_id", pi.id);

    if (requestId) {
      await supabaseAdmin
        .from("tow_requests")
        .update({ status: "PAGO", updated_at: now })
        .eq("id", requestId);

      await supabaseAdmin
        .from("tow_trips")
        .update({ status: "a_caminho", updated_at: now })
        .eq("request_id", requestId);
    }
  }

  if (event.type === "payment_intent.canceled") {
    const pi = event.data.object as { id: string };
    await supabaseAdmin
      .from("payments")
      .update({ status: "canceled", updated_at: new Date().toISOString() })
      .eq("stripe_intent_id", pi.id);
  }

  if (event.type === "payment_intent.payment_failed") {
    const pi = event.data.object as { id: string };
    await supabaseAdmin
      .from("payments")
      .update({ status: "canceled", updated_at: new Date().toISOString() })
      .eq("stripe_intent_id", pi.id);
  }

  return NextResponse.json({ received: true });
}
