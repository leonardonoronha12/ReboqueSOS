import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AsaasWebhook = {
  event?: string;
  payment?: {
    id?: string;
    status?: string;
    billingType?: string;
    externalReference?: string | null;
    value?: number;
  } | null;
};

export async function POST(request: Request) {
  try {
    const configuredToken = process.env.ASAAS_WEBHOOK_TOKEN ? String(process.env.ASAAS_WEBHOOK_TOKEN).trim() : "";
    if (configuredToken) {
      const headerToken = request.headers.get("asaas-access-token") ?? "";
      if (!headerToken || headerToken !== configuredToken) {
        return NextResponse.json({ received: true }, { status: 200 });
      }
    }

    const payload = (await request.json().catch(() => null)) as AsaasWebhook | null;
    const paymentId = payload?.payment?.id ? String(payload.payment.id).trim() : "";
    if (!paymentId) return NextResponse.json({ received: true }, { status: 200 });

    const requestId = payload?.payment?.externalReference ? String(payload.payment.externalReference).trim() : "";
    const status = payload?.payment?.status ? String(payload.payment.status).trim() : "";
    const billingType = payload?.payment?.billingType ? String(payload.payment.billingType).trim() : "";
    const event = payload?.event ? String(payload.event).trim() : "";

    const supabaseAdmin = createSupabaseAdminClient();
    const now = new Date().toISOString();

    if (requestId) {
      await supabaseAdmin
        .from("payments")
        .upsert(
          {
            request_id: requestId,
            stripe_intent_id: null,
            amount: payload?.payment?.value ? Math.round(Number(payload.payment.value) * 100) : 0,
            currency: "brl",
            status: status || event,
            provider: "asaas",
            provider_payment_id: paymentId,
            method: billingType ? billingType.toLowerCase() : "pix",
            updated_at: now,
          },
          { onConflict: "request_id" },
        );
    } else {
      await supabaseAdmin
        .from("payments")
        .update({ status: status || event, updated_at: now })
        .eq("provider", "asaas")
        .eq("provider_payment_id", paymentId);
    }

    const isPaid = status === "RECEIVED" || event === "PAYMENT_RECEIVED";
    if (isPaid && requestId) {
      await supabaseAdmin.from("tow_requests").update({ status: "PAGO", updated_at: now }).eq("id", requestId);
      await supabaseAdmin.from("tow_trips").update({ status: "finalizado", updated_at: now }).eq("request_id", requestId);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch {
    return NextResponse.json({ received: true }, { status: 200 });
  }
}

