"use client";

import { DirectionsRenderer, GoogleMap, MarkerF, OverlayView, useJsApiLoader } from "@react-google-maps/api";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

type Coords = { lat: number; lng: number };

function formatEta(minutes: number | null) {
  if (!Number.isFinite(minutes) || minutes == null) return "—";
  const m = Math.max(0, Math.round(minutes));
  if (m <= 1) return "1 min";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!r) return `${h}h`;
  return `${h}h ${r}min`;
}

function initials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const a = parts[0]?.[0] ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (a + b).toUpperCase();
}

export function TripTrackingClient(props: {
  tripId: string;
  requestId: string;
  pickup: Coords;
  pickupLabel: string;
  initialTowLocation: Coords | null;
  partner: {
    name: string;
    whatsapp: string | null;
    photoUrl: string | null;
  };
}) {
  const [towLocation, setTowLocation] = useState<Coords | null>(props.initialTowLocation);
  const [route, setRoute] = useState<google.maps.DirectionsResult | null>(null);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const lastDirectionsAtRef = useRef(0);

  useEffect(() => {
    let alive = true;

    async function refresh() {
      try {
        const res = await fetch(`/api/public/trips/${props.tripId}/live`, { method: "GET", cache: "no-store" });
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
    id: "reboquesos-client-track-map",
    googleMapsApiKey: apiKey,
    language: "pt-BR",
    region: "BR",
  });

  const center = useMemo(() => {
    if (towLocation) return towLocation;
    return props.pickup;
  }, [props.pickup, towLocation]);

  const canRoute = Boolean(isLoaded && towLocation);

  useEffect(() => {
    if (!canRoute) return;
    const now = Date.now();
    if (now - lastDirectionsAtRef.current < 12000) return;
    lastDirectionsAtRef.current = now;

    const service = new google.maps.DirectionsService();
    service.route(
      {
        origin: towLocation as Coords,
        destination: props.pickup,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status !== "OK" || !result) return;
        setRoute(result);
        const seconds =
          result.routes?.[0]?.legs?.reduce((acc, leg) => acc + (leg.duration?.value ?? 0), 0) ?? 0;
        if (seconds > 0) setEtaMinutes(seconds / 60);
      },
    );
  }, [canRoute, props.pickup, towLocation]);

  const partnerLabel = props.partner.name.trim() || "Reboque";
  const partnerInitials = initials(partnerLabel);

  if (!apiKey) {
    return (
      <div className="mx-auto w-full max-w-xl rounded-xl border bg-white p-6">
        <h2 className="text-lg font-semibold">Rastreamento</h2>
        <p className="mt-2 text-sm text-zinc-700">Configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY para exibir o mapa.</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="fixed inset-0 grid place-items-center bg-white">
        <div className="rounded-xl border bg-white p-6">
          <p className="text-sm text-zinc-700">Carregando mapa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50">
      <GoogleMap
        center={center}
        zoom={14}
        mapContainerStyle={{ width: "100%", height: "100%" }}
        options={{ disableDefaultUI: true, clickableIcons: false }}
      >
        <MarkerF position={props.pickup} />
        {route ? (
          <DirectionsRenderer
            directions={route}
            options={{
              suppressMarkers: true,
              polylineOptions: { strokeColor: "#111827", strokeOpacity: 0.9, strokeWeight: 5 },
            }}
          />
        ) : null}
        {towLocation ? (
          <OverlayView position={towLocation} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
            <div className="relative -translate-x-1/2 -translate-y-1/2">
              <div className="h-12 w-12 overflow-hidden rounded-full border-2 border-white bg-brand-yellow shadow-soft">
                {props.partner.photoUrl ? (
                  <Image
                    src={props.partner.photoUrl}
                    alt={partnerLabel}
                    width={48}
                    height={48}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center text-sm font-extrabold text-brand-black">
                    {partnerInitials}
                  </div>
                )}
              </div>
              <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-[7px] border-t-[10px] border-x-transparent border-t-white" />
              <div className="absolute left-1/2 top-full mt-[9px] h-0 w-0 -translate-x-1/2 border-x-[6px] border-t-[9px] border-x-transparent border-t-brand-yellow" />
            </div>
          </OverlayView>
        ) : null}
      </GoogleMap>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
        <div className="pointer-events-auto mx-auto w-full max-w-2xl rounded-3xl border border-brand-border/20 bg-white/95 p-4 shadow-soft backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-brand-black/60">Reboque a caminho</div>
              <div className="mt-1 truncate text-base font-extrabold text-brand-black">{partnerLabel}</div>
              <div className="mt-1 text-xs text-brand-text2">{props.pickupLabel}</div>
            </div>
            <div className="text-right">
              <div className="text-xs font-semibold text-brand-black/60">Chega em</div>
              <div className="mt-1 text-lg font-extrabold text-brand-black">{formatEta(etaMinutes)}</div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {props.partner.whatsapp ? (
              <a
                className="rounded-2xl border border-brand-border/20 bg-white px-4 py-2 text-sm font-semibold text-brand-black hover:bg-brand-yellow/10"
                href={`https://wa.me/${props.partner.whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
              >
                Falar no WhatsApp
              </a>
            ) : null}
            <a
              className="rounded-2xl border border-brand-border/20 bg-white px-4 py-2 text-sm font-semibold text-brand-black hover:bg-brand-yellow/10"
              href={`/requests/${encodeURIComponent(props.requestId)}`}
            >
              Detalhes
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
