import { NextResponse } from "next/server";

import { getUserProfile } from "@/lib/auth/getProfile";
import { getRequiredEnv } from "@/lib/env";
import { requireUser } from "@/lib/auth/requireUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user_id?: number | string;
};

async function exchangeCode(params: { code: string; redirect_uri: string }) {
  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("client_id", getRequiredEnv("MERCADOPAGO_CLIENT_ID"));
  body.set("client_secret", getRequiredEnv("MERCADOPAGO_CLIENT_SECRET"));
  body.set("code", params.code);
  body.set("redirect_uri", params.redirect_uri);

  const res = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const text = await res.text();
  let json: TokenResponse | null = null;
  try {
    json = text ? (JSON.parse(text) as TokenResponse) : null;
  } catch {
    json = null;
  }
  return { res, json, text };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = String(url.searchParams.get("code") ?? "").trim();
  const state = String(url.searchParams.get("state") ?? "").trim();
  if (!code) return NextResponse.redirect(new URL("/partner?mp=error", url.origin));

  const cookies = request.headers.get("cookie") ?? "";
  const stateCookie = cookies
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("mp_oauth_state="));
  const expected = stateCookie ? decodeURIComponent(stateCookie.split("=").slice(1).join("=")) : "";
  if (!expected || !state || expected !== state) {
    return NextResponse.redirect(new URL("/partner?mp=invalid_state", url.origin));
  }

  const user = await requireUser();
  if (!user) return NextResponse.redirect(new URL("/login", url.origin));

  const profile = await getUserProfile(user.id);
  if (!profile || (profile.role !== "reboque" && profile.role !== "admin")) {
    return NextResponse.redirect(new URL("/partner?mp=forbidden", url.origin));
  }

  const rawRedirectUri = getRequiredEnv("MERCADOPAGO_REDIRECT_URI");
  const redirectUri = rawRedirectUri.startsWith("http") ? rawRedirectUri : `${url.origin}${rawRedirectUri}`;

  const { res, json } = await exchangeCode({ code, redirect_uri: redirectUri });
  if (!res.ok || !json?.access_token || !json?.refresh_token || !json?.user_id) {
    return NextResponse.redirect(new URL("/partner?mp=error", url.origin));
  }

  const expiresIn = Number(json.expires_in ?? 0);
  const expiresAt = expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

  const supabaseAdmin = createSupabaseAdminClient();
  await supabaseAdmin
    .from("tow_partners")
    .update({
      mp_user_id: String(json.user_id),
      mp_access_token: String(json.access_token),
      mp_refresh_token: String(json.refresh_token),
      mp_token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  const resp = NextResponse.redirect(new URL("/partner?mp=connected", url.origin));
  resp.headers.set("Set-Cookie", "mp_oauth_state=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax");
  return resp;
}

