"use client";

import { useEffect, useMemo, useState } from "react";

import { GoogleMap, MarkerF, useJsApiLoader } from "@react-google-maps/api";

type Coords = { lat: number; lng: number };

export function TripMapClient(props: {
  tripId: string;
  pickup: Coords;
  initialTowLocation: Coords | null;
  pickupLabel: string;
}) {
  const [towLocation, setTowLocation] = useState<Coords | null>(props.initialTowLocation);

  useEffect(() => {
    let alive = true;

    async function refresh() {
      try {
        const res = await fetch(`/api/public/trips/${props.tripId}/live`, { method: "GET" });
        const json = (await res.json()) as { live?: { lat: number; lng: number } | null };
        if (!alive) return;
        if (res.ok && json.live && Number.isFinite(json.live.lat) && Number.isFinite(json.live.lng)) {
          setTowLocation({ lat: json.live.lat, lng: json.live.lng });
        }
      } catch {
        return;
      }
    }

    void refresh();
    const id = window.setInterval(refresh, 2500);
    return () => {
      alive = false;
      window.clearInterval(id);
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
