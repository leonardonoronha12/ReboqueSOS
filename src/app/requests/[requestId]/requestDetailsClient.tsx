"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Modal } from "@/components/ui/Modal";
import { getTowRequestExpiresAtMs } from "@/lib/towRequestExpiry";

type RequestRow = {
  id: string;
  local_cliente: string;
  cidade: string;
  telefone_cliente?: string | null;
  modelo_veiculo?: string | null;
  status: string;
  accepted_proposal_id: string | null;
  created_at: string;
};

type PartnerRow = {
  id: string;
  empresa_nome: string | null;
  whatsapp_number: string | null;
  caminhao_modelo: string | null;
  caminhao_placa: string | null;
  caminhao_tipo: string | null;
  foto_parceiro_path: string | null;
};

type ProposalRow = {
  id: string;
  partner_id: string;
  valor: number;
  eta_minutes: number;
  accepted: boolean;
  created_at: string;
  partner?: PartnerRow | null;
};

type TripRow = {
  id: string;
  status: string;
};

function formatBrl(value: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

function tryVibrate() {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate([250, 120, 250, 120, 450]);
    }
  } catch {
    return;
  }
}

async function playAlarmToneOnce() {
  try {
    const AudioCtx =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
        .AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") await ctx.resume().catch(() => null);

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.connect(ctx.destination);

    const mkBeep = (t: number, f: number, d: number) => {
      const g1 = ctx.createGain();
      g1.gain.setValueAtTime(0.0001, t);
      g1.connect(master);

      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.0001, t);
      g2.connect(master);

      const o1 = ctx.createOscillator();
      o1.type = "sawtooth";
      o1.frequency.setValueAtTime(f, t);
      o1.connect(g1);

      const o2 = ctx.createOscillator();
      o2.type = "square";
      o2.frequency.setValueAtTime(f / 2, t);
      o2.connect(g2);

      g1.gain.setValueAtTime(0.0001, t);
      g1.gain.exponentialRampToValueAtTime(0.28, t + 0.015);
      g1.gain.exponentialRampToValueAtTime(0.0001, t + d);

      g2.gain.setValueAtTime(0.0001, t);
      g2.gain.exponentialRampToValueAtTime(0.14, t + 0.015);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + d);

      o1.start(t);
      o2.start(t);
      o1.stop(t + d + 0.02);
      o2.stop(t + d + 0.02);
    };

    const t0 = ctx.currentTime + 0.02;
    mkBeep(t0, 880, 0.22);
    mkBeep(t0 + 0.34, 784, 0.22);
    mkBeep(t0 + 0.68, 988, 0.30);
    window.setTimeout(() => {
      ctx.close().catch(() => null);
    }, 1400);
  } catch {
    return;
  }
}

export function RequestDetailsClient(props: {
  requestId: string;
  initialRequest: RequestRow;
  initialProposals: ProposalRow[];
  initialTrip: TripRow | null;
}) {
  const router = useRouter();
  const [requestRow, setRequestRow] = useState<RequestRow>(props.initialRequest);
  const [proposals, setProposals] = useState<ProposalRow[]>(props.initialProposals);
  const [trip, setTrip] = useState<TripRow | null>(props.initialTrip);
  const [isAccepting, setIsAccepting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proposalModalOpen, setProposalModalOpen] = useState(false);
  const [proposalModalId, setProposalModalId] = useState<string | null>(null);
  const [isCanceling, setIsCanceling] = useState(false);
  const lastNotifiedIdRef = useRef<string | null>(null);
  const [declinedIds, setDeclinedIds] = useState<Set<string>>(() => new Set());
  const alarmIntervalRef = useRef<number | null>(null);
  const alarmTicksRef = useRef(0);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`reboquesos:declined_proposals:${props.requestId}`);
      if (!raw) return;
      const arr = JSON.parse(raw) as unknown;
      if (!Array.isArray(arr)) return;
      const next = new Set<string>(arr.map((v) => String(v)).filter(Boolean));
      setDeclinedIds(next);
    } catch {
      return;
    }
  }, [props.requestId]);

  const visibleProposals = useMemo(() => proposals.filter((p) => !declinedIds.has(p.id)), [declinedIds, proposals]);
  const accepted = useMemo(() => visibleProposals.find((p) => p.accepted) ?? null, [visibleProposals]);
  const newestProposal = useMemo(() => visibleProposals[0] ?? null, [visibleProposals]);
  const modalProposal = useMemo(
    () => (proposalModalId ? visibleProposals.find((p) => p.id === proposalModalId) ?? null : null),
    [proposalModalId, visibleProposals],
  );

  useEffect(() => {
    let alive = true;

    async function refresh() {
      try {
        const res = await fetch(`/api/public/requests/${props.requestId}`, { method: "GET" });
        const json = (await res.json()) as {
          request?: RequestRow;
          proposals?: ProposalRow[];
          trip?: TripRow | null;
        };
        if (!alive) return;
        if (res.ok && json.request) {
          setRequestRow(json.request);
          setProposals((json.proposals ?? []) as ProposalRow[]);
          setTrip((json.trip ?? null) as TripRow | null);
        }
      } catch {
        return;
      }
    }

    void refresh();
    const id = window.setInterval(refresh, 3500);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [props.requestId]);

  const expiresAtMs = useMemo(() => getTowRequestExpiresAtMs(requestRow.created_at), [requestRow.created_at]);
  const isExpired = useMemo(() => {
    const status = String(requestRow.status ?? "");
    if (trip) return false;
    if (accepted) return false;
    if (requestRow.accepted_proposal_id) return false;
    if (status !== "PENDENTE" && status !== "PROPOSTA_RECEBIDA") return false;
    if (expiresAtMs == null) return false;
    return nowMs > expiresAtMs;
  }, [accepted, expiresAtMs, nowMs, requestRow.accepted_proposal_id, requestRow.status, trip]);

  useEffect(() => {
    const status = String(requestRow.status ?? "");
    const shouldTick =
      !trip &&
      !accepted &&
      !requestRow.accepted_proposal_id &&
      (status === "PENDENTE" || status === "PROPOSTA_RECEBIDA") &&
      expiresAtMs != null;
    if (!shouldTick) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [accepted, expiresAtMs, requestRow.accepted_proposal_id, requestRow.status, trip]);

  useEffect(() => {
    if (!isExpired) return;
    setProposalModalOpen(false);
    setProposalModalId(null);
  }, [isExpired]);

  useEffect(() => {
    if (!newestProposal) return;
    if (accepted) return;
    if (isExpired) return;
    const id = newestProposal.id;
    if (!id) return;
    if (lastNotifiedIdRef.current === id) return;
    lastNotifiedIdRef.current = id;
    setProposalModalId(id);
    setProposalModalOpen(true);
    tryVibrate();
    void playAlarmToneOnce();
  }, [accepted, isExpired, newestProposal]);

  useEffect(() => {
    const shouldAlarm = proposalModalOpen && !!modalProposal && !accepted;
    if (!shouldAlarm) {
      if (alarmIntervalRef.current != null) window.clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
      alarmTicksRef.current = 0;
      return;
    }

    if (alarmIntervalRef.current != null) return;
    alarmTicksRef.current = 0;
    alarmIntervalRef.current = window.setInterval(() => {
      alarmTicksRef.current += 1;
      if (alarmTicksRef.current <= 4) tryVibrate();
      void playAlarmToneOnce();
    }, 1600);

    return () => {
      if (alarmIntervalRef.current != null) window.clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
      alarmTicksRef.current = 0;
    };
  }, [accepted, modalProposal, proposalModalOpen]);

  function declineProposal(proposalId: string) {
    setDeclinedIds((prev) => {
      const next = new Set(prev);
      next.add(proposalId);
      try {
        window.localStorage.setItem(
          `reboquesos:declined_proposals:${props.requestId}`,
          JSON.stringify(Array.from(next.values())),
        );
      } catch {
        return next;
      }
      return next;
    });
    setProposalModalOpen(false);
  }

  async function acceptProposal(proposalId: string) {
    if (isExpired) {
      setError("Pedido expirado (3 min). Solicite novamente.");
      return;
    }
    setIsAccepting(proposalId);
    setError(null);
    try {
      const res = await fetch(`/api/proposals/${proposalId}/accept`, { method: "POST" });
      const json = (await res.json()) as { tripId?: string | null; error?: string };
      if (!res.ok) throw new Error(json.error || "Falha ao aceitar.");
      setProposalModalOpen(false);
      router.push(`/payments/${props.requestId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao aceitar.");
    } finally {
      setIsAccepting(null);
    }
  }

  const isSearchingPartners = (() => {
    const status = String(requestRow.status ?? "");
    if (trip) return false;
    if (accepted) return false;
    if (isExpired) return false;
    if (visibleProposals.length > 0) return false;
    return status === "PENDENTE" || status === "PROPOSTA_RECEBIDA";
  })();

  const canCancelRequest = (() => {
    const status = String(requestRow.status ?? "");
    if (trip) return false;
    if (accepted) return false;
    if (isExpired) return false;
    if (requestRow.accepted_proposal_id) return false;
    return status === "PENDENTE" || status === "PROPOSTA_RECEBIDA";
  })();

  return (
    <div className="space-y-6">
      {isExpired ? (
        <div className="fixed inset-0 z-40 grid place-items-center p-6">
          <div className="w-full max-w-md rounded-3xl border border-brand-border/20 bg-white p-5 shadow-soft">
            <div className="text-center text-sm font-extrabold text-brand-black">Tempo esgotado</div>
            <div className="mt-2 text-center text-xs font-semibold text-brand-black/60">
              Nenhum reboque aceitou em 3 minutos. Faça um novo pedido.
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white"
                type="button"
                onClick={() => router.push("/")}
              >
                Solicitar novamente
              </button>
              <button
                className="rounded-md border px-4 py-2 text-sm font-semibold"
                type="button"
                onClick={() => router.push("/")}
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {isSearchingPartners ? (
        <div className="pointer-events-none fixed inset-0 z-40 grid place-items-center p-6">
          <div className="rounded-3xl border border-brand-border/20 bg-white/95 p-5 shadow-soft backdrop-blur">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-brand-border/20 border-t-brand-yellow" />
            <div className="mt-4 text-center text-sm font-extrabold text-brand-black">
              Buscando reboques parceiros…
            </div>
            <div className="mt-1 text-center text-xs font-semibold text-brand-black/60">
              Aguarde as propostas aparecerem
            </div>
          </div>
        </div>
      ) : null}

      <Modal
        open={proposalModalOpen && !!modalProposal}
        title="Proposta recebida"
        onClose={() => setProposalModalOpen(false)}
        footer={
          modalProposal ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                className="rounded-md border px-4 py-2 text-sm font-semibold"
                type="button"
                onClick={() => declineProposal(modalProposal.id)}
              >
                Recusar
              </button>
              <button
                className="rounded-md border px-4 py-2 text-sm font-semibold"
                type="button"
                onClick={() => setProposalModalOpen(false)}
              >
                Depois
              </button>
              <button
                className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                type="button"
                disabled={!!accepted || isAccepting === modalProposal.id}
                onClick={() => acceptProposal(modalProposal.id)}
              >
                {isAccepting === modalProposal.id ? "Aceitando..." : "Aceitar e pagar"}
              </button>
            </div>
          ) : null
        }
      >
        {modalProposal ? (
          <div className="space-y-3 text-sm text-brand-black/70">
            <div className="rounded-xl border border-brand-border/20 bg-white p-3">
              <div className="text-xs font-semibold text-brand-black/60">Preço</div>
              <div className="mt-1 text-lg font-extrabold text-brand-black">{formatBrl(Number(modalProposal.valor))}</div>
              <div className="mt-2 text-xs font-semibold text-brand-black/60">Chega em</div>
              <div className="mt-1 text-base font-extrabold text-brand-black">{Math.max(1, Math.round(Number(modalProposal.eta_minutes || 0)))} min</div>
            </div>

            <div className="rounded-xl border border-brand-border/20 bg-white p-3">
              <div className="text-xs font-semibold text-brand-black/60">Reboque</div>
              <div className="mt-1 text-base font-extrabold text-brand-black">{modalProposal.partner?.empresa_nome ?? "Parceiro"}</div>
              {modalProposal.partner?.caminhao_modelo || modalProposal.partner?.caminhao_tipo || modalProposal.partner?.caminhao_placa ? (
                <div className="mt-1 text-xs text-brand-black/60">
                  {[modalProposal.partner?.caminhao_tipo, modalProposal.partner?.caminhao_modelo, modalProposal.partner?.caminhao_placa]
                    .filter(Boolean)
                    .join(" • ")}
                </div>
              ) : null}
              {modalProposal.partner?.whatsapp_number ? (
                <div className="mt-2">
                  <a
                    className="inline-flex rounded-md border border-brand-border/20 bg-white px-3 py-2 text-xs font-semibold text-brand-black hover:bg-brand-yellow/10"
                    href={`https://wa.me/${String(modalProposal.partner.whatsapp_number).replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Falar no WhatsApp
                  </a>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>

      <div className="rounded-xl border bg-white p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold">Pedido #{requestRow.id.slice(0, 8)}</h1>
            <p className="mt-1 text-sm text-zinc-700">
              {requestRow.cidade} • {requestRow.local_cliente}
            </p>
            {requestRow.modelo_veiculo || requestRow.telefone_cliente ? (
              <p className="mt-2 text-sm text-zinc-700">
                {requestRow.modelo_veiculo ? `Veículo: ${requestRow.modelo_veiculo}` : null}
                {requestRow.modelo_veiculo && requestRow.telefone_cliente ? " • " : null}
                {requestRow.telefone_cliente ? `Telefone: ${requestRow.telefone_cliente}` : null}
              </p>
            ) : null}
          </div>
          <span className="inline-flex w-fit rounded-full border bg-white px-3 py-1 text-xs font-medium">
            {requestRow.status}
          </span>
        </div>
        {trip ? (
          <div className="mt-4 flex flex-wrap gap-3">
            <a className="rounded-md border px-3 py-2 text-sm font-medium" href={`/trips/${trip.id}`}>
              Acompanhar corrida
            </a>
            <a className="rounded-md border px-3 py-2 text-sm font-medium" href={`/payments/${requestRow.id}`}>
              Pagar
            </a>
          </div>
        ) : canCancelRequest ? (
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
              type="button"
              disabled={isCanceling}
              onClick={async () => {
                setError(null);
                const ok = window.confirm("Cancelar este pedido?");
                if (!ok) return;
                setIsCanceling(true);
                try {
                  const res = await fetch(`/api/requests/${encodeURIComponent(requestRow.id)}/cancel`, { method: "POST" });
                  const json = (await res.json().catch(() => null)) as { error?: string } | null;
                  if (!res.ok) throw new Error(json?.error || "Não foi possível cancelar agora.");
                  router.push("/");
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Não foi possível cancelar agora.");
                } finally {
                  setIsCanceling(false);
                }
              }}
            >
              {isCanceling ? "Cancelando..." : "Cancelar pedido"}
            </button>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border bg-white p-6">
        <h2 className="text-lg font-semibold">Propostas</h2>
        <p className="mt-1 text-sm text-zinc-700">
          Aguarde as respostas dos reboques próximos. Ao aceitar, você será levado ao pagamento.
        </p>

        {error ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {isExpired ? (
          <div className="mt-4 rounded-md border bg-zinc-50 p-4 text-sm text-zinc-700">
            Pedido expirado. Para chamar de novo, faça uma nova solicitação.
          </div>
        ) : proposals.length === 0 ? (
          <div className="mt-4 rounded-md border bg-zinc-50 p-4 text-sm text-zinc-700">
            Nenhuma proposta ainda.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {visibleProposals.map((p) => (
              <div key={p.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  <div className="font-medium">
                    {formatBrl(Number(p.valor))} • ETA {p.eta_minutes} min
                  </div>
                  {p.partner?.empresa_nome ? <div className="mt-1 text-xs text-zinc-600">{p.partner.empresa_nome}</div> : null}
                  <div className="text-xs text-zinc-600">
                    {p.accepted ? "Aceita" : "Disponível"} • {new Date(p.created_at).toLocaleString("pt-BR")}
                  </div>
                </div>
                <div className="flex gap-2">
                  {accepted?.id === p.id ? (
                    <span className="rounded-md bg-green-600 px-3 py-2 text-xs font-semibold text-white">
                      Aceita
                    </span>
                  ) : (
                    <button
                      className="rounded-md bg-black px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      disabled={!!accepted || isAccepting === p.id || isExpired}
                      onClick={() => acceptProposal(p.id)}
                    >
                      {isAccepting === p.id ? "Aceitando..." : "Aceitar"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
