import Link from "next/link";
import { redirect } from "next/navigation";

import { getUserProfile } from "@/lib/auth/getProfile";
import { requireUser } from "@/lib/auth/requireUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function formatBrlCents(amountCents: number | null) {
  const cents = typeof amountCents === "number" && Number.isFinite(amountCents) ? amountCents : null;
  if (cents == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatDateTime(value: string | null | undefined) {
  const t = value ? new Date(value) : null;
  if (!t || Number.isNaN(t.getTime())) return "—";
  return t.toLocaleString("pt-BR");
}

export default async function PartnerTripHistoryPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;

  const user = await requireUser();
  if (!user) redirect("/login");

  const profile = await getUserProfile(user.id);
  if (!profile || (profile.role !== "reboque" && profile.role !== "admin")) redirect("/partner");

  const supabase = createSupabaseAdminClient();

  const tripQuery = await supabase
    .from("tow_trips")
    .select("id,request_id,driver_id,status,created_at,updated_at,canceled_at,canceled_by_role,canceled_fee_cents,canceled_after_seconds")
    .eq("id", tripId)
    .maybeSingle();

  const trip =
    tripQuery.error || !tripQuery.data
      ? (
          await supabase
            .from("tow_trips")
            .select("id,request_id,driver_id,status,created_at,updated_at")
            .eq("id", tripId)
            .maybeSingle()
        ).data
      : tripQuery.data;

  if (!trip) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div className="rounded-3xl border border-brand-border/20 bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-extrabold text-brand-black">Histórico da corrida</div>
            <Link className="btn-secondary" href="/partner">
              Voltar
            </Link>
          </div>
          <div className="mt-3 text-sm text-brand-black/70">Corrida não encontrada.</div>
        </div>
      </div>
    );
  }

  if (profile.role !== "admin" && String(trip.driver_id ?? "") !== user.id) redirect("/partner");

  const { data: requestRow } = await supabase
    .from("tow_requests")
    .select("id,status,cidade,local_cliente,telefone_cliente,modelo_veiculo,created_at,updated_at,accepted_proposal_id,destino_local")
    .eq("id", String(trip.request_id ?? ""))
    .maybeSingle();

  const acceptedProposalId = requestRow?.accepted_proposal_id ? String(requestRow.accepted_proposal_id) : null;
  const { data: proposal } = acceptedProposalId
    ? await supabase.from("tow_proposals").select("id,valor,eta_minutes,created_at").eq("id", acceptedProposalId).maybeSingle()
    : { data: null };

  const { data: payment } = await supabase
    .from("payments")
    .select("provider,status,amount,updated_at")
    .eq("request_id", String(trip.request_id ?? ""))
    .maybeSingle();

  const canceledFeeRaw = (trip as unknown as { canceled_fee_cents?: unknown }).canceled_fee_cents;
  const canceledFeeCents = typeof canceledFeeRaw === "number" && Number.isFinite(canceledFeeRaw) ? canceledFeeRaw : null;

  const canceledAfterRaw = (trip as unknown as { canceled_after_seconds?: unknown }).canceled_after_seconds;
  const canceledAfterSeconds = typeof canceledAfterRaw === "number" && Number.isFinite(canceledAfterRaw) ? canceledAfterRaw : null;

  const paymentCents = typeof payment?.amount === "number" && Number.isFinite(payment.amount) ? Number(payment.amount) : null;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div className="rounded-3xl border border-brand-border/20 bg-white p-5 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-extrabold text-brand-black">Histórico da corrida</div>
          <Link className="btn-secondary" href="/partner">
            Voltar
          </Link>
        </div>
        <div className="mt-3 space-y-1 text-sm text-brand-black/70">
          <div>
            <span className="font-semibold text-brand-black">Trip:</span> #{String(trip.id).slice(0, 8)}
          </div>
          <div>
            <span className="font-semibold text-brand-black">Status:</span> {String(trip.status ?? "—")}
          </div>
          <div>
            <span className="font-semibold text-brand-black">Criada:</span> {formatDateTime(String(trip.created_at ?? ""))}
          </div>
          <div>
            <span className="font-semibold text-brand-black">Atualizada:</span> {formatDateTime(String(trip.updated_at ?? ""))}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-brand-border/20 bg-white p-5 shadow-soft">
        <div className="text-sm font-extrabold text-brand-black">Pedido</div>
        {requestRow ? (
          <div className="mt-3 space-y-1 text-sm text-brand-black/70">
            <div>
              <span className="font-semibold text-brand-black">Pedido:</span> #{String(requestRow.id).slice(0, 8)}
            </div>
            <div>
              <span className="font-semibold text-brand-black">Status:</span> {String(requestRow.status ?? "—")}
            </div>
            <div>
              <span className="font-semibold text-brand-black">Cidade:</span> {String(requestRow.cidade ?? "—")}
            </div>
            <div>
              <span className="font-semibold text-brand-black">Local:</span> {String(requestRow.local_cliente ?? "—")}
            </div>
            {requestRow.destino_local ? (
              <div>
                <span className="font-semibold text-brand-black">Destino:</span> {String(requestRow.destino_local)}
              </div>
            ) : null}
            {requestRow.modelo_veiculo ? (
              <div>
                <span className="font-semibold text-brand-black">Veículo:</span> {String(requestRow.modelo_veiculo)}
              </div>
            ) : null}
            {requestRow.telefone_cliente ? (
              <div>
                <span className="font-semibold text-brand-black">Telefone:</span> {String(requestRow.telefone_cliente)}
              </div>
            ) : null}
            <div>
              <span className="font-semibold text-brand-black">Criado:</span> {formatDateTime(String(requestRow.created_at ?? ""))}
            </div>
            <div>
              <span className="font-semibold text-brand-black">Atualizado:</span> {formatDateTime(String(requestRow.updated_at ?? ""))}
            </div>
          </div>
        ) : (
          <div className="mt-3 text-sm text-brand-black/70">Pedido não encontrado.</div>
        )}
      </div>

      <div className="rounded-3xl border border-brand-border/20 bg-white p-5 shadow-soft">
        <div className="text-sm font-extrabold text-brand-black">Proposta aceita</div>
        {proposal ? (
          <div className="mt-3 space-y-1 text-sm text-brand-black/70">
            <div>
              <span className="font-semibold text-brand-black">Valor:</span>{" "}
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(proposal.valor ?? 0))}
            </div>
            <div>
              <span className="font-semibold text-brand-black">ETA:</span> {Math.max(1, Math.round(Number(proposal.eta_minutes ?? 0)))} min
            </div>
            <div>
              <span className="font-semibold text-brand-black">Enviada:</span> {formatDateTime(String(proposal.created_at ?? ""))}
            </div>
          </div>
        ) : (
          <div className="mt-3 text-sm text-brand-black/70">Nenhuma proposta aceita.</div>
        )}
      </div>

      <div className="rounded-3xl border border-brand-border/20 bg-white p-5 shadow-soft">
        <div className="text-sm font-extrabold text-brand-black">Pagamento</div>
        {payment ? (
          <div className="mt-3 space-y-1 text-sm text-brand-black/70">
            <div>
              <span className="font-semibold text-brand-black">Provedor:</span> {String(payment.provider ?? "—")}
            </div>
            <div>
              <span className="font-semibold text-brand-black">Status:</span> {String(payment.status ?? "—")}
            </div>
            <div>
              <span className="font-semibold text-brand-black">Valor:</span> {formatBrlCents(paymentCents)}
            </div>
            <div>
              <span className="font-semibold text-brand-black">Atualizado:</span> {formatDateTime(String(payment.updated_at ?? ""))}
            </div>
          </div>
        ) : (
          <div className="mt-3 text-sm text-brand-black/70">Nenhum pagamento encontrado.</div>
        )}
      </div>

      {(trip as { canceled_at?: string | null })?.canceled_at ? (
        <div className="rounded-3xl border border-brand-red/30 bg-brand-red/10 p-5 text-sm text-brand-red">
          <div className="font-extrabold">Cancelamento</div>
          <div className="mt-2 space-y-1 font-semibold">
            <div>Cancelado em: {formatDateTime(String((trip as { canceled_at?: string | null }).canceled_at ?? ""))}</div>
            <div>Por: {String((trip as { canceled_by_role?: string | null }).canceled_by_role ?? "—")}</div>
            <div>Multa: {formatBrlCents(canceledFeeCents)}</div>
            <div>Tempo até cancelar: {canceledAfterSeconds != null ? `${canceledAfterSeconds}s` : "—"}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
