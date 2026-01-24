import { NextResponse } from "next/server";

import { getUserProfile } from "@/lib/auth/getProfile";
import { requireUser } from "@/lib/auth/requireUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { TowTripStatus } from "@/lib/types";

const tripToRequestStatus: Record<TowTripStatus, string> = {
  a_caminho: "A_CAMINHO",
  chegou: "CHEGUEI",
  em_servico: "EM_SERVICO",
  concluido: "CONCLUIDO",
  finalizado: "PAGO",
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const profile = await getUserProfile(user.id);
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 403 });
  if (profile.role !== "reboque" && profile.role !== "admin") {
    return NextResponse.json({ error: "Apenas parceiros podem atualizar." }, { status: 403 });
  }

  const body = (await request.json()) as { status?: TowTripStatus };
  const status = body.status;
  if (!status) return NextResponse.json({ error: "Status inválido." }, { status: 400 });

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: trip, error: tripErr } = await supabaseAdmin
    .from("tow_trips")
    .select("id,driver_id,request_id")
    .eq("id", tripId)
    .maybeSingle();

  if (tripErr || !trip) return NextResponse.json({ error: "Trip não encontrada." }, { status: 404 });
  if (profile.role !== "admin" && trip.driver_id !== user.id) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const now = new Date().toISOString();
  const { error: updErr } = await supabaseAdmin
    .from("tow_trips")
    .update({ status, updated_at: now })
    .eq("id", tripId);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  const requestStatus = tripToRequestStatus[status];
  if (requestStatus) {
    await supabaseAdmin
      .from("tow_requests")
      .update({ status: requestStatus, updated_at: now })
      .eq("id", trip.request_id);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

