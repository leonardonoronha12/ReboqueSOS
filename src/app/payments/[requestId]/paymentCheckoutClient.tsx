"use client";

import { Elements } from "@stripe/react-stripe-js";
import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { StripePaymentElementOptions } from "@stripe/stripe-js";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { stripePromise } from "@/lib/stripe/client";

async function readJsonResponse<T>(res: Response) {
  const text = await res.text();
  if (!text) return { ok: false as const, data: null as T | null, errorText: "" };
  try {
    return { ok: true as const, data: JSON.parse(text) as T, errorText: "" };
  } catch {
    return { ok: false as const, data: null as T | null, errorText: text };
  }
}

function CheckoutForm(props: { options: StripePaymentElementOptions; onSubmitted: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onPay() {
    if (!stripe || !elements) return;
    setIsSubmitting(true);
    setError(null);
    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {},
      redirect: "if_required",
    });
    if (stripeError) setError(stripeError.message ?? "Falha no pagamento.");
    if (!stripeError) props.onSubmitted();
    setIsSubmitting(false);
  }

  return (
    <div className="space-y-4">
      <PaymentElement options={props.options} />
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      <button
        className="w-full rounded-md bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        disabled={!stripe || !elements || isSubmitting}
        onClick={onPay}
      >
        {isSubmitting ? "Processando..." : "Pagar agora"}
      </button>
    </div>
  );
}

export function PaymentCheckoutClient(props: { requestId: string }) {
  const router = useRouter();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "submitted" | "paid">("idle");
  const [paidTripId, setPaidTripId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setError(null);
      const res = await fetch("/api/payments/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: props.requestId }),
      });
      const parsed = await readJsonResponse<{ clientSecret?: string; error?: string }>(res);
      if (!parsed.ok) throw new Error("Resposta inválida do servidor ao criar pagamento.");
      if (!res.ok) throw new Error(parsed.data?.error || "Falha ao criar pagamento.");
      if (!cancelled) setClientSecret(parsed.data?.clientSecret ?? null);
    }
    run().catch((e) => setError(e instanceof Error ? e.message : "Falha ao criar pagamento."));
    return () => {
      cancelled = true;
    };
  }, [props.requestId]);

  useEffect(() => {
    if (status !== "submitted") return;
    let cancelled = false;
    let tries = 0;

    async function tick() {
      tries += 1;
      try {
        const res = await fetch(`/api/public/requests/${props.requestId}`, { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { request?: { status?: string }; trip?: { id?: string } | null };
        if (json.request?.status === "PAGO") {
          if (!cancelled) {
            const tripId = json.trip?.id ? String(json.trip.id) : null;
            setPaidTripId(tripId);
            setStatus("paid");
          }
          return;
        }
      } finally {
        if (!cancelled && tries < 30) {
          window.setTimeout(() => void tick(), 1500);
        }
      }
    }

    void tick();
    return () => {
      cancelled = true;
    };
  }, [props.requestId, status]);

  useEffect(() => {
    if (status !== "paid") return;
    const t = window.setTimeout(() => {
      if (paidTripId) {
        router.replace(`/trips/${paidTripId}`);
      } else {
        router.replace(`/requests/${props.requestId}`);
      }
    }, 800);
    return () => window.clearTimeout(t);
  }, [paidTripId, props.requestId, router, status]);

  const options = useMemo<StripePaymentElementOptions>(() => {
    return {
      layout: "tabs",
    };
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border bg-white p-6">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="rounded-xl border bg-white p-6">
        <p className="text-sm text-zinc-700">Carregando checkout...</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-white p-6">
      {status === "submitted" ? (
        <div className="mb-4 rounded-md border bg-zinc-50 p-3 text-sm text-zinc-700">
          Pagamento enviado. Confirmando...
        </div>
      ) : null}
      {status === "paid" ? (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          Pagamento confirmado. Obrigado!
          <div className="mt-3">
            {paidTripId ? (
              <a className="rounded-md border bg-white px-3 py-2 text-sm font-semibold" href={`/trips/${paidTripId}`}>
                Acompanhar reboque
              </a>
            ) : (
              <a className="rounded-md border bg-white px-3 py-2 text-sm font-semibold" href={`/requests/${props.requestId}`}>
                Voltar ao pedido
              </a>
            )}
          </div>
        </div>
      ) : null}
      <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe" } }}>
        <CheckoutForm options={options} onSubmitted={() => setStatus("submitted")} />
      </Elements>
    </div>
  );
}
