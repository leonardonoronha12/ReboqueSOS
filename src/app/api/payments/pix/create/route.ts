import { NextResponse } from "next/server";

import { getUserProfile } from "@/lib/auth/getProfile";
import { getOptionalEnvAny, getRequiredEnv } from "@/lib/env";
import { requireUser } from "@/lib/auth/requireUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

async function mpFetch<T>(path: string, init?: RequestInit) {
  const token =
    getOptionalEnvAny(["MERCADOPAGO_ACCESS_TOKEN", "MERCADO_PAGO_ACCESS_TOKEN"]) ?? getRequiredEnv("MERCADOPAGO_ACCESS_TOKEN");
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

    const totalCents = Math.round(Number(proposal.valor) * 100);
    if (!Number.isFinite(totalCents) || totalCents <= 0) {
      return NextResponse.json({ error: "Valor inválido." }, { status: 400 });
    }

    const existing = await supabaseAdmin
      .from("payments")
      .select("provider,provider_payment_id,status,amount")
      .eq("request_id", requestId)
      .maybeSingle();

    if (existing.data?.provider === "mercadopago" && existing.data.provider_payment_id && existing.data.status !== "approved") {
      const pid = String(existing.data.provider_payment_id);
      const { res, json } = await mpFetch<MpPaymentResponse>(`/v1/payments/${encodeURIComponent(pid)}`, { method: "GET" });
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

    const mpPayload = {
      transaction_amount: Number((totalCents / 100).toFixed(2)),
      description: `ReboqueSOS - Pedido ${requestId.slice(0, 8)}`,
      payment_method_id: "pix",
      payer: { email: payerEmail },
      external_reference: requestId,
      notification_url: notificationUrl,
    };

    const { res: mpRes, json: mpJson, text: mpText } = await mpFetch<MpPaymentResponse>("/v1/payments", {
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
        platform_fee_amount: 0,
        driver_amount: 0,
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

