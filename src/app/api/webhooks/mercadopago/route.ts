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

type MpTokenResponse = { access_token?: string; refresh_token?: string; expires_in?: number; user_id?: number | string };

async function refreshPartnerToken(params: { refresh_token: string }) {
  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("client_id", getRequiredEnv("MERCADOPAGO_CLIENT_ID"));
  body.set("client_secret", getRequiredEnv("MERCADOPAGO_CLIENT_SECRET"));
  body.set("refresh_token", params.refresh_token);
  const res = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const text = await res.text();
  let json: MpTokenResponse | null = null;
  try {
    json = text ? (JSON.parse(text) as MpTokenResponse) : null;
  } catch {
    json = null;
  }
  return { res, json, text };
}

async function getPartnerMpAccessToken(supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>, partnerId: string) {
  const { data: partner } = await supabaseAdmin
    .from("tow_partners")
    .select("id,mp_access_token,mp_refresh_token,mp_token_expires_at")
    .eq("id", partnerId)
    .maybeSingle();

  const access = partner?.mp_access_token ? String(partner.mp_access_token) : "";
  const refresh = partner?.mp_refresh_token ? String(partner.mp_refresh_token) : "";
  const expiresAt = partner?.mp_token_expires_at ? String(partner.mp_token_expires_at) : "";
  const expired = (() => {
    if (!expiresAt) return false;
    const t = new Date(expiresAt).getTime();
    if (!Number.isFinite(t)) return false;
    return t - Date.now() < 2 * 60 * 1000;
  })();

  if (access && !expired) return access;
  if (!refresh) return "";

  const { res, json } = await refreshPartnerToken({ refresh_token: refresh });
  if (!res.ok || !json?.access_token || !json?.refresh_token) return "";

  const expiresIn = Number(json.expires_in ?? 0);
  const nextExpiresAt = expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
  await supabaseAdmin
    .from("tow_partners")
    .update({
      mp_access_token: String(json.access_token),
      mp_refresh_token: String(json.refresh_token),
      mp_token_expires_at: nextExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", partnerId);

  return String(json.access_token);
}

async function mpGetPayment(paymentId: string, token: string) {
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

    const supabaseAdmin = createSupabaseAdminClient();
    const now = new Date().toISOString();

    const { data: paymentRow } = await supabaseAdmin
      .from("payments")
      .select("request_id,provider,provider_payment_id")
      .eq("provider", "mercadopago")
      .eq("provider_payment_id", paymentId)
      .maybeSingle();

    const requestIdFromDb = paymentRow?.request_id ? String(paymentRow.request_id) : "";
    const requestId = requestIdFromDb;
    if (!requestId) return NextResponse.json({ received: true }, { status: 200 });

    const { data: reqRow } = await supabaseAdmin
      .from("tow_requests")
      .select("id,accepted_proposal_id")
      .eq("id", requestId)
      .maybeSingle();

    const { data: proposal } = reqRow?.accepted_proposal_id
      ? await supabaseAdmin
          .from("tow_proposals")
          .select("id,partner_id")
          .eq("id", reqRow.accepted_proposal_id)
          .maybeSingle()
      : { data: null };

    const partnerId = proposal?.partner_id ? String(proposal.partner_id) : "";
    const sellerToken = partnerId ? await getPartnerMpAccessToken(supabaseAdmin, partnerId) : "";
    const token =
      sellerToken ||
      getOptionalEnvAny(["MERCADOPAGO_ACCESS_TOKEN", "MERCADO_PAGO_ACCESS_TOKEN"]) ||
      getRequiredEnv("MERCADOPAGO_ACCESS_TOKEN");

    const { res, json } = await mpGetPayment(paymentId, token);
    if (!res.ok || !json) return NextResponse.json({ received: true }, { status: 200 });

    const status = String(json.status ?? "");

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
