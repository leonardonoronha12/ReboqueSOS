"use client";

import { DirectionsRenderer, GoogleMap, MarkerF, useJsApiLoader } from "@react-google-maps/api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Coords = { lat: number; lng: number };

function towMarkerSvgDataUrl() {
  const svg =
    `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">` +
    `<path d="M12 38.5c0-1.7 1.3-3 3-3h19.6c1 0 1.9.5 2.4 1.4l4.7 8.1h7.3c1.7 0 3 1.3 3 3v2.5H12v-9z" fill="#FFC300"/>` +
    `<path d="M22 26c0-1.7 1.3-3 3-3h10c1.7 0 3 1.3 3 3v8H22v-8z" fill="#FFC300"/>` +
    `<path d="M46 28.5c0-.8.6-1.5 1.5-1.5h6c.8 0 1.5.7 1.5 1.5V33h-9v-4.5z" fill="#FFC300"/>` +
    `<path d="M45 33h13c1.7 0 3 1.3 3 3v2.5H45V33z" fill="#FFFFFF" opacity="0.14"/>` +
    `<path d="M50 20.5c0-1.4 1.1-2.5 2.5-2.5S55 19.1 55 20.5V22h-5v-1.5z" fill="#E10600"/>` +
    `<path d="M52.5 12c4.5 0 8.2 3.6 8.2 8.1 0 .7-.1 1.4-.3 2.1h-3.3c.3-.7.5-1.4.5-2.1 0-2.8-2.3-5-5.1-5s-5.1 2.2-5.1 5c0 .7.1 1.4.5 2.1h-3.3c-.2-.7-.3-1.4-.3-2.1 0-4.5 3.7-8.1 8.2-8.1z" fill="#E10600"/>` +
    `<path d="M20 52a6 6 0 1 0 0-12 6 6 0 0 0 0 12z" fill="#0B0B0D" stroke="#2A2A2E" stroke-width="2"/>` +
    `<path d="M46 52a6 6 0 1 0 0-12 6 6 0 0 0 0 12z" fill="#0B0B0D" stroke="#2A2A2E" stroke-width="2"/>` +
    `<path d="M20 48a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" fill="#FFFFFF" opacity="0.8"/>` +
    `<path d="M46 48a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" fill="#FFFFFF" opacity="0.8"/>` +
    `<path d="M43 26.5c.7 0 1.3.6 1.3 1.3v7.7c0 .7-.6 1.3-1.3 1.3H15.2c-.6 0-1.1-.3-1.3-.8l-3-7.7c-.3-.9.3-1.8 1.3-1.8H43z" fill="#FFFFFF" opacity="0.1"/>` +
    `<path d="M43 37h10.2c1.3 0 2.5-.5 3.5-1.4l2.6-2.3" stroke="#FFFFFF" stroke-opacity="0.25" stroke-width="2" stroke-linecap="round"/>` +
    `</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function haversineMeters(a: Coords, b: Coords) {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const h = s1 * s1 + Math.cos(lat1) * Math.cos(lat2) * s2 * s2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
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
  dropoff: Coords | null;
  dropoffLabel: string;
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
  const [phase, setPhase] = useState<"pickup" | "dropoff">("pickup");
  const pickupArrivedRef = useRef(false);
  const finishSentRef = useRef(false);
  const [showFinishModal, setShowFinishModal] = useState(false);

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

  const target = useMemo<Coords>(() => {
    if (phase === "dropoff" && props.dropoff) return props.dropoff;
    return props.pickup;
  }, [phase, props.dropoff, props.pickup]);

  const targetLabel = phase === "dropoff" ? props.dropoffLabel : props.pickupLabel;
  const phaseLabel = phase === "dropoff" ? "Destino" : "Local do cliente";

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
          destination: target,
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
  }, [canRoute, target, towLocation]);

  const partnerLabel = props.partner.name.trim() || "Reboque";
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
      url: towMarkerSvgDataUrl(),
      scaledSize: new g.maps.Size(52, 52),
      anchor: new g.maps.Point(26, 26),
    };
  }, [hasGoogleMaps, towLocation]);

  useEffect(() => {
    if (!towLocation) return;
    if (isCanceled) return;
    if (!props.dropoff) return;
    if (phase !== "pickup") return;
    const meters = haversineMeters(towLocation, props.pickup);
    if (meters > 120) return;
    setPhase("dropoff");
    pickupArrivedRef.current = true;
  }, [isCanceled, phase, props.dropoff, props.pickup, towLocation]);

  useEffect(() => {
    if (!towLocation) return;
    if (isCanceled) return;
    if (!props.dropoff) return;
    if (phase !== "dropoff") return;
    const meters = haversineMeters(towLocation, props.dropoff);
    if (meters > 120) return;
    setShowFinishModal(true);
  }, [isCanceled, phase, props.dropoff, towLocation]);

  const updateTripStatus = useCallback(
    async (status: "chegou" | "finalizado") => {
      try {
        const res = await fetch(`/api/trips/${encodeURIComponent(props.tripId)}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (res.status === 401) return;
      } catch {
        return;
      }
    },
    [props.tripId],
  );

  useEffect(() => {
    if (!canTransmit) return;
    if (isCanceled) return;
    if (!pickupArrivedRef.current) return;
    if (props.trip.status === "chegou" || props.trip.status === "em_servico" || props.trip.status === "concluido" || props.trip.status === "finalizado") {
      return;
    }
    pickupArrivedRef.current = false;
    void updateTripStatus("chegou");
  }, [canTransmit, isCanceled, props.trip.status, updateTripStatus]);

  useEffect(() => {
    if (!canTransmit) return;
    if (isCanceled) return;
    if (!props.dropoff) return;
    if (phase !== "dropoff") return;
    if (!towLocation) return;
    if (finishSentRef.current) return;
    if (props.trip.status === "finalizado") return;
    const meters = haversineMeters(towLocation, props.dropoff);
    if (meters > 120) return;
    finishSentRef.current = true;
    void updateTripStatus("finalizado");
  }, [canTransmit, isCanceled, phase, props.dropoff, props.trip.status, towLocation, updateTripStatus]);

  useEffect(() => {
    if (props.trip.status === "finalizado") setShowFinishModal(true);
  }, [props.trip.status]);

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
        {props.dropoff ? <MarkerF position={props.dropoff} /> : null}
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
          />
        ) : null}
        </GoogleMap>

      {showFinishModal ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-brand-border/20 bg-white p-5 shadow-soft">
            <div className="text-lg font-extrabold text-brand-black">Corrida finalizada</div>
            <div className="mt-2 text-sm text-brand-text2">{props.dropoffLabel}</div>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white"
                href={canTransmit ? "/partner" : `/requests/${encodeURIComponent(props.requestId)}/rating`}
              >
                {canTransmit ? "Voltar ao painel" : "Avaliar corrida"}
              </a>
              <a
                className="rounded-md border px-4 py-2 text-sm font-semibold"
                href={`/requests/${encodeURIComponent(props.requestId)}`}
              >
                Detalhes
              </a>
              <button
                className="rounded-md border px-4 py-2 text-sm font-semibold"
                type="button"
                onClick={() => setShowFinishModal(false)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
              <div className="text-xs font-semibold text-brand-black/60">{phaseLabel}</div>
              <div className="mt-1 truncate text-base font-extrabold text-brand-black">{partnerLabel}</div>
              <div className="mt-1 text-xs text-brand-text2">{targetLabel}</div>
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
