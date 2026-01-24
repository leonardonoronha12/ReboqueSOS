"use client";

import { Elements } from "@stripe/react-stripe-js";
import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { StripePaymentElementOptions } from "@stripe/stripe-js";
import { useEffect, useMemo, useState } from "react";

import { stripePromise } from "@/lib/stripe/client";

function CheckoutForm(props: { options: StripePaymentElementOptions }) {
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
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setError(null);
      const res = await fetch("/api/payments/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: props.requestId }),
      });
      const json = (await res.json()) as { clientSecret?: string; error?: string };
      if (!res.ok) throw new Error(json.error || "Falha ao criar pagamento.");
      if (!cancelled) setClientSecret(json.clientSecret ?? null);
    }
    run().catch((e) => setError(e instanceof Error ? e.message : "Falha ao criar pagamento."));
    return () => {
      cancelled = true;
    };
  }, [props.requestId]);

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
      <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe" } }}>
        <CheckoutForm options={options} />
      </Elements>
    </div>
  );
}
