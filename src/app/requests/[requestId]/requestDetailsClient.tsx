"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type RequestRow = {
  id: string;
  local_cliente: string;
  cidade: string;
  status: string;
  accepted_proposal_id: string | null;
  created_at: string;
};

type ProposalRow = {
  id: string;
  partner_id: string;
  valor: number;
  eta_minutes: number;
  accepted: boolean;
  created_at: string;
};

type TripRow = {
  id: string;
  status: string;
};

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

  const accepted = useMemo(() => proposals.find((p) => p.accepted) ?? null, [proposals]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const requestsChannel = supabase
      .channel(`tow_requests:${props.requestId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tow_requests", filter: `id=eq.${props.requestId}` },
        (payload) => {
          if (payload.new) setRequestRow(payload.new as RequestRow);
        },
      )
      .subscribe();

    const proposalsChannel = supabase
      .channel(`tow_proposals:${props.requestId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tow_proposals",
          filter: `request_id=eq.${props.requestId}`,
        },
        () => {
          supabase
            .from("tow_proposals")
            .select("id,partner_id,valor,eta_minutes,accepted,created_at")
            .eq("request_id", props.requestId)
            .order("created_at", { ascending: false })
            .then(({ data }) => setProposals((data ?? []) as ProposalRow[]));
        },
      )
      .subscribe();

    const tripsChannel = supabase
      .channel(`tow_trips:${props.requestId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tow_trips",
          filter: `request_id=eq.${props.requestId}`,
        },
        (payload) => {
          if (payload.new) setTrip(payload.new as TripRow);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(requestsChannel);
      void supabase.removeChannel(proposalsChannel);
      void supabase.removeChannel(tripsChannel);
    };
  }, [props.requestId]);

  async function acceptProposal(proposalId: string) {
    setIsAccepting(proposalId);
    setError(null);
    try {
      const res = await fetch(`/api/proposals/${proposalId}/accept`, { method: "POST" });
      const json = (await res.json()) as { tripId?: string | null; error?: string };
      if (!res.ok) throw new Error(json.error || "Falha ao aceitar.");
      if (json.tripId) router.push(`/trips/${json.tripId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao aceitar.");
    } finally {
      setIsAccepting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold">Pedido #{requestRow.id.slice(0, 8)}</h1>
            <p className="mt-1 text-sm text-zinc-700">
              {requestRow.cidade} • {requestRow.local_cliente}
            </p>
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
            {requestRow.status === "PAGO" ? (
              <a
                className="rounded-md border px-3 py-2 text-sm font-medium"
                href={`/requests/${requestRow.id}/rating`}
              >
                Avaliar
              </a>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border bg-white p-6">
        <h2 className="text-lg font-semibold">Propostas</h2>
        <p className="mt-1 text-sm text-zinc-700">
          Aguarde as respostas dos reboques próximos. Ao aceitar, o rastreamento ao vivo inicia.
        </p>

        {error ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {proposals.length === 0 ? (
          <div className="mt-4 rounded-md border bg-zinc-50 p-4 text-sm text-zinc-700">
            Nenhuma proposta ainda.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {proposals.map((p) => (
              <div key={p.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  <div className="font-medium">
                    R$ {Number(p.valor).toFixed(2)} • ETA {p.eta_minutes} min
                  </div>
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
                      disabled={!!accepted || isAccepting === p.id}
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
