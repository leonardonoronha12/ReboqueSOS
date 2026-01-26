import { NextResponse } from "next/server";

import { getUserProfile } from "@/lib/auth/getProfile";
import { requireUser } from "@/lib/auth/requireUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripeServer } from "@/lib/stripe/server";

export async function POST(request: Request) {
  try {
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

    const stripe = getStripeServer();
    let accountId = partner?.stripe_account_id ?? null;

    if (!accountId) {
      const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(user.id);
      const email = userRes.user?.email ?? undefined;

      const account = await stripe.accounts.create({
        type: "express",
        country: "BR",
        email,
        business_type: "individual",
        capabilities: { transfers: { requested: true } },
        metadata: { user_id: user.id },
      });

      accountId = account.id;
      await supabaseAdmin
        .from("tow_partners")
        .update({ stripe_account_id: accountId, updated_at: new Date().toISOString() })
        .eq("id", user.id);
    }

    const origin = new URL(request.url).origin;
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/partner?stripe=refresh`,
      return_url: `${origin}/partner?stripe=return`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url, stripe_account_id: accountId }, { status: 200 });
  } catch (e) {
    const msg =
      e instanceof Error && e.message
        ? e.message
        : "Falha ao criar link de onboarding.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
