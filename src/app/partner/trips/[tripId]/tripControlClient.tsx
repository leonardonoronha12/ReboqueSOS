"use client";

import { useEffect, useRef, useState } from "react";

import type { TowTripStatus } from "@/lib/types";

type Coords = { lat: number; lng: number };

export function TripControlClient(props: {
  tripId: string;
  requestId: string;
  currentStatus: TowTripStatus | string;
}) {
  const [isTracking, setIsTracking] = useState(false);
  const [lastCoords, setLastCoords] = useState<Coords | null>(null);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const lastCoordsRef = useRef<Coords | null>(null);

  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (intervalRef.current != null) window.clearInterval(intervalRef.current);
    };
  }, []);

  async function postLocation(coords: Coords) {
    await fetch(`/api/trips/${props.tripId}/location`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(coords),
    });
  }

  async function updateStatus(status: TowTripStatus) {
    setError(null);
    const res = await fetch(`/api/trips/${props.tripId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      setError(json.error || "Falha ao atualizar status.");
    }
  }

  async function startTracking() {
    setError(null);
    if (!navigator.geolocation) {
      setError("Seu navegador não suporta GPS.");
      return;
    }

    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    if (intervalRef.current != null) window.clearInterval(intervalRef.current);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        lastCoordsRef.current = coords;
        setLastCoords(coords);
      },
      () => setError("Falha ao capturar GPS."),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
    );

    intervalRef.current = window.setInterval(() => {
      if (!lastCoordsRef.current) return;
      void postLocation(lastCoordsRef.current);
    }, 5000);

    setIsTracking(true);
    await updateStatus("a_caminho");
  }

  function stopTracking() {
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    if (intervalRef.current != null) window.clearInterval(intervalRef.current);
    watchIdRef.current = null;
    intervalRef.current = null;
    setIsTracking(false);
  }

  return (
    <div className="rounded-xl border bg-white p-6">
      <h2 className="text-lg font-semibold">Ações</h2>
      <p className="mt-1 text-sm text-zinc-700">
        Inicie o deslocamento para ativar o GPS e permitir rastreamento ao vivo no app do cliente.
      </p>

      {error ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          onClick={startTracking}
          disabled={isTracking}
        >
          Iniciar deslocamento (GPS)
        </button>
        <button
          className="rounded-md border px-4 py-2 text-sm font-semibold disabled:opacity-50"
          onClick={stopTracking}
          disabled={!isTracking}
        >
          Parar GPS
        </button>
        <button
          className="rounded-md border px-4 py-2 text-sm font-semibold"
          onClick={() => updateStatus("chegou")}
        >
          Cheguei
        </button>
        <button
          className="rounded-md border px-4 py-2 text-sm font-semibold"
          onClick={() => updateStatus("em_servico")}
        >
          Em serviço
        </button>
        <button
          className="rounded-md border px-4 py-2 text-sm font-semibold"
          onClick={() => updateStatus("concluido")}
        >
          Concluir corrida
        </button>
        <a
          className="rounded-md border px-4 py-2 text-sm font-semibold"
          href={`/payments/${props.requestId}?mode=partner`}
        >
          Cobrar cliente agora
        </a>
      </div>

      {lastCoords ? (
        <div className="mt-4 text-xs text-zinc-600">
          Último GPS: {lastCoords.lat.toFixed(5)}, {lastCoords.lng.toFixed(5)}
        </div>
      ) : null}
    </div>
  );
}
