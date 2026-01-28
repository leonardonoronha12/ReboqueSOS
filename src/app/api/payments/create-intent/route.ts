import { NextResponse } from "next/server";

import { getUserProfile } from "@/lib/auth/getProfile";
import { requireUser } from "@/lib/auth/requireUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { calculatePlatformFeeCents, getStripeServer } from "@/lib/stripe/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as null | { requestId?: string };
    const requestId = String(body?.requestId ?? "");
    if (!requestId) return NextResponse.json({ error: "requestId obrigatório." }, { status: 400 });

    const user = await requireUser();
    const profile = user ? await getUserProfile(user.id) : null;

    const supabaseAdmin = createSupabaseAdminClient();
    const { data: reqRow, error: reqErr } = await supabaseAdmin
      .from("tow_requests")
      .select("id,cliente_id,status,accepted_proposal_id")
      .eq("id", requestId)
      .maybeSingle();

    if (reqErr || !reqRow) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });

    if (reqRow.status === "PAGO") {
      return NextResponse.json({ error: "Pedido já está pago." }, { status: 409 });
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

    if (!reqRow.accepted_proposal_id) {
      return NextResponse.json({ error: "Pedido ainda não foi aceito." }, { status: 409 });
    }

    const { data: proposal } = await supabaseAdmin
      .from("tow_proposals")
      .select("id,partner_id,valor")
      .eq("id", reqRow.accepted_proposal_id)
      .maybeSingle();

    if (!proposal) return NextResponse.json({ error: "Proposta aceita não encontrada." }, { status: 404 });

    const { data: partner } = await supabaseAdmin
      .from("tow_partners")
      .select("id,stripe_account_id")
      .eq("id", proposal.partner_id)
      .maybeSingle();

    if (!partner?.stripe_account_id) {
      return NextResponse.json(
        { error: "Parceiro sem Stripe Connect configurado." },
        { status: 409 },
      );
    }

    const totalCents = Math.round(Number(proposal.valor) * 100);
    if (!Number.isFinite(totalCents) || totalCents <= 0) {
      return NextResponse.json({ error: "Valor inválido." }, { status: 400 });
    }

    const platformFee = calculatePlatformFeeCents(totalCents);
    const driverAmount = totalCents - platformFee;
    const stripe = getStripeServer();

    const existing = await supabaseAdmin
      .from("payments")
      .select("stripe_intent_id,status")
      .eq("request_id", requestId)
      .maybeSingle();

    if (existing.data?.stripe_intent_id && existing.data.status === "succeeded") {
      return NextResponse.json({ error: "Pedido já está pago." }, { status: 409 });
    }

    if (existing.data?.stripe_intent_id && existing.data.status !== "succeeded") {
      const pi = await stripe.paymentIntents.retrieve(existing.data.stripe_intent_id);
      const pmTypes = Array.isArray(pi.payment_method_types) ? pi.payment_method_types : [];
      const supportsPix = pmTypes.includes("pix");
      const canReuse = supportsPix && pi.status !== "canceled" && pi.status !== "succeeded";
      if (canReuse && pi.client_secret) {
        await supabaseAdmin
          .from("payments")
          .update({ status: pi.status, updated_at: new Date().toISOString() })
          .eq("stripe_intent_id", pi.id);
        return NextResponse.json({ clientSecret: pi.client_secret }, { status: 200 });
      }

      if (!supportsPix && pi.status !== "succeeded") {
        await stripe.paymentIntents.cancel(pi.id).catch(() => null);
      }
    }

    const intent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: "brl",
      payment_method_types: ["card", "pix"],
      payment_method_options: {
        pix: { expires_after_seconds: 3600 },
      },
      application_fee_amount: platformFee,
      transfer_data: {
        destination: partner.stripe_account_id,
      },
      metadata: {
        request_id: requestId,
        trip_id: trip?.id ?? "",
        partner_id: partner.id,
      },
    });

    await supabaseAdmin.from("payments").upsert(
      {
        request_id: requestId,
        stripe_intent_id: intent.id,
        amount: totalCents,
        currency: "brl",
        status: intent.status,
        platform_fee_amount: platformFee,
        driver_amount: driverAmount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "request_id" },
    );

    return NextResponse.json({ clientSecret: intent.client_secret }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao criar pagamento.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
