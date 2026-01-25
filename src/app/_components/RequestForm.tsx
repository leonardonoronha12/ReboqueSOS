"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Sheet } from "@/components/ui/Sheet";

type Coords = { lat: number; lng: number };

function formatBrPhone(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);

  if (!ddd) return "";
  if (digits.length <= 2) return `(${ddd}`;

  if (rest.length <= 4) return `(${ddd}) ${rest}`;

  if (rest.length <= 8) {
    const a = rest.slice(0, 4);
    const b = rest.slice(4);
    return b ? `(${ddd}) ${a}-${b}` : `(${ddd}) ${a}`;
  }

  const a = rest.slice(0, rest.length === 9 ? 5 : 4);
  const b = rest.slice(rest.length === 9 ? 5 : 4);
  return `(${ddd}) ${a}-${b}`;
}

export function RequestForm() {
  const router = useRouter();
  const [coords, setCoords] = useState<Coords | null>(null);
  const [nearbyCount, setNearbyCount] = useState<number | null>(null);
  const [isLoadingNearby, setIsLoadingNearby] = useState(false);
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [openSheet, setOpenSheet] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [modeloVeiculo, setModeloVeiculo] = useState("");
  const [endereco, setEndereco] = useState("");

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
    const onOpen = () => setOpenSheet(true);
    window.addEventListener("reboquesos:open-request-sheet", onOpen);
    return () => window.removeEventListener("reboquesos:open-request-sheet", onOpen);
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("reboquesos.nome");
      if (saved) setNome(saved);
      const savedPhone = window.localStorage.getItem("reboquesos.telefone");
      if (savedPhone) setTelefone(savedPhone);
      const savedModel = window.localStorage.getItem("reboquesos.modeloVeiculo");
      if (savedModel) setModeloVeiculo(savedModel);
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
    try {
      if (!telefone) return;
      window.localStorage.setItem("reboquesos.telefone", telefone);
    } catch {
      return;
    }
  }, [telefone]);

  useEffect(() => {
    try {
      if (!modeloVeiculo) return;
      window.localStorage.setItem("reboquesos.modeloVeiculo", modeloVeiculo);
    } catch {
      return;
    }
  }, [modeloVeiculo]);

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

  const canSubmit = useMemo(() => {
    const displayName = nome.trim();
    const tel = telefone.replace(/\D/g, "").trim();
    const model = modeloVeiculo.trim();
    if (!displayName || !tel || !model) return false;
    if (coords) return true;
    if (endereco.trim()) return true;
    return false;
  }, [coords, endereco, modeloVeiculo, nome, telefone]);

  async function handleGetLocation() {
    if (!navigator.geolocation) {
      setSheetError("Seu navegador não suporta GPS.");
      return;
    }
    setSheetError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => setSheetError("Não foi possível obter sua localização."),
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
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSheetError(null);

    try {
      const displayName = nome.trim();
      const tel = telefone.trim();
      const model = modeloVeiculo.trim();
      if (!displayName || !tel || !model) {
        setSheetError("Informe nome, telefone e modelo do veículo.");
        return;
      }

      const resolved = await ensureCoords();
      if (!resolved) {
        setSheetError("Informe um endereço ou use a localização do dispositivo.");
        return;
      }

      setOpenSheet(false);

      const res = await fetch("/api/tow-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: displayName,
          endereco: resolved.address || undefined,
          local_cliente: resolved.address || undefined,
          lat: resolved.coords.lat,
          lng: resolved.coords.lng,
          telefone: tel,
          modelo_veiculo: model,
        }),
      });

      const json = (await res.json()) as { id?: string; error?: string };
      if (!res.ok) throw new Error(json.error || "Falha ao solicitar reboque.");
      if (!json.id) throw new Error("Resposta inválida.");

      router.push(`/requests/${json.id}`);
    } catch (e) {
      setOpenSheet(true);
      setSheetError(e instanceof Error ? e.message : "Falha ao solicitar reboque.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const label =
    geoStatus === "loading" ? "…" : geoStatus === "error" ? "—" : coords ? String(nearbyCount ?? 0) : "—";

  return (
    <>
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

      <Sheet
        open={openSheet}
        title="Pedir reboque"
        onClose={() => {
          if (isSubmitting) return;
          setOpenSheet(false);
        }}
        footer={
          <button className="btn-primary w-full disabled:opacity-50" type="button" disabled={!canSubmit || isSubmitting} onClick={startRequest}>
            {isSubmitting ? "Solicitando..." : "Solicitar reboque agora"}
          </button>
        }
      >
        <div className="space-y-3">
          {sheetError ? (
            <div className="rounded-2xl border border-brand-red/30 bg-brand-red/10 p-3 text-sm font-semibold text-brand-red">
              {sheetError}
            </div>
          ) : null}

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
            <div className="text-sm font-bold text-brand-black">Telefone</div>
            <input
              className="mt-1 w-full rounded-2xl border border-brand-border/20 bg-white px-3 py-2 text-brand-black placeholder:text-brand-text2 focus:border-brand-yellow/60 focus:outline-none focus:ring-4 focus:ring-brand-yellow/20"
              placeholder="(21) 99999-9999"
              inputMode="tel"
              value={telefone}
              onChange={(e) => setTelefone(formatBrPhone(e.target.value))}
            />
          </div>

          <div>
            <div className="text-sm font-bold text-brand-black">Modelo do veículo</div>
            <input
              className="mt-1 w-full rounded-2xl border border-brand-border/20 bg-white px-3 py-2 text-brand-black placeholder:text-brand-text2 focus:border-brand-yellow/60 focus:outline-none focus:ring-4 focus:ring-brand-yellow/20"
              placeholder="Ex: Gol, Onix, HB20, Corolla..."
              value={modeloVeiculo}
              onChange={(e) => setModeloVeiculo(e.target.value)}
            />
          </div>

          <div>
            <div className="text-sm font-bold text-brand-black">Endereço (opcional)</div>
            <input
              className="mt-1 w-full rounded-2xl border border-brand-border/20 bg-white px-3 py-2 text-brand-black placeholder:text-brand-text2 focus:border-brand-yellow/60 focus:outline-none focus:ring-4 focus:ring-brand-yellow/20"
              placeholder="Rua, número, referência"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
            />
          </div>

          <button className="btn-secondary w-full" type="button" onClick={handleGetLocation}>
            Usar meu local
          </button>

          {coords ? (
            <div className="text-xs text-brand-text2">
              Local atual: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </div>
          ) : null}
        </div>
      </Sheet>
    </>
  );
}
