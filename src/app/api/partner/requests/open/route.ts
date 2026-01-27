import { NextResponse } from "next/server";

import { getUserProfile } from "@/lib/auth/getProfile";
import { requireUser } from "@/lib/auth/requireUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const profile = await getUserProfile(user.id);
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 403 });
  if (profile.role !== "reboque" && profile.role !== "admin") {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: partner, error: partnerErr } = await supabaseAdmin
    .from("tow_partners")
    .select("cidade,ativo")
    .eq("id", user.id)
    .maybeSingle();

  if (partnerErr) return NextResponse.json({ error: partnerErr.message }, { status: 500 });
  if (!partner?.ativo) return NextResponse.json({ requests: [] }, { status: 200 });

  const cidade = String(partner.cidade ?? "").trim();
  if (!cidade) return NextResponse.json({ requests: [] }, { status: 200 });

  const { data: requests, error: reqErr } = await supabaseAdmin
    .from("tow_requests")
    .select("id,local_cliente,cidade,status,created_at,lat,lng,cliente_nome,telefone_cliente,modelo_veiculo")
    .eq("cidade", cidade)
    .in("status", ["PENDENTE", "PROPOSTA_RECEBIDA"])
    .order("created_at", { ascending: false })
    .limit(20);

  if (reqErr) return NextResponse.json({ error: reqErr.message }, { status: 500 });
  return NextResponse.json({ requests: requests ?? [] }, { status: 200 });
}

