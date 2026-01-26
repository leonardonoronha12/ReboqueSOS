"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { GoogleMap, MarkerF, useJsApiLoader } from "@react-google-maps/api";

import { Sheet } from "@/components/ui/Sheet";

type Coords = { lat: number; lng: number };
type CoordsSource = "gps" | "address" | null;
type AddressPrediction = { description: string; placeId: string };
type GooglePrediction = { description?: unknown; place_id?: unknown };
type AutocompleteRequest = {
  input: string;
  componentRestrictions: { country: string };
  locationBias?: unknown;
};
type GoogleLike = {
  maps?: {
    Circle?: new (opts: { center: { lat: number; lng: number }; radius: number }) => { getBounds: () => unknown };
    places?: {
      AutocompleteService?: new () => {
        getPlacePredictions: (
          req: AutocompleteRequest,
          cb: (preds: GooglePrediction[] | null, status: string) => void,
        ) => void;
      };
    };
  };
};

type Tow = { id: string; pos: Coords; target: Coords; speed: number };

async function readJsonMaybe<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

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

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function randomPointAround(center: Coords, radiusDeg: number): Coords {
  const angle = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * radiusDeg;
  return { lat: center.lat + Math.cos(angle) * r, lng: center.lng + Math.sin(angle) * r };
}

export function RequestForm() {
  const router = useRouter();
  const [coords, setCoords] = useState<Coords | null>(null);
  const [coordsSource, setCoordsSource] = useState<CoordsSource>(null);
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
  const [addressPredictions, setAddressPredictions] = useState<AddressPrediction[]>([]);
  const [isAddressAutocompleteOpen, setIsAddressAutocompleteOpen] = useState(false);
  const [isLoadingAddressAutocomplete, setIsLoadingAddressAutocomplete] = useState(false);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const { isLoaded: isGoogleMapsLoaded } = useJsApiLoader({
    id: "reboquesos-google-maps-places-ptbr",
    googleMapsApiKey: apiKey,
    libraries: ["places"],
    language: "pt-BR",
    region: "BR",
  });

  const mapCenter = useMemo<Coords>(() => coords ?? { lat: -22.8097, lng: -43.0619 }, [coords]);
  const mapCenterRef = useRef<Coords>(mapCenter);

  useEffect(() => {
    mapCenterRef.current = mapCenter;
  }, [mapCenter]);

  const [tows, setTows] = useState<Tow[]>([]);

  useEffect(() => {
    if (!apiKey || !isGoogleMapsLoaded) {
      setTows([]);
      return;
    }
    const center = mapCenterRef.current;
    setTows(
      Array.from({ length: 6 }, (_, i) => ({
        id: `tow-${i + 1}`,
        pos: randomPointAround(center, 0.012),
        target: randomPointAround(center, 0.012),
        speed: rand(0.00008, 0.00018),
      })),
    );
  }, [apiKey, isGoogleMapsLoaded, mapCenter.lat, mapCenter.lng]);

  useEffect(() => {
    if (!apiKey || !isGoogleMapsLoaded) return;

    const id = window.setInterval(() => {
      setTows((prev) =>
        prev.map((t) => {
          const dx = t.target.lat - t.pos.lat;
          const dy = t.target.lng - t.pos.lng;
          const dist = Math.hypot(dx, dy);
          if (!Number.isFinite(dist) || dist < 0.00006) {
            return { ...t, target: randomPointAround(mapCenterRef.current, 0.013) };
          }
          const step = t.speed;
          const ratio = dist <= step ? 1 : step / dist;
          return {
            ...t,
            pos: { lat: t.pos.lat + dx * ratio, lng: t.pos.lng + dy * ratio },
          };
        }),
      );
    }, 200);

    return () => window.clearInterval(id);
  }, [apiKey, isGoogleMapsLoaded]);

  const towIcon = useMemo<google.maps.Icon | undefined>(() => {
    if (!isGoogleMapsLoaded) return undefined;
    const g = (window as unknown as { google?: typeof google }).google;
    if (!g?.maps?.Size || !g?.maps?.Point) return undefined;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">` +
      `<rect x="8" y="28" width="28" height="12" rx="3" fill="#FFC300" stroke="#0B0B0D" stroke-width="2"/>` +
      `<rect x="36" y="30" width="14" height="10" rx="3" fill="#FFC300" stroke="#0B0B0D" stroke-width="2"/>` +
      `<rect x="12" y="31" width="9" height="6" rx="2" fill="#FFFFFF" stroke="#0B0B0D" stroke-width="2"/>` +
      `<path d="M10 40h40" fill="none" stroke="#0B0B0D" stroke-width="2" stroke-linecap="round"/>` +
      `<path d="M36 40l-6 8h-8" fill="none" stroke="#0B0B0D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="M30 48l-4 4" fill="none" stroke="#0B0B0D" stroke-width="2" stroke-linecap="round"/>` +
      `<path d="M26 52c2 2 4 2 6 0" fill="none" stroke="#0B0B0D" stroke-width="2" stroke-linecap="round"/>` +
      `<rect x="44" y="22" width="2" height="12" fill="#0B0B0D"/>` +
      `<path d="M45 24l-10 6" fill="none" stroke="#0B0B0D" stroke-width="2" stroke-linecap="round"/>` +
      `<path d="M35 30l-10 18" fill="none" stroke="#0B0B0D" stroke-width="2" stroke-linecap="round"/>` +
      `<path d="M25 48h-5" fill="none" stroke="#0B0B0D" stroke-width="2" stroke-linecap="round"/>` +
      `<path d="M20 48l-2 3" fill="none" stroke="#0B0B0D" stroke-width="2" stroke-linecap="round"/>` +
      `<rect x="6" y="50" width="16" height="6" rx="2" fill="#E5E7EB" stroke="#0B0B0D" stroke-width="2"/>` +
      `<circle cx="10" cy="56" r="4" fill="#0B0B0D"/><circle cx="10" cy="56" r="2" fill="#E5E7EB"/>` +
      `<circle cx="20" cy="56" r="4" fill="#0B0B0D"/><circle cx="20" cy="56" r="2" fill="#E5E7EB"/>` +
      `<circle cx="18" cy="46" r="6" fill="#0B0B0D"/><circle cx="18" cy="46" r="3" fill="#E5E7EB"/>` +
      `<circle cx="42" cy="46" r="6" fill="#0B0B0D"/><circle cx="42" cy="46" r="3" fill="#E5E7EB"/>` +
      `</svg>`;
    const url = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    return {
      url,
      scaledSize: new g.maps.Size(28, 28),
      anchor: new g.maps.Point(14, 14),
    };
  }, [isGoogleMapsLoaded]);

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
        setCoords((prev) => prev ?? { lat: pos.coords.latitude, lng: pos.coords.longitude });
        setCoordsSource((prev) => prev ?? "gps");
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
        const json = await readJsonMaybe<{ count_nearby?: number }>(res);
        const count = json?.count_nearby;
        if (!cancelled) setNearbyCount(Number.isFinite(count) ? Number(count) : 0);
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
        setCoordsSource("gps");
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
    const json = await readJsonMaybe<{
      location?: { lat: number; lng: number };
      formattedAddress?: string | null;
      error?: string;
    }>(res);
    if (!res.ok || !json?.location) {
      throw new Error(json?.error || `Não foi possível localizar o endereço. (HTTP ${res.status})`);
    }
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

      const json = await readJsonMaybe<{ id?: string; error?: string }>(res);
      if (!res.ok) throw new Error(json?.error || `Falha ao solicitar reboque. (HTTP ${res.status})`);
      if (!json?.id) throw new Error("Resposta inválida.");

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

  useEffect(() => {
    const query = endereco.trim();
    if (!apiKey || !isGoogleMapsLoaded) {
      setAddressPredictions([]);
      setIsLoadingAddressAutocomplete(false);
      return;
    }

    if (!isAddressAutocompleteOpen || query.length < 3) {
      setAddressPredictions([]);
      setIsLoadingAddressAutocomplete(false);
      return;
    }

    const google = (window as unknown as { google?: GoogleLike }).google;
    const ServiceCtor = google?.maps?.places?.AutocompleteService;
    const CircleCtor = google?.maps?.Circle;
    if (!ServiceCtor) {
      setAddressPredictions([]);
      setIsLoadingAddressAutocomplete(false);
      return;
    }

    const service = new ServiceCtor();
    setIsLoadingAddressAutocomplete(true);

    const timeoutId = window.setTimeout(() => {
      const req: AutocompleteRequest = {
        input: query,
        componentRestrictions: { country: "br" },
      };
      const lat = coords?.lat;
      const lng = coords?.lng;
      if (CircleCtor && typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng)) {
        req.locationBias = new CircleCtor({
          center: { lat, lng },
          radius: 35000,
        }).getBounds();
      }

      service.getPlacePredictions(req, (preds, status) => {
        if (!isAddressAutocompleteOpen) return;
        if (status !== "OK" || !Array.isArray(preds) || preds.length === 0) {
          setAddressPredictions([]);
          setIsLoadingAddressAutocomplete(false);
          return;
        }

        setAddressPredictions(
          preds
            .map((p) => ({
              description: String(p?.description ?? "").trim(),
              placeId: String(p?.place_id ?? "").trim(),
            }))
            .filter((p) => p.description && p.placeId)
            .slice(0, 6),
        );
        setIsLoadingAddressAutocomplete(false);
      });
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [apiKey, coords?.lat, coords?.lng, endereco, isAddressAutocompleteOpen, isGoogleMapsLoaded]);

  async function selectAddressPrediction(p: AddressPrediction) {
    setEndereco(p.description);
    setIsAddressAutocompleteOpen(false);
    setAddressPredictions([]);

    try {
      const res = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: p.description }),
      });
      const json = await readJsonMaybe<{
        location?: { lat: number; lng: number };
        formattedAddress?: string | null;
        error?: string;
      }>(res);
      if (!res.ok || !json?.location) throw new Error(json?.error || `Não foi possível localizar o endereço. (HTTP ${res.status})`);
      setCoords({ lat: json.location.lat, lng: json.location.lng });
      setCoordsSource("address");
      setEndereco(String(json.formattedAddress ?? p.description));
    } catch (e) {
      setSheetError(e instanceof Error ? e.message : "Não foi possível localizar o endereço.");
    }
  }

  return (
    <>
      <div id="mapa-selecao" className="rounded-2xl border border-brand-border/20 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-bold text-brand-black">Reboques próximos</div>
          {isLoadingNearby ? <div className="text-xs text-brand-text2">Carregando...</div> : null}
        </div>
        <div className="mt-3 h-[220px] overflow-hidden rounded-2xl border border-brand-border/20 bg-zinc-50">
          {apiKey && isGoogleMapsLoaded ? (
            <GoogleMap
              center={mapCenter}
              zoom={14}
              mapContainerStyle={{ width: "100%", height: "100%" }}
              options={{
                disableDefaultUI: true,
                clickableIcons: false,
                gestureHandling: "none",
                keyboardShortcuts: false,
              }}
            >
              {coords ? <MarkerF position={coords} /> : null}
              {tows.map((t) => (
                <MarkerF key={t.id} position={t.pos} icon={towIcon} />
              ))}
            </GoogleMap>
          ) : null}
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
            <div className="relative">
              <input
                className="mt-1 w-full rounded-2xl border border-brand-border/20 bg-white px-3 py-2 text-brand-black placeholder:text-brand-text2 focus:border-brand-yellow/60 focus:outline-none focus:ring-4 focus:ring-brand-yellow/20"
                placeholder="Rua, número, referência"
                value={endereco}
                onChange={(e) => {
                  setEndereco(e.target.value);
                  setSheetError(null);
                  if (coordsSource === "address") {
                    setCoords(null);
                    setCoordsSource(null);
                  }
                }}
                onFocus={() => setIsAddressAutocompleteOpen(true)}
                onBlur={() => {
                  window.setTimeout(() => setIsAddressAutocompleteOpen(false), 150);
                }}
                role="combobox"
                aria-expanded={isAddressAutocompleteOpen}
                aria-controls="endereco-autocomplete-listbox"
                aria-autocomplete="list"
              />

              {apiKey && isGoogleMapsLoaded && isAddressAutocompleteOpen ? (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-2xl border border-brand-border/20 bg-white shadow-sm">
                  {isLoadingAddressAutocomplete ? (
                    <div className="px-3 py-2 text-xs font-semibold text-brand-text2">Buscando endereços…</div>
                  ) : addressPredictions.length ? (
                    <div id="endereco-autocomplete-listbox" role="listbox" className="max-h-56 overflow-auto py-1">
                      {addressPredictions.map((p) => (
                        <button
                          key={p.placeId}
                          type="button"
                          className="block w-full px-3 py-2 text-left text-sm text-brand-black hover:bg-brand-yellow/10"
                          role="option"
                          aria-selected={false}
                          onClick={() => void selectAddressPrediction(p)}
                        >
                          {p.description}
                        </button>
                      ))}
                    </div>
                  ) : endereco.trim().length >= 3 ? (
                    <div className="px-3 py-2 text-xs font-semibold text-brand-text2">Nenhum endereço encontrado.</div>
                  ) : null}
                </div>
              ) : null}
            </div>
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
