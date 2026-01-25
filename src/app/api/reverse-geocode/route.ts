import { NextResponse } from "next/server";

import { reverseGeocodeCoords } from "@/lib/google/geocode";

export async function POST(request: Request) {
  const body = (await request.json()) as { lat?: number; lng?: number };
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Coordenadas inválidas." }, { status: 400 });
  }

  try {
    const details = await reverseGeocodeCoords({ lat, lng });
    return NextResponse.json(
      {
        cidade: details.cidade,
        formattedAddress: details.formattedAddress,
      },
      { status: 200 },
    );
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao resolver localização." }, { status: 400 });
  }
}

