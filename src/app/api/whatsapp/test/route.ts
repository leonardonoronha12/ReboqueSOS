import { NextResponse } from "next/server";

import { sendWhatsAppMessage } from "@/lib/whatsapp/sendWhatsApp";

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Disponível apenas em desenvolvimento." }, { status: 403 });
  }

  let body: { to?: string; body?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const to = String(body.to ?? "");
  const message = String(body.body ?? "");
  if (!to || !message) {
    return NextResponse.json({ error: "Informe { to, body }." }, { status: 400 });
  }

  try {
    await sendWhatsAppMessage({ to, body: message });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Falha ao enviar WhatsApp." }, { status: 500 });
  }
}

