"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { GoogleMap, MarkerF, useJsApiLoader } from "@react-google-maps/api";

import { Modal } from "@/components/ui/Modal";
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
type PartnerInfo = {
  id: string;
  empresa_nome: string | null;
  whatsapp_number: string | null;
  caminhao_modelo: string | null;
  caminhao_placa: string | null;
  caminhao_tipo: string | null;
  foto_parceiro_path: string | null;
};
type ProposalWithPartner = {
  id: string;
  partner_id: string;
  valor: number;
  eta_minutes: number;
  accepted: boolean;
  created_at: string;
  partner: PartnerInfo | null;
};
type TripRow = { id: string; status: string };
type RequestRow = {
  id: string;
  local_cliente: string;
  cidade: string;
  status: string;
  accepted_proposal_id: string | null;
  created_at: string;
  telefone_cliente?: string | null;
  modelo_veiculo?: string | null;
  destino_local?: string | null;
};

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
  const [destinoEndereco, setDestinoEndereco] = useState("");
  const [destinoCoords, setDestinoCoords] = useState<Coords | null>(null);
  const [destinoPredictions, setDestinoPredictions] = useState<AddressPrediction[]>([]);
  const [isDestinoAutocompleteOpen, setIsDestinoAutocompleteOpen] = useState(false);
  const [isLoadingDestinoAutocomplete, setIsLoadingDestinoAutocomplete] = useState(false);

  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [activeRequest, setActiveRequest] = useState<RequestRow | null>(null);
  const [activeProposals, setActiveProposals] = useState<ProposalWithPartner[]>([]);
  const [activeTrip, setActiveTrip] = useState<TripRow | null>(null);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isAcceptingProposal, setIsAcceptingProposal] = useState<string | null>(null);

  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [locationModalCoords, setLocationModalCoords] = useState<Coords | null>(null);
  const [locationModalAddress, setLocationModalAddress] = useState<string | null>(null);
  const [isResolvingLocationAddress, setIsResolvingLocationAddress] = useState(false);
  const [locationModalError, setLocationModalError] = useState<string | null>(null);
  const locationMapRef = useRef<google.maps.Map | null>(null);

  const [isEnderecoModalOpen, setIsEnderecoModalOpen] = useState(false);
  const [enderecoModalCoords, setEnderecoModalCoords] = useState<Coords | null>(null);
  const [enderecoModalAddress, setEnderecoModalAddress] = useState<string | null>(null);
  const [isResolvingEnderecoAddress, setIsResolvingEnderecoAddress] = useState(false);
  const [enderecoModalError, setEnderecoModalError] = useState<string | null>(null);
  const enderecoMapRef = useRef<google.maps.Map | null>(null);

  const [isDestinoModalOpen, setIsDestinoModalOpen] = useState(false);
  const [destinoModalCoords, setDestinoModalCoords] = useState<Coords | null>(null);
  const [destinoModalAddress, setDestinoModalAddress] = useState<string | null>(null);
  const [isResolvingDestinoAddress, setIsResolvingDestinoAddress] = useState(false);
  const [destinoModalError, setDestinoModalError] = useState<string | null>(null);
  const destinoMapRef = useRef<google.maps.Map | null>(null);

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

  const locationModalLat = locationModalCoords?.lat ?? null;
  const locationModalLng = locationModalCoords?.lng ?? null;

  useEffect(() => {
    if (!isLocationModalOpen) return;
    if (!Number.isFinite(locationModalLat) || !Number.isFinite(locationModalLng)) return;
    let cancelled = false;
    const id = window.setTimeout(async () => {
      try {
        setIsResolvingLocationAddress(true);
        const res = await fetch("/api/reverse-geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat: locationModalLat, lng: locationModalLng }),
        });
        const json = await readJsonMaybe<{ formattedAddress?: string | null; error?: string }>(res);
        if (cancelled) return;
        if (!res.ok) {
          setLocationModalAddress(null);
          return;
        }
        const formatted = String(json?.formattedAddress ?? "").trim();
        setLocationModalAddress(formatted || null);
      } catch {
        if (!cancelled) setLocationModalAddress(null);
      } finally {
        if (!cancelled) setIsResolvingLocationAddress(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [isLocationModalOpen, locationModalLat, locationModalLng]);

  const enderecoModalLat = enderecoModalCoords?.lat ?? null;
  const enderecoModalLng = enderecoModalCoords?.lng ?? null;

  useEffect(() => {
    if (!isEnderecoModalOpen) return;
    if (!Number.isFinite(enderecoModalLat) || !Number.isFinite(enderecoModalLng)) return;
    let cancelled = false;
    const id = window.setTimeout(async () => {
      try {
        setIsResolvingEnderecoAddress(true);
        const res = await fetch("/api/reverse-geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat: enderecoModalLat, lng: enderecoModalLng }),
        });
        const json = await readJsonMaybe<{ formattedAddress?: string | null; error?: string }>(res);
        if (cancelled) return;
        if (!res.ok) {
          setEnderecoModalAddress(null);
          return;
        }
        const formatted = String(json?.formattedAddress ?? "").trim();
        setEnderecoModalAddress(formatted || null);
      } catch {
        if (!cancelled) setEnderecoModalAddress(null);
      } finally {
        if (!cancelled) setIsResolvingEnderecoAddress(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [enderecoModalLat, enderecoModalLng, isEnderecoModalOpen]);

  const destinoModalLat = destinoModalCoords?.lat ?? null;
  const destinoModalLng = destinoModalCoords?.lng ?? null;

  useEffect(() => {
    if (!isDestinoModalOpen) return;
    if (!Number.isFinite(destinoModalLat) || !Number.isFinite(destinoModalLng)) return;
    let cancelled = false;
    const id = window.setTimeout(async () => {
      try {
        setIsResolvingDestinoAddress(true);
        const res = await fetch("/api/reverse-geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat: destinoModalLat, lng: destinoModalLng }),
        });
        const json = await readJsonMaybe<{ formattedAddress?: string | null; error?: string }>(res);
        if (cancelled) return;
        if (!res.ok) {
          setDestinoModalAddress(null);
          return;
        }
        const formatted = String(json?.formattedAddress ?? "").trim();
        setDestinoModalAddress(formatted || null);
      } catch {
        if (!cancelled) setDestinoModalAddress(null);
      } finally {
        if (!cancelled) setIsResolvingDestinoAddress(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [destinoModalLat, destinoModalLng, isDestinoModalOpen]);

  async function handleGetLocation() {
    if (!navigator.geolocation) {
      setSheetError("Seu navegador não suporta GPS.");
      return;
    }
    setSheetError(null);
    setLocationModalError(null);
    setLocationModalAddress(null);
    setLocationModalCoords(null);
    setIsLocationModalOpen(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude);
        const lng = Number(pos.coords.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          setLocationModalError("Não foi possível obter sua localização.");
          return;
        }
        setLocationModalCoords({ lat, lng });
      },
      () => setLocationModalError("Não foi possível obter sua localização."),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  async function handlePickEnderecoOnMap() {
    setSheetError(null);
    setIsAddressAutocompleteOpen(false);
    setEnderecoModalError(null);
    setEnderecoModalAddress(null);
    setEnderecoModalCoords(coordsSource === "address" ? coords : coords ?? null);
    setIsEnderecoModalOpen(true);

    if (coordsSource === "address" && coords) return;

    const typed = endereco.trim();
    if (typed.length >= 3) {
      try {
        const res = await fetch("/api/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: typed }),
        });
        const json = await readJsonMaybe<{ location?: { lat: number; lng: number }; formattedAddress?: string | null; error?: string }>(res);
        if (res.ok && json?.location && Number.isFinite(json.location.lat) && Number.isFinite(json.location.lng)) {
          setEnderecoModalCoords({ lat: Number(json.location.lat), lng: Number(json.location.lng) });
          const formatted = String(json.formattedAddress ?? "").trim();
          if (formatted) setEnderecoModalAddress(formatted);
          return;
        }
      } catch {
        return;
      }
    }

    if (coords) {
      setEnderecoModalCoords(coords);
      return;
    }

    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude);
        const lng = Number(pos.coords.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        setEnderecoModalCoords({ lat, lng });
      },
      () => null,
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  async function handlePickDestinoOnMap() {
    setSheetError(null);
    setIsDestinoAutocompleteOpen(false);
    setDestinoModalError(null);
    setDestinoModalAddress(null);
    setDestinoModalCoords(destinoCoords ?? null);
    setIsDestinoModalOpen(true);

    if (destinoCoords) return;

    const typed = destinoEndereco.trim();
    if (typed.length >= 3) {
      try {
        const res = await fetch("/api/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: typed }),
        });
        const json = await readJsonMaybe<{ location?: { lat: number; lng: number }; formattedAddress?: string | null; error?: string }>(res);
        if (res.ok && json?.location && Number.isFinite(json.location.lat) && Number.isFinite(json.location.lng)) {
          setDestinoModalCoords({ lat: Number(json.location.lat), lng: Number(json.location.lng) });
          const formatted = String(json.formattedAddress ?? "").trim();
          if (formatted) setDestinoModalAddress(formatted);
          return;
        }
      } catch {
        return;
      }
    }

    if (coords) {
      setDestinoModalCoords(coords);
      return;
    }

    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude);
        const lng = Number(pos.coords.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        setDestinoModalCoords({ lat, lng });
      },
      () => null,
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  useEffect(() => {
    if (!isLocationModalOpen) return;
    if (!locationModalCoords) return;
    const map = locationMapRef.current;
    if (!map) return;
    map.panTo(locationModalCoords);
  }, [isLocationModalOpen, locationModalCoords]);

  useEffect(() => {
    if (!isEnderecoModalOpen) return;
    if (!enderecoModalCoords) return;
    const map = enderecoMapRef.current;
    if (!map) return;
    map.panTo(enderecoModalCoords);
  }, [enderecoModalCoords, isEnderecoModalOpen]);

  useEffect(() => {
    if (!isDestinoModalOpen) return;
    if (!destinoModalCoords) return;
    const map = destinoMapRef.current;
    if (!map) return;
    map.panTo(destinoModalCoords);
  }, [destinoModalCoords, isDestinoModalOpen]);

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
      const destino = destinoEndereco.trim();
      if (!displayName || !tel || !model || !destino) {
        setSheetError("Informe nome, telefone, modelo do veículo e destino.");
        return;
      }

      const resolved = await ensureCoords();
      if (!resolved) {
        setSheetError("Informe um endereço ou use a localização do dispositivo.");
        return;
      }

      let destinoFinal = destinoCoords;
      let destinoAddress = destino;
      if (!destinoFinal) {
        const res = await fetch("/api/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: destino }),
        });
        const json = await readJsonMaybe<{
          location?: { lat: number; lng: number };
          formattedAddress?: string | null;
          error?: string;
        }>(res);
        if (!res.ok || !json?.location) {
          setSheetError(json?.error || `Não foi possível localizar o destino. (HTTP ${res.status})`);
          return;
        }
        destinoFinal = { lat: json.location.lat, lng: json.location.lng };
        destinoAddress = String(json.formattedAddress ?? destino);
        setDestinoCoords(destinoFinal);
        setDestinoEndereco(destinoAddress);
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
          destino_local: destinoAddress || undefined,
          destino_lat: destinoFinal.lat,
          destino_lng: destinoFinal.lng,
          telefone: tel,
          modelo_veiculo: model,
        }),
      });

      const json = await readJsonMaybe<{ id?: string; error?: string }>(res);
      if (!res.ok) throw new Error(json?.error || `Falha ao solicitar reboque. (HTTP ${res.status})`);
      if (!json?.id) throw new Error("Resposta inválida.");

      setActiveRequestId(String(json.id));
      setSearchError(null);
      setIsSearchModalOpen(true);
    } catch (e) {
      setOpenSheet(true);
      setSheetError(e instanceof Error ? e.message : "Falha ao solicitar reboque.");
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    const requestId = activeRequestId;
    if (!requestId) return;
    if (!isSearchModalOpen) return;
    let alive = true;

    async function refresh() {
      try {
        const res = await fetch(`/api/public/requests/${requestId}`, { method: "GET", cache: "no-store" });
        const json = (await res.json()) as { request?: RequestRow; proposals?: ProposalWithPartner[]; trip?: TripRow | null; error?: string };
        if (!alive) return;
        if (!res.ok) return;
        if (json.request) setActiveRequest(json.request);
        setActiveProposals(Array.isArray(json.proposals) ? json.proposals : []);
        setActiveTrip(json.trip ?? null);
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
  }, [activeRequestId, isSearchModalOpen]);

  async function acceptProposalFromModal(proposalId: string) {
    if (isAcceptingProposal) return;
    setIsAcceptingProposal(proposalId);
    setSearchError(null);
    try {
      const res = await fetch(`/api/proposals/${encodeURIComponent(proposalId)}/accept`, { method: "POST" });
      const json = (await res.json()) as { tripId?: string | null; error?: string };
      if (!res.ok) throw new Error(json?.error || "Falha ao aceitar proposta.");
      await fetch(`/api/public/requests/${encodeURIComponent(activeRequestId ?? "")}`, { method: "GET", cache: "no-store" }).catch(() => null);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "Falha ao aceitar proposta.");
    } finally {
      setIsAcceptingProposal(null);
    }
  }

  const label =
    geoStatus === "loading" ? "…" : geoStatus === "error" ? "—" : coords ? String(nearbyCount ?? 0) : "—";

  const acceptedProposal = useMemo(() => activeProposals.find((p) => p.accepted) ?? null, [activeProposals]);
  const acceptedPartner = acceptedProposal?.partner ?? null;

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

  useEffect(() => {
    const query = destinoEndereco.trim();
    if (!apiKey || !isGoogleMapsLoaded) {
      setDestinoPredictions([]);
      setIsLoadingDestinoAutocomplete(false);
      return;
    }

    if (!isDestinoAutocompleteOpen || query.length < 3) {
      setDestinoPredictions([]);
      setIsLoadingDestinoAutocomplete(false);
      return;
    }

    const google = (window as unknown as { google?: GoogleLike }).google;
    const ServiceCtor = google?.maps?.places?.AutocompleteService;
    if (!ServiceCtor) {
      setDestinoPredictions([]);
      setIsLoadingDestinoAutocomplete(false);
      return;
    }

    const service = new ServiceCtor();
    setIsLoadingDestinoAutocomplete(true);

    const timeoutId = window.setTimeout(() => {
      const req: AutocompleteRequest = {
        input: query,
        componentRestrictions: { country: "br" },
      };

      service.getPlacePredictions(req, (preds, status) => {
        if (!isDestinoAutocompleteOpen) return;
        if (status !== "OK" || !Array.isArray(preds) || preds.length === 0) {
          setDestinoPredictions([]);
          setIsLoadingDestinoAutocomplete(false);
          return;
        }

        setDestinoPredictions(
          preds
            .map((p) => ({
              description: String(p?.description ?? "").trim(),
              placeId: String(p?.place_id ?? "").trim(),
            }))
            .filter((p) => p.description && p.placeId)
            .slice(0, 6),
        );
        setIsLoadingDestinoAutocomplete(false);
      });
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [apiKey, destinoEndereco, isDestinoAutocompleteOpen, isGoogleMapsLoaded]);

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

  async function selectDestinoPrediction(p: AddressPrediction) {
    setDestinoEndereco(p.description);
    setIsDestinoAutocompleteOpen(false);
    setDestinoPredictions([]);

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
      setDestinoCoords({ lat: json.location.lat, lng: json.location.lng });
      setDestinoEndereco(String(json.formattedAddress ?? p.description));
    } catch (e) {
      setSheetError(e instanceof Error ? e.message : "Não foi possível localizar o endereço de destino.");
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

      <Modal
        open={isSearchModalOpen}
        title={acceptedPartner ? "Reboque confirmado" : "Buscando reboques parceiros"}
        onClose={() => setIsSearchModalOpen(false)}
        footer={
          acceptedPartner && activeRequestId ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              {activeTrip?.id ? (
                <a className="btn-secondary w-full sm:w-auto" href={`/trips/${activeTrip.id}`}>
                  Acompanhar corrida
                </a>
              ) : null}
              <a className="btn-primary w-full sm:w-auto" href={`/payments/${activeRequestId}`}>
                Ir para pagamento
              </a>
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              {activeRequestId ? (
                <a className="btn-secondary w-full sm:w-auto" href={`/requests/${activeRequestId}`}>
                  Abrir detalhes
                </a>
              ) : null}
              <button className="btn-primary w-full sm:w-auto" type="button" onClick={() => setIsSearchModalOpen(false)}>
                Fechar
              </button>
            </div>
          )
        }
      >
        <div className="space-y-3">
          {searchError ? (
            <div className="rounded-2xl border border-brand-red/30 bg-brand-red/10 p-3 text-sm font-semibold text-brand-red">
              {searchError}
            </div>
          ) : null}

          {activeRequest ? (
            <div className="rounded-2xl border border-brand-border/20 bg-brand-yellow/10 p-3 text-sm text-brand-black/80">
              <div className="font-semibold text-brand-black">Pedido {activeRequest.id.slice(0, 8)}</div>
              <div className="mt-1 text-xs text-brand-black/70">
                {activeRequest.cidade} • {activeRequest.local_cliente}
              </div>
              {activeRequest.destino_local ? (
                <div className="mt-1 text-xs text-brand-black/70">Destino: {activeRequest.destino_local}</div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border border-brand-border/20 bg-brand-yellow/10 p-3 text-sm font-semibold text-brand-black/90">
              Preparando seu pedido...
            </div>
          )}

          {acceptedPartner ? (
            <div className="rounded-2xl border border-brand-border/20 bg-white p-4">
              <div className="text-sm font-bold text-brand-black">Reboque que aceitou</div>
              <div className="mt-2 text-sm text-brand-black/80">
                <div className="font-semibold text-brand-black">{acceptedPartner.empresa_nome ?? "Reboque parceiro"}</div>
                <div className="mt-1 text-xs text-brand-black/70">
                  {acceptedPartner.caminhao_tipo ? `${acceptedPartner.caminhao_tipo} • ` : ""}
                  {acceptedPartner.caminhao_modelo ?? "—"}
                  {acceptedPartner.caminhao_placa ? ` • Placa ${acceptedPartner.caminhao_placa}` : ""}
                </div>
                {acceptedPartner.whatsapp_number ? (
                  <div className="mt-1 text-xs text-brand-black/70">WhatsApp: {acceptedPartner.whatsapp_number}</div>
                ) : null}
              </div>
            </div>
          ) : activeProposals.length ? (
            <div className="space-y-2">
              <div className="text-sm font-bold text-brand-black">Propostas recebidas</div>
              <div className="space-y-2">
                {activeProposals.map((p) => (
                  <div key={p.id} className="rounded-2xl border border-brand-border/20 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-brand-black">{p.partner?.empresa_nome ?? "Reboque parceiro"}</div>
                        <div className="mt-1 text-xs text-brand-black/70">
                          ETA {Number(p.eta_minutes).toFixed(0)} min • R$ {Number(p.valor).toFixed(2)}
                        </div>
                        {p.partner?.caminhao_modelo ? (
                          <div className="mt-1 text-xs text-brand-black/70">{p.partner.caminhao_modelo}</div>
                        ) : null}
                      </div>
                      <button
                        className="btn-primary shrink-0 disabled:opacity-50"
                        type="button"
                        disabled={Boolean(isAcceptingProposal)}
                        onClick={() => void acceptProposalFromModal(p.id)}
                      >
                        {isAcceptingProposal === p.id ? "Aceitando..." : "Aceitar"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-brand-border/20 bg-white p-4">
              <div className="text-sm font-bold text-brand-black">Buscando reboques parceiros...</div>
              <div className="mt-1 text-xs text-brand-black/70">Aguarde enquanto enviamos seu pedido para a região.</div>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={isLocationModalOpen}
        title="Selecionar local"
        onClose={() => {
          setIsLocationModalOpen(false);
        }}
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              className="btn-secondary w-full sm:w-auto"
              type="button"
              onClick={() => setIsLocationModalOpen(false)}
            >
              Cancelar
            </button>
            <button
              className="btn-primary w-full disabled:opacity-50 sm:w-auto"
              type="button"
              disabled={!locationModalCoords}
              onClick={() => {
                if (!locationModalCoords) return;
                setCoords(locationModalCoords);
                setCoordsSource("gps");
                if (locationModalAddress) setEndereco(locationModalAddress);
                setIsLocationModalOpen(false);
              }}
            >
              Confirmar local
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="rounded-2xl border border-brand-border/20 bg-brand-yellow/10 p-3 text-sm font-semibold text-brand-black/90">
            {locationModalError ? (
              <span className="text-brand-red">{locationModalError}</span>
            ) : locationModalAddress ? (
              <span className="text-brand-black">{locationModalAddress}</span>
            ) : locationModalCoords ? (
              <span className="text-brand-black">
                {locationModalCoords.lat.toFixed(5)}, {locationModalCoords.lng.toFixed(5)}
              </span>
            ) : (
              <span className="text-brand-black">Obtendo sua localização pelo GPS...</span>
            )}
            {!locationModalError && isResolvingLocationAddress ? (
              <span className="ml-2 text-xs text-brand-text2">Atualizando...</span>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-2xl border border-brand-border/20 bg-zinc-50">
            <div className="relative h-[360px] w-full">
              {apiKey && isGoogleMapsLoaded && locationModalCoords ? (
                <GoogleMap
                  center={locationModalCoords}
                  zoom={17}
                  mapContainerStyle={{ width: "100%", height: "100%" }}
                  onLoad={(map) => {
                    locationMapRef.current = map;
                    map.panTo(locationModalCoords);
                  }}
                  onUnmount={() => {
                    locationMapRef.current = null;
                  }}
                  onIdle={() => {
                    const map = locationMapRef.current;
                    const center = map?.getCenter();
                    const lat = center?.lat();
                    const lng = center?.lng();
                    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
                    const next = { lat: Number(lat), lng: Number(lng) };
                    setLocationModalError(null);
                    setLocationModalCoords((prev) => {
                      if (!prev) return next;
                      const same = Math.abs(prev.lat - next.lat) < 0.0000005 && Math.abs(prev.lng - next.lng) < 0.0000005;
                      return same ? prev : next;
                    });
                  }}
                  options={{
                    disableDefaultUI: true,
                    zoomControl: true,
                    clickableIcons: false,
                    gestureHandling: "greedy",
                    fullscreenControl: false,
                    mapTypeControl: false,
                    streetViewControl: false,
                  }}
                >
                </GoogleMap>
              ) : (
                <div className="grid h-full place-items-center p-6">
                  <div className="text-sm text-brand-text2">
                    {!apiKey ? "Google Maps não configurado." : !locationModalCoords ? "Carregando mapa..." : "Carregando mapa..."}
                  </div>
                </div>
              )}
              {apiKey && isGoogleMapsLoaded && locationModalCoords ? (
                <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
                  <div className="drop-shadow-md">
                    <svg width="34" height="34" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M32 4C21.5 4 13 12.5 13 23c0 15 19 37 19 37s19-22 19-37C51 12.5 42.5 4 32 4z"
                        fill="#E10600"
                      />
                      <circle cx="32" cy="23" r="7.5" fill="white" opacity="0.95" />
                    </svg>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="text-xs text-brand-text2">Mova o mapa para ajustar o local exato.</div>
        </div>
      </Modal>

      <Modal
        open={isEnderecoModalOpen}
        title="Selecionar endereço"
        onClose={() => {
          setIsEnderecoModalOpen(false);
        }}
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button className="btn-secondary w-full sm:w-auto" type="button" onClick={() => setIsEnderecoModalOpen(false)}>
              Cancelar
            </button>
            <button
              className="btn-primary w-full disabled:opacity-50 sm:w-auto"
              type="button"
              disabled={!enderecoModalCoords}
              onClick={() => {
                if (!enderecoModalCoords) return;
                setCoords(enderecoModalCoords);
                setCoordsSource("address");
                if (enderecoModalAddress) setEndereco(enderecoModalAddress);
                setIsEnderecoModalOpen(false);
              }}
            >
              Confirmar endereço
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="rounded-2xl border border-brand-border/20 bg-brand-yellow/10 p-3 text-sm font-semibold text-brand-black/90">
            {enderecoModalError ? (
              <span className="text-brand-red">{enderecoModalError}</span>
            ) : enderecoModalAddress ? (
              <span className="text-brand-black">{enderecoModalAddress}</span>
            ) : enderecoModalCoords ? (
              <span className="text-brand-black">
                {enderecoModalCoords.lat.toFixed(5)}, {enderecoModalCoords.lng.toFixed(5)}
              </span>
            ) : (
              <span className="text-brand-black">Carregando mapa...</span>
            )}
            {!enderecoModalError && isResolvingEnderecoAddress ? (
              <span className="ml-2 text-xs text-brand-text2">Atualizando...</span>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-2xl border border-brand-border/20 bg-zinc-50">
            <div className="relative h-[360px] w-full">
              {apiKey && isGoogleMapsLoaded && enderecoModalCoords ? (
                <GoogleMap
                  center={enderecoModalCoords}
                  zoom={16}
                  mapContainerStyle={{ width: "100%", height: "100%" }}
                  onLoad={(map) => {
                    enderecoMapRef.current = map;
                    map.panTo(enderecoModalCoords);
                  }}
                  onUnmount={() => {
                    enderecoMapRef.current = null;
                  }}
                  onIdle={() => {
                    const map = enderecoMapRef.current;
                    const center = map?.getCenter();
                    const lat = center?.lat();
                    const lng = center?.lng();
                    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
                    const next = { lat: Number(lat), lng: Number(lng) };
                    setEnderecoModalError(null);
                    setEnderecoModalCoords((prev) => {
                      if (!prev) return next;
                      const same = Math.abs(prev.lat - next.lat) < 0.0000005 && Math.abs(prev.lng - next.lng) < 0.0000005;
                      return same ? prev : next;
                    });
                  }}
                  options={{
                    disableDefaultUI: true,
                    zoomControl: true,
                    clickableIcons: false,
                    gestureHandling: "greedy",
                    fullscreenControl: false,
                    mapTypeControl: false,
                    streetViewControl: false,
                  }}
                />
              ) : (
                <div className="grid h-full place-items-center p-6">
                  <div className="text-sm text-brand-text2">{!apiKey ? "Google Maps não configurado." : "Carregando mapa..."}</div>
                </div>
              )}
              {apiKey && isGoogleMapsLoaded && enderecoModalCoords ? (
                <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
                  <div className="drop-shadow-md">
                    <svg width="34" height="34" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M32 4C21.5 4 13 12.5 13 23c0 15 19 37 19 37s19-22 19-37C51 12.5 42.5 4 32 4z"
                        fill="#E10600"
                      />
                      <circle cx="32" cy="23" r="7.5" fill="white" opacity="0.95" />
                    </svg>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="text-xs text-brand-text2">Mova o mapa para ajustar o endereço.</div>
        </div>
      </Modal>

      <Modal
        open={isDestinoModalOpen}
        title="Selecionar destino"
        onClose={() => {
          setIsDestinoModalOpen(false);
        }}
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button className="btn-secondary w-full sm:w-auto" type="button" onClick={() => setIsDestinoModalOpen(false)}>
              Cancelar
            </button>
            <button
              className="btn-primary w-full disabled:opacity-50 sm:w-auto"
              type="button"
              disabled={!destinoModalCoords}
              onClick={() => {
                if (!destinoModalCoords) return;
                setDestinoCoords(destinoModalCoords);
                if (destinoModalAddress) setDestinoEndereco(destinoModalAddress);
                setIsDestinoModalOpen(false);
              }}
            >
              Confirmar destino
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="rounded-2xl border border-brand-border/20 bg-brand-yellow/10 p-3 text-sm font-semibold text-brand-black/90">
            {destinoModalError ? (
              <span className="text-brand-red">{destinoModalError}</span>
            ) : destinoModalAddress ? (
              <span className="text-brand-black">{destinoModalAddress}</span>
            ) : destinoModalCoords ? (
              <span className="text-brand-black">
                {destinoModalCoords.lat.toFixed(5)}, {destinoModalCoords.lng.toFixed(5)}
              </span>
            ) : (
              <span className="text-brand-black">Carregando mapa...</span>
            )}
            {!destinoModalError && isResolvingDestinoAddress ? (
              <span className="ml-2 text-xs text-brand-text2">Atualizando...</span>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-2xl border border-brand-border/20 bg-zinc-50">
            <div className="relative h-[360px] w-full">
              {apiKey && isGoogleMapsLoaded && destinoModalCoords ? (
                <GoogleMap
                  center={destinoModalCoords}
                  zoom={16}
                  mapContainerStyle={{ width: "100%", height: "100%" }}
                  onLoad={(map) => {
                    destinoMapRef.current = map;
                    map.panTo(destinoModalCoords);
                  }}
                  onUnmount={() => {
                    destinoMapRef.current = null;
                  }}
                  onIdle={() => {
                    const map = destinoMapRef.current;
                    const center = map?.getCenter();
                    const lat = center?.lat();
                    const lng = center?.lng();
                    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
                    const next = { lat: Number(lat), lng: Number(lng) };
                    setDestinoModalError(null);
                    setDestinoModalCoords((prev) => {
                      if (!prev) return next;
                      const same = Math.abs(prev.lat - next.lat) < 0.0000005 && Math.abs(prev.lng - next.lng) < 0.0000005;
                      return same ? prev : next;
                    });
                  }}
                  options={{
                    disableDefaultUI: true,
                    zoomControl: true,
                    clickableIcons: false,
                    gestureHandling: "greedy",
                    fullscreenControl: false,
                    mapTypeControl: false,
                    streetViewControl: false,
                  }}
                />
              ) : (
                <div className="grid h-full place-items-center p-6">
                  <div className="text-sm text-brand-text2">{!apiKey ? "Google Maps não configurado." : "Carregando mapa..."}</div>
                </div>
              )}
              {apiKey && isGoogleMapsLoaded && destinoModalCoords ? (
                <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
                  <div className="drop-shadow-md">
                    <svg width="34" height="34" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M32 4C21.5 4 13 12.5 13 23c0 15 19 37 19 37s19-22 19-37C51 12.5 42.5 4 32 4z"
                        fill="#E10600"
                      />
                      <circle cx="32" cy="23" r="7.5" fill="white" opacity="0.95" />
                    </svg>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="text-xs text-brand-text2">Mova o mapa para ajustar o destino.</div>
        </div>
      </Modal>

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
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-bold text-brand-black">Endereço</div>
              <button
                type="button"
                className="text-xs font-semibold text-brand-black underline"
                onClick={() => void handlePickEnderecoOnMap()}
              >
                Usar mapa
              </button>
            </div>
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

          <div>
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-bold text-brand-black">Destino do veículo</div>
              <button
                type="button"
                className="text-xs font-semibold text-brand-black underline"
                onClick={() => void handlePickDestinoOnMap()}
              >
                Usar mapa
              </button>
            </div>
            <div className="relative">
              <input
                className="mt-1 w-full rounded-2xl border border-brand-border/20 bg-white px-3 py-2 text-brand-black placeholder:text-brand-text2 focus:border-brand-yellow/60 focus:outline-none focus:ring-4 focus:ring-brand-yellow/20"
                placeholder="Para onde levar o carro?"
                value={destinoEndereco}
                onChange={(e) => {
                  setDestinoEndereco(e.target.value);
                  setDestinoCoords(null);
                  setSheetError(null);
                }}
                onFocus={() => setIsDestinoAutocompleteOpen(true)}
                onBlur={() => {
                  window.setTimeout(() => setIsDestinoAutocompleteOpen(false), 150);
                }}
                role="combobox"
                aria-expanded={isDestinoAutocompleteOpen}
                aria-controls="destino-autocomplete-listbox"
                aria-autocomplete="list"
              />

              {apiKey && isGoogleMapsLoaded && isDestinoAutocompleteOpen ? (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-2xl border border-brand-border/20 bg-white shadow-sm">
                  {isLoadingDestinoAutocomplete ? (
                    <div className="px-3 py-2 text-xs font-semibold text-brand-text2">Buscando destinos…</div>
                  ) : destinoPredictions.length ? (
                    <div id="destino-autocomplete-listbox" role="listbox" className="max-h-56 overflow-auto py-1">
                      {destinoPredictions.map((p) => (
                        <button
                          key={p.placeId}
                          type="button"
                          className="block w-full px-3 py-2 text-left text-sm text-brand-black hover:bg-brand-yellow/10"
                          role="option"
                          aria-selected={false}
                          onClick={() => void selectDestinoPrediction(p)}
                        >
                          {p.description}
                        </button>
                      ))}
                    </div>
                  ) : destinoEndereco.trim().length >= 3 ? (
                    <div className="px-3 py-2 text-xs font-semibold text-brand-text2">Nenhum destino encontrado.</div>
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
