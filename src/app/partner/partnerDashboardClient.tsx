"use client";

import { DirectionsRenderer, GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import { useEffect, useMemo, useRef, useState } from "react";

import { haversineKm } from "@/lib/geo";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type PartnerRow = {
  empresa_nome: string | null;
  cidade: string | null;
  whatsapp_number: string | null;
  ativo: boolean | null;
  stripe_account_id?: string | null;
};

type ProfileRow = {
  nome: string;
};

type RequestRow = {
  id: string;
  local_cliente: string;
  cidade: string;
  status: string;
  created_at: string;
  lat: number | null;
  lng: number | null;
  cliente_nome: string | null;
  telefone_cliente: string | null;
  modelo_veiculo: string | null;
};

type TripRow = {
  id: string;
  request_id: string;
  status: string;
  created_at: string;
};

type Coords = { lat: number; lng: number };

function StatusPill(props: { label: string; tone?: "yellow" | "red" | "green" | "gray" }) {
  const tone = props.tone ?? "gray";
  const cls =
    tone === "green"
      ? "border-brand-success/30 bg-brand-success/10 text-brand-success"
      : tone === "yellow"
        ? "border-brand-yellow/35 bg-brand-yellow/15 text-brand-black"
        : tone === "red"
          ? "border-brand-red/35 bg-brand-red/10 text-brand-red"
          : "border-brand-border/30 bg-white text-brand-black/70";

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${cls}`}>
      {props.label}
    </span>
  );
}

function formatDateTime(value: string) {
  try {
    return new Date(value).toLocaleString("pt-BR");
  } catch {
    return value;
  }
}

function formatBrl(cents: number) {
  const value = Number.isFinite(cents) ? cents / 100 : 0;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

async function readJsonResponse<T>(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function playAlertTone() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.connect(ctx.destination);

    const beeps = [
      { t: 0.0, d: 0.12, f: 880 },
      { t: 0.18, d: 0.12, f: 880 },
      { t: 0.36, d: 0.18, f: 988 },
    ];

    for (const b of beeps) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(b.f, now + b.t);
      osc.connect(gain);
      gain.gain.setValueAtTime(0.0001, now + b.t);
      gain.gain.linearRampToValueAtTime(0.12, now + b.t + 0.01);
      gain.gain.linearRampToValueAtTime(0.0001, now + b.t + b.d);
      osc.start(now + b.t);
      osc.stop(now + b.t + b.d + 0.02);
    }

    window.setTimeout(() => void ctx.close().catch(() => null), 1200);
  } catch {
    return;
  }
}

function RequestAlertModal(props: {
  open: boolean;
  request: RequestRow | null;
  myCoords: Coords | null;
  onClose: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}) {
  const req = props.request;
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const { isLoaded } = useJsApiLoader({
    id: "reboquesos-partner-alert-map",
    googleMapsApiKey: apiKey,
    language: "pt-BR",
    region: "BR",
  });

  const pickupCoords = useMemo<Coords | null>(() => {
    if (!req || typeof req.lat !== "number" || typeof req.lng !== "number") return null;
    if (!Number.isFinite(req.lat) || !Number.isFinite(req.lng)) return null;
    return { lat: req.lat, lng: req.lng };
  }, [req]);

  const [route, setRoute] = useState<google.maps.DirectionsResult | null>(null);
  const [routeKm, setRouteKm] = useState<number | null>(null);

  useEffect(() => {
    if (!props.open) return;
    if (!isLoaded) return;
    if (!props.myCoords || !pickupCoords) return;
    const service = new google.maps.DirectionsService();
    service.route(
      {
        origin: props.myCoords,
        destination: pickupCoords,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status !== "OK" || !result) return;
        setRoute(result);
        const meters =
          result.routes?.[0]?.legs?.reduce((acc, leg) => acc + (leg.distance?.value ?? 0), 0) ?? 0;
        if (meters > 0) setRouteKm(meters / 1000);
      },
    );
  }, [isLoaded, pickupCoords, props.myCoords, props.open]);

  const directKm = useMemo(() => {
    if (!props.myCoords || !pickupCoords) return null;
    return haversineKm(props.myCoords, pickupCoords);
  }, [pickupCoords, props.myCoords]);

  if (!props.open || !req) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        onClick={props.onClose}
        aria-label="Fechar"
      />
      <div className="relative w-full max-w-3xl rounded-3xl border border-brand-border/20 bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-brand-black/60">Nova solicitação</div>
            <div className="mt-1 truncate text-lg font-extrabold text-brand-black">{req.local_cliente}</div>
            <div className="mt-1 text-xs text-brand-text2">
              {req.cidade} • {formatDateTime(req.created_at)}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusPill label={req.status} tone="yellow" />
              {typeof routeKm === "number" ? (
                <StatusPill label={`${routeKm.toFixed(1)} km (rota)`} tone="green" />
              ) : typeof directKm === "number" ? (
                <StatusPill label={`${directKm.toFixed(1)} km (direto)`} />
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:items-end">
            <button
              type="button"
              className="rounded-2xl border border-brand-border/20 bg-white px-4 py-2 text-sm font-semibold text-brand-black hover:bg-brand-yellow/10"
              onClick={props.onToggleSound}
            >
              {props.soundEnabled ? "Som: ligado" : "Som: desligado"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={props.onClose}
            >
              Fechar
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-brand-border/20 bg-white p-4">
            <div className="text-sm font-extrabold text-brand-black">Detalhes</div>
            <div className="mt-3 space-y-2 text-sm text-brand-black/80">
              <div>
                <span className="font-semibold text-brand-black">Veículo:</span>{" "}
                {req.modelo_veiculo ?? "—"}
              </div>
              <div>
                <span className="font-semibold text-brand-black">Cliente:</span>{" "}
                {req.cliente_nome ?? "—"}
              </div>
              <div>
                <span className="font-semibold text-brand-black">Telefone:</span>{" "}
                {req.telefone_cliente ?? "—"}
              </div>
              <div>
                <span className="font-semibold text-brand-black">Sua localização:</span>{" "}
                {props.myCoords ? `${props.myCoords.lat.toFixed(5)}, ${props.myCoords.lng.toFixed(5)}` : "GPS não disponível"}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <a className="btn-primary" href={`/partner/requests/${req.id}`}>
                Abrir solicitação
              </a>
              <a
                className="rounded-2xl border border-brand-border/20 bg-white px-4 py-3 text-sm font-semibold text-brand-black hover:bg-brand-yellow/10"
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${req.lat ?? ""},${req.lng ?? ""}`)}`}
                target="_blank"
                rel="noreferrer"
              >
                Abrir no Google Maps
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-brand-border/20 bg-white p-4">
            <div className="text-sm font-extrabold text-brand-black">Mapa e rota</div>
            <div className="mt-3">
              {!apiKey ? (
                <div className="rounded-2xl border border-brand-border/20 bg-brand-yellow/10 p-3 text-sm text-brand-black/80">
                  Google Maps não configurado.
                </div>
              ) : !pickupCoords ? (
                <div className="rounded-2xl border border-brand-border/20 bg-brand-yellow/10 p-3 text-sm text-brand-black/80">
                  Coordenadas do pedido não disponíveis.
                </div>
              ) : !props.myCoords ? (
                <div className="rounded-2xl border border-brand-border/20 bg-brand-yellow/10 p-3 text-sm text-brand-black/80">
                  Ative o GPS do navegador para ver a rota.
                </div>
              ) : !isLoaded ? (
                <div className="rounded-2xl border border-brand-border/20 bg-brand-yellow/10 p-3 text-sm text-brand-black/80">
                  Carregando mapa...
                </div>
              ) : (
                <GoogleMap
                  mapContainerClassName="h-64 w-full overflow-hidden rounded-2xl"
                  center={props.myCoords}
                  zoom={12}
                  options={{ disableDefaultUI: true, zoomControl: true }}
                >
                  {route ? <DirectionsRenderer directions={route} options={{ suppressMarkers: false }} /> : null}
                </GoogleMap>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PartnerDashboardClient(props: {
  profile: ProfileRow;
  partner: PartnerRow | null;
  cidade: string;
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  requests: RequestRow[];
  trips: TripRow[];
}) {
  const displayName = props.partner?.empresa_nome ?? props.profile.nome;
  const [ativo, setAtivo] = useState(Boolean(props.partner?.ativo));
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [stripeConnected, setStripeConnected] = useState<boolean | null>(null);
  const [availableCents, setAvailableCents] = useState(0);
  const [pendingCents, setPendingCents] = useState(0);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isCreatingLink, setIsCreatingLink] = useState(false);
  const [isPayouting, setIsPayouting] = useState(false);
  const [payoutMessage, setPayoutMessage] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const [requests, setRequests] = useState<RequestRow[]>(props.requests);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertRequest, setAlertRequest] = useState<RequestRow | null>(null);
  const [myCoords, setMyCoords] = useState<Coords | null>(null);
  const seenRequestIdsRef = useRef(new Set<string>());
  const pollingInFlightRef = useRef(false);

  const requestCount = requests.length;
  const tripCount = props.trips.length;

  const statusTone = useMemo(() => {
    if (!ativo) return "red" as const;
    return "green" as const;
  }, [ativo]);

  useEffect(() => {
    setRequests(props.requests);
  }, [props.requests]);

  useEffect(() => {
    for (const r of props.requests) {
      seenRequestIdsRef.current.add(r.id);
    }
  }, [props.requests]);

  useEffect(() => {
    if (!ativo) return;
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude);
        const lng = Number(pos.coords.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) setMyCoords({ lat, lng });
      },
      () => null,
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [ativo]);

  useEffect(() => {
    if (!ativo) return;
    if (!props.supabaseUrl || !props.supabaseAnonKey) return;
    let cancelled = false;
    let supabase: ReturnType<typeof createSupabaseBrowserClient> | null = null;
    try {
      supabase = createSupabaseBrowserClient({ url: props.supabaseUrl, anonKey: props.supabaseAnonKey });
    } catch {
      return;
    }

    const channel = supabase
      .channel(`partner_alerts:${props.cidade}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tow_requests", filter: `cidade=eq.${props.cidade}` },
        async (payload) => {
          if (cancelled) return;
          const row = payload.new as { id?: string; status?: string };
          const id = String(row?.id ?? "");
          if (!id) return;
          if (seenRequestIdsRef.current.has(id)) return;
          seenRequestIdsRef.current.add(id);

          const status = String(row?.status ?? "");
          if (!["PENDENTE", "PROPOSTA_RECEBIDA"].includes(status)) return;

          const res = await fetch(`/api/public/requests/${id}`, { cache: "no-store" }).catch(() => null);
          const json = res ? await readJsonResponse<{ request?: Partial<RequestRow> }>(res) : null;
          const req = json?.request;
          if (!req || typeof req.id !== "string") return;

          const normalized: RequestRow = {
            id: req.id,
            local_cliente: String(req.local_cliente ?? ""),
            cidade: String(req.cidade ?? props.cidade),
            status: String(req.status ?? status),
            created_at: String(req.created_at ?? new Date().toISOString()),
            lat: typeof req.lat === "number" ? req.lat : null,
            lng: typeof req.lng === "number" ? req.lng : null,
            cliente_nome: typeof req.cliente_nome === "string" ? req.cliente_nome : null,
            telefone_cliente: typeof req.telefone_cliente === "string" ? req.telefone_cliente : null,
            modelo_veiculo: typeof req.modelo_veiculo === "string" ? req.modelo_veiculo : null,
          };

          setRequests((prev) => (prev.some((r) => r.id === normalized.id) ? prev : [normalized, ...prev].slice(0, 20)));
          setAlertRequest(normalized);
          setAlertOpen(true);
          if (soundEnabled) playAlertTone();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (supabase) {
        void supabase.removeChannel(channel);
      }
    };
  }, [ativo, props.cidade, props.supabaseAnonKey, props.supabaseUrl, soundEnabled]);

  useEffect(() => {
    if (!ativo) return;
    let cancelled = false;

    async function tick() {
      if (cancelled) return;
      if (pollingInFlightRef.current) return;
      pollingInFlightRef.current = true;
      try {
        const res = await fetch("/api/partner/requests/open", { cache: "no-store" });
        const json = await readJsonResponse<{ requests?: Array<Partial<RequestRow>>; error?: string }>(res);
        if (!res.ok) return;
        const list = (json?.requests ?? []) as Array<Partial<RequestRow>>;
        const normalized = list
          .map((r) => ({
            id: String(r.id ?? ""),
            local_cliente: String(r.local_cliente ?? ""),
            cidade: String(r.cidade ?? props.cidade),
            status: String(r.status ?? ""),
            created_at: String(r.created_at ?? ""),
            lat: typeof r.lat === "number" ? r.lat : null,
            lng: typeof r.lng === "number" ? r.lng : null,
            cliente_nome: typeof r.cliente_nome === "string" ? r.cliente_nome : null,
            telefone_cliente: typeof r.telefone_cliente === "string" ? r.telefone_cliente : null,
            modelo_veiculo: typeof r.modelo_veiculo === "string" ? r.modelo_veiculo : null,
          }))
          .filter((r) => r.id && r.local_cliente);

        if (normalized.length) {
          setRequests(normalized);
          const newest = normalized[0];
          if (newest && !seenRequestIdsRef.current.has(newest.id)) {
            seenRequestIdsRef.current.add(newest.id);
            setAlertRequest(newest);
            setAlertOpen(true);
            if (soundEnabled) playAlertTone();
          }
        }
      } catch {
        return;
      } finally {
        pollingInFlightRef.current = false;
      }
    }

    void tick();
    const id = window.setInterval(() => void tick(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [ativo, props.cidade, soundEnabled]);

  async function loadBalance() {
    setBalanceError(null);
    setIsLoadingBalance(true);
    try {
      const res = await fetch("/api/partner/stripe/balance");
      const json = await readJsonResponse<{
        connected?: boolean;
        available_cents?: number;
        pending_cents?: number;
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(json?.error || "Falha ao carregar saldo.");
      setStripeConnected(Boolean(json?.connected));
      setAvailableCents(Number.isFinite(json?.available_cents) ? Number(json?.available_cents) : 0);
      setPendingCents(Number.isFinite(json?.pending_cents) ? Number(json?.pending_cents) : 0);
    } catch (e) {
      setStripeConnected(null);
      setBalanceError(e instanceof Error ? e.message : "Falha ao carregar saldo.");
    } finally {
      setIsLoadingBalance(false);
    }
  }

  useEffect(() => {
    loadBalance().catch(() => null);
  }, []);

  async function toggleActive() {
    const next = !ativo;
    setUpdateError(null);
    setIsUpdating(true);
    setAtivo(next);

    try {
      const res = await fetch("/api/partner/active", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: next }),
      });
      const json = (await res.json()) as { ativo?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error || "Falha ao atualizar.");
      setAtivo(Boolean(json.ativo));
    } catch (e) {
      setAtivo(!next);
      setUpdateError(e instanceof Error ? e.message : "Falha ao atualizar.");
    } finally {
      setIsUpdating(false);
    }
  }

  async function openOnboarding() {
    window.location.href = "/partner/stripe/setup";
  }

  async function openStripeDashboard() {
    setIsCreatingLink(true);
    setPayoutMessage(null);
    try {
      const res = await fetch("/api/partner/stripe/dashboard", { method: "POST" });
      const json = await readJsonResponse<{ url?: string; error?: string }>(res);
      if (!res.ok) throw new Error(json?.error || "Não foi possível abrir o painel.");
      if (!json?.url) throw new Error("Resposta inválida do servidor.");
      window.open(json.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setBalanceError(e instanceof Error ? e.message : "Não foi possível abrir o painel.");
    } finally {
      setIsCreatingLink(false);
    }
  }

  async function payoutAll() {
    setIsPayouting(true);
    setPayoutMessage(null);
    setBalanceError(null);
    try {
      const res = await fetch("/api/partner/stripe/payout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const json = await readJsonResponse<{ status?: string; amount_cents?: number; error?: string }>(res);
      if (!res.ok) throw new Error(json?.error || "Falha ao sacar.");
      const amount = Number.isFinite(json?.amount_cents) ? Number(json?.amount_cents) : 0;
      setPayoutMessage(`Saque solicitado: ${formatBrl(amount)} (${json?.status ?? "ok"})`);
      await loadBalance();
    } catch (e) {
      setBalanceError(e instanceof Error ? e.message : "Falha ao sacar.");
    } finally {
      setIsPayouting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <RequestAlertModal
        key={alertRequest?.id ?? "none"}
        open={alertOpen}
        request={alertRequest}
        myCoords={myCoords}
        onClose={() => setAlertOpen(false)}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((v) => !v)}
      />

      <div className="card relative overflow-hidden p-5 sm:p-6">
        <div className="pointer-events-none absolute inset-0 opacity-80">
          <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_12%_0%,rgba(255,195,0,0.16)_0%,rgba(28,28,31,0)_60%),radial-gradient(55%_55%_at_92%_8%,rgba(225,6,0,0.18)_0%,rgba(28,28,31,0)_60%)]" />
        </div>

        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-brand-black/70">Dono do reboque</div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-brand-black">{displayName}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusPill label={ativo ? "Ativo" : "Inativo"} tone={statusTone} />
              <StatusPill label={props.cidade} tone="yellow" />
              {props.partner?.whatsapp_number ? <StatusPill label={`WhatsApp: ${props.partner.whatsapp_number}`} /> : null}
            </div>
          </div>

          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <button
              type="button"
              className="btn-secondary disabled:opacity-50"
              disabled={isUpdating}
              onClick={toggleActive}
            >
              {isUpdating ? "Atualizando..." : ativo ? "Ficar inativo" : "Ficar ativo"}
            </button>
            {updateError ? <div className="text-right text-xs font-semibold text-brand-red">{updateError}</div> : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-brand-border/20 bg-white p-4 shadow-soft">
          <div className="text-xs font-semibold text-brand-black/60">Pedidos em aberto</div>
          <div className="mt-1 text-2xl font-extrabold text-brand-black">{requestCount}</div>
          <div className="mt-2 text-xs text-brand-text2">Cidade: {props.cidade}</div>
        </div>
        <div className="rounded-3xl border border-brand-border/20 bg-white p-4 shadow-soft">
          <div className="text-xs font-semibold text-brand-black/60">Minhas corridas</div>
          <div className="mt-1 text-2xl font-extrabold text-brand-black">{tripCount}</div>
          <div className="mt-2 text-xs text-brand-text2">Últimas atualizações no painel</div>
        </div>
        <div className="rounded-3xl border border-brand-border/20 bg-white p-4 shadow-soft">
          <div className="text-xs font-semibold text-brand-black/60">Status</div>
          <div className="mt-1">
            {ativo ? (
              <div className="text-sm font-semibold text-brand-black">Pronto para receber chamados</div>
            ) : (
              <div className="text-sm font-semibold text-brand-black">Você está indisponível</div>
            )}
          </div>
          <div className="mt-2 text-xs text-brand-text2">
            Quando ativo, você pode receber alertas de novos pedidos.
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-brand-border/20 bg-white p-4 shadow-soft">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="text-sm font-extrabold text-brand-black">Saldo e saque</div>
            <div className="mt-1 text-xs text-brand-text2">
              O pagamento cai na sua conta Stripe e o saque vai para sua conta bancária configurada.
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              className="btn-secondary disabled:opacity-50"
              disabled={isCreatingLink}
              onClick={openOnboarding}
            >
              {isCreatingLink ? "Carregando..." : "Configurar conta bancária"}
            </button>
            <button
              type="button"
              className="rounded-2xl border border-brand-border/20 bg-white px-4 py-3 text-sm font-semibold text-brand-black hover:bg-brand-yellow/10 disabled:opacity-50"
              disabled={isCreatingLink || stripeConnected === false}
              onClick={openStripeDashboard}
            >
              Abrir painel Stripe
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-brand-border/20 bg-brand-yellow/10 p-3">
            <div className="text-xs font-semibold text-brand-black/60">Disponível para saque</div>
            <div className="mt-1 text-lg font-extrabold text-brand-black">
              {isLoadingBalance ? "Carregando..." : formatBrl(availableCents)}
            </div>
          </div>
          <div className="rounded-2xl border border-brand-border/20 bg-white p-3">
            <div className="text-xs font-semibold text-brand-black/60">Pendente</div>
            <div className="mt-1 text-lg font-extrabold text-brand-black">
              {isLoadingBalance ? "Carregando..." : formatBrl(pendingCents)}
            </div>
          </div>
          <div className="rounded-2xl border border-brand-border/20 bg-white p-3">
            <div className="text-xs font-semibold text-brand-black/60">Ação</div>
            <button
              type="button"
              className="btn-primary mt-2 w-full disabled:opacity-50"
              disabled={isPayouting || isLoadingBalance || stripeConnected !== true || availableCents <= 0}
              onClick={payoutAll}
            >
              {isPayouting ? "Solicitando..." : "Sacar tudo agora"}
            </button>
          </div>
        </div>

        {payoutMessage ? (
          <div className="mt-3 rounded-2xl border border-brand-success/30 bg-brand-success/10 p-3 text-sm font-semibold text-brand-success">
            {payoutMessage}
          </div>
        ) : null}

        {balanceError ? (
          <div className="mt-3 rounded-2xl border border-brand-red/30 bg-brand-red/10 p-3 text-sm font-semibold text-brand-red">
            {balanceError}
          </div>
        ) : null}

        {stripeConnected === false ? (
          <div className="mt-3 rounded-2xl border border-brand-border/20 bg-brand-yellow/10 p-3 text-sm text-brand-black/80">
            Você ainda não configurou sua conta Stripe para receber pagamentos. Clique em “Configurar conta bancária”.
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-brand-border/20 bg-white p-4 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-extrabold text-brand-black">Pedidos recebidos</div>
            <a className="text-xs font-semibold text-brand-black underline" href={`/partner?cidade=${encodeURIComponent(props.cidade)}`}>
              Atualizar
            </a>
          </div>

          {requests.length ? (
            <div className="mt-3 space-y-2">
              {requests.slice(0, 10).map((r) => (
                <a
                  key={r.id}
                  className="block rounded-2xl border border-brand-border/20 bg-white p-3 hover:bg-brand-yellow/10"
                  href={`/partner/requests/${r.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-brand-black">{r.local_cliente}</div>
                      <div className="mt-0.5 text-xs text-brand-text2">
                        {r.cidade} • {formatDateTime(r.created_at)}
                      </div>
                    </div>
                    <StatusPill label={r.status} />
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-brand-border/20 bg-brand-yellow/10 p-3 text-sm text-brand-black/80">
              Nenhum pedido aberto para {props.cidade}.
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-brand-border/20 bg-white p-4 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-extrabold text-brand-black">Minhas corridas</div>
            <a className="text-xs font-semibold text-brand-black underline" href="/partner">
              Atualizar
            </a>
          </div>

          {props.trips.length ? (
            <div className="mt-3 space-y-2">
              {props.trips.slice(0, 10).map((t) => (
                <a
                  key={t.id}
                  className="block rounded-2xl border border-brand-border/20 bg-white p-3 hover:bg-brand-yellow/10"
                  href={`/partner/trips/${t.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-brand-black">Trip #{t.id.slice(0, 8)}</div>
                      <div className="mt-0.5 text-xs text-brand-text2">
                        Pedido #{t.request_id.slice(0, 8)} • {formatDateTime(t.created_at)}
                      </div>
                    </div>
                    <StatusPill label={t.status} />
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-brand-border/20 bg-brand-yellow/10 p-3 text-sm text-brand-black/80">
              Nenhuma corrida ainda.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
