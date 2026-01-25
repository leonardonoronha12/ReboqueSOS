import { NextResponse } from "next/server";

import { getUserProfile } from "@/lib/auth/getProfile";
import { requireUser } from "@/lib/auth/requireUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripeServer } from "@/lib/stripe/server";

function pickBrlCents(lines: Array<{ currency: string; amount: number }> | null | undefined) {
  const brl = (lines ?? []).find((l) => String(l.currency).toLowerCase() === "brl");
  return brl?.amount ?? 0;
}

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const profile = await getUserProfile(user.id);
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 403 });
  if (profile.role !== "reboque" && profile.role !== "admin") {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: partner, error: partnerErr } = await supabaseAdmin
    .from("tow_partners")
    .select("stripe_account_id")
    .eq("id", user.id)
    .maybeSingle();

  if (partnerErr) return NextResponse.json({ error: partnerErr.message }, { status: 500 });
  if (!partner?.stripe_account_id) {
    return NextResponse.json({ connected: false }, { status: 200 });
  }

  const stripe = getStripeServer();
  const balance = await stripe.balance.retrieve({}, { stripeAccount: partner.stripe_account_id });

  const availableCents = pickBrlCents(balance.available as Array<{ currency: string; amount: number }>);
  const pendingCents = pickBrlCents(balance.pending as Array<{ currency: string; amount: number }>);

  return NextResponse.json(
    {
      connected: true,
      stripe_account_id: partner.stripe_account_id,
      available_cents: availableCents,
      pending_cents: pendingCents,
    },
    { status: 200 },
  );
}

