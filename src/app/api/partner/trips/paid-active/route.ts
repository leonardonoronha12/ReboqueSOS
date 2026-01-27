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

  const now = Date.now();
  const recentWindowMs = 20 * 60 * 1000;

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: trips, error: tripsErr } = await supabaseAdmin
    .from("tow_trips")
    .select("id,request_id,status,updated_at,created_at")
    .eq("driver_id", user.id)
    .in("status", ["a_caminho", "chegou", "em_servico"])
    .order("updated_at", { ascending: false })
    .limit(10);

  if (tripsErr) return NextResponse.json({ error: tripsErr.message }, { status: 500 });
  const list = trips ?? [];
  if (!list.length) return NextResponse.json({ tripId: null, requestId: null }, { status: 200 });

  const requestIds = Array.from(new Set(list.map((t) => String(t.request_id ?? "")).filter(Boolean)));
  if (!requestIds.length) return NextResponse.json({ tripId: null, requestId: null }, { status: 200 });

  const { data: payments, error: payErr } = await supabaseAdmin
    .from("payments")
    .select("request_id,status,updated_at")
    .in("request_id", requestIds);

  if (payErr) return NextResponse.json({ error: payErr.message }, { status: 500 });

  const paidAtByRequestId = new Map<string, number>();
  for (const p of payments ?? []) {
    const requestId = String(p.request_id ?? "");
    if (!requestId) continue;
    if (String(p.status ?? "") !== "succeeded") continue;
    const t = new Date(String(p.updated_at ?? "")).getTime();
    if (!Number.isFinite(t)) continue;
    paidAtByRequestId.set(requestId, t);
  }

  let best: { tripId: string; requestId: string; paidAtMs: number } | null = null;
  for (const t of list) {
    const requestId = String(t.request_id ?? "");
    if (!requestId) continue;
    const paidAtMs = paidAtByRequestId.get(requestId);
    if (!paidAtMs) continue;
    if (now - paidAtMs > recentWindowMs) continue;
    const tripId = String(t.id ?? "");
    if (!tripId) continue;
    if (!best || paidAtMs > best.paidAtMs) best = { tripId, requestId, paidAtMs };
  }

  if (best) return NextResponse.json({ tripId: best.tripId, requestId: best.requestId }, { status: 200 });
  return NextResponse.json({ tripId: null, requestId: null }, { status: 200 });
}
