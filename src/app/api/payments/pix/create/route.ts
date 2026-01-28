import { NextResponse } from "next/server";

import { getUserProfile } from "@/lib/auth/getProfile";
import { requireUser } from "@/lib/auth/requireUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { calculatePlatformFeeCents } from "@/lib/stripe/server";

type AsaasCustomer = {
  id: string;
};

type AsaasPayment = {
  id: string;
  status: string;
};

type AsaasPixQrCode = {
  encodedImage?: string;
  payload?: string;
  expirationDate?: string;
};

function getAsaasBaseUrl() {
  const env = process.env.ASAAS_ENV ? String(process.env.ASAAS_ENV).toLowerCase() : "";
  if (process.env.ASAAS_BASE_URL) return String(process.env.ASAAS_BASE_URL);
  if (env === "sandbox") return "https://api-sandbox.asaas.com";
  return "https://api.asaas.com";
}

function getAsaasApiKey() {
  const k = process.env.ASAAS_API_KEY ? String(process.env.ASAAS_API_KEY).trim() : "";
  return k;
}

async function asaasFetch<T>(path: string, init?: RequestInit) {
  const apiKey = getAsaasApiKey();
  if (!apiKey) return { ok: false as const, status: 500, json: null as T | null, text: "Asaas não configurado." };
  const base = getAsaasBaseUrl();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      access_token: apiKey,
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
  return { ok: res.ok, status: res.status, json, text };
}

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

    const existing = await supabaseAdmin
      .from("payments")
      .select("provider,provider_payment_id,status,amount")
      .eq("request_id", requestId)
      .maybeSingle();

    if (existing.data?.provider === "asaas" && existing.data.provider_payment_id && existing.data.status !== "RECEIVED") {
      const pid = String(existing.data.provider_payment_id);
      const qrRes = await asaasFetch<AsaasPixQrCode>(`/v3/payments/${encodeURIComponent(pid)}/pixQrCode`, { method: "GET" });
      if (qrRes.ok && qrRes.json?.payload && qrRes.json?.encodedImage) {
        return NextResponse.json(
          {
            provider: "asaas",
            status: String(existing.data.status ?? "PENDING"),
            qrCode: String(qrRes.json.payload),
            qrCodeBase64: String(qrRes.json.encodedImage),
            expiresAt: qrRes.json.expirationDate ? String(qrRes.json.expirationDate) : null,
          },
          { status: 200 },
        );
      }
    }

    const { data: partner } = await supabaseAdmin
      .from("tow_partners")
      .select("id,asaas_wallet_id")
      .eq("id", partnerId)
      .maybeSingle();

    const partnerWalletId = partner?.asaas_wallet_id ? String(partner.asaas_wallet_id).trim() : "";
    if (!partnerWalletId) {
      return NextResponse.json({ error: "Parceiro ainda não está habilitado para Pix (Split)." }, { status: 409 });
    }

    const platformFeeCents = calculatePlatformFeeCents(totalCents);
    const driverAmountCents = totalCents - platformFeeCents;
    const partnerPercent = Math.max(0, Math.min(100, Number(((driverAmountCents / totalCents) * 100).toFixed(4))));

    const customerName = (reqRow.cliente_nome ? String(reqRow.cliente_nome) : "").trim() || "Cliente";
    const customerEmail = (() => {
      const email = user?.email ? String(user.email).trim() : "";
      if (email) return email;
      return `guest+${requestId.replace(/[^a-zA-Z0-9]/g, "")}@reboquesos.local`;
    })();

    const customerRes = await asaasFetch<AsaasCustomer>("/v3/customers", {
      method: "POST",
      body: JSON.stringify({
        name: customerName,
        email: customerEmail,
        mobilePhone: reqRow.telefone_cliente ? String(reqRow.telefone_cliente) : undefined,
        externalReference: requestId,
      }),
    });
    if (!customerRes.ok || !customerRes.json?.id) {
      return NextResponse.json({ error: "Falha ao criar cliente Pix.", details: customerRes.json ?? customerRes.text }, { status: 502 });
    }

    const payRes = await asaasFetch<AsaasPayment>("/v3/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: customerRes.json.id,
        billingType: "PIX",
        value: Number((totalCents / 100).toFixed(2)),
        dueDate: todayIso(),
        description: `ReboqueSOS - Pedido ${requestId.slice(0, 8)}`,
        externalReference: requestId,
        splits: [{ walletId: partnerWalletId, percentualValue: partnerPercent }],
      }),
    });
    if (!payRes.ok || !payRes.json?.id) {
      return NextResponse.json({ error: "Falha ao criar Pix.", details: payRes.json ?? payRes.text }, { status: 502 });
    }

    const asaasPaymentId = String(payRes.json.id);
    const asaasStatus = String(payRes.json.status ?? "PENDING");

    const qrRes = await asaasFetch<AsaasPixQrCode>(`/v3/payments/${encodeURIComponent(asaasPaymentId)}/pixQrCode`, {
      method: "GET",
    });
    const qr = qrRes.ok && qrRes.json?.payload ? String(qrRes.json.payload) : "";
    const b64 = qrRes.ok && qrRes.json?.encodedImage ? String(qrRes.json.encodedImage) : "";
    if (!qr || !b64) return NextResponse.json({ error: "Pix criado, mas QR não disponível." }, { status: 502 });

    await supabaseAdmin.from("payments").upsert(
      {
        request_id: requestId,
        stripe_intent_id: null,
        amount: totalCents,
        currency: "brl",
        status: asaasStatus,
        provider: "asaas",
        provider_payment_id: asaasPaymentId,
        method: "pix",
        platform_fee_amount: platformFeeCents,
        driver_amount: driverAmountCents,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "request_id" },
    );

    return NextResponse.json(
      {
        provider: "asaas",
        status: asaasStatus,
        qrCode: qr,
        qrCodeBase64: b64,
        expiresAt: qrRes.ok && qrRes.json?.expirationDate ? String(qrRes.json.expirationDate) : null,
      },
      { status: 200 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao criar Pix.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
