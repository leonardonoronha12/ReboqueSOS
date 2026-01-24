import { redirect } from "next/navigation";

import { getUserProfile } from "@/lib/auth/getProfile";
import { requireUser } from "@/lib/auth/requireUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function PartnerDashboardPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const profile = await getUserProfile(user.id);
  if (!profile) redirect("/login");
  if (profile.role !== "reboque" && profile.role !== "admin") {
    return (
      <div className="rounded-xl border bg-white p-6">
        <h1 className="text-xl font-semibold">Acesso negado</h1>
        <p className="mt-2 text-sm text-zinc-700">Esta área é apenas para parceiros.</p>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: partner } = await supabase
    .from("tow_partners")
    .select("id,empresa_nome,cidade,whatsapp_number,ativo")
    .eq("id", user.id)
    .maybeSingle();

  const cidade = partner?.cidade ?? "São Gonçalo";

  const { data: requests } = await supabase
    .from("tow_requests")
    .select("id,local_cliente,cidade,status,created_at")
    .eq("cidade", cidade)
    .in("status", ["PENDENTE", "PROPOSTA_RECEBIDA"])
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: trips } = await supabase
    .from("tow_trips")
    .select("id,request_id,status,created_at")
    .eq("driver_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-6">
        <h1 className="text-xl font-semibold">Painel do motorista</h1>
        <p className="mt-1 text-sm text-zinc-700">
          {partner?.empresa_nome ?? profile.nome} • {cidade} •{" "}
          {partner?.ativo ? "Ativo" : "Inativo"}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-6">
          <h2 className="text-lg font-semibold">Pedidos recebidos</h2>
          {requests?.length ? (
            <div className="mt-4 space-y-3">
              {requests.map((r) => (
                <a
                  key={r.id}
                  className="block rounded-lg border p-4 hover:bg-zinc-50"
                  href={`/partner/requests/${r.id}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm">
                      <div className="font-medium">{r.local_cliente}</div>
                      <div className="text-xs text-zinc-600">
                        {r.cidade} • {new Date(r.created_at).toLocaleString("pt-BR")}
                      </div>
                    </div>
                    <span className="rounded-full border bg-white px-3 py-1 text-xs font-medium">
                      {r.status}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-md border bg-zinc-50 p-4 text-sm text-zinc-700">
              Nenhum pedido aberto para {cidade}.
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-white p-6">
          <h2 className="text-lg font-semibold">Minhas corridas</h2>
          {trips?.length ? (
            <div className="mt-4 space-y-3">
              {trips.map((t) => (
                <a
                  key={t.id}
                  className="block rounded-lg border p-4 hover:bg-zinc-50"
                  href={`/partner/trips/${t.id}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm">
                      <div className="font-medium">Trip #{t.id.slice(0, 8)}</div>
                      <div className="text-xs text-zinc-600">
                        Pedido #{t.request_id.slice(0, 8)}
                      </div>
                    </div>
                    <span className="rounded-full border bg-white px-3 py-1 text-xs font-medium">
                      {t.status}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-md border bg-zinc-50 p-4 text-sm text-zinc-700">
              Nenhuma corrida ainda.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

