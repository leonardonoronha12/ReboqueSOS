import { NextResponse } from "next/server";

import { haversineKm } from "@/lib/geo";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cidade = url.searchParams.get("cidade") ?? "";
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const radiusKm = Number(url.searchParams.get("radius_km") ?? "20");
  const onlyCount = url.searchParams.get("only_count") === "1";

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
  }

  const supabaseAdmin = createSupabaseAdminClient();
  let query = supabaseAdmin
    .from("tow_partners")
    .select("id,empresa_nome,cidade,lat,lng,ativo")
    .eq("ativo", true)
    .not("lat", "is", null)
    .not("lng", "is", null)
    .limit(50);

  if (cidade) {
    query = query.eq("cidade", cidade);
  }

  const { data: partners, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const all = (partners ?? [])
    .map((p) => ({
      id: p.id,
      empresa_nome: p.empresa_nome,
      cidade: p.cidade,
      lat: p.lat as number,
      lng: p.lng as number,
      distance_km: haversineKm({ lat, lng }, { lat: p.lat as number, lng: p.lng as number }),
    }))
    .sort((a, b) => a.distance_km - b.distance_km);

  const countNearby =
    Number.isFinite(radiusKm) && radiusKm > 0 ? all.filter((p) => p.distance_km <= radiusKm).length : all.length;

  if (onlyCount) {
    return NextResponse.json({ count_nearby: countNearby }, { status: 200 });
  }

  return NextResponse.json({ partners: all.slice(0, 3), count_nearby: countNearby }, { status: 200 });
}
