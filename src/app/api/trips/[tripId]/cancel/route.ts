import { NextResponse } from "next/server";

import { getUserProfile } from "@/lib/auth/getProfile";
import { requireUser } from "@/lib/auth/requireUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function computeCancellationFeeCents(amountCents: number) {
  const pct = Math.round(amountCents * 0.1);
  const min = 1000;
  const max = 5000;
  return Math.max(min, Math.min(pct, max));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const profile = await getUserProfile(user.id);
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 403 });

  let body: { reason?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const supabaseAdmin = createSupabaseAdminClient();

  const { data: trip } = await supabaseAdmin
    .from("tow_trips")
    .select("*")
    .eq("id", tripId)
    .maybeSingle();

  if (!trip) return NextResponse.json({ error: "Trip não encontrada." }, { status: 404 });

  const { data: reqRow } = await supabaseAdmin
    .from("tow_requests")
    .select("id,cliente_id,status")
    .eq("id", trip.request_id)
    .maybeSingle();

  if (!reqRow) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });

  const role = (() => {
    if (profile.role === "admin") return "admin" as const;
    if (profile.role === "cliente" && reqRow.cliente_id && String(reqRow.cliente_id) === user.id) return "cliente" as const;
    if (profile.role === "reboque" && String(trip.driver_id) === user.id) return "reboque" as const;
    return null;
  })();

  if (!role) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  if (String(trip.status) === "cancelado" || String(reqRow.status) === "CANCELADO") {
    return NextResponse.json({ ok: true, already: true }, { status: 200 });
  }

  if (String(trip.status) === "finalizado" || String(trip.status) === "concluido") {
    return NextResponse.json({ error: "Não é possível cancelar uma corrida finalizada." }, { status: 409 });
  }

  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("amount,status,updated_at")
    .eq("request_id", reqRow.id)
    .maybeSingle();

  const now = new Date();
  const paidAt = payment?.status === "succeeded" ? new Date(String(payment.updated_at ?? "")) : null;
  const startAt = paidAt && !Number.isNaN(paidAt.getTime()) ? paidAt : new Date(String(trip.created_at ?? ""));
  const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - startAt.getTime()) / 1000));

  const amountCents = Number.isFinite(payment?.amount) ? Number(payment?.amount) : 0;
  const hasPenalty = Boolean(amountCents > 0 && elapsedSeconds >= 180);
  const feeCents = hasPenalty ? computeCancellationFeeCents(amountCents) : 0;
  const payer = role === "admin" ? null : role;

  const updatesTrip: Record<string, unknown> = {
    status: "cancelado",
    updated_at: now.toISOString(),
    canceled_at: now.toISOString(),
    canceled_by_role: payer,
    canceled_fee_cents: feeCents,
    canceled_after_seconds: elapsedSeconds,
  };

  const tripUpd = await supabaseAdmin
    .from("tow_trips")
    .update(updatesTrip)
    .eq("id", tripId);

  if (tripUpd.error) {
    return NextResponse.json(
      { error: tripUpd.error.message, hint: "Se for erro de constraint, aplique a migração 0005_cancel.sql." },
      { status: 500 },
    );
  }

  const reqUpd = await supabaseAdmin
    .from("tow_requests")
    .update({ status: "CANCELADO", updated_at: now.toISOString() })
    .eq("id", reqRow.id);

  if (reqUpd.error) {
    return NextResponse.json(
      { error: reqUpd.error.message, hint: "Se for erro de constraint, aplique a migração 0005_cancel.sql." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      canceledBy: payer,
      penalty: hasPenalty ? { fee_cents: feeCents, after_seconds: elapsedSeconds, amount_cents: amountCents } : null,
      reason: body.reason ? String(body.reason).slice(0, 180) : null,
    },
    { status: 200 },
  );
}
