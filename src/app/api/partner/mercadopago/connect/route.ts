import { NextResponse } from "next/server";

import crypto from "node:crypto";

import { getUserProfile } from "@/lib/auth/getProfile";
import { getRequiredEnv } from "@/lib/env";
import { requireUser } from "@/lib/auth/requireUser";

export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const profile = await getUserProfile(user.id);
  if (!profile || (profile.role !== "reboque" && profile.role !== "admin")) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const origin = new URL(request.url).origin;
  const redirectUri = getRequiredEnv("MERCADOPAGO_REDIRECT_URI");
  const clientId = getRequiredEnv("MERCADOPAGO_CLIENT_ID");

  const state = crypto.randomBytes(18).toString("hex");
  const cookie = `mp_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=900`;

  const url = new URL("https://auth.mercadopago.com.br/authorization");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("platform_id", "mp");
  url.searchParams.set("redirect_uri", redirectUri.startsWith("http") ? redirectUri : `${origin}${redirectUri}`);
  url.searchParams.set("state", state);

  const res = NextResponse.json({ url: url.toString() }, { status: 200 });
  res.headers.set("Set-Cookie", cookie);
  return res;
}

