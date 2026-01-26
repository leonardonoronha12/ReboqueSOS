import { NextResponse } from "next/server";

import { getUserProfile } from "@/lib/auth/getProfile";
import { requireUser } from "@/lib/auth/requireUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppMessage } from "@/lib/whatsapp/sendWhatsApp";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ proposalId: string }> },
) {
  const { proposalId } = await params;
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
    .select("id,cliente_id,status,local_cliente,cidade,telefone_cliente,modelo_veiculo")
    .eq("id", proposal.request_id)
    .maybeSingle();

  if (reqErr || !reqRow) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  const user = await requireUser();
  const profile = user ? await getUserProfile(user.id) : null;

  const canAccept = (() => {
    if (reqRow.cliente_id == null) return true;
    if (!user || !profile) return false;
    if (profile.role !== "cliente" && profile.role !== "admin") return false;
    return profile.role === "admin" || reqRow.cliente_id === user.id;
  })();

  if (!canAccept) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

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

  const { data: partner } = await supabaseAdmin
    .from("tow_partners")
    .select("whatsapp_number,empresa_nome")
    .eq("id", proposal.partner_id)
    .maybeSingle();

  if (partner?.whatsapp_number) {
    const origin = new URL(request.url).origin;
    const acceptLink = `${origin}/partner/requests/${proposal.request_id}`;
    const body =
      `✅ Sua proposta foi aceita no ReboqueSOS\n` +
      `📍 Local: ${reqRow.local_cliente ?? "—"}\n` +
      `🏙️ Cidade: ${reqRow.cidade ?? "—"}\n` +
      `🚗 Veículo: ${reqRow.modelo_veiculo ?? "—"}\n` +
      `📞 Telefone: ${reqRow.telefone_cliente ?? "—"}\n` +
      `💰 Valor: R$ ${proposal.valor}\n` +
      `⏱️ ETA: ${proposal.eta_minutes} min\n` +
      `🔗 Abrir no painel: ${acceptLink}`;

    await Promise.allSettled([sendWhatsAppMessage({ to: String(partner.whatsapp_number), body })]);
  }

  return NextResponse.json({ tripId: trip.id }, { status: 200 });
}
