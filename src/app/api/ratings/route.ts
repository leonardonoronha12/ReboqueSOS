import { NextResponse } from "next/server";

import { getUserProfile } from "@/lib/auth/getProfile";
import { requireUser } from "@/lib/auth/requireUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const user = await requireUser();
  const profile = user ? await getUserProfile(user.id) : null;
  if (user && !profile) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 403 });
  if (profile && profile.role !== "cliente" && profile.role !== "admin") {
    return NextResponse.json({ error: "Apenas clientes podem avaliar." }, { status: 403 });
  }

  const body = (await request.json()) as {
    requestId?: string;
    rating?: number;
    comentario?: string;
  };

  const requestId = String(body.requestId ?? "");
  const rating = Number(body.rating);
  const comentario = typeof body.comentario === "string" ? body.comentario : null;

  if (!requestId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: reqRow } = await supabaseAdmin
    .from("tow_requests")
    .select("id,cliente_id,status")
    .eq("id", requestId)
    .maybeSingle();

  if (!reqRow) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  if (String(reqRow.status ?? "") !== "PAGO") {
    return NextResponse.json({ error: "A avaliação fica disponível após finalizar a corrida." }, { status: 400 });
  }

  const reqClienteId = reqRow.cliente_id ? String(reqRow.cliente_id) : null;
  const userId = user?.id ? String(user.id) : null;
  const role = profile?.role ?? null;

  if (reqClienteId) {
    if (!userId) return NextResponse.json({ error: "Faça login para avaliar." }, { status: 401 });
    if (role !== "admin" && reqClienteId !== userId) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }
  } else {
    if (role && role !== "cliente" && role !== "admin") {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }
  }

  const { data: trip } = await supabaseAdmin
    .from("tow_trips")
    .select("id,driver_id")
    .eq("request_id", requestId)
    .maybeSingle();

  if (!trip) return NextResponse.json({ error: "Trip não encontrada." }, { status: 404 });

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("tow_ratings").upsert(
    {
      request_id: requestId,
      cliente_id: reqClienteId ?? userId ?? null,
      driver_id: trip.driver_id,
      rating,
      comentario,
      updated_at: now,
    },
    { onConflict: "request_id" },
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 200 });
}
