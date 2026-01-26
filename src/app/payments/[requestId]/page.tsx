import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUserProfile } from "@/lib/auth/getProfile";
import { requireUser } from "@/lib/auth/requireUser";

import { PaymentCheckoutClient } from "./paymentCheckoutClient";

export default async function PaymentPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  const user = await requireUser();
  const profile = user ? await getUserProfile(user.id) : null;
  const supabase = createSupabaseAdminClient();

  const { data: reqRow } = await supabase
    .from("tow_requests")
    .select("id,status,accepted_proposal_id,cliente_id")
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

  const { data: trip } = await supabase
    .from("tow_trips")
    .select("id,driver_id,status")
    .eq("request_id", requestId)
    .maybeSingle();

  const canPay = (() => {
    if (!user) return reqRow.cliente_id == null;
    if (!profile) return false;
    return profile.role === "admin" || reqRow.cliente_id === user.id || (trip?.driver_id && trip.driver_id === user.id);
  })();

  if (!canPay) {
    return (
      <div className="rounded-xl border bg-white p-6">
        <h1 className="text-xl font-semibold">Pagamento</h1>
        <p className="mt-2 text-sm text-zinc-700">Sem permissão para acessar este pagamento.</p>
      </div>
    );
  }

  if (!reqRow.accepted_proposal_id) {
    return (
      <div className="rounded-xl border bg-white p-6">
        <h1 className="text-xl font-semibold">Pagamento</h1>
        <p className="mt-2 text-sm text-zinc-700">Aguarde a proposta ser aceita para liberar o pagamento.</p>
      </div>
    );
  }

  if (reqRow.status === "PAGO") {
    return (
      <div className="rounded-xl border bg-white p-6">
        <h1 className="text-xl font-semibold">Pagamento</h1>
        <p className="mt-2 text-sm text-zinc-700">Este pedido já foi pago.</p>
        {trip?.id ? (
          <div className="mt-4">
            <a className="rounded-md border px-3 py-2 text-sm font-medium" href={`/trips/${trip.id}`}>
              Acompanhar corrida
            </a>
          </div>
        ) : null}
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
