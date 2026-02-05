import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getTowRequestExpiresAtMs, isTowRequestExpired } from "@/lib/towRequestExpiry";

type PartnerRow = {
  id: string;
  empresa_nome: string | null;
  whatsapp_number: string | null;
  caminhao_modelo: string | null;
  caminhao_placa: string | null;
  caminhao_tipo: string | null;
  foto_parceiro_path: string | null;
};

export async function GET(_request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const supabaseAdmin = createSupabaseAdminClient();

  const { data: requestRow } = await supabaseAdmin
    .from("tow_requests")
    .select("id,local_cliente,cidade,status,accepted_proposal_id,telefone_cliente,modelo_veiculo,created_at,lat,lng,cliente_nome,destino_local,destino_lat,destino_lng")
    .eq("id", requestId)
    .maybeSingle();

  if (!requestRow) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });

  const expiresAtMs = getTowRequestExpiresAtMs(String((requestRow as { created_at?: unknown } | null)?.created_at ?? ""));
  const expired = isTowRequestExpired({
    createdAt: String((requestRow as { created_at?: unknown } | null)?.created_at ?? ""),
    status: String((requestRow as { status?: unknown } | null)?.status ?? ""),
    acceptedProposalId: (requestRow as { accepted_proposal_id?: string | null } | null)?.accepted_proposal_id ?? null,
  });

  const { data: proposals } = await supabaseAdmin
    .from("tow_proposals")
    .select("id,partner_id,valor,eta_minutes,accepted,created_at")
    .eq("request_id", requestId)
    .order("created_at", { ascending: false });

  const partnerIds = Array.from(
    new Set((proposals ?? []).map((p) => String((p as { partner_id?: string | null }).partner_id ?? "")).filter(Boolean)),
  );

  const { data: partners } = partnerIds.length
    ? await supabaseAdmin
        .from("tow_partners")
        .select("id,empresa_nome,whatsapp_number,caminhao_modelo,caminhao_placa,caminhao_tipo,foto_parceiro_path")
        .in("id", partnerIds)
    : { data: [] };

  const partnerById = new Map<string, PartnerRow>();
  for (const p of (partners ?? []) as unknown as PartnerRow[]) {
    const id = String(p?.id ?? "").trim();
    if (!id) continue;
    partnerById.set(id, {
      id,
      empresa_nome: p.empresa_nome ?? null,
      whatsapp_number: p.whatsapp_number ?? null,
      caminhao_modelo: p.caminhao_modelo ?? null,
      caminhao_placa: p.caminhao_placa ?? null,
      caminhao_tipo: p.caminhao_tipo ?? null,
      foto_parceiro_path: p.foto_parceiro_path ?? null,
    });
  }

  const proposalsWithPartner = (proposals ?? []).map((p) => {
    const pid = String((p as { partner_id?: string | null }).partner_id ?? "");
    const partner = partnerById.get(pid) ?? null;
    return {
      ...p,
      partner,
    };
  });

  const { data: trip } = await supabaseAdmin
    .from("tow_trips")
    .select("id,status")
    .eq("request_id", requestId)
    .maybeSingle();

  return NextResponse.json(
    {
      request: { ...requestRow, expires_at: expiresAtMs ? new Date(expiresAtMs).toISOString() : null, expired },
      proposals: proposalsWithPartner,
      trip: trip ?? null,
    },
    { status: 200 },
  );
}
