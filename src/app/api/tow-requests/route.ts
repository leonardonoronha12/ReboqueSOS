import { NextResponse } from "next/server";

import { getUserProfile } from "@/lib/auth/getProfile";
import { requireUser } from "@/lib/auth/requireUser";
import { haversineKm } from "@/lib/geo";
import { geocodeAddressDetails, reverseGeocodeCoords } from "@/lib/google/geocode";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppMessage } from "@/lib/whatsapp/sendWhatsApp";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const profile = await getUserProfile(user.id);
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 403 });
  if (profile.role !== "cliente" && profile.role !== "admin") {
    return NextResponse.json({ error: "Apenas clientes podem solicitar." }, { status: 403 });
  }

  const body = (await request.json()) as {
    cidade?: string;
    local_cliente?: string;
    endereco?: string;
    lat?: number | null;
    lng?: number | null;
    telefone?: string;
    modelo_veiculo?: string;
  };

  const defaultCity = "São Gonçalo";
  let cidade = String(body.cidade ?? "").trim();
  let localCliente = String(body.local_cliente ?? body.endereco ?? "").trim();
  let lat = typeof body.lat === "number" ? body.lat : null;
  let lng = typeof body.lng === "number" ? body.lng : null;
  const telefone = String(body.telefone ?? "").trim();
  const modeloVeiculo = String(body.modelo_veiculo ?? "").trim();

  if (!telefone) return NextResponse.json({ error: "Informe um telefone." }, { status: 400 });
  if (!modeloVeiculo) return NextResponse.json({ error: "Informe o modelo do veículo." }, { status: 400 });

  if (lat != null && lng != null && (!Number.isFinite(lat) || !Number.isFinite(lng))) {
    return NextResponse.json({ error: "Coordenadas inválidas." }, { status: 400 });
  }

  if ((lat == null || lng == null) && localCliente) {
    try {
      const details = await geocodeAddressDetails({ address: `${localCliente}, RJ, Brasil` });
      lat = details.location.lat;
      lng = details.location.lng;
      if (!cidade && details.cidade) cidade = details.cidade;
      if (!localCliente && details.formattedAddress) localCliente = details.formattedAddress;
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Falha ao geocodificar endereço." },
        { status: 400 },
      );
    }
  }

  if (lat != null && lng != null && !cidade) {
    try {
      const details = await reverseGeocodeCoords({ lat, lng });
      if (details.cidade) cidade = details.cidade;
      if (!localCliente && details.formattedAddress) localCliente = details.formattedAddress;
    } catch {
      cidade = defaultCity;
    }
  }

  if (!cidade) cidade = defaultCity;
  if (!localCliente) localCliente = "Localização selecionada";
  if (lat == null || lng == null) {
    return NextResponse.json({ error: "Informe o endereço ou selecione no mapa." }, { status: 400 });
  }

  const supabaseAdmin = createSupabaseAdminClient();

  const { data: reqRow, error: reqErr } = await supabaseAdmin
    .from("tow_requests")
    .insert({
      cliente_id: user.id,
      local_cliente: localCliente,
      cidade,
      lat,
      lng,
      telefone_cliente: telefone,
      modelo_veiculo: modeloVeiculo,
      status: "PENDENTE",
    })
    .select("id,local_cliente,cidade,lat,lng")
    .single();

  if (reqErr) {
    return NextResponse.json({ error: reqErr.message }, { status: 500 });
  }

  const { data: partners, error: partnersErr } = await supabaseAdmin
    .from("tow_partners")
    .select("id,empresa_nome,cidade,lat,lng,whatsapp_number,ativo")
    .eq("ativo", true)
    .eq("cidade", cidade)
    .not("whatsapp_number", "is", null)
    .limit(50);

  if (partnersErr) {
    return NextResponse.json({ id: reqRow.id }, { status: 201 });
  }

  const origin = new URL(request.url).origin;
  const nearby = (partners ?? [])
    .filter((p) => typeof p.lat === "number" && typeof p.lng === "number")
    .map((p) => ({
      ...p,
      distanceKm: haversineKm(
        { lat: reqRow.lat, lng: reqRow.lng },
        { lat: p.lat as number, lng: p.lng as number },
      ),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 3);

  await Promise.allSettled(
    nearby.map((p) =>
      sendWhatsAppMessage({
        to: String(p.whatsapp_number),
        body:
          `🚨 Novo chamado ReboqueSOS\n` +
          `📍 Local: ${reqRow.local_cliente}\n` +
          `📌 Distância: ${p.distanceKm.toFixed(1)} km\n` +
          `🚗 Veículo: ${modeloVeiculo}\n` +
          `📞 Telefone: ${telefone}\n` +
          `Cliente: ${profile.nome}\n` +
          `Clique para enviar proposta: ${origin}/partner/requests/${reqRow.id}`,
      }),
    ),
  );

  return NextResponse.json({ id: reqRow.id }, { status: 201 });
}
