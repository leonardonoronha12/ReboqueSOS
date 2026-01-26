import { NextResponse } from "next/server";

import { getUserProfile } from "@/lib/auth/getProfile";
import { requireUser } from "@/lib/auth/requireUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripeServer } from "@/lib/stripe/server";

function pickBrlCents(lines: Array<{ currency: string; amount: number }> | null | undefined) {
  const brl = (lines ?? []).find((l) => String(l.currency).toLowerCase() === "brl");
  return brl?.amount ?? 0;
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const profile = await getUserProfile(user.id);
    if (!profile) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 403 });
    if (profile.role !== "reboque" && profile.role !== "admin") {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as { amount_cents?: number };
    const requestedCents = typeof body.amount_cents === "number" ? Math.floor(body.amount_cents) : null;

    const supabaseAdmin = createSupabaseAdminClient();
    const { data: partner, error: partnerErr } = await supabaseAdmin
      .from("tow_partners")
      .select("stripe_account_id")
      .eq("id", user.id)
      .maybeSingle();

    if (partnerErr) return NextResponse.json({ error: partnerErr.message }, { status: 500 });
    if (!partner?.stripe_account_id) return NextResponse.json({ error: "Conta Stripe não configurada." }, { status: 409 });

    const stripe = getStripeServer();
    const balance = await stripe.balance.retrieve({}, { stripeAccount: partner.stripe_account_id });
    const availableCents = pickBrlCents(balance.available as Array<{ currency: string; amount: number }>);

    const amount = requestedCents == null ? availableCents : requestedCents;
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Sem saldo disponível para saque." }, { status: 409 });
    }
    if (amount > availableCents) {
      return NextResponse.json({ error: "Valor acima do saldo disponível." }, { status: 409 });
    }

    const payout = await stripe.payouts.create(
      { amount, currency: "brl" },
      { stripeAccount: partner.stripe_account_id },
    );

    return NextResponse.json({ payout_id: payout.id, status: payout.status, amount_cents: amount }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error && e.message ? e.message : "Falha ao sacar.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
