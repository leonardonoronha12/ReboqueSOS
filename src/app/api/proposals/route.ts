import { NextResponse } from "next/server";

import { getUserProfile } from "@/lib/auth/getProfile";
import { requireUser } from "@/lib/auth/requireUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const profile = await getUserProfile(user.id);
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 403 });
  if (profile.role !== "reboque" && profile.role !== "admin") {
    return NextResponse.json({ error: "Apenas parceiros podem propor." }, { status: 403 });
  }

  const body = (await request.json()) as {
    requestId?: string;
    valor?: number;
    etaMinutes?: number;
  };

  const requestId = String(body.requestId ?? "");
  const valor = Number(body.valor);
  const etaMinutes = Number(body.etaMinutes);

  if (!requestId || !Number.isFinite(valor) || !Number.isFinite(etaMinutes)) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const supabaseAdmin = createSupabaseAdminClient();

  const { data: reqRow, error: reqErr } = await supabaseAdmin
    .from("tow_requests")
    .select("id,status")
    .eq("id", requestId)
    .maybeSingle();

  if (reqErr || !reqRow) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  if (reqRow.status !== "PENDENTE" && reqRow.status !== "PROPOSTA_RECEBIDA") {
    return NextResponse.json({ error: "Pedido não está aceitando propostas." }, { status: 409 });
  }

  const { data: proposal, error: propErr } = await supabaseAdmin
    .from("tow_proposals")
    .upsert(
      {
        request_id: requestId,
        partner_id: user.id,
        valor,
        eta_minutes: etaMinutes,
      },
      { onConflict: "request_id,partner_id" },
    )
    .select("id")
    .single();

  if (propErr) return NextResponse.json({ error: propErr.message }, { status: 500 });

  await supabaseAdmin
    .from("tow_requests")
    .update({ status: "PROPOSTA_RECEBIDA" })
    .eq("id", requestId)
    .in("status", ["PENDENTE", "PROPOSTA_RECEBIDA"]);

  return NextResponse.json({ id: proposal.id }, { status: 201 });
}

