import { redirect } from "next/navigation";

import { getUserProfile } from "@/lib/auth/getProfile";
import { requireUser } from "@/lib/auth/requireUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { PartnerDashboardClient } from "./partnerDashboardClient";

export default async function PartnerDashboardPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const profile = await getUserProfile(user.id);
  if (!profile) redirect("/login");
  if (profile.role !== "reboque" && profile.role !== "admin") {
    return (
      <div className="rounded-xl border bg-white p-6">
        <h1 className="text-xl font-semibold">Acesso negado</h1>
        <p className="mt-2 text-sm text-zinc-700">Esta área é apenas para parceiros.</p>
      </div>
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data: partner } = await supabase
    .from("tow_partners")
    .select("id,empresa_nome,cidade,whatsapp_number,ativo,stripe_account_id")
    .eq("id", user.id)
    .maybeSingle();

  const cidade = partner?.cidade ?? "São Gonçalo";

  const { data: requests } = await supabase
    .from("tow_requests")
    .select("id,local_cliente,cidade,status,created_at")
    .eq("cidade", cidade)
    .in("status", ["PENDENTE", "PROPOSTA_RECEBIDA"])
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: trips } = await supabase
    .from("tow_trips")
    .select("id,request_id,status,created_at")
    .eq("driver_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <PartnerDashboardClient
      profile={profile}
      partner={partner ?? null}
      cidade={cidade}
      requests={(requests ?? []).map((r) => ({
        id: r.id,
        local_cliente: r.local_cliente,
        cidade: r.cidade,
        status: r.status,
        created_at: r.created_at,
      }))}
      trips={(trips ?? []).map((t) => ({
        id: t.id,
        request_id: t.request_id,
        status: t.status,
        created_at: t.created_at,
      }))}
    />
  );
}
