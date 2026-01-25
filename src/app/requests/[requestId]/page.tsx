import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { RequestDetailsClient } from "./requestDetailsClient";

export default async function RequestPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  const supabase = createSupabaseAdminClient();

  const { data: requestRow } = await supabase
    .from("tow_requests")
    .select("id,local_cliente,cidade,status,accepted_proposal_id,telefone_cliente,modelo_veiculo,created_at")
    .eq("id", requestId)
    .maybeSingle();

  const { data: proposals } = await supabase
    .from("tow_proposals")
    .select("id,partner_id,valor,eta_minutes,accepted,created_at")
    .eq("request_id", requestId)
    .order("created_at", { ascending: false });

  const { data: trip } = await supabase
    .from("tow_trips")
    .select("id,status")
    .eq("request_id", requestId)
    .maybeSingle();

  if (!requestRow) {
    return (
      <div className="rounded-xl border bg-white p-6">
        <h1 className="text-xl font-semibold">Pedido não encontrado</h1>
        <p className="mt-2 text-sm text-zinc-700">Verifique o link do chamado.</p>
      </div>
    );
  }

  return (
    <RequestDetailsClient
      requestId={requestRow.id}
      initialRequest={requestRow}
      initialProposals={proposals ?? []}
      initialTrip={trip ?? null}
    />
  );
}
