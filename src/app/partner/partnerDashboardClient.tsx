"use client";

import { useEffect, useMemo, useState } from "react";

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
};

type TripRow = {
  id: string;
  request_id: string;
  status: string;
  created_at: string;
};

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

export function PartnerDashboardClient(props: {
  profile: ProfileRow;
  partner: PartnerRow | null;
  cidade: string;
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

  const requestCount = props.requests.length;
  const tripCount = props.trips.length;

  const statusTone = useMemo(() => {
    if (!ativo) return "red" as const;
    return "green" as const;
  }, [ativo]);

  async function loadBalance() {
    setBalanceError(null);
    setIsLoadingBalance(true);
    try {
      const res = await fetch("/api/partner/stripe/balance");
      const json = (await res.json()) as {
        connected?: boolean;
        available_cents?: number;
        pending_cents?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Falha ao carregar saldo.");
      setStripeConnected(Boolean(json.connected));
      setAvailableCents(Number.isFinite(json.available_cents) ? Number(json.available_cents) : 0);
      setPendingCents(Number.isFinite(json.pending_cents) ? Number(json.pending_cents) : 0);
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
    setIsCreatingLink(true);
    setPayoutMessage(null);
    try {
      const res = await fetch("/api/partner/stripe/onboard", { method: "POST" });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error || "Não foi possível abrir o onboarding.");
      window.location.href = json.url;
    } catch (e) {
      setBalanceError(e instanceof Error ? e.message : "Não foi possível abrir o onboarding.");
    } finally {
      setIsCreatingLink(false);
    }
  }

  async function openStripeDashboard() {
    setIsCreatingLink(true);
    setPayoutMessage(null);
    try {
      const res = await fetch("/api/partner/stripe/dashboard", { method: "POST" });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error || "Não foi possível abrir o painel.");
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
      const json = (await res.json()) as { status?: string; amount_cents?: number; error?: string };
      if (!res.ok) throw new Error(json.error || "Falha ao sacar.");
      const amount = Number.isFinite(json.amount_cents) ? Number(json.amount_cents) : 0;
      setPayoutMessage(`Saque solicitado: ${formatBrl(amount)} (${json.status ?? "ok"})`);
      await loadBalance();
    } catch (e) {
      setBalanceError(e instanceof Error ? e.message : "Falha ao sacar.");
    } finally {
      setIsPayouting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
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

          {props.requests.length ? (
            <div className="mt-3 space-y-2">
              {props.requests.slice(0, 10).map((r) => (
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
