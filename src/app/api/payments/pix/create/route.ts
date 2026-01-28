import { NextResponse } from "next/server";

import { getUserProfile } from "@/lib/auth/getProfile";
import { getRequiredEnv } from "@/lib/env";
import { requireUser } from "@/lib/auth/requireUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { calculatePlatformFeeCents } from "@/lib/stripe/server";

type MpPaymentResponse = {
  id?: number | string;
  status?: string;
  date_of_expiration?: string | null;
  external_reference?: string | null;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string | null;
      qr_code_base64?: string | null;
    } | null;
  } | null;
};

async function mpFetchWithToken<T>(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`https://api.mercadopago.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const text = await res.text();
  let json: T | null = null;
  try {
    json = text ? (JSON.parse(text) as T) : null;
  } catch {
    json = null;
  }
  return { res, json, text };
}

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

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as null | { requestId?: string };
    const requestId = String(body?.requestId ?? "").trim();
    if (!requestId) return NextResponse.json({ error: "requestId obrigatório." }, { status: 400 });

    const user = await requireUser();
    const profile = user ? await getUserProfile(user.id) : null;

    const supabaseAdmin = createSupabaseAdminClient();
    const { data: reqRow } = await supabaseAdmin
      .from("tow_requests")
      .select("id,cliente_id,status,accepted_proposal_id,cliente_nome,telefone_cliente")
      .eq("id", requestId)
      .maybeSingle();

    if (!reqRow) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    if (reqRow.status === "PAGO") return NextResponse.json({ error: "Pedido já está pago." }, { status: 409 });
    if (!reqRow.accepted_proposal_id) {
      return NextResponse.json({ error: "Pedido ainda não foi aceito." }, { status: 409 });
    }

    const { data: trip } = await supabaseAdmin
      .from("tow_trips")
      .select("id,driver_id,status")
      .eq("request_id", requestId)
      .maybeSingle();

    const canPay = (() => {
      if (!user) return reqRow.cliente_id == null;
      if (!profile) return false;
      return profile.role === "admin" || reqRow.cliente_id === user.id || (trip?.driver_id && trip.driver_id === user.id);
    })();

    if (!canPay) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

    const { data: proposal } = await supabaseAdmin
      .from("tow_proposals")
      .select("id,partner_id,valor")
      .eq("id", reqRow.accepted_proposal_id)
      .maybeSingle();

    if (!proposal) return NextResponse.json({ error: "Proposta aceita não encontrada." }, { status: 404 });
    const partnerId = String(proposal.partner_id ?? "").trim();
    if (!partnerId) return NextResponse.json({ error: "Parceiro inválido." }, { status: 400 });

    const totalCents = Math.round(Number(proposal.valor) * 100);
    if (!Number.isFinite(totalCents) || totalCents <= 0) {
      return NextResponse.json({ error: "Valor inválido." }, { status: 400 });
    }

    const sellerToken = await getPartnerMpAccessToken(supabaseAdmin, partnerId);
    if (!sellerToken) {
      return NextResponse.json(
        { error: "Parceiro não conectou o Mercado Pago para receber via Pix." },
        { status: 409 },
      );
    }

    const existing = await supabaseAdmin
      .from("payments")
      .select("provider,provider_payment_id,status,amount")
      .eq("request_id", requestId)
      .maybeSingle();

    if (existing.data?.provider === "mercadopago" && existing.data.provider_payment_id && existing.data.status !== "approved") {
      const pid = String(existing.data.provider_payment_id);
      const { res, json } = await mpFetchWithToken<MpPaymentResponse>(sellerToken, `/v1/payments/${encodeURIComponent(pid)}`, {
        method: "GET",
      });
      if (res.ok && json) {
        const qr = json.point_of_interaction?.transaction_data?.qr_code ?? null;
        const b64 = json.point_of_interaction?.transaction_data?.qr_code_base64 ?? null;
        const status = String(json.status ?? existing.data.status ?? "pending");
        await supabaseAdmin
          .from("payments")
          .update({ status, updated_at: new Date().toISOString() })
          .eq("request_id", requestId);
        if (qr && b64) {
          return NextResponse.json(
            { provider: "mercadopago", status, qrCode: qr, qrCodeBase64: b64, expiresAt: json.date_of_expiration ?? null },
            { status: 200 },
          );
        }
      }
    }

    const payerEmail = (() => {
      const email = user?.email ? String(user.email).trim() : "";
      if (email) return email;
      return `guest+${requestId.replace(/[^a-zA-Z0-9]/g, "")}@reboquesos.local`;
    })();

    const origin = new URL(request.url).origin;
    const notificationUrl = `${origin}/api/webhooks/mercadopago`;

    const platformFeeCents = calculatePlatformFeeCents(totalCents);
    const applicationFee = Number((platformFeeCents / 100).toFixed(2));
    const driverAmount = totalCents - platformFeeCents;

    const mpPayload = {
      transaction_amount: Number((totalCents / 100).toFixed(2)),
      description: `ReboqueSOS - Pedido ${requestId.slice(0, 8)}`,
      payment_method_id: "pix",
      payer: { email: payerEmail },
      external_reference: requestId,
      notification_url: notificationUrl,
      application_fee: applicationFee,
    };

    const { res: mpRes, json: mpJson, text: mpText } = await mpFetchWithToken<MpPaymentResponse>(sellerToken, "/v1/payments", {
      method: "POST",
      headers: { "X-Idempotency-Key": `reboquesos_pix_${requestId}` },
      body: JSON.stringify(mpPayload),
    });

    if (!mpRes.ok || !mpJson?.id) {
      return NextResponse.json({ error: "Falha ao criar Pix.", details: mpJson ?? mpText }, { status: 502 });
    }

    const mpId = String(mpJson.id);
    const status = String(mpJson.status ?? "pending");
    const qr = mpJson.point_of_interaction?.transaction_data?.qr_code ?? null;
    const b64 = mpJson.point_of_interaction?.transaction_data?.qr_code_base64 ?? null;
    if (!qr || !b64) return NextResponse.json({ error: "Pix criado, mas QR não disponível." }, { status: 502 });

    await supabaseAdmin.from("payments").upsert(
      {
        request_id: requestId,
        stripe_intent_id: null,
        amount: totalCents,
        currency: "brl",
        status,
        provider: "mercadopago",
        provider_payment_id: mpId,
        method: "pix",
        platform_fee_amount: platformFeeCents,
        driver_amount: driverAmount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "request_id" },
    );

    return NextResponse.json(
      { provider: "mercadopago", status, qrCode: qr, qrCodeBase64: b64, expiresAt: mpJson.date_of_expiration ?? null },
      { status: 200 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao criar Pix.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
