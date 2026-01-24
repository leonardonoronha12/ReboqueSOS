import { NextResponse } from "next/server";

import { getUserProfile } from "@/lib/auth/getProfile";
import { requireUser } from "@/lib/auth/requireUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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
    return NextResponse.json({ error: "Apenas parceiros podem transmitir GPS." }, { status: 403 });
  }

  const body = (await request.json()) as { lat?: number; lng?: number };
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Coordenadas inválidas." }, { status: 400 });
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: trip, error: tripErr } = await supabaseAdmin
    .from("tow_trips")
    .select("id,driver_id")
    .eq("id", tripId)
    .maybeSingle();

  if (tripErr || !trip) return NextResponse.json({ error: "Trip não encontrada." }, { status: 404 });
  if (profile.role !== "admin" && trip.driver_id !== user.id) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const now = new Date().toISOString();
  const { error: upsertErr } = await supabaseAdmin
    .from("tow_live_location")
    .upsert({ trip_id: tripId, lat, lng, updated_at: now }, { onConflict: "trip_id" });

  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 200 });
}

