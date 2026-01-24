import { NextResponse } from "next/server";

import { getUserProfile } from "@/lib/auth/getProfile";
import { requireUser } from "@/lib/auth/requireUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ proposalId: string }> },
) {
  const { proposalId } = await params;
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const profile = await getUserProfile(user.id);
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 403 });
  if (profile.role !== "cliente" && profile.role !== "admin") {
    return NextResponse.json({ error: "Apenas clientes podem aceitar." }, { status: 403 });
  }

  const supabaseAdmin = createSupabaseAdminClient();

  const { data: proposal, error: propErr } = await supabaseAdmin
    .from("tow_proposals")
    .select("id,request_id,partner_id,valor,eta_minutes,accepted")
    .eq("id", proposalId)
    .maybeSingle();

  if (propErr || !proposal) {
    return NextResponse.json({ error: "Proposta não encontrada." }, { status: 404 });
  }

  const { data: reqRow, error: reqErr } = await supabaseAdmin
    .from("tow_requests")
    .select("id,cliente_id,status")
    .eq("id", proposal.request_id)
    .maybeSingle();

  if (reqErr || !reqRow) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  if (profile.role !== "admin" && reqRow.cliente_id !== user.id) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  if (reqRow.status === "ACEITO" || reqRow.status === "A_CAMINHO") {
    const { data: existingTrip } = await supabaseAdmin
      .from("tow_trips")
      .select("id")
      .eq("request_id", reqRow.id)
      .maybeSingle();
    return NextResponse.json({ tripId: existingTrip?.id ?? null }, { status: 200 });
  }

  await supabaseAdmin
    .from("tow_proposals")
    .update({ accepted: false })
    .eq("request_id", proposal.request_id);

  await supabaseAdmin
    .from("tow_proposals")
    .update({ accepted: true })
    .eq("id", proposal.id);

  await supabaseAdmin
    .from("tow_requests")
    .update({
      status: "ACEITO",
      accepted_proposal_id: proposal.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", proposal.request_id);

  const { data: trip, error: tripErr } = await supabaseAdmin
    .from("tow_trips")
    .insert({
      request_id: proposal.request_id,
      driver_id: proposal.partner_id,
      status: "a_caminho",
    })
    .select("id")
    .single();

  if (tripErr) {
    return NextResponse.json({ error: tripErr.message }, { status: 500 });
  }

  return NextResponse.json({ tripId: trip.id }, { status: 200 });
}

