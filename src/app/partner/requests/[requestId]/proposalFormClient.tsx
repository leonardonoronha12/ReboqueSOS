"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Proposal = {
  id: string;
  valor: number;
  eta_minutes: number;
  accepted: boolean;
  created_at: string;
};

export function ProposalFormClient(props: {
  requestId: string;
  initialProposal: Proposal | null;
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
}) {
  const router = useRouter();
  const [valor, setValor] = useState(String(props.initialProposal?.valor ?? ""));
  const [etaMinutes, setEtaMinutes] = useState(
    String(props.initialProposal?.eta_minutes ?? ""),
  );
  const [proposal, setProposal] = useState<Proposal | null>(props.initialProposal);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!props.supabaseUrl || !props.supabaseAnonKey) return;

    const supabase = createSupabaseBrowserClient({ url: props.supabaseUrl, anonKey: props.supabaseAnonKey });
    const channel = supabase
      .channel(`my_proposal:${props.requestId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tow_proposals",
          filter: `request_id=eq.${props.requestId}`,
        },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [props.requestId, props.supabaseAnonKey, props.supabaseUrl, router]);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      if (cancelled) return;
      try {
        const res = await fetch("/api/partner/trips/paid-active", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { tripId?: string | null; requestId?: string | null };
        const tripId = json.tripId ? String(json.tripId) : "";
        const requestId = json.requestId ? String(json.requestId) : "";
        if (!tripId || requestId !== props.requestId) return;
        window.location.href = `/trips/${encodeURIComponent(tripId)}`;
      } catch {
        return;
      }
    }

    void tick();
    const id = window.setInterval(() => void tick(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [props.requestId]);

  async function submit() {
    setIsSubmitting(true);
    setError(null);
    try {
      const valorNum = Number(valor);
      const etaNum = Number(etaMinutes);
      if (!Number.isFinite(valorNum) || valorNum <= 0) {
        throw new Error("Informe um valor maior que zero.");
      }
      if (!Number.isFinite(etaNum) || etaNum <= 0) {
        throw new Error("Informe um ETA (min) maior que zero.");
      }
      if (!Number.isInteger(etaNum)) {
        throw new Error("ETA (min) deve ser um número inteiro.");
      }

      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: props.requestId,
          valor: valorNum,
          etaMinutes: etaNum,
        }),
      });
      const json = (await res.json()) as { id?: string; error?: string };
      if (!res.ok) throw new Error(json.error || "Falha ao enviar proposta.");
      setProposal(
        proposal
          ? { ...proposal, valor: valorNum, eta_minutes: etaNum }
          : {
              id: json.id!,
              valor: valorNum,
              eta_minutes: etaNum,
              accepted: false,
              created_at: new Date().toISOString(),
            },
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao enviar proposta.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border bg-white p-6">
      <h2 className="text-lg font-semibold">Enviar proposta</h2>
      <p className="mt-1 text-sm text-zinc-700">
        Informe o valor e o ETA. Se o cliente aceitar, a corrida aparece em “Minhas corridas”.
      </p>

      {proposal?.accepted ? (
        <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          Proposta aceita. Abra “Minhas corridas” para iniciar o deslocamento.
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="space-y-1">
          <div className="text-sm font-medium">Valor (R$)</div>
          <input
            className="w-full rounded-md border px-3 py-2"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            inputMode="decimal"
            placeholder="200.00"
          />
        </label>
        <label className="space-y-1">
          <div className="text-sm font-medium">ETA (min)</div>
          <input
            className="w-full rounded-md border px-3 py-2"
            value={etaMinutes}
            onChange={(e) => setEtaMinutes(e.target.value)}
            inputMode="numeric"
            min={1}
            step={1}
            placeholder="20"
          />
        </label>
      </div>

      <button
        className="mt-4 rounded-md bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        disabled={isSubmitting}
        onClick={submit}
      >
        {isSubmitting ? "Enviando..." : "Enviar proposta"}
      </button>
    </div>
  );
}
