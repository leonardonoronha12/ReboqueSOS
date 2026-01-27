import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(_request: Request, { params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const supabaseAdmin = createSupabaseAdminClient();

  const { data: trip } = await supabaseAdmin
    .from("tow_trips")
    .select("id,request_id,driver_id,status")
    .eq("id", tripId)
    .maybeSingle();

  if (!trip) return NextResponse.json({ error: "Trip não encontrada." }, { status: 404 });

  const { data: reqRow } = await supabaseAdmin
    .from("tow_requests")
    .select("id,local_cliente,lat,lng,status")
    .eq("id", trip.request_id)
    .maybeSingle();

  const pickup =
    reqRow && typeof reqRow.lat === "number" && typeof reqRow.lng === "number" && Number.isFinite(reqRow.lat) && Number.isFinite(reqRow.lng)
      ? { lat: reqRow.lat, lng: reqRow.lng }
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

  return NextResponse.json(
    {
      trip: { id: trip.id, request_id: trip.request_id, status: trip.status },
      request: {
        id: reqRow?.id ?? trip.request_id,
        status: reqRow?.status ?? null,
        local_cliente: reqRow?.local_cliente ?? null,
        pickup,
      },
      partner: {
        name: partner?.empresa_nome ?? null,
        whatsapp: partner?.whatsapp_number ?? null,
        photoUrl: partnerPhotoUrl,
      },
    },
    { status: 200 },
  );
}

