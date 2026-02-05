import { NextResponse } from "next/server";

import { getUserProfile } from "@/lib/auth/getProfile";
import { requireUser } from "@/lib/auth/requireUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(_request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const profile = await getUserProfile(user.id);
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 403 });
  if (profile.role !== "cliente" && profile.role !== "admin") {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: reqRow, error: reqErr } = await supabaseAdmin
    .from("tow_requests")
    .select("id,cliente_id,status,accepted_proposal_id")
    .eq("id", requestId)
    .maybeSingle();

  if (reqErr || !reqRow) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });

  const ownerId = String((reqRow as { cliente_id?: unknown } | null)?.cliente_id ?? "");
  if (profile.role !== "admin" && ownerId && ownerId !== user.id) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const status = String((reqRow as { status?: unknown } | null)?.status ?? "");
  const acceptedProposalId = (reqRow as { accepted_proposal_id?: string | null } | null)?.accepted_proposal_id ?? null;
  if (acceptedProposalId) {
    return NextResponse.json({ error: "Pedido já teve uma proposta aceita." }, { status: 409 });
  }
  if (status !== "PENDENTE" && status !== "PROPOSTA_RECEBIDA") {
    return NextResponse.json({ error: "Pedido não pode mais ser cancelado." }, { status: 409 });
  }

  const now = new Date().toISOString();
  const { error: updErr } = await supabaseAdmin.from("tow_requests").update({ status: "CANCELADO", updated_at: now }).eq("id", requestId);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}

