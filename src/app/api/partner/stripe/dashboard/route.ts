import { NextResponse } from "next/server";

import { getUserProfile } from "@/lib/auth/getProfile";
import { requireUser } from "@/lib/auth/requireUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripeServer } from "@/lib/stripe/server";

export async function POST() {
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
  if (!partner?.stripe_account_id) return NextResponse.json({ error: "Conta Stripe não configurada." }, { status: 409 });

  const stripe = getStripeServer();
  const link = await stripe.accounts.createLoginLink(partner.stripe_account_id);
  return NextResponse.json({ url: link.url }, { status: 200 });
}

