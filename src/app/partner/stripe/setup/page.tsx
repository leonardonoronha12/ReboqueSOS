import { redirect } from "next/navigation";

import { getUserProfile } from "@/lib/auth/getProfile";
import { requireUser } from "@/lib/auth/requireUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { StripeCustomOnboardingClient } from "./stripeCustomOnboardingClient";

export default async function PartnerStripeSetupPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const profile = await getUserProfile(user.id);
  if (!profile || (profile.role !== "reboque" && profile.role !== "admin")) {
    redirect("/partner");
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: partner } = await supabaseAdmin
    .from("tow_partners")
    .select("id,cpf,empresa_nome,whatsapp_number,stripe_account_id")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <StripeCustomOnboardingClient
      initial={{
        cpf: partner?.cpf ?? null,
        email: user.email ?? null,
        fullName: profile.nome ?? "",
        phone: partner?.whatsapp_number ?? null,
        stripe_account_id: partner?.stripe_account_id ?? null,
      }}
    />
  );
}

