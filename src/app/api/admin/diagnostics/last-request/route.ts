import { NextResponse } from "next/server";

import { getUserProfile } from "@/lib/auth/getProfile";
import { requireUser } from "@/lib/auth/requireUser";
import { haversineKm } from "@/lib/geo";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const url = new URL(request.url);
  const cityParam = (url.searchParams.get("cidade") ?? "").trim();
  const cidade = cityParam || null;

  const supabaseAdmin = createSupabaseAdminClient();

  const reqQuery = supabaseAdmin
    .from("tow_requests")
    .select("id,cidade,status,local_cliente,lat,lng,cliente_nome,telefone_cliente,modelo_veiculo,created_at")
    .order("created_at", { ascending: false })
    .limit(1);

  const { data: reqRow } = cidade ? await reqQuery.eq("cidade", cidade).maybeSingle() : await reqQuery.maybeSingle();
  if (!reqRow) return NextResponse.json({ error: "Nenhum pedido encontrado." }, { status: 404 });

  const { data: partners } = await supabaseAdmin
    .from("tow_partners")
    .select("id,empresa_nome,cidade,ativo,whatsapp_number,lat,lng,created_at")
    .eq("ativo", true)
    .not("whatsapp_number", "is", null)
    .limit(200);

  const cityToCheck = cidade ?? (reqRow.cidade ? String(reqRow.cidade) : null);
  const partnersInCity = (partners ?? [])
    .filter((p) => (cityToCheck ? String(p.cidade ?? "") === cityToCheck : true))
    .map((p) => ({
      id: p.id,
      empresa_nome: p.empresa_nome,
      cidade: p.cidade,
      ativo: p.ativo,
      whatsapp_number: Boolean(p.whatsapp_number),
      lat: p.lat,
      lng: p.lng,
      coords_ok: typeof p.lat === "number" && typeof p.lng === "number",
      created_at: p.created_at,
    }))
    .slice(0, 20);

  const nearby = (partners ?? [])
    .filter(
      (p) =>
        typeof p.lat === "number" &&
        typeof p.lng === "number" &&
        typeof reqRow.lat === "number" &&
        typeof reqRow.lng === "number",
    )
    .map((p) => ({
      id: p.id,
      empresa_nome: p.empresa_nome,
      cidade: p.cidade,
      ativo: p.ativo,
      whatsapp_number: Boolean(p.whatsapp_number),
      lat: p.lat,
      lng: p.lng,
      distanceKm: haversineKm(
        { lat: reqRow.lat as number, lng: reqRow.lng as number },
        { lat: p.lat as number, lng: p.lng as number },
      ),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 10);

  return NextResponse.json(
    {
      request: {
        id: reqRow.id,
        cidade: reqRow.cidade,
        status: reqRow.status,
        local_cliente: reqRow.local_cliente,
        lat: reqRow.lat,
        lng: reqRow.lng,
        cliente_nome: reqRow.cliente_nome,
        telefone_cliente: reqRow.telefone_cliente,
        modelo_veiculo: reqRow.modelo_veiculo,
        created_at: reqRow.created_at,
      },
      partners_in_city: partnersInCity,
      partners_nearby: nearby,
    },
    { status: 200 },
  );
}
