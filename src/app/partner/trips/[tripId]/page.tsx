import { redirect } from "next/navigation";

import { getUserProfile } from "@/lib/auth/getProfile";
import { requireUser } from "@/lib/auth/requireUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { TripControlClient } from "./tripControlClient";

export default async function PartnerTripPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const user = await requireUser();
  if (!user) redirect("/login");

  const profile = await getUserProfile(user.id);
  if (!profile || (profile.role !== "reboque" && profile.role !== "admin")) {
    redirect("/partner");
  }

  const supabase = createSupabaseAdminClient();
  const { data: trip } = await supabase
    .from("tow_trips")
    .select("id,request_id,driver_id,status,created_at,updated_at")
    .eq("id", tripId)
    .maybeSingle();

  if (!trip) {
    return (
      <div className="rounded-xl border bg-white p-6">
        <h1 className="text-xl font-semibold">Trip não encontrada</h1>
      </div>
    );
  }

  if (profile.role !== "admin" && trip.driver_id !== user.id) {
    redirect("/partner");
  }

  const { data: reqRow } = await supabase
    .from("tow_requests")
    .select("id,local_cliente,cidade,status,lat,lng,created_at")
    .eq("id", trip.request_id)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-6">
        <h1 className="text-xl font-semibold">Corrida #{trip.id.slice(0, 8)}</h1>
        <p className="mt-2 text-sm text-zinc-700">
          Pedido #{trip.request_id.slice(0, 8)} • Status: {trip.status}
        </p>
        {reqRow ? (
          <p className="mt-2 text-sm text-zinc-700">
            {reqRow.cidade} • {reqRow.local_cliente}
          </p>
        ) : null}
      </div>

      <TripControlClient tripId={trip.id} requestId={trip.request_id} currentStatus={trip.status} />
    </div>
  );
}
