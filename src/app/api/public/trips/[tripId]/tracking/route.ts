import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(_request: Request, { params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const supabaseAdmin = createSupabaseAdminClient();

  const { data: trip } = await supabaseAdmin
    .from("tow_trips")
    .select("*")
    .eq("id", tripId)
    .maybeSingle();

  if (!trip) return NextResponse.json({ error: "Trip não encontrada." }, { status: 404 });

  const { data: reqRow } = await supabaseAdmin
    .from("tow_requests")
    .select("*")
    .eq("id", trip.request_id)
    .maybeSingle();

  const pickup =
    reqRow && typeof reqRow.lat === "number" && typeof reqRow.lng === "number" && Number.isFinite(reqRow.lat) && Number.isFinite(reqRow.lng)
      ? { lat: reqRow.lat, lng: reqRow.lng }
      : null;

  const dropoff =
    reqRow &&
    typeof (reqRow as { destino_lat?: number | null }).destino_lat === "number" &&
    typeof (reqRow as { destino_lng?: number | null }).destino_lng === "number" &&
    Number.isFinite((reqRow as { destino_lat?: number | null }).destino_lat as number) &&
    Number.isFinite((reqRow as { destino_lng?: number | null }).destino_lng as number)
      ? {
          lat: (reqRow as { destino_lat: number }).destino_lat,
          lng: (reqRow as { destino_lng: number }).destino_lng,
        }
      : null;

  const { data: partner } = trip.driver_id
    ? await supabaseAdmin
        .from("tow_partners")
        .select("empresa_nome,whatsapp_number,foto_parceiro_path")
        .eq("id", trip.driver_id)
        .maybeSingle()
    : { data: null };

  let partnerPhotoUrl: string | null = null;
  const partnerPhotoPath = partner?.foto_parceiro_path ? String(partner.foto_parceiro_path) : "";
  if (partnerPhotoPath) {
    const { data } = await supabaseAdmin.storage
      .from("partner-assets")
      .createSignedUrl(partnerPhotoPath, 60 * 30)
      .catch(() => ({ data: null }));
    partnerPhotoUrl = data?.signedUrl ?? null;
  }

  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("amount,status,updated_at")
    .eq("request_id", trip.request_id)
    .maybeSingle();

  return NextResponse.json(
    {
      trip: {
        id: trip.id,
        request_id: trip.request_id,
        status: trip.status,
        canceled_at: (trip as { canceled_at?: string | null }).canceled_at ?? null,
        canceled_by_role: (trip as { canceled_by_role?: string | null }).canceled_by_role ?? null,
        canceled_fee_cents: (trip as { canceled_fee_cents?: number | null }).canceled_fee_cents ?? null,
        canceled_after_seconds: (trip as { canceled_after_seconds?: number | null }).canceled_after_seconds ?? null,
      },
      request: {
        id: reqRow?.id ?? trip.request_id,
        status: reqRow?.status ?? null,
        local_cliente: reqRow?.local_cliente ?? null,
        pickup,
        destino_local: (reqRow as { destino_local?: string | null })?.destino_local ?? null,
        dropoff,
      },
      payment: payment
        ? {
            amount_cents: typeof payment.amount === "number" ? payment.amount : null,
            status: payment.status ?? null,
            paid_at: payment.status === "succeeded" ? (payment.updated_at ?? null) : null,
          }
        : null,
      partner: {
        name: partner?.empresa_nome ?? null,
        whatsapp: partner?.whatsapp_number ?? null,
        photoUrl: partnerPhotoUrl,
      },
    },
    { status: 200 },
  );
}
