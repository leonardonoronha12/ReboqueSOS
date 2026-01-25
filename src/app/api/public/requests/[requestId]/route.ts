import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(_request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const supabaseAdmin = createSupabaseAdminClient();

  const { data: requestRow } = await supabaseAdmin
    .from("tow_requests")
    .select("id,local_cliente,cidade,status,accepted_proposal_id,telefone_cliente,modelo_veiculo,created_at")
    .eq("id", requestId)
    .maybeSingle();

  if (!requestRow) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });

  const { data: proposals } = await supabaseAdmin
    .from("tow_proposals")
    .select("id,partner_id,valor,eta_minutes,accepted,created_at")
    .eq("request_id", requestId)
    .order("created_at", { ascending: false });

  const { data: trip } = await supabaseAdmin
    .from("tow_trips")
    .select("id,status")
    .eq("request_id", requestId)
    .maybeSingle();

  return NextResponse.json({ request: requestRow, proposals: proposals ?? [], trip: trip ?? null }, { status: 200 });
}

