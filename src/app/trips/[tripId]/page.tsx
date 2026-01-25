import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { TripMapClient } from "./tripMapClient";

export default async function TripPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const supabase = createSupabaseAdminClient();

  const { data: trip } = await supabase
    .from("tow_trips")
    .select("id,request_id,status")
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

  const { data: live } = await supabase
    .from("tow_live_location")
    .select("lat,lng,updated_at")
    .eq("trip_id", tripId)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-6">
        <h1 className="text-xl font-semibold">Corrida em andamento</h1>
        <p className="mt-2 text-sm text-zinc-700">
          Status: {reqRow?.status ?? trip.status}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a className="rounded-md border px-3 py-2 text-sm font-medium" href={`/payments/${trip.request_id}`}>
            Checkout e pagamento
          </a>
        </div>
      </div>

      {reqRow ? (
        <TripMapClient
          tripId={tripId}
          pickup={{ lat: reqRow.lat, lng: reqRow.lng }}
          initialTowLocation={live ? { lat: live.lat, lng: live.lng } : null}
          pickupLabel={reqRow.local_cliente}
        />
      ) : (
        <div className="rounded-xl border bg-white p-6">
          <p className="text-sm text-zinc-700">Sem dados do pedido.</p>
        </div>
      )}
    </div>
  );
}
