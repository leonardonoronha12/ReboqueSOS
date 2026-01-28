import { NextResponse } from "next/server";

import { getOptionalEnvAny, getRequiredEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type MpWebhook = {
  type?: string;
  action?: string;
  data?: { id?: string | number } | null;
};

type MpPayment = {
  id?: number | string;
  status?: string;
  external_reference?: string | null;
  transaction_amount?: number;
};

async function mpGetPayment(paymentId: string) {
  const token =
    getOptionalEnvAny(["MERCADOPAGO_ACCESS_TOKEN", "MERCADO_PAGO_ACCESS_TOKEN"]) ?? getRequiredEnv("MERCADOPAGO_ACCESS_TOKEN");
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  const text = await res.text();
  let json: MpPayment | null = null;
  try {
    json = text ? (JSON.parse(text) as MpPayment) : null;
  } catch {
    json = null;
  }
  return { res, json, text };
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => null)) as MpWebhook | null;
    const idRaw = payload?.data?.id;
    const paymentId = idRaw != null ? String(idRaw).trim() : "";
    if (!paymentId) return NextResponse.json({ received: true }, { status: 200 });

    const { res, json } = await mpGetPayment(paymentId);
    if (!res.ok || !json) return NextResponse.json({ received: true }, { status: 200 });

    const status = String(json.status ?? "");
    const requestId = json.external_reference ? String(json.external_reference).trim() : "";
    if (!requestId) return NextResponse.json({ received: true }, { status: 200 });

    const supabaseAdmin = createSupabaseAdminClient();
    const now = new Date().toISOString();

    const { data: existing } = await supabaseAdmin
      .from("payments")
      .select("request_id,amount,currency")
      .eq("request_id", requestId)
      .maybeSingle();

    const amountCents = json.transaction_amount
      ? Math.round(Number(json.transaction_amount) * 100)
      : typeof existing?.amount === "number"
        ? existing.amount
        : null;

    if (amountCents != null && amountCents > 0) {
      await supabaseAdmin
        .from("payments")
        .upsert(
          {
            request_id: requestId,
            stripe_intent_id: null,
            amount: amountCents,
            currency: existing?.currency ?? "brl",
            status,
            provider: "mercadopago",
            provider_payment_id: String(json.id ?? paymentId),
            method: "pix",
            updated_at: now,
          },
          { onConflict: "request_id" },
        );
    } else {
      await supabaseAdmin
        .from("payments")
        .update({
          status,
          provider: "mercadopago",
          provider_payment_id: String(json.id ?? paymentId),
          method: "pix",
          updated_at: now,
        })
        .eq("request_id", requestId);
    }

    if (status === "approved") {
      await supabaseAdmin.from("tow_requests").update({ status: "PAGO", updated_at: now }).eq("id", requestId);
      await supabaseAdmin.from("tow_trips").update({ status: "finalizado", updated_at: now }).eq("request_id", requestId);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch {
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
