import { createSupabaseServerClient } from "@/lib/supabase/server";

import { PaymentCheckoutClient } from "./paymentCheckoutClient";

export default async function PaymentPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: reqRow } = await supabase
    .from("tow_requests")
    .select("id,status,accepted_proposal_id")
    .eq("id", requestId)
    .maybeSingle();

  if (!reqRow) {
    return (
      <div className="rounded-xl border bg-white p-6">
        <h1 className="text-xl font-semibold">Pagamento</h1>
        <p className="mt-2 text-sm text-zinc-700">Pedido não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-6">
        <h1 className="text-xl font-semibold">Checkout transparente</h1>
        <p className="mt-2 text-sm text-zinc-700">Status do pedido: {reqRow.status}</p>
      </div>

      <PaymentCheckoutClient requestId={requestId} />
    </div>
  );
}

