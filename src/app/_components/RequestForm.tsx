"use client";

import { useEffect, useState } from "react";

type Coords = { lat: number; lng: number };

export function RequestForm() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [nearbyCount, setNearbyCount] = useState<number | null>(null);
  const [isLoadingNearby, setIsLoadingNearby] = useState(false);
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    let alive = true;
    const timeouts: number[] = [];
    const defer = (fn: () => void) => {
      const id = window.setTimeout(() => {
        if (!alive) return;
        fn();
      }, 0);
      timeouts.push(id);
    };

    if (!navigator.geolocation) {
      defer(() => setGeoStatus("error"));
      return () => {
        alive = false;
        for (const id of timeouts) window.clearTimeout(id);
      };
    }

    defer(() => setGeoStatus("loading"));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!alive) return;
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus("ready");
      },
      () => {
        if (!alive) return;
        setGeoStatus("error");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );

    return () => {
      alive = false;
      for (const id of timeouts) window.clearTimeout(id);
    };
  }, []);

  useEffect(() => {
    const lat = coords?.lat;
    const lng = coords?.lng;
    if (lat == null || lng == null) {
      setNearbyCount(null);
      return;
    }

    let cancelled = false;
    async function run() {
      setIsLoadingNearby(true);
      try {
        const qs = new URLSearchParams({
          lat: String(lat),
          lng: String(lng),
          radius_km: "20",
          only_count: "1",
        });
        const res = await fetch(`/api/partners/nearby?${qs.toString()}`);
        const json = (await res.json()) as { count_nearby?: number };
        if (!cancelled) setNearbyCount(Number.isFinite(json.count_nearby) ? Number(json.count_nearby) : 0);
      } finally {
        if (!cancelled) setIsLoadingNearby(false);
      }
    }
    run().catch(() => {
      if (!cancelled) setNearbyCount(0);
    });

    return () => {
      cancelled = true;
    };
  }, [coords]);

  const label =
    geoStatus === "loading" ? "…" : geoStatus === "error" ? "—" : coords ? String(nearbyCount ?? 0) : "—";

  return (
    <div id="mapa-selecao" className="rounded-2xl border border-brand-border/20 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-bold text-brand-black">Reboques próximos</div>
        {isLoadingNearby ? <div className="text-xs text-brand-text2">Carregando...</div> : null}
      </div>
      <div className="mt-3 rounded-2xl border border-brand-border/20 bg-brand-yellow/10 p-3 text-sm font-semibold text-brand-black/90">
        <span className="text-brand-black">{label}</span> reboques próximos ativos para atender seu chamado agora
      </div>
      {geoStatus === "error" ? (
        <div className="mt-2 text-xs text-brand-text2">
          Ative a localização do dispositivo para calcular reboques próximos.
        </div>
      ) : null}
    </div>
  );
}

