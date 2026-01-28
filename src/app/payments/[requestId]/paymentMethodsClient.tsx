"use client";

import { useMemo, useState } from "react";

import { PaymentCheckoutClient } from "./paymentCheckoutClient";
import { PixCheckoutClient } from "./pixCheckoutClient";

export function PaymentMethodsClient(props: { requestId: string; cardEnabled: boolean }) {
  const [method, setMethod] = useState<"pix" | "card">("pix");
  const cardDisabledReason = useMemo(() => {
    if (props.cardEnabled) return null;
    return "Cartão indisponível (parceiro sem conta Stripe configurada).";
  }, [props.cardEnabled]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={method === "pix" ? "rounded-md bg-black px-4 py-2 text-sm font-semibold text-white" : "rounded-md border bg-white px-4 py-2 text-sm font-semibold"}
          onClick={() => setMethod("pix")}
        >
          Pix
        </button>
        <button
          type="button"
          disabled={!props.cardEnabled}
          className={
            method === "card"
              ? "rounded-md bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              : "rounded-md border bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
          }
          onClick={() => setMethod("card")}
        >
          Cartão
        </button>
      </div>

      {cardDisabledReason ? (
        <div className="rounded-md border bg-zinc-50 p-3 text-sm text-zinc-700">{cardDisabledReason}</div>
      ) : null}

      {method === "pix" ? <PixCheckoutClient requestId={props.requestId} /> : <PaymentCheckoutClient requestId={props.requestId} />}
    </div>
  );
}

