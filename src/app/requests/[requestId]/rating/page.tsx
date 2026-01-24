import { createSupabaseServerClient } from "@/lib/supabase/server";

import { RatingClient } from "./ratingClient";

export default async function RatingPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: reqRow } = await supabase
    .from("tow_requests")
    .select("id,status")
    .eq("id", requestId)
    .maybeSingle();

  if (!reqRow) {
    return (
      <div className="rounded-xl border bg-white p-6">
        <h1 className="text-xl font-semibold">Avaliação</h1>
        <p className="mt-2 text-sm text-zinc-700">Pedido não encontrado.</p>
      </div>
    );
  }

  const { data: rating } = await supabase
    .from("tow_ratings")
    .select("rating,comentario,created_at")
    .eq("request_id", requestId)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-6">
        <h1 className="text-xl font-semibold">Avaliar corrida</h1>
        <p className="mt-2 text-sm text-zinc-700">Status do pedido: {reqRow.status}</p>
      </div>
      <RatingClient requestId={requestId} initialRating={rating ?? null} />
    </div>
  );
}

