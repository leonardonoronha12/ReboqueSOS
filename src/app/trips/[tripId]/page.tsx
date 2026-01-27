import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { TripTrackingClient } from "./tripTrackingClient";

export default async function TripPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const supabase = createSupabaseAdminClient();

  const { data: trip } = await supabase
    .from("tow_trips")
    .select("id,request_id,status,driver_id")
    .eq("id", tripId)
    .maybeSingle();

  if (!trip) {
    return (
      <div className="rounded-xl border bg-white p-6">
        <h1 className="text-xl font-semibold">Corrida não encontrada</h1>
      </div>
    );
  }

  const { data: reqRow } = await supabase
    .from("tow_requests")
    .select("id,local_cliente,cidade,status,lat,lng")
    .eq("id", trip.request_id)
    .maybeSingle();

  const pickup =
    reqRow && typeof reqRow.lat === "number" && typeof reqRow.lng === "number" && Number.isFinite(reqRow.lat) && Number.isFinite(reqRow.lng)
      ? { lat: reqRow.lat, lng: reqRow.lng }
      : null;

  const { data: live } = await supabase
    .from("tow_live_location")
    .select("lat,lng,updated_at")
    .eq("trip_id", tripId)
    .maybeSingle();

  const { data: partner } = trip.driver_id
    ? await supabase
        .from("tow_partners")
        .select("empresa_nome,whatsapp_number,foto_parceiro_path")
        .eq("id", trip.driver_id)
        .maybeSingle()
    : { data: null };

  let partnerPhotoUrl: string | null = null;
  const partnerPhotoPath = partner?.foto_parceiro_path ? String(partner.foto_parceiro_path) : "";
  if (partnerPhotoPath) {
    const { data } = await supabase.storage
      .from("partner-assets")
      .createSignedUrl(partnerPhotoPath, 60 * 60)
      .catch(() => ({ data: null }));
    partnerPhotoUrl = data?.signedUrl ?? null;
  }

  return (
    <>
      {reqRow && pickup ? (
        <TripTrackingClient
          tripId={tripId}
          requestId={trip.request_id}
          pickup={pickup}
          initialTowLocation={live ? { lat: live.lat, lng: live.lng } : null}
          pickupLabel={reqRow.local_cliente}
          partner={{
            name: String(partner?.empresa_nome ?? "Reboque"),
            whatsapp: partner?.whatsapp_number ? String(partner.whatsapp_number) : null,
            photoUrl: partnerPhotoUrl,
          }}
        />
      ) : (
        <div className="rounded-xl border bg-white p-6">
          <h1 className="text-xl font-semibold">Rastreamento</h1>
          <p className="mt-2 text-sm text-zinc-700">Não foi possível carregar as coordenadas do pedido.</p>
          <div className="mt-4">
            <a className="rounded-md border px-3 py-2 text-sm font-semibold" href={`/requests/${trip.request_id}`}>
              Voltar ao pedido
            </a>
          </div>
        </div>
      )}
    </>
  );
}
