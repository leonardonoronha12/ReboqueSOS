import { NextResponse } from "next/server";

import { getUserProfile } from "@/lib/auth/getProfile";
import { requireUser } from "@/lib/auth/requireUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const profile = await getUserProfile(user.id);
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 403 });
  if (profile.role !== "reboque" && profile.role !== "admin") {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: trips, error: tripsErr } = await supabaseAdmin
    .from("tow_trips")
    .select("id,request_id,status,created_at")
    .eq("driver_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  if (tripsErr) return NextResponse.json({ error: tripsErr.message }, { status: 500 });
  const list = trips ?? [];
  if (!list.length) return NextResponse.json({ tripId: null, requestId: null }, { status: 200 });

  const requestIds = Array.from(new Set(list.map((t) => String(t.request_id ?? "")).filter(Boolean)));
  if (!requestIds.length) return NextResponse.json({ tripId: null, requestId: null }, { status: 200 });

  const { data: requests, error: reqErr } = await supabaseAdmin
    .from("tow_requests")
    .select("id,status")
    .in("id", requestIds);

  if (reqErr) return NextResponse.json({ error: reqErr.message }, { status: 500 });

  const statusById = new Map<string, string>();
  for (const r of requests ?? []) {
    statusById.set(String(r.id), String(r.status ?? ""));
  }

  for (const t of list) {
    const requestId = String(t.request_id ?? "");
    if (!requestId) continue;
    if (statusById.get(requestId) !== "PAGO") continue;
    return NextResponse.json({ tripId: String(t.id), requestId }, { status: 200 });
  }

  return NextResponse.json({ tripId: null, requestId: null }, { status: 200 });
}

