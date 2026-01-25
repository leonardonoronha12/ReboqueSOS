"use client";

import Link from "next/link";
import { useMemo } from "react";

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

export function DemoRequestDetailsClient(props: {
  requestId: string;
  initialRequest: RequestRow;
  initialProposals: ProposalRow[];
  initialTrip: TripRow | null;
}) {
  const accepted = useMemo(() => props.initialProposals.find((p) => p.accepted) ?? null, [props.initialProposals]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-brand-border/20 bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-brand-black">
              Chamado #{props.initialRequest.id.slice(0, 8)}
            </h1>
            <p className="mt-1 text-sm text-brand-black/70">
              {props.initialRequest.cidade} • {props.initialRequest.local_cliente}
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full border border-brand-yellow/35 bg-brand-yellow/10 px-3 py-1 text-xs font-bold text-brand-black">
            {props.initialRequest.status}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            className="rounded-2xl border border-brand-border/20 bg-white px-4 py-2 text-sm font-semibold text-brand-black hover:bg-brand-yellow/10"
            href="/trips/demo"
          >
            Acompanhar corrida
          </Link>
          <Link
            className="rounded-2xl border border-brand-border/20 bg-white px-4 py-2 text-sm font-semibold text-brand-black hover:bg-brand-yellow/10"
            href="/payments/demo"
          >
            Pagar
          </Link>
          <Link
            className="rounded-2xl border border-brand-border/20 bg-white px-4 py-2 text-sm font-semibold text-brand-black hover:bg-brand-yellow/10"
            href="/requests/demo/rating"
          >
            Avaliar
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-brand-border/20 bg-white p-5 shadow-soft">
        <h2 className="text-lg font-extrabold tracking-tight text-brand-black">Propostas</h2>
        <p className="mt-1 text-sm text-brand-black/70">
          Exemplo da tela. No chamado real, as propostas aparecem automaticamente.
        </p>

        {props.initialProposals.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-brand-border/20 bg-brand-yellow/10 p-4 text-sm text-brand-black/80">
            Nenhuma proposta ainda.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {props.initialProposals.map((p) => (
              <div key={p.id} className="flex flex-col gap-3 rounded-2xl border border-brand-border/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  <div className="font-bold text-brand-black">
                    R$ {Number(p.valor).toFixed(2)} • ETA {p.eta_minutes} min
                  </div>
                  <div className="text-xs text-brand-text2">
                    {p.accepted ? "Aceita" : "Disponível"} • {new Date(p.created_at).toLocaleString("pt-BR")}
                  </div>
                </div>
                <div className="flex gap-2">
                  {accepted?.id === p.id ? (
                    <span className="rounded-2xl bg-brand-success px-4 py-2 text-xs font-bold text-white">
                      Aceita
                    </span>
                  ) : (
                    <button className="btn-primary px-4 py-2 text-sm" disabled type="button">
                      Aceitar
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
