import { NextResponse } from "next/server";

import { getUserProfile } from "@/lib/auth/getProfile";
import { requireUser } from "@/lib/auth/requireUser";
import { haversineKm } from "@/lib/geo";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TOW_REQUEST_TTL_MS } from "@/lib/towRequestExpiry";

function parseFiniteNumber(value: string | null) {
  const n = value == null ? NaN : Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function GET(request: Request) {
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
    .select("cidade,ativo,lat,lng")
    .eq("id", user.id)
    .maybeSingle();

  if (partnerErr) return NextResponse.json({ error: partnerErr.message }, { status: 500 });
  if (!partner?.ativo) return NextResponse.json({ requests: [] }, { status: 200 });

  const cidade = String(partner.cidade ?? "").trim();
  const url = new URL(request.url);
  const latFromQuery = parseFiniteNumber(url.searchParams.get("lat"));
  const lngFromQuery = parseFiniteNumber(url.searchParams.get("lng"));
  const radiusFromQuery = parseFiniteNumber(url.searchParams.get("radius_km"));

  const latFromPartner = Number.isFinite(Number((partner as { lat?: unknown } | null)?.lat)) ? Number((partner as { lat?: number | null }).lat) : null;
  const lngFromPartner = Number.isFinite(Number((partner as { lng?: unknown } | null)?.lng)) ? Number((partner as { lng?: number | null }).lng) : null;

  const lat = latFromQuery ?? latFromPartner;
  const lng = lngFromQuery ?? lngFromPartner;
  const radiusKm = radiusFromQuery != null && radiusFromQuery > 0 ? Math.min(120, radiusFromQuery) : 35;

  const hasCoords = lat != null && lng != null;
  if (!hasCoords && !cidade) return NextResponse.json({ requests: [] }, { status: 200 });

  const cutoffIso = new Date(Date.now() - TOW_REQUEST_TTL_MS).toISOString();
  let query = supabaseAdmin
    .from("tow_requests")
    .select("id,local_cliente,cidade,status,created_at,lat,lng,cliente_nome,telefone_cliente,modelo_veiculo,accepted_proposal_id")
    .in("status", ["PENDENTE", "PROPOSTA_RECEBIDA"])
    .is("accepted_proposal_id", null)
    .gte("created_at", cutoffIso)
    .order("created_at", { ascending: false });

  if (hasCoords) {
    const center = { lat: Number(lat), lng: Number(lng) };
    const deltaLat = radiusKm / 111;
    const cos = Math.cos((center.lat * Math.PI) / 180);
    const deltaLng = radiusKm / (111 * (Math.abs(cos) > 0.0001 ? cos : 0.0001));
    const minLat = center.lat - deltaLat;
    const maxLat = center.lat + deltaLat;
    const minLng = center.lng - deltaLng;
    const maxLng = center.lng + deltaLng;

    query = query
      .not("lat", "is", null)
      .not("lng", "is", null)
      .gte("lat", minLat)
      .lte("lat", maxLat)
      .gte("lng", minLng)
      .lte("lng", maxLng)
      .limit(120);
  } else {
    query = query.eq("cidade", cidade).limit(20);
  }

  const { data: requests, error: reqErr } = await query;

  if (reqErr) return NextResponse.json({ error: reqErr.message }, { status: 500 });

  if (!hasCoords) return NextResponse.json({ requests: requests ?? [] }, { status: 200 });

  const center = { lat: Number(lat), lng: Number(lng) };
  const filtered = (requests ?? []).filter((r) => {
    const rLat = typeof r.lat === "number" ? r.lat : null;
    const rLng = typeof r.lng === "number" ? r.lng : null;
    if (rLat == null || rLng == null) return false;
    return haversineKm(center, { lat: rLat, lng: rLng }) <= radiusKm;
  });

  return NextResponse.json({ requests: filtered.slice(0, 20) }, { status: 200 });
}
