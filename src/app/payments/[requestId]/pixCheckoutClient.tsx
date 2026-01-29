"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type PixResponse = {
  provider?: string;
  status?: string;
  qrCode?: string;
  qrCodeBase64?: string;
  expiresAt?: string | null;
  error?: string;
  details?: unknown;
};

async function readJsonResponse<T>(res: Response) {
  const text = await res.text();
  if (!text) return { ok: false as const, data: null as T | null, errorText: "" };
  try {
    return { ok: true as const, data: JSON.parse(text) as T, errorText: "" };
  } catch {
    return { ok: false as const, data: null as T | null, errorText: text };
  }
}

export function PixCheckoutClient(props: { requestId: string }) {
  const router = useRouter();
  const [data, setData] = useState<PixResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "awaiting" | "paid">("idle");
  const [paidTripId, setPaidTripId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setError(null);
      const res = await fetch("/api/payments/pix/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: props.requestId }),
      });
      const parsed = await readJsonResponse<PixResponse>(res);
      if (!parsed.ok) throw new Error("Resposta inválida do servidor ao criar Pix.");
      if (!res.ok) {
        const detailsText = (() => {
          const d = parsed.data?.details;
          if (!d) return "";
          if (typeof d === "string") return d;
          try {
            return JSON.stringify(d);
          } catch {
            return "";
          }
        })();
        throw new Error(`${parsed.data?.error || "Falha ao criar Pix."}${detailsText ? ` (${detailsText})` : ""}`);
      }
      if (!cancelled) {
        setData(parsed.data);
        setStatus("awaiting");
      }
    }
    run().catch((e) => setError(e instanceof Error ? e.message : "Falha ao criar Pix."));
    return () => {
      cancelled = true;
    };
  }, [props.requestId]);

  useEffect(() => {
    if (status !== "awaiting") return;
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
        if (!cancelled && tries < 80) {
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

  const qrSrc = useMemo(() => {
    const b64 = data?.qrCodeBase64 ? String(data.qrCodeBase64) : "";
    if (!b64) return "";
    return `data:image/png;base64,${b64}`;
  }, [data?.qrCodeBase64]);

  async function copy() {
    const code = data?.qrCode ? String(data.qrCode) : "";
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      return;
    }
  }

  if (error) {
    return (
      <div className="rounded-xl border bg-white p-6">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border bg-white p-6">
        <p className="text-sm text-zinc-700">Gerando Pix...</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-white p-6">
      {status === "awaiting" ? (
        <div className="mb-4 rounded-md border bg-zinc-50 p-3 text-sm text-zinc-700">
          Aguardando pagamento do Pix...
        </div>
      ) : null}
      {status === "paid" ? (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          Pagamento confirmado. Obrigado!
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-[220px_1fr] sm:items-start">
        <div className="rounded-xl border bg-white p-3">
          {qrSrc ? <Image src={qrSrc} alt="QR Code Pix" width={200} height={200} className="rounded-md" /> : null}
        </div>
        <div className="space-y-3">
          <div className="text-sm font-semibold text-brand-black">Pague via Pix</div>
          <div className="text-xs text-brand-black/70">
            Abra o app do seu banco e escaneie o QR Code ou copie o código Pix.
          </div>
          <div className="rounded-md border bg-white p-3 text-xs text-brand-black/80">
            <div className="break-all">{data.qrCode ? String(data.qrCode) : "—"}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white" type="button" onClick={() => void copy()}>
              Copiar código
            </button>
            <a className="rounded-md border bg-white px-4 py-2 text-sm font-semibold" href={`/requests/${props.requestId}`}>
              Voltar
            </a>
          </div>
          {data.expiresAt ? (
            <div className="text-xs text-brand-black/60">Expira em: {new Date(String(data.expiresAt)).toLocaleString("pt-BR")}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
