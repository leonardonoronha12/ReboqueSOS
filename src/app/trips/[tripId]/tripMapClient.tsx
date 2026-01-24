"use client";

import { useEffect, useMemo, useState } from "react";

import { GoogleMap, MarkerF, useJsApiLoader } from "@react-google-maps/api";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Coords = { lat: number; lng: number };

export function TripMapClient(props: {
  tripId: string;
  pickup: Coords;
  initialTowLocation: Coords | null;
  pickupLabel: string;
}) {
  const [towLocation, setTowLocation] = useState<Coords | null>(props.initialTowLocation);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`tow_live_location:${props.tripId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tow_live_location",
          filter: `trip_id=eq.${props.tripId}`,
        },
        (payload) => {
          if (!payload.new) return;
          const row = payload.new as { lat: number; lng: number };
          setTowLocation({ lat: row.lat, lng: row.lng });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [props.tripId]);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const { isLoaded } = useJsApiLoader({
    id: "reboquesos-google-maps",
    googleMapsApiKey: apiKey,
  });

  const center = useMemo(() => towLocation ?? props.pickup, [props.pickup, towLocation]);

  if (!apiKey) {
    return (
      <div className="rounded-xl border bg-white p-6">
        <h2 className="text-lg font-semibold">Mapa</h2>
        <p className="mt-1 text-sm text-zinc-700">
          Configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY para exibir o mapa.
        </p>
        <div className="mt-4 text-sm text-zinc-700">
          <div>Cliente: {props.pickup.lat.toFixed(5)}, {props.pickup.lng.toFixed(5)}</div>
          {towLocation ? (
            <div>Reboque: {towLocation.lat.toFixed(5)}, {towLocation.lng.toFixed(5)}</div>
          ) : (
            <div>Reboque: aguardando GPS...</div>
          )}
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="rounded-xl border bg-white p-6">
        <p className="text-sm text-zinc-700">Carregando mapa...</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-white">
      <div className="border-b p-4">
        <h2 className="text-lg font-semibold">Rastreamento ao vivo</h2>
        <p className="mt-1 text-sm text-zinc-700">{props.pickupLabel}</p>
      </div>
      <div className="h-[520px] w-full">
        <GoogleMap
          center={center}
          zoom={14}
          mapContainerStyle={{ width: "100%", height: "100%" }}
          options={{ disableDefaultUI: true, clickableIcons: false }}
        >
          <MarkerF position={props.pickup} />
          {towLocation ? <MarkerF position={towLocation} /> : null}
        </GoogleMap>
      </div>
    </div>
  );
}

