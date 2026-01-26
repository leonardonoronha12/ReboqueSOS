import { NextResponse } from "next/server";

import { getUserProfile } from "@/lib/auth/getProfile";
import { requireUser } from "@/lib/auth/requireUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripeServer } from "@/lib/stripe/server";

export async function GET() {
  try {
    const user = await requireUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const profile = await getUserProfile(user.id);
    if (!profile || (profile.role !== "reboque" && profile.role !== "admin")) {
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
      return NextResponse.json({ ok: true, account: null }, { status: 200 });
    }

    const stripe = getStripeServer();
    const account = await stripe.accounts.retrieve(partner.stripe_account_id);

    return NextResponse.json(
      {
        ok: true,
        account: {
          id: account.id,
          type: (account as { type?: string }).type ?? null,
          charges_enabled: Boolean((account as { charges_enabled?: boolean }).charges_enabled),
          payouts_enabled: Boolean((account as { payouts_enabled?: boolean }).payouts_enabled),
          disabled_reason: (account as { requirements?: { disabled_reason?: string | null } }).requirements?.disabled_reason ?? null,
          requirements: (account as { requirements?: { currently_due?: string[]; eventually_due?: string[]; past_due?: string[] } }).requirements
            ? {
                currently_due:
                  (account as { requirements?: { currently_due?: string[] } }).requirements?.currently_due ?? [],
                eventually_due:
                  (account as { requirements?: { eventually_due?: string[] } }).requirements?.eventually_due ?? [],
                past_due: (account as { requirements?: { past_due?: string[] } }).requirements?.past_due ?? [],
              }
            : null,
        },
      },
      { status: 200 },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha ao carregar status." },
      { status: 500 },
    );
  }
}

