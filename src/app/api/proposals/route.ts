import { NextResponse } from "next/server";

import { getUserProfile } from "@/lib/auth/getProfile";
import { requireUser } from "@/lib/auth/requireUser";
import { getOptionalEnv } from "@/lib/env";
import { haversineKm } from "@/lib/geo";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Coords = { lat: number; lng: number };

function getGoogleMapsKey() {
  return getOptionalEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY") ?? getOptionalEnv("GOOGLE_MAPS_API_KEY") ?? "";
}

async function estimateEtaMinutesByDirections(input: { origin: Coords; destination: Coords }) {
  const key = getGoogleMapsKey();
  if (!key) return null;
  const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
  url.searchParams.set("origin", `${input.origin.lat},${input.origin.lng}`);
  url.searchParams.set("destination", `${input.destination.lat},${input.destination.lng}`);
  url.searchParams.set("mode", "driving");
  url.searchParams.set("language", "pt-BR");
  url.searchParams.set("region", "br");
  url.searchParams.set("key", key);
  const res = await fetch(url.toString(), { method: "GET" });
  const json = (await res.json()) as {
    status?: string;
    error_message?: string;
    routes?: Array<{ legs?: Array<{ duration?: { value?: number } | null }> }>;
  };
  if (!res.ok || String(json.status ?? "") !== "OK") return null;
  const sec = Number(json.routes?.[0]?.legs?.[0]?.duration?.value ?? 0);
  if (!Number.isFinite(sec) || sec <= 0) return null;
  return Math.max(1, Math.round(sec / 60));
}

function estimateEtaMinutesFallback(input: { origin: Coords; destination: Coords }) {
  const km = haversineKm(input.origin, input.destination);
  if (!Number.isFinite(km) || km <= 0) return 10;
  const avgKmH = 35;
  const minutes = (km / avgKmH) * 60;
  return Math.max(1, Math.min(180, Math.round(minutes)));
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const profile = await getUserProfile(user.id);
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 403 });
  if (profile.role !== "reboque" && profile.role !== "admin") {
    return NextResponse.json({ error: "Apenas parceiros podem propor." }, { status: 403 });
  }

  const body = (await request.json()) as {
    requestId?: string;
    valor?: number;
    partnerLat?: number | null;
    partnerLng?: number | null;
  };

  const requestId = String(body.requestId ?? "");
  const valor = Number(body.valor);
  const partnerLat = body.partnerLat == null ? null : Number(body.partnerLat);
  const partnerLng = body.partnerLng == null ? null : Number(body.partnerLng);

  if (!requestId) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  if (!Number.isFinite(valor) || valor <= 0) {
    return NextResponse.json({ error: "Informe um valor maior que zero." }, { status: 400 });
  }

  const supabaseAdmin = createSupabaseAdminClient();

  const { data: reqRow, error: reqErr } = await supabaseAdmin
    .from("tow_requests")
    .select("id,status,lat,lng")
    .eq("id", requestId)
    .maybeSingle();

  if (reqErr || !reqRow) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  if (reqRow.status !== "PENDENTE" && reqRow.status !== "PROPOSTA_RECEBIDA") {
    return NextResponse.json({ error: "Pedido não está aceitando propostas." }, { status: 409 });
  }

  const pickup = (() => {
    const lat = Number((reqRow as { lat?: unknown }).lat);
    const lng = Number((reqRow as { lng?: unknown }).lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng } satisfies Coords;
  })();
  if (!pickup) return NextResponse.json({ error: "Pedido sem coordenadas para calcular rota." }, { status: 409 });

  const partnerCoords = (() => {
    if (Number.isFinite(partnerLat) && Number.isFinite(partnerLng)) return { lat: Number(partnerLat), lng: Number(partnerLng) } satisfies Coords;
    return null;
  })();

  const fallbackPartnerCoords = async () => {
    const { data } = await supabaseAdmin.from("tow_partners").select("lat,lng").eq("id", user.id).maybeSingle();
    const lat = Number((data as { lat?: unknown } | null)?.lat);
    const lng = Number((data as { lng?: unknown } | null)?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng } satisfies Coords;
  };

  const origin = partnerCoords ?? (await fallbackPartnerCoords());
  if (!origin) {
    return NextResponse.json(
      { error: "Localização do parceiro indisponível. Ative o GPS para calcular o tempo automaticamente." },
      { status: 409 },
    );
  }

  const etaMinutes = (await estimateEtaMinutesByDirections({ origin, destination: pickup })) ?? estimateEtaMinutesFallback({ origin, destination: pickup });

  const { data: proposal, error: propErr } = await supabaseAdmin
    .from("tow_proposals")
    .upsert(
      {
        request_id: requestId,
        partner_id: user.id,
        valor,
        eta_minutes: etaMinutes,
      },
      { onConflict: "request_id,partner_id" },
    )
    .select("id")
    .single();

  if (propErr) {
    const msg = propErr.message || "Falha ao enviar proposta.";
    if (msg.includes("tow_proposals_eta_minutes_check")) {
      return NextResponse.json({ error: "Não foi possível calcular o tempo estimado automaticamente." }, { status: 400 });
    }
    if (msg.includes("tow_proposals_valor_check")) {
      return NextResponse.json({ error: "Informe um valor maior que zero." }, { status: 400 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  await supabaseAdmin
    .from("tow_requests")
    .update({ status: "PROPOSTA_RECEBIDA" })
    .eq("id", requestId)
    .in("status", ["PENDENTE", "PROPOSTA_RECEBIDA"]);

  return NextResponse.json({ id: proposal.id }, { status: 201 });
}
