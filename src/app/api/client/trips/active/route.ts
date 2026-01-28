import { NextResponse } from "next/server";

import { getUserProfile } from "@/lib/auth/getProfile";
import { requireUser } from "@/lib/auth/requireUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ tripId: null, requestId: null, requestStatus: null, tripStatus: null, next: null }, { status: 200 });

  const profile = await getUserProfile(user.id);
  if (!profile) return NextResponse.json({ tripId: null, requestId: null, requestStatus: null, tripStatus: null, next: null }, { status: 200 });
  if (profile.role !== "cliente" && profile.role !== "admin") {
    return NextResponse.json({ tripId: null, requestId: null, requestStatus: null, tripStatus: null, next: null }, { status: 200 });
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: requests } = await supabaseAdmin
    .from("tow_requests")
    .select("id,status,accepted_proposal_id,created_at,updated_at")
    .eq("cliente_id", user.id)
    .in("status", ["ACEITO", "PAGO", "A_CAMINHO", "CHEGUEI", "EM_SERVICO", "CONCLUIDO"])
    .order("updated_at", { ascending: false })
    .limit(15);

  const list = requests ?? [];
  if (!list.length) return NextResponse.json({ tripId: null, requestId: null, requestStatus: null, tripStatus: null, next: null }, { status: 200 });

  const requestId = String(list[0].id ?? "");
  const status = String(list[0].status ?? "");
  if (!requestId) return NextResponse.json({ tripId: null, requestId: null, requestStatus: null, tripStatus: null, next: null }, { status: 200 });

  if (status === "ACEITO") {
    return NextResponse.json(
      { tripId: null, requestId, requestStatus: status, tripStatus: null, next: `/payments/${encodeURIComponent(requestId)}` },
      { status: 200 },
    );
  }

  const { data: trip } = await supabaseAdmin
    .from("tow_trips")
    .select("id,status,updated_at,created_at")
    .eq("request_id", requestId)
    .in("status", ["a_caminho", "chegou", "em_servico", "finalizado"])
    .order("updated_at", { ascending: false })
    .maybeSingle();

  if (!trip?.id) {
    return NextResponse.json({ tripId: null, requestId, requestStatus: status, tripStatus: null, next: null }, { status: 200 });
  }

  const t = new Date(String(trip.updated_at ?? trip.created_at ?? "")).getTime();
  const now = Date.now();
  const within = Number.isFinite(t) ? now - t < 12 * 60 * 60 * 1000 : true;
  if (!within) return NextResponse.json({ tripId: null, requestId, requestStatus: status, tripStatus: null, next: null }, { status: 200 });

  return NextResponse.json(
    {
      tripId: String(trip.id),
      requestId,
      requestStatus: status,
      tripStatus: trip.status ? String(trip.status) : null,
      next: `/trips/${encodeURIComponent(String(trip.id))}`,
    },
    { status: 200 },
  );
}
