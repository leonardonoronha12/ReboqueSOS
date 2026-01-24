import { redirect } from "next/navigation";

import { getUserProfile } from "@/lib/auth/getProfile";
import { requireUser } from "@/lib/auth/requireUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== "admin") {
    return (
      <div className="rounded-xl border bg-white p-6">
        <h1 className="text-xl font-semibold">Acesso negado</h1>
        <p className="mt-2 text-sm text-zinc-700">Esta área é apenas para admin.</p>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();

  const { data: partners } = await supabase
    .from("tow_partners")
    .select("id,empresa_nome,cidade,ativo,whatsapp_number,stripe_account_id,created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: requests } = await supabase
    .from("tow_requests")
    .select("id,cidade,status,local_cliente,created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: payments } = await supabase
    .from("payments")
    .select("amount,status,platform_fee_amount,driver_amount,created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const succeeded = (payments ?? []).filter((p) => p.status === "succeeded");
  const total = succeeded.reduce((acc, p) => acc + (p.amount ?? 0), 0);
  const totalFee = succeeded.reduce((acc, p) => acc + (p.platform_fee_amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-6">
        <h1 className="text-xl font-semibold">Admin</h1>
        <p className="mt-1 text-sm text-zinc-700">Faturamento e operação RJ.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border p-4">
            <div className="text-xs text-zinc-600">Total pago</div>
            <div className="text-lg font-semibold">
              R$ {(total / 100).toFixed(2)}
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs text-zinc-600">Comissão (10%)</div>
            <div className="text-lg font-semibold">
              R$ {(totalFee / 100).toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-6">
          <h2 className="text-lg font-semibold">Parceiros</h2>
          <div className="mt-4 space-y-3">
            {(partners ?? []).map((p) => (
              <div key={p.id} className="rounded-lg border p-4 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <div className="font-medium">{p.empresa_nome}</div>
                  <span className="rounded-full border bg-white px-3 py-1 text-xs font-medium">
                    {p.ativo ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <div className="mt-1 text-xs text-zinc-600">
                  {p.cidade} • {p.whatsapp_number ?? "sem WhatsApp"} •{" "}
                  {p.stripe_account_id ? "Stripe OK" : "Stripe pendente"}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-white p-6">
          <h2 className="text-lg font-semibold">Corridas / pedidos</h2>
          <div className="mt-4 space-y-3">
            {(requests ?? []).map((r) => (
              <a
                key={r.id}
                className="block rounded-lg border p-4 text-sm hover:bg-zinc-50"
                href={`/requests/${r.id}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="font-medium">{r.local_cliente}</div>
                  <span className="rounded-full border bg-white px-3 py-1 text-xs font-medium">
                    {r.status}
                  </span>
                </div>
                <div className="mt-1 text-xs text-zinc-600">
                  {r.cidade} • {new Date(r.created_at).toLocaleString("pt-BR")}
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6">
        <h2 className="text-lg font-semibold">Pagamentos</h2>
        <div className="mt-4 space-y-3">
          {(payments ?? []).map((p, idx) => (
            <div key={idx} className="rounded-lg border p-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <div className="font-medium">R$ {((p.amount ?? 0) / 100).toFixed(2)}</div>
                <span className="rounded-full border bg-white px-3 py-1 text-xs font-medium">
                  {p.status}
                </span>
              </div>
              <div className="mt-1 text-xs text-zinc-600">
                Comissão: R$ {((p.platform_fee_amount ?? 0) / 100).toFixed(2)} •{" "}
                Motorista: R$ {((p.driver_amount ?? 0) / 100).toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

