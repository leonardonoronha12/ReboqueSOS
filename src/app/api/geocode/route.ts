import { NextResponse } from "next/server";

import { geocodeAddressDetails } from "@/lib/google/geocode";

export async function POST(request: Request) {
  let body: { address?: string } = {};
  try {
    body = (await request.json()) as { address?: string };
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const address = String(body.address ?? "").trim();
  if (!address) return NextResponse.json({ error: "Endereço inválido." }, { status: 400 });

  try {
    const details = await geocodeAddressDetails({ address });
    return NextResponse.json(
      {
        location: details.location,
        formattedAddress: details.formattedAddress,
        cidade: details.cidade,
      },
      { status: 200 },
    );
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao geocodificar." }, { status: 400 });
  }
}
