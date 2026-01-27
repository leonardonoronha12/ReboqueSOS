"use client";

import { DirectionsRenderer, GoogleMap, MarkerF, useJsApiLoader } from "@react-google-maps/api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Coords = { lat: number; lng: number };

function towMarkerSvgDataUrl() {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">` +
    `<defs><filter id="s" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity=".25"/></filter></defs>` +
    `<g filter="url(#s)">` +
    `<circle cx="32" cy="32" r="26" fill="#ffc300" stroke="#ffffff" stroke-width="4"/>` +
    `<path d="M18 36h20c2.2 0 4-1.8 4-4v-7h4.5c1 0 2 .5 2.6 1.4l3.3 4.6c.4.6.6 1.2.6 1.9V36h-3.2a5 5 0 0 1-9.6 0H26.8a5 5 0 0 1-9.6 0H18Zm6.6 5.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Zm22.8 0a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4ZM22 22h18v11H22V22Zm22 5v6h6.7l-2.7-3.7c-.2-.2-.4-.3-.7-.3H44Z" fill="#0b0b0d"/>` +
    `</g></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function formatBrl(cents: number | null) {
  if (!Number.isFinite(cents) || cents == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

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

function computeCancellationFeeCents(amountCents: number) {
  const pct = Math.round(amountCents * 0.1);
  const min = 1000;
  const max = 5000;
  return Math.max(min, Math.min(pct, max));
}

export function TripTrackingClient(props: {
  tripId: string;
  requestId: string;
  pickup: Coords;
  pickupLabel: string;
  initialTowLocation: Coords | null;
  trip: {
    status: string | null;
    canceled_at: string | null;
    canceled_by_role: string | null;
    canceled_fee_cents: number | null;
    canceled_after_seconds: number | null;
  };
  payment: { amount_cents: number | null; status: string | null; paid_at: string | null } | null;
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
  const [isCanceling, setIsCanceling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelDone, setCancelDone] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const redirectInFlightRef = useRef(false);
  const [canTransmit, setCanTransmit] = useState<boolean | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const lastCoordsRef = useRef<Coords | null>(null);
  const sendingRef = useRef(false);

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

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch(`/api/trips/${encodeURIComponent(props.tripId)}/can-transmit`, { cache: "no-store" });
        const json = (await res.json()) as { canTransmit?: boolean };
        if (!alive) return;
        setCanTransmit(Boolean(json?.canTransmit));
      } catch {
        if (!alive) return;
        setCanTransmit(false);
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, [props.tripId]);

  useEffect(() => {
    if (!canTransmit) return;
    if (!navigator.geolocation) {
      setGpsError("GPS indisponível neste dispositivo.");
      return;
    }

    async function send(coords: Coords) {
      if (sendingRef.current) return;
      sendingRef.current = true;
      try {
        await fetch(`/api/trips/${encodeURIComponent(props.tripId)}/location`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(coords),
        });
      } finally {
        sendingRef.current = false;
      }
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude);
        const lng = Number(pos.coords.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        const coords = { lat, lng };
        lastCoordsRef.current = coords;
        setGpsError(null);
        void send(coords);
      },
      () => {
        setGpsError("Permissão de localização negada.");
      },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 15000 },
    );

    intervalRef.current = window.setInterval(() => {
      const coords = lastCoordsRef.current;
      if (coords) void send(coords);
    }, 3000);

    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (intervalRef.current != null) window.clearInterval(intervalRef.current);
      watchIdRef.current = null;
      intervalRef.current = null;
    };
  }, [canTransmit, props.tripId]);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const { isLoaded } = useJsApiLoader({
    id: "reboquesos-client-track-map",
    googleMapsApiKey: apiKey,
    language: "pt-BR",
    region: "BR",
  });

  const hasGoogleMaps =
    typeof window !== "undefined" && Boolean((window as unknown as { google?: { maps?: unknown } }).google?.maps);

  const center = useMemo(() => {
    if (towLocation) return towLocation;
    return props.pickup;
  }, [props.pickup, towLocation]);

  const canRoute = Boolean(isLoaded && hasGoogleMaps && towLocation);

  useEffect(() => {
    if (!canRoute) return;
    const now = Date.now();
    if (now - lastDirectionsAtRef.current < 12000) return;
    lastDirectionsAtRef.current = now;

    try {
      if (typeof window === "undefined") return;
      const g = (window as unknown as { google?: typeof google }).google;
      if (!g?.maps?.DirectionsService) return;
      const service = new g.maps.DirectionsService();
      service.route(
        {
          origin: towLocation as Coords,
          destination: props.pickup,
          travelMode: g.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status !== "OK" || !result) return;
          setRoute(result);
          const seconds =
            result.routes?.[0]?.legs?.reduce((acc, leg) => acc + (leg.duration?.value ?? 0), 0) ?? 0;
          if (seconds > 0) setEtaMinutes(seconds / 60);
        },
      );
    } catch {
      return;
    }
  }, [canRoute, props.pickup, towLocation]);

  const partnerLabel = props.partner.name.trim() || "Reboque";
  const partnerInitials = initials(partnerLabel);
  const isCanceled = cancelDone || props.trip.status === "cancelado" || props.trip.canceled_at != null;
  const paidAt = props.payment?.paid_at ? new Date(props.payment.paid_at) : null;
  const paidAtMs = paidAt && !Number.isNaN(paidAt.getTime()) ? paidAt.getTime() : null;
  const nowMs = Date.now();
  const elapsedSeconds = paidAtMs ? Math.max(0, Math.floor((nowMs - paidAtMs) / 1000)) : null;
  const amountCents = props.payment?.amount_cents != null && Number.isFinite(props.payment.amount_cents) ? props.payment.amount_cents : null;
  const feePreviewCents = amountCents != null ? computeCancellationFeeCents(amountCents) : null;
  const penaltyApplies = Boolean(amountCents != null && elapsedSeconds != null && elapsedSeconds >= 180);

  const partnerIcon = useMemo(() => {
    if (!towLocation) return undefined;
    if (!hasGoogleMaps) return undefined;
    const g = (window as unknown as { google?: typeof google }).google;
    if (!g?.maps?.Size || !g?.maps?.Point) return undefined;
    return {
      url: props.partner.photoUrl || towMarkerSvgDataUrl(),
      scaledSize: new g.maps.Size(52, 52),
      anchor: new g.maps.Point(26, 26),
    };
  }, [hasGoogleMaps, props.partner.photoUrl, towLocation]);

  const redirectAfterCancel = useCallback(async () => {
    if (redirectInFlightRef.current) return;
    redirectInFlightRef.current = true;
    setIsRedirecting(true);
    try {
      const res = await fetch("/api/partner/trips/paid-active", { cache: "no-store" }).catch(() => null);
      const to = res && res.ok ? "/partner" : `/requests/${encodeURIComponent(props.requestId)}`;
      window.location.href = to;
    } catch {
      window.location.href = `/requests/${encodeURIComponent(props.requestId)}`;
    }
  }, [props.requestId]);

  useEffect(() => {
    if (!isCanceled) return;
    void redirectAfterCancel();
  }, [isCanceled, redirectAfterCancel]);

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

  if (!hasGoogleMaps) {
    return (
      <div className="fixed inset-0 grid place-items-center bg-white p-6">
        <div className="w-full max-w-md rounded-xl border bg-white p-6">
          <h2 className="text-lg font-semibold">Rastreamento</h2>
          <p className="mt-2 text-sm text-zinc-700">
            Não foi possível carregar o Google Maps neste dispositivo. Recarregue a página.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white"
              type="button"
              onClick={() => window.location.reload()}
            >
              Recarregar
            </button>
            <a
              className="rounded-md border px-4 py-2 text-sm font-semibold"
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${props.pickup.lat},${props.pickup.lng}`)}`}
              target="_blank"
              rel="noreferrer"
            >
              Abrir no Google Maps
            </a>
          </div>
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
          <MarkerF
            position={towLocation}
            icon={partnerIcon}
            label={
              !partnerIcon
                ? {
                    text: partnerInitials,
                    color: "#0b0b0d",
                    fontWeight: "800",
                    fontSize: "12px",
                  }
                : undefined
            }
          />
        ) : null}
        </GoogleMap>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
        <div className="pointer-events-auto mx-auto w-full max-w-2xl rounded-3xl border border-brand-border/20 bg-white/95 p-4 shadow-soft backdrop-blur">
          {isCanceled ? (
            <div className="mb-3 rounded-2xl border border-brand-red/30 bg-brand-red/10 p-3 text-sm font-semibold text-brand-red">
              Serviço cancelado
              {props.trip.canceled_fee_cents && props.trip.canceled_fee_cents > 0 ? (
                <div className="mt-1 text-xs font-semibold text-brand-red/80">
                  Multa: {formatBrl(props.trip.canceled_fee_cents)}
                </div>
              ) : null}
              {isRedirecting ? (
                <div className="mt-1 text-xs font-semibold text-brand-red/80">Voltando…</div>
              ) : null}
            </div>
          ) : null}

          {cancelError ? (
            <div className="mb-3 rounded-2xl border border-brand-red/30 bg-brand-red/10 p-3 text-sm font-semibold text-brand-red">
              {cancelError}
            </div>
          ) : null}

          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-brand-black/60">Reboque a caminho</div>
              <div className="mt-1 truncate text-base font-extrabold text-brand-black">{partnerLabel}</div>
              <div className="mt-1 text-xs text-brand-text2">{props.pickupLabel}</div>
              {!towLocation ? (
                <div className="mt-1 text-xs font-semibold text-brand-black/60">Aguardando GPS do reboque…</div>
              ) : null}
              {canTransmit ? (
                gpsError ? (
                  <div className="mt-1 text-xs font-semibold text-brand-red">{gpsError}</div>
                ) : (
                  <div className="mt-1 text-xs font-semibold text-brand-black/60">Transmitindo GPS…</div>
                )
              ) : null}
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
            {!isCanceled ? (
              <button
                className="rounded-2xl border border-brand-red/30 bg-brand-red/10 px-4 py-2 text-sm font-semibold text-brand-red hover:bg-brand-red/15 disabled:opacity-50"
                type="button"
                disabled={isCanceling}
                onClick={async () => {
                  setCancelError(null);
                  if (isCanceling) return;
                  const extra =
                    penaltyApplies && feePreviewCents != null
                      ? `\n\nMulta de cancelamento: ${formatBrl(feePreviewCents)}`
                      : feePreviewCents != null && elapsedSeconds != null && elapsedSeconds < 180
                        ? `\n\nSem multa se cancelar agora. Após 3 min, multa: ${formatBrl(feePreviewCents)}`
                        : "";
                  const ok = window.confirm(`Cancelar o serviço?${extra}`);
                  if (!ok) return;
                  setIsCanceling(true);
                  try {
                    const res = await fetch(`/api/trips/${encodeURIComponent(props.tripId)}/cancel`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ reason: "user_cancel" }),
                    });
                    const json = (await res.json().catch(() => null)) as
                      | { error?: string; penalty?: { fee_cents?: number } | null }
                      | null;
                    if (res.status === 401) {
                      window.location.href = `/login`;
                      return;
                    }
                    if (!res.ok) {
                      throw new Error(json?.error || "Não foi possível cancelar agora.");
                    }
                    setCancelDone(true);
                    await redirectAfterCancel();
                  } catch (e) {
                    setCancelError(e instanceof Error ? e.message : "Não foi possível cancelar agora.");
                  } finally {
                    setIsCanceling(false);
                  }
                }}
              >
                {isCanceling ? "Cancelando..." : "Cancelar serviço"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
