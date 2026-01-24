"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type ExistingRating = { rating: number; comentario: string | null; created_at: string };

export function RatingClient(props: {
  requestId: string;
  initialRating: ExistingRating | null;
}) {
  const router = useRouter();
  const [rating, setRating] = useState<number>(props.initialRating?.rating ?? 5);
  const [comentario, setComentario] = useState<string>(props.initialRating?.comentario ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stars = useMemo(() => [1, 2, 3, 4, 5], []);

  async function submit() {
    setIsSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: props.requestId, rating, comentario }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error || "Falha ao avaliar.");
      setMessage("Avaliação enviada.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao avaliar.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border bg-white p-6">
      <div className="text-sm font-medium">Nota</div>
      <div className="mt-2 flex gap-2">
        {stars.map((s) => (
          <button
            key={s}
            className={`h-10 w-10 rounded-md border text-sm font-semibold ${
              rating >= s ? "bg-black text-white" : "bg-white"
            }`}
            type="button"
            onClick={() => setRating(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mt-4 text-sm font-medium">Comentário (opcional)</div>
      <textarea
        className="mt-2 w-full rounded-md border px-3 py-2"
        rows={4}
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
      />

      {error ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {message}
        </div>
      ) : null}

      <button
        className="mt-4 rounded-md bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        disabled={isSubmitting}
        onClick={submit}
      >
        {isSubmitting ? "Enviando..." : "Enviar avaliação"}
      </button>
    </div>
  );
}

