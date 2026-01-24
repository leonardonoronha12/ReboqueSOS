"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { GoogleMap, MarkerF, useJsApiLoader } from "@react-google-maps/api";

import { BrandLogo } from "@/components/BrandLogo";
import { Sheet } from "@/components/ui/Sheet";

type Coords = { lat: number; lng: number };
type NearbyPartner = {
  id: string;
  empresa_nome: string;
  cidade: string;
  lat: number;
  lng: number;
  distance_km: number;
};

export function RequestForm() {
  const router = useRouter();
  const [endereco, setEndereco] = useState("");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nearby, setNearby] = useState<NearbyPartner[] | null>(null);
  const [isLoadingNearby, setIsLoadingNearby] = useState(false);
  const [openSheet, setOpenSheet] = useState(false);
  const [nome, setNome] = useState("");
  const [openStatus, setOpenStatus] = useState(false);
  const [statusText, setStatusText] = useState<string>("Solicitando reboque");
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusCoords, setStatusCoords] = useState<Coords | null>(null);
  const [statusAddress, setStatusAddress] = useState<string>("");

  const canSubmit = useMemo(() => {
    if (!coords && !endereco) return false;
    return true;
  }, [coords, endereco]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("reboquesos.nome");
      if (saved) setNome(saved);
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    try {
      if (!nome) return;
      window.localStorage.setItem("reboquesos.nome", nome);
    } catch {
      return;
    }
  }, [nome]);

  useEffect(() => {
    const lat = coords?.lat;
    const lng = coords?.lng;
    if (lat == null || lng == null) {
      setNearby(null);
      return;
    }

    let cancelled = false;
    async function run() {
      setIsLoadingNearby(true);
      try {
        const qs = new URLSearchParams({ lat: String(lat), lng: String(lng) });
        const res = await fetch(`/api/partners/nearby?${qs.toString()}`);
        const json = (await res.json()) as { partners?: NearbyPartner[] };
        if (!cancelled) setNearby(json.partners ?? []);
      } finally {
        if (!cancelled) setIsLoadingNearby(false);
      }
    }
    run().catch(() => {
      if (!cancelled) setNearby([]);
    });

    return () => {
      cancelled = true;
    };
  }, [coords]);

  useEffect(() => {
    const onOpen = () => setOpenSheet(true);
    window.addEventListener("reboquesos:open-request-sheet", onOpen);
    return () => window.removeEventListener("reboquesos:open-request-sheet", onOpen);
  }, []);

  async function handleGetLocation() {
    setError(null);
    if (!navigator.geolocation) {
      setError("Seu navegador não suporta GPS.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => setError("Não foi possível obter sua localização."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function ensureCoords() {
    if (coords) return { coords, address: endereco };
    const address = endereco.trim();
    if (!address) return null;

    const res = await fetch("/api/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });
    const json = (await res.json()) as {
      location?: { lat: number; lng: number };
      formattedAddress?: string | null;
      error?: string;
    };
    if (!res.ok || !json.location) throw new Error(json.error || "Não foi possível localizar o endereço.");
    return {
      coords: { lat: json.location.lat, lng: json.location.lng },
      address: String(json.formattedAddress ?? address),
    };
  }

  async function startRequest() {
    setIsSubmitting(true);
    setError(null);
    setStatusError(null);
    setStatusText("Solicitando reboque");
    setOpenSheet(false);
    setOpenStatus(true);

    try {
      const resolved = await ensureCoords();
      if (!resolved) {
        setStatusError("Informe um endereço ou selecione um ponto no mapa.");
        return;
      }
      setStatusCoords(resolved.coords);
      setStatusAddress(resolved.address);

      const res = await fetch("/api/tow-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endereco: resolved.address || undefined,
          local_cliente: resolved.address || undefined,
          lat: resolved.coords.lat,
          lng: resolved.coords.lng,
        }),
      });

      const json = (await res.json()) as { id?: string; error?: string };
      if (res.status === 401) {
        setOpenStatus(false);
        router.push("/login");
        return;
      }
      if (!res.ok) throw new Error(json.error || "Falha ao solicitar reboque.");
      if (!json.id) throw new Error("Resposta inválida.");

      setStatusText("Chamado enviado! Procurando reboques próximos");
      window.setTimeout(() => {
        router.push(`/requests/${json.id}`);
      }, 1100);
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : "Falha ao solicitar reboque.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const { isLoaded } = useJsApiLoader({
    id: "reboquesos-google-maps-home",
    googleMapsApiKey: apiKey,
  });

  const defaultCenter = { lat: -22.8267, lng: -43.0533 };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-extrabold text-brand-black">Solicitar reboque</div>
          <div className="mt-0.5 text-xs text-brand-text2">
            Digite o endereço, use seu local ou ajuste no mapa
          </div>
        </div>
        <span className="rounded-full border border-brand-success/30 bg-brand-success/10 px-3 py-1 text-xs font-semibold text-brand-success">
          Seguro e rápido
        </span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1" />
        <button
          className="btn-secondary inline-flex items-center justify-center px-4 py-2 text-sm"
          type="button"
          onClick={handleGetLocation}
        >
          Usar meu local
        </button>
      </div>

      <div className="mt-4 space-y-1">
        <div className="text-sm font-bold text-brand-black">Endereço (opcional)</div>
        <input
          className="w-full rounded-2xl border border-brand-border/20 bg-white px-3 py-2 text-brand-black placeholder:text-brand-text2 focus:border-brand-yellow/60 focus:outline-none focus:ring-4 focus:ring-brand-yellow/20"
          placeholder="Rua, número, referência (ex: Av. ..., 123)"
          value={endereco}
          onChange={(e) => setEndereco(e.target.value)}
        />
        {coords ? (
          <div className="text-xs text-brand-text2">
            Local selecionado: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </div>
        ) : null}
      </div>

      {apiKey ? (
        isLoaded ? (
          <div className="mt-4 overflow-hidden rounded-2xl border border-brand-border/20 bg-white">
            <div className="border-b border-brand-border/20 bg-brand-yellow/10 px-4 py-3 text-sm">
              <div className="font-bold text-brand-black">Escolher no mapa</div>
              <div className="mt-0.5 text-xs text-brand-black/70">
                Clique para posicionar o pino e arraste para ajustar
              </div>
            </div>
            <div className="h-[260px] w-full">
              <GoogleMap
                center={coords ?? defaultCenter}
                zoom={coords ? 15 : 12}
                mapContainerStyle={{ width: "100%", height: "100%" }}
                options={{ disableDefaultUI: true, clickableIcons: false }}
                onClick={(e) => {
                  const ll = e.latLng;
                  if (!ll) return;
                  setCoords({ lat: ll.lat(), lng: ll.lng() });
                }}
              >
                {coords ? (
                  <MarkerF
                    position={coords}
                    draggable
                    onDragEnd={(e) => {
                      const ll = e.latLng;
                      if (!ll) return;
                      setCoords({ lat: ll.lat(), lng: ll.lng() });
                    }}
                  />
                ) : null}
              </GoogleMap>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-brand-border/20 bg-white p-3 text-sm text-brand-black/70">
            Carregando mapa...
          </div>
        )
      ) : (
        <div className="mt-4 rounded-xl border border-brand-yellow/30 bg-brand-yellow/10 p-3 text-sm text-brand-black">
          Configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY para habilitar seleção no mapa e endereço.
        </div>
      )}

      {error ? (
        <div className="mt-4 rounded-md border border-brand-red/30 bg-brand-red/10 p-3 text-sm text-brand-red">
          {error}
        </div>
      ) : null}

      <button
        className="btn-primary mt-4 w-full text-sm disabled:opacity-50"
        type="button"
        disabled={!canSubmit || isSubmitting}
        onClick={() => setOpenSheet(true)}
      >
        {isSubmitting ? "Enviando..." : "Solicitar Reboque Agora"}
      </button>

      <Sheet
        open={openSheet}
        title="Confirmar solicitação"
        onClose={() => {
          if (isSubmitting) return;
          setOpenSheet(false);
        }}
        footer={
          <button className="btn-primary w-full disabled:opacity-50" type="button" disabled={isSubmitting} onClick={startRequest}>
            {isSubmitting ? "Solicitando..." : "Chamar Reboque"}
          </button>
        }
      >
        <div className="space-y-3">
          <div>
            <div className="text-sm font-bold text-brand-black">Seu nome</div>
            <input
              className="mt-1 w-full rounded-2xl border border-brand-border/20 bg-white px-3 py-2 text-brand-black placeholder:text-brand-text2 focus:border-brand-yellow/60 focus:outline-none focus:ring-4 focus:ring-brand-yellow/20"
              placeholder="Ex: João da Silva"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>
          <div>
            <div className="text-sm font-bold text-brand-black">Endereço</div>
            <input
              className="mt-1 w-full rounded-2xl border border-brand-border/20 bg-white px-3 py-2 text-brand-black placeholder:text-brand-text2 focus:border-brand-yellow/60 focus:outline-none focus:ring-4 focus:ring-brand-yellow/20"
              placeholder="Rua, número, referência"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" type="button" onClick={handleGetLocation}>
              Usar meu local
            </button>
            <button
              className="rounded-2xl border border-brand-border/20 bg-white px-4 py-3 text-sm font-semibold text-brand-black hover:bg-brand-yellow/10"
              type="button"
              onClick={() => window.document.getElementById("mapa-selecao")?.scrollIntoView({ behavior: "smooth" })}
            >
              Ajustar no mapa
            </button>
          </div>
        </div>
      </Sheet>

      {openStatus ? (
        <div className="fixed inset-0 z-50 bg-white">
          <div className="border-b border-brand-border/20 bg-white">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
              <BrandLogo size="sm" tone="light" />
              <button
                className="rounded-2xl border border-brand-border/20 bg-white px-4 py-2 text-sm font-semibold text-brand-black hover:bg-brand-yellow/10"
                type="button"
                onClick={() => setOpenStatus(false)}
              >
                Fechar
              </button>
            </div>
          </div>
          <div className="mx-auto w-full max-w-6xl px-4 py-4">
            <div className="flex items-center gap-2 text-lg font-extrabold text-brand-black">
              {statusText}
              <span className="sos-dots text-brand-red">
                <span>•</span> <span>•</span> <span>•</span>
              </span>
            </div>
            {statusAddress ? <div className="mt-1 text-sm text-brand-black/70">{statusAddress}</div> : null}
            {statusError ? (
              <div className="mt-4 rounded-2xl border border-brand-red/30 bg-brand-red/10 p-4 text-sm font-semibold text-brand-red">
                {statusError}
              </div>
            ) : null}

            <div className="mt-4 overflow-hidden rounded-2xl border border-brand-border/20 bg-white shadow-soft">
              <div className="h-[56vh] w-full">
                {apiKey && isLoaded && statusCoords ? (
                  <GoogleMap
                    center={statusCoords}
                    zoom={15}
                    mapContainerStyle={{ width: "100%", height: "100%" }}
                    options={{ disableDefaultUI: true, clickableIcons: false }}
                  >
                    <MarkerF position={statusCoords} />
                  </GoogleMap>
                ) : (
                  <div className="flex h-full items-center justify-center p-6 text-center text-sm text-brand-black/70">
                    {apiKey ? "Carregando mapa..." : "Mapa indisponível. Continuando solicitação..."}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div id="mapa-selecao" className="mt-6 rounded-2xl border border-brand-border/20 bg-white p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-bold text-brand-black">Reboques próximos</div>
            <div className="text-xs text-brand-text2">
              Mostra os 3 parceiros mais próximos (por distância).
            </div>
          </div>
          {isLoadingNearby ? (
            <div className="text-xs text-brand-text2">Carregando...</div>
          ) : null}
        </div>

        {!coords ? (
          <div className="mt-3 rounded-xl border border-brand-border/20 bg-brand-yellow/10 p-3 text-sm text-brand-black/80">
            Use “Usar meu local” ou selecione um ponto no mapa para listar reboques próximos.
          </div>
        ) : nearby && nearby.length === 0 ? (
          <div className="mt-3 rounded-xl border border-brand-yellow/30 bg-brand-yellow/10 p-3 text-sm text-brand-black">
            Nenhum parceiro encontrado próximo.
          </div>
        ) : nearby ? (
          <div className="mt-3 space-y-2">
            {nearby.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-brand-border/20 bg-white p-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="truncate font-bold text-brand-black">{p.empresa_nome}</div>
                  <div className="mt-0.5 text-xs text-brand-text2">{p.cidade}</div>
                </div>
                <div className="shrink-0 rounded-full border border-brand-yellow/40 bg-brand-yellow px-3 py-1 text-xs font-bold text-brand-black">
                  {p.distance_km.toFixed(1)} km
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {coords && apiKey && isLoaded ? (
          <div className="mt-4 h-[280px] w-full overflow-hidden rounded-xl border border-brand-border/20">
            <GoogleMap
              center={coords}
              zoom={13}
              mapContainerStyle={{ width: "100%", height: "100%" }}
              options={{ disableDefaultUI: true, clickableIcons: false }}
            >
              <MarkerF position={coords} />
              {(nearby ?? []).map((p) => (
                <MarkerF key={p.id} position={{ lat: p.lat, lng: p.lng }} />
              ))}
            </GoogleMap>
          </div>
        ) : null}
      </div>
    </div>
  );
}
