"use client";

import { Component, type ReactNode, useEffect, useRef, useState } from "react";

import { TripTrackingClient } from "./tripTrackingClient";

type Coords = { lat: number; lng: number };

type TrackingResponse = {
  trip?: {
    id?: string;
    request_id?: string;
    status?: string | null;
    canceled_at?: string | null;
    canceled_by_role?: string | null;
    canceled_fee_cents?: number | null;
    canceled_after_seconds?: number | null;
  };
  request?: {
    id?: string;
    status?: string | null;
    local_cliente?: string | null;
    pickup?: Coords | null;
    destino_local?: string | null;
    dropoff?: Coords | null;
  };
  payment?: { amount_cents?: number | null; status?: string | null; paid_at?: string | null } | null;
  partner?: { name?: string | null; whatsapp?: string | null; photoUrl?: string | null };
  error?: string;
};

class LocalErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto w-full max-w-xl rounded-xl border bg-white p-6">
          <h1 className="text-xl font-semibold">Rastreamento</h1>
          <p className="mt-2 text-sm text-zinc-700">Não foi possível abrir o mapa neste dispositivo.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white"
              type="button"
              onClick={() => window.location.reload()}
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function TripTrackingPageClient(props: { tripId: string }) {
  const [data, setData] = useState<TrackingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const redirectingRef = useRef(false);

  useEffect(() => {
    let alive = true;

    async function load() {
      setError(null);
      try {
        const res = await fetch(`/api/public/trips/${props.tripId}/tracking`, { cache: "no-store" });
        const json = (await res.json()) as TrackingResponse;
        if (!alive) return;
        if (!res.ok) {
          setError(json?.error || "Falha ao carregar rastreamento.");
          setData(null);
          return;
        }
        setData(json);
      } catch {
        if (!alive) return;
        setError("Falha ao carregar rastreamento.");
        setData(null);
      }
    }

    void load();
    const id = window.setInterval(load, 3500);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [props.tripId]);

  useEffect(() => {
    if (redirectingRef.current) return;
    const tripStatus = data?.trip?.status ? String(data.trip.status) : "";
    const reqStatus = data?.request?.status ? String(data.request.status) : "";
    const canceled = tripStatus === "cancelado" || reqStatus === "CANCELADO" || Boolean(data?.trip?.canceled_at);
    if (!canceled) return;
    redirectingRef.current = true;

    let cancelled = false;
    async function run() {
      const requestId = data?.trip?.request_id ? String(data.trip.request_id) : "";
      try {
        const res = await fetch("/api/partner/trips/paid-active", { cache: "no-store" }).catch(() => null);
        if (cancelled) return;
        const to = res && res.ok ? "/partner" : requestId ? `/requests/${encodeURIComponent(requestId)}` : "/";
        window.location.href = to;
      } catch {
        if (!cancelled) window.location.href = requestId ? `/requests/${encodeURIComponent(requestId)}` : "/";
      }
    }
    void run();

    return () => {
      cancelled = true;
    };
  }, [data]);

  useEffect(() => {
    const tripId = data?.trip?.id ? String(data.trip.id) : "";
    const tripStatus = data?.trip?.status ? String(data.trip.status) : "";
    const requestId = data?.trip?.request_id ? String(data.trip.request_id) : "";
    const reqStatus = data?.request?.status ? String(data.request.status) : "";
    const ended = tripStatus === "finalizado" || tripStatus === "cancelado" || reqStatus === "PAGO" || reqStatus === "CANCELADO";

    try {
      if (ended) {
        window.localStorage.removeItem("reboquesos_active_trip_id");
        window.localStorage.removeItem("reboquesos_active_request_id");
        return;
      }

      if (tripId) window.localStorage.setItem("reboquesos_active_trip_id", tripId);
      if (requestId) window.localStorage.setItem("reboquesos_active_request_id", requestId);
    } catch {
      return;
    }
  }, [data]);

  if (error) {
    return (
      <div className="mx-auto w-full max-w-xl rounded-xl border bg-white p-6">
        <h1 className="text-xl font-semibold">Rastreamento</h1>
        <p className="mt-2 text-sm text-zinc-700">{error}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white"
            type="button"
            onClick={() => window.location.reload()}
          >
            Recarregar
          </button>
          <a className="rounded-md border px-4 py-2 text-sm font-semibold" href={`/requests/${encodeURIComponent(props.tripId)}`}>
            Voltar
          </a>
        </div>
      </div>
    );
  }

  const tripId = data?.trip?.id ? String(data.trip.id) : "";
  const requestId = data?.trip?.request_id ? String(data.trip.request_id) : "";
  const pickup = data?.request?.pickup ?? null;
  const pickupLabel = data?.request?.local_cliente ? String(data.request.local_cliente) : "Local do cliente";
  const dropoff = data?.request?.dropoff ?? null;
  const dropoffLabel = data?.request?.destino_local ? String(data.request.destino_local) : "Destino";

  if (!tripId || !requestId || !pickup) {
    return (
      <div className="fixed inset-0 grid place-items-center bg-white p-6">
        <div className="w-full max-w-md rounded-xl border bg-white p-6">
          <p className="text-sm text-zinc-700">Carregando rastreamento...</p>
        </div>
      </div>
    );
  }

  return (
    <LocalErrorBoundary>
      <TripTrackingClient
        tripId={tripId}
        requestId={requestId}
        pickup={pickup}
        pickupLabel={pickupLabel}
        dropoff={dropoff}
        dropoffLabel={dropoffLabel}
        initialTowLocation={null}
        trip={{
          status: data?.trip?.status ? String(data.trip.status) : null,
          canceled_at: data?.trip?.canceled_at ? String(data.trip.canceled_at) : null,
          canceled_by_role: data?.trip?.canceled_by_role ? String(data.trip.canceled_by_role) : null,
          canceled_fee_cents:
            typeof data?.trip?.canceled_fee_cents === "number" ? data.trip.canceled_fee_cents : null,
          canceled_after_seconds:
            typeof data?.trip?.canceled_after_seconds === "number" ? data.trip.canceled_after_seconds : null,
        }}
        payment={
          data?.payment
            ? {
                amount_cents:
                  typeof data.payment.amount_cents === "number" ? data.payment.amount_cents : null,
                status: data.payment.status ? String(data.payment.status) : null,
                paid_at: data.payment.paid_at ? String(data.payment.paid_at) : null,
              }
            : null
        }
        partner={{
          name: data?.partner?.name ? String(data.partner.name) : "Reboque",
          whatsapp: data?.partner?.whatsapp ? String(data.partner.whatsapp) : null,
          photoUrl: data?.partner?.photoUrl ? String(data.partner.photoUrl) : null,
        }}
      />
    </LocalErrorBoundary>
  );
}
