import { redirect } from "next/navigation";

import { getUserProfile } from "@/lib/auth/getProfile";
import { requireUser } from "@/lib/auth/requireUser";
import { getOptionalEnvAny } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { ProposalFormClient } from "./proposalFormClient";

export default async function PartnerRequestPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  const user = await requireUser();
  if (!user) redirect("/login");

  const profile = await getUserProfile(user.id);
  if (!profile || (profile.role !== "reboque" && profile.role !== "admin")) {
    redirect("/partner");
  }

  const supabase = createSupabaseAdminClient();
  const { data: reqRow } = await supabase
    .from("tow_requests")
    .select("id,local_cliente,cidade,status,created_at,lat,lng,cliente_nome,telefone_cliente,modelo_veiculo")
    .eq("id", requestId)
    .maybeSingle();

  if (!reqRow) {
    return (
      <div className="rounded-xl border bg-white p-6">
        <h1 className="text-xl font-semibold">Pedido não encontrado</h1>
      </div>
    );
  }

  const { data: myProposal } = await supabase
    .from("tow_proposals")
    .select("id,valor,eta_minutes,accepted,created_at")
    .eq("request_id", requestId)
    .eq("partner_id", user.id)
    .maybeSingle();

  const supabaseUrl = getOptionalEnvAny(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"]) ?? null;
  const supabaseAnonKey = getOptionalEnvAny(["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY"]) ?? null;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-6">
        <h1 className="text-xl font-semibold">Pedido #{reqRow.id.slice(0, 8)}</h1>
        <p className="mt-2 text-sm text-zinc-700">
          {reqRow.cidade} • {reqRow.local_cliente}
        </p>
        {reqRow.cliente_nome ? (
          <p className="mt-2 text-sm text-zinc-700">Cliente: {reqRow.cliente_nome}</p>
        ) : null}
        {reqRow.modelo_veiculo || reqRow.telefone_cliente ? (
          <p className="mt-2 text-sm text-zinc-700">
            {reqRow.modelo_veiculo ? `Veículo: ${reqRow.modelo_veiculo}` : null}
            {reqRow.modelo_veiculo && reqRow.telefone_cliente ? " • " : null}
            {reqRow.telefone_cliente ? `Telefone: ${reqRow.telefone_cliente}` : null}
          </p>
        ) : null}
        <div className="mt-3 flex items-center gap-2">
          <span className="rounded-full border bg-white px-3 py-1 text-xs font-medium">
            {reqRow.status}
          </span>
        </div>
      </div>

      <ProposalFormClient
        requestId={reqRow.id}
        initialProposal={myProposal ?? null}
        supabaseUrl={supabaseUrl}
        supabaseAnonKey={supabaseAnonKey}
      />
    </div>
  );
}
